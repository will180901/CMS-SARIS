/**
 * SyncClientService — client de synchronisation, actif UNIQUEMENT dans le backend
 * embarqué (poste local SQLite). Dialogue avec le serveur central via /sync/pull et
 * /sync/push, applique les deltas localement (réutilise SyncService.ingest), et tient
 * le curseur local (modèle SyncState).
 *
 * Config (env, posée par Electron au lancement du backend embarqué) :
 *   DATABASE_PROVIDER=sqlite, SERVER_URL, SERVER_SYNC_TOKEN (JWT), POSTE_LOCAL_ID, SITE_ID.
 *
 * ⚠️ Validation runtime requise (serveur joignable + base) : auth de service (token),
 * ordre d'application FK, gros volumes. Le code ci-dessous est typé/structuré ;
 * comportement à valider en environnement.
 */
import fs from 'node:fs'
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { SyncService } from './sync.service'
import {
  NotificationService,
  type NotifRow,
} from '../notification/notification.service'
import type {
  SyncPullResponseV2,
  SyncPushResponseV2,
  SyncEntityEnvelope,
} from '@cms-saris/types/sync'

interface SyncStateDelegate {
  findUnique: (a: unknown) => Promise<{
    lastPulledAt?: Date | null
    lastPushedAt?: Date | null
  } | null>
  upsert: (a: unknown) => Promise<unknown>
}

/** Modèles porteurs de la messagerie (alignés sur `sync-models.ts`) : leur arrivée doit
 *  rafraîchir l'écran sans délai, mais SANS faire sonner de notification. */
const MODELES_MESSAGERIE = new Set([
  'Conversation',
  'ConversationParticipant',
  'Message',
  'MessageReaction',
  'MessageMasque',
  'MessagePieceJointe',
])

@Injectable()
export class SyncClientService implements OnApplicationBootstrap {
  private readonly logger = new Logger('SyncClient')
  private running = false
  private wasOnline = false
  private backoffMs = 0
  /** Passe à true après le 1er PULL réussi → le desktop peut ouvrir l'app (données prêtes). */
  private initialSyncDone = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: SyncService,
    private readonly notif: NotificationService,
  ) {}

  /**
   * Au démarrage du backend embarqué (mode local), lance une synchro initiale (non
   * bloquante) puis une synchro périodique. En mode serveur, `enabled` est faux → no-op.
   */
  onApplicationBootstrap(): void {
    if (!this.enabled) return
    // Synchro initiale au démarrage (non bloquante).
    setTimeout(() => void this.triggerSync('démarrage'), 1500)
    // SONDEUR DE JOIGNABILITÉ léger : déclenche une synchro INSTANTANÉE dès que le serveur
    // (re)devient joignable — internet OU serveur local/distant — sans attendre un cycle périodique.
    const probeSec = Number(process.env['SYNC_PROBE_SEC'] ?? '4')
    setInterval(() => void this.probe(), Math.max(2, probeSec) * 1000)
    // Filet de sécurité espacé : rattrape un éventuel changement non détecté par la sonde.
    const safetySec = Number(process.env['SYNC_SAFETY_SEC'] ?? '300')
    setInterval(
      () => void this.triggerSync('filet'),
      Math.max(60, safetySec) * 1000,
    )
    // Battement de vie : signale la présence du poste INDÉPENDAMMENT de toute donnée à
    // pousser — fait apparaître le poste dès l'installation et rend le statut en ligne
    // vivant (fenêtre ONLINE_WINDOW_MS = 90 s côté supervision, cf. sync-supervision.service).
    void this.heartbeat()
    const heartbeatSec = Number(process.env['SYNC_HEARTBEAT_SEC'] ?? '30')
    setInterval(() => void this.heartbeat(), Math.max(10, heartbeatSec) * 1000)
    // CANAL TEMPS RÉEL vers le central, séparé des cycles de synchronisation.
    void this.ecouterCloche()
  }

  private get libelle(): string {
    return process.env['POSTE_LIBELLE'] ?? ''
  }

  /** Battement de vie best-effort (jamais bloquant, jamais d'erreur remontée). */
  private async heartbeat(): Promise<void> {
    if (!this.enabled) return
    try {
      await fetch(`${this.serverUrl}/sync/heartbeat`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          posteLocalId: this.posteLocalId,
          libelle: this.libelle || undefined,
        }),
      })
    } catch {
      // best-effort — le prochain battement retentera
    }
  }

  /** Sonde la joignabilité du serveur ; sur la transition hors-ligne → EN LIGNE, lance une
   *  synchronisation IMMÉDIATE (reprise du travail en attente). */
  private async probe(): Promise<void> {
    const online = await this.isOnline()
    if (online && !this.wasOnline) {
      this.wasOnline = true
      this.logger.log(
        'Connexion au serveur détectée → synchronisation immédiate',
      )
      void this.triggerSync('reconnexion')
    } else if (!online) {
      this.wasOnline = false
    }
  }

  /** Déclenche un cycle (anti-recouvrement + backoff exponentiel borné sur échec/injoignable). */
  async triggerSync(raison: string): Promise<void> {
    if (this.running) return
    const r = await this.runCycle()
    if (r) {
      this.backoffMs = 0
      if (r.pulled || r.pushed || r.conflicts) {
        this.logger.log(
          `Synchro (${raison}) : ${r.pulled} reçu(s), ${r.pushed} envoyé(s), ${r.conflicts} conflit(s)`,
        )
      }
    } else if (this.enabled) {
      // Échec / serveur injoignable → nouvelle tentative après un backoff borné.
      this.backoffMs = Math.min(
        this.backoffMs ? this.backoffMs * 2 : 5000,
        60000,
      )
      setTimeout(() => void this.probe(), this.backoffMs)
    }
  }

  private get serverUrl(): string {
    return (process.env['SERVER_URL'] ?? '').replace(/\/+$/, '')
  }
  /**
   * Jeton d'accès (Bearer) pour la synchro. Priorité au FICHIER `SERVER_SYNC_TOKEN_FILE`
   * (relu à CHAQUE cycle) : le process Electron y écrit l'access token et le renouvelle
   * (rotation du refresh) SANS redémarrer ce backend. Repli sur l'env `SERVER_SYNC_TOKEN`.
   */
  private get token(): string {
    const file = process.env['SERVER_SYNC_TOKEN_FILE']
    if (file) {
      try {
        return fs.readFileSync(file, 'utf8').trim()
      } catch {
        /* pas encore écrit */
      }
    }
    return process.env['SERVER_SYNC_TOKEN'] ?? ''
  }
  private get posteLocalId(): string {
    return process.env['POSTE_LOCAL_ID'] ?? 'poste-local'
  }
  private get siteId(): string {
    return process.env['SITE_ID'] ?? ''
  }
  get enabled(): boolean {
    return (
      !!this.serverUrl &&
      process.env['DATABASE_PROVIDER'] === 'sqlite' &&
      !!this.siteId
    )
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    }
  }

  private get stateDelegate(): SyncStateDelegate {
    return (this.prisma as unknown as Record<string, SyncStateDelegate>)[
      'syncState'
    ]
  }

  private async cursor(): Promise<{
    lastPulledAt?: string
    lastPushedAt?: string
  }> {
    try {
      const row = await this.stateDelegate.findUnique({
        where: {
          posteLocalId_siteId: {
            posteLocalId: this.posteLocalId,
            siteId: this.siteId,
          },
        },
      })
      return {
        lastPulledAt: row?.lastPulledAt
          ? row.lastPulledAt.toISOString()
          : undefined,
        lastPushedAt: row?.lastPushedAt
          ? row.lastPushedAt.toISOString()
          : undefined,
      }
    } catch {
      return {}
    }
  }

  private async saveCursor(patch: {
    lastPulledAt?: Date
    lastPushedAt?: Date
  }): Promise<void> {
    await this.stateDelegate.upsert({
      where: {
        posteLocalId_siteId: {
          posteLocalId: this.posteLocalId,
          siteId: this.siteId,
        },
      },
      create: {
        posteLocalId: this.posteLocalId,
        siteId: this.siteId,
        ...patch,
      },
      update: patch,
    })
  }

  /**
   * Serveur central joignable ?
   * PAS `/health` (racine) : c'est le healthCheckPath déclaré à Render (render.yaml),
   * qui peut y répondre 503 pendant une transition d'instance côté plateforme, sans
   * rapport avec la vraie disponibilité de l'API. `/health/ping` est un chemin dédié,
   * jamais sondé par Render — cf. useServerHealth.ts / main.ts (même correctif).
   */
  async isOnline(): Promise<boolean> {
    if (!this.serverUrl) return false
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 4000)
      const res = await fetch(`${this.serverUrl}/health/ping`, {
        signal: ctrl.signal,
      })
      clearTimeout(t)
      return res.ok
    } catch {
      return false
    }
  }

  /** PULL : récupère les deltas du serveur et les applique localement (LWW). Le serveur
   *  ordonne les changements PAR MODÈLE (dépendances d'abord : sites, référentiels, comptes,
   *  puis dossiers) → les FK sont satisfaites au fil de l'ingestion. */
  async pull(): Promise<number> {
    let since = (await this.cursor()).lastPulledAt
    let applied = 0
    // Premier chargement : le poste s'ouvre sur un écran d'attente pendant que les
    // données du site arrivent. Sans compteur, cet écran est un texte figé et l'on ne
    // sait pas si quelque chose se passe — on croit à un blocage et on ferme. On publie
    // donc l'avancement au fil de l'eau, pour que l'attente soit habitée.
    const premierChargement = !since
    let serverTime: string | undefined
    for (let guard = 0; guard < 1000; guard++) {
      // Le site est résolu par le serveur depuis le JWT (jamais envoyé dans l'URL).
      const url = `${this.serverUrl}/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ''}`
      const res = await fetch(url, { headers: this.headers() })
      if (!res.ok) throw new Error(`pull HTTP ${res.status}`)
      const body = (await res.json()) as SyncPullResponseV2
      for (const env of body.changes) {
        const r = await this.sync.ingest(env)
        if (r.applied) {
          applied++
          this.rediffuser(env)
        }
      }
      serverTime = body.serverTime
      since = body.nextSince
      if (premierChargement) this.premierChargementRecus = applied
      // Reprise incrémentale : on persiste le curseur APRÈS chaque page appliquée, pour
      // reprendre EXACTEMENT là où on s'est arrêté en cas d'interruption (réseau coupé).
      if (body.nextSince)
        await this.saveCursor({ lastPulledAt: new Date(body.nextSince) })
      if (!body.hasMore) break
    }
    if (serverTime)
      await this.saveCursor({ lastPulledAt: new Date(serverTime) })
    return applied
  }

  /**
   * Rediffuse localement ce qui vient d'arriver par la synchronisation.
   *
   * Le moteur écrit directement en base : sans cette étape, une notification ou un message
   * venu d'un autre poste attendait le prochain rafraîchissement de l'écran. C'est le
   * dernier maillon de la chaîne temps réel — sonnette, synchro, puis affichage.
   *
   * Deux traitements, parce que les deux cas ne se ressemblent pas :
   *  - une NOTIFICATION est rediffusée telle quelle : le flux local applique déjà ses
   *    règles de visibilité à l'abonnement, on n'en réimplémente pas une deuxième ;
   *  - la MESSAGERIE reçoit un signal silencieux `LIVE_MESSAGERIE` (ni cloche, ni son,
   *    ni bandeau) qui invite simplement l'écran à recharger ses conversations. Rediffuser
   *    le message lui-même ferait sonner une notification pour chaque ligne synchronisée,
   *    y compris ses propres messages relus — insupportable à l'usage.
   */
  private rediffuser(env: SyncEntityEnvelope): void {
    try {
      if (env.op === 'delete') return
      if (env.model === 'Notification') {
        this.notif.rediffuserDepuisSynchro(env.data as unknown as NotifRow)
        return
      }
      if (MODELES_MESSAGERIE.has(env.model)) {
        this.notif.broadcastLive('LIVE_MESSAGERIE')
      }
    } catch (e) {
      // L'affichage temps réel est un confort : il ne doit JAMAIS faire échouer une
      // ingestion. Une donnée bien enregistrée qui s'affiche une seconde plus tard vaut
      // infiniment mieux qu'une synchronisation interrompue.
      this.logger.warn(`Rediffusion ignorée : ${(e as Error).message}`)
    }
  }

  /**
   * SONNETTE : écoute permanente du canal temps réel du serveur central.
   *
   * Pourquoi ce canal EN PLUS de la synchronisation : la synchro travaille par cycles.
   * Entre deux cycles, un message envoyé depuis un autre poste attend. Pour une
   * messagerie, attendre c'est être cassé. Le central sonne, le poste synchronise
   * immédiatement — le délai tombe du cycle à la milliseconde.
   *
   * Le canal ne transporte aucune donnée : il ne fait que réveiller. Toute la sécurité
   * reste dans /sync/pull, qui n'a pas changé.
   *
   * Robustesse : reconnexion perpétuelle avec attente progressive plafonnée. Une coupure
   * réseau, un serveur qui redémarre ou une veille prolongée de la machine se soldent par
   * une reconnexion, jamais par un canal silencieusement mort — cas le plus dangereux,
   * puisqu'il donnerait une application qui semble marcher mais n'apprend plus rien.
   */
  private async ecouterCloche(): Promise<void> {
    let attente = 0
    for (;;) {
      try {
        const url = `${this.serverUrl}/sync/events?posteLocalId=${encodeURIComponent(this.posteLocalId)}`
        const res = await fetch(url, {
          headers: { ...this.headers(), Accept: 'text/event-stream' },
        })
        if (!res.ok || !res.body) throw new Error(`cloche HTTP ${res.status}`)
        this.logger.log('Canal temps réel ouvert vers le serveur central')
        attente = 0
        const lecteur = res.body.getReader()
        const decodeur = new TextDecoder()
        // TAMPON OBLIGATOIRE. Un flux SSE n'arrive PAS découpé en événements : il arrive
        // découpé en paquets réseau. Une trame peut être coupée n'importe où — y compris
        // au milieu du mot « sync » — puis reprise dans le paquet suivant. Chercher le mot
        // dans chaque paquet pris isolément fait donc MANQUER des sonneries, précisément
        // le silence que ce canal existe pour empêcher.
        //
        // On accumule donc, et on ne juge que des événements COMPLETS, délimités par la
        // ligne vide du protocole.
        let tampon = ''
        for (;;) {
          const { done, value } = await lecteur.read()
          if (done) break
          if (!value?.length) continue
          tampon += decodeur.decode(value, { stream: true })

          // Découpage sur le séparateur d'événements SSE (ligne vide). Le dernier morceau
          // est un reliquat éventuellement incomplet : il repart dans le tampon.
          const morceaux = tampon.split(/\r?\n\r?\n/)
          tampon = morceaux.pop() ?? ''

          // Garde-fou : un serveur défaillant qui enverrait un flot continu sans jamais
          // délimiter d'événement ferait grossir ce tampon sans fin. On le borne.
          if (tampon.length > 64 * 1024) tampon = ''

          for (const evenement of morceaux) {
            // On ne synchronise QUE sur une vraie sonnerie. Le canal porte aussi un
            // battement de vie, destiné aux intermédiaires réseau : le confondre avec une
            // sonnerie ferait synchroniser tout le parc toutes les 25 secondes — soit
            // exactement l'interrogation périodique que ce canal remplace.
            if (evenement.includes('"sync"')) void this.triggerSync('temps réel')
          }
        }
        throw new Error('canal fermé par le serveur')
      } catch (e) {
        // Hors-ligne, c'est le cas NORMAL : on n'inonde pas le journal. Le canal se
        // rétablira tout seul, et la synchronisation périodique prend le relais entre-temps.
        this.logger.debug?.(`Canal temps réel indisponible : ${(e as Error).message}`)
        attente = Math.min(attente ? attente * 2 : 3000, 60000)
        await new Promise((r) => setTimeout(r, attente))
      }
    }
  }

  /**
   * Reste-t-il des écritures locales non remontées ?
   *
   * Sert au processus Electron pour décider quand rendre la main au serveur central
   * après une reconnexion : tant que ce poste a du travail à remonter, l'afficher
   * depuis le central montrerait à l'utilisateur une vue AMPUTÉE de ce qu'il vient
   * de saisir hors-ligne — il le croirait perdu, et le ressaisirait.
   *
   * Volontairement bon marché : une page d'UN élément suffit à répondre par oui ou non,
   * là où `push()` énumère tout. Appelé toutes les 5 s, ça compte.
   */
  async hasPendingPush(): Promise<boolean> {
    if (!this.enabled) return false
    try {
      const { lastPushedAt } = await this.cursor()
      const page = await this.sync.pull(this.siteId, lastPushedAt, 1)
      return page.changes.length > 0
    } catch {
      // Base locale illisible : on ne peut pas affirmer que tout est remonté.
      // Prudence — on répond « il reste quelque chose » plutôt que de risquer une
      // bascule prématurée vers le central.
      return true
    }
  }

  /** PUSH : envoie au serveur les changements locaux depuis le dernier push. */
  async push(): Promise<SyncPushResponseV2 | null> {
    const { lastPushedAt } = await this.cursor()
    const collected: SyncEntityEnvelope[] = []
    let since = lastPushedAt
    for (let guard = 0; guard < 1000; guard++) {
      const page = await this.sync.pull(this.siteId, since, 500) // base locale = un seul site
      collected.push(...page.changes)
      since = page.nextSince
      if (!page.hasMore) break
    }
    if (!collected.length) return null
    const res = await fetch(`${this.serverUrl}/sync/push`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        posteLocalId: this.posteLocalId,
        changes: collected,
      }),
    })
    if (!res.ok) throw new Error(`push HTTP ${res.status}`)
    const out = (await res.json()) as SyncPushResponseV2
    await this.saveCursor({ lastPushedAt: new Date(out.serverTime) })
    return out
  }

  /** Données initiales prêtes ? true si la synchro n'est pas active (mode serveur) OU si le
   *  1er pull a abouti. Le desktop attend `ready` avant d'ouvrir l'app (ouverture fluide). */
  get ready(): boolean {
    return !this.enabled || this.initialSyncDone
  }

  /** Un cycle de synchronisation est-il en cours ? Affiché en direct par l'application
   *  (bulle de synchronisation) : sans cela, la synchro est un travail invisible et l'on
   *  ne sait jamais si les données sont à jour ou en train de l'être. */
  get enCours(): boolean {
    return this.running
  }

  /** Enregistrements reçus pendant le TOUT PREMIER chargement — publié page par page,
   *  pour que l'écran d'attente affiche un compteur qui avance au lieu d'un texte figé. */
  private premierChargementRecus = 0
  get recusPremierChargement(): number {
    return this.premierChargementRecus
  }

  /** État de synchro pour l'UI (mode local). */
  async clientStatus(): Promise<{
    enabled: boolean
    online: boolean
    ready: boolean
    lastPulledAt?: string
    lastPushedAt?: string
  }> {
    const c = await this.cursor()
    return {
      enabled: this.enabled,
      online: this.enabled ? await this.isOnline() : false,
      ready: this.ready,
      ...c,
    }
  }

  /** Cycle complet : pull (minimise les conflits) PUIS push. Best-effort, non bloquant. */
  async runCycle(): Promise<{
    pulled: number
    pushed: number
    conflicts: number
  } | null> {
    if (!this.enabled || this.running) return null
    if (!(await this.isOnline())) return null
    this.running = true
    try {
      const pulled = await this.pull()
      this.initialSyncDone = true // 1er pull abouti → données initiales en place
      const out = await this.push()
      return {
        pulled,
        pushed: out?.applied.length ?? 0,
        conflicts: out?.conflicts.length ?? 0,
      }
    } catch (e) {
      const err = e as Error
      this.logger.error(
        'cycle de synchronisation échoué : ' + (err.message || String(e)),
        err.stack,
      )
      return null
    } finally {
      this.running = false
    }
  }
}
