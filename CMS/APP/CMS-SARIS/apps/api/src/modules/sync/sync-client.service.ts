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
import { raisonRejet, estRejetDefinitif } from './conflict'
import {
  CURSEUR_ORIGINE,
  NIVEAU_CONTROLE,
  PosteSuspenduError,
  lireMode,
  lireOrdres,
  refusDeSuspension,
  resyncAEngager,
  type OrdresServeur,
} from './sync-controle'
import { CLE_MODE, type ModeSysteme } from '../systeme/mode-systeme'
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
  /**
   * Verrou d'exclusion des cycles, pris AVANT le moindre `await`. Distinct de `running`, que
   * l'interface affiche (« synchronisation en cours ») : tant que le serveur n'est pas confirmé
   * joignable, rien ne doit s'afficher « en cours ».
   *
   * Avant, l'exclusion reposait sur `running`, posé seulement APRÈS la vérification de
   * joignabilité (un `await`) : deux déclencheurs simultanés — la sonnette temps réel et la
   * réponse d'un battement de vie — passaient tous deux et poussaient le MÊME lot en parallèle
   * (deux échanges inscrits au journal du central, à 2 ms d'écart).
   */
  private verrou = false
  private wasOnline = false
  private backoffMs = 0
  /** Passe à true après le 1er PULL réussi → le desktop peut ouvrir l'app (données prêtes). */
  private initialSyncDone = false

  // ── Ordres du serveur (contrôle du flux) ────────────────────────────────────
  /** Échanges SUSPENDUS par un administrateur — appris par un battement de vie, ou par un
   *  refus du serveur. Le poste cesse alors d'essayer et garde son travail en local. */
  private suspendu = false
  private motifSuspension: string | null = null
  /** Resynchronisation complète demandée par le serveur et pas encore accusée (date ISO de
   *  la demande). Tant qu'elle est là, le poste dit à l'interface qu'il se resynchronise. */
  private resyncDemande: string | null = null
  /** Dernière demande accomplie ET accusée : on ne refait jamais la même, même si le serveur
   *  tarde à l'effacer de son côté. */
  private resyncAccomplie: string | null = null
  /** Le curseur de réception sera remis à zéro au prochain cycle. Fait SOUS le verrou
   *  `running` : une remise à zéro faite pendant un cycle en route serait écrasée par la fin
   *  de ce cycle, et la resynchronisation n'aurait jamais lieu. */
  private resyncReinitPrevue = false
  /** Le cycle en cours (ou le prochain) repart de zéro : à son terme, la demande est accusée. */
  private resyncPullDepuisZero = false
  /** Mode du système (production / test) tel que le serveur central l'a annoncé. */
  private modeConnu: ModeSysteme | null = null

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

  /** Version de l'application, annoncée au serveur (supervision du parc). Posée par le
   *  process Electron ; vide en développement. */
  private get versionApp(): string {
    return process.env['APP_VERSION'] ?? ''
  }

  /**
   * Battement de vie best-effort (jamais bloquant, jamais d'erreur remontée).
   *
   * Il porte aussi le NIVEAU des ordres que ce poste comprend, et sa VERSION : c'est ce qui
   * permet à l'administrateur de ne se voir offrir que des boutons qui ont un effet sur ce
   * poste. En retour, le serveur y glisse ses ordres (suspension, resynchronisation).
   */
  private async heartbeat(): Promise<void> {
    if (!this.enabled) return
    try {
      const res = await fetch(`${this.serverUrl}/sync/heartbeat`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          posteLocalId: this.posteLocalId,
          libelle: this.libelle || undefined,
          versionApp: this.versionApp || undefined,
          niveauControle: NIVEAU_CONTROLE,
        }),
      })
      if (res.ok) {
        const corps: unknown = await res.json().catch(() => null)
        this.appliquerOrdres(lireOrdres(corps))
        await this.memoriserMode(lireMode(corps))
      }
    } catch {
      // best-effort — le prochain battement retentera
    }
  }

  /**
   * Applique les ordres du serveur. `null` = aucune information : on ne change rien.
   *
   * Suspension : on s'arrête sans bruit et on le dit à l'interface. À la LEVÉE, on
   * rattrape tout de suite plutôt que d'attendre un cycle périodique.
   * Resynchronisation : on la planifie — la remise à zéro du curseur se fera au prochain
   * cycle, sous le verrou (cf. `resyncReinitPrevue`).
   */
  private appliquerOrdres(ordres: OrdresServeur | null): void {
    if (!ordres) return
    const etaitSuspendu = this.suspendu
    this.suspendu = ordres.suspendu
    this.motifSuspension = ordres.suspendu ? ordres.motif : null
    if (ordres.suspendu && !etaitSuspendu)
      this.logger.warn(
        `Échanges suspendus par un administrateur${ordres.motif ? ` — ${ordres.motif}` : ''} : le poste garde son travail en local.`,
      )
    if (!ordres.suspendu && etaitSuspendu) {
      this.logger.log('Échanges rétablis par le serveur → rattrapage immédiat')
      void this.triggerSync('reprise après suspension')
    }
    if (resyncAEngager(ordres, this.resyncDemande ?? this.resyncAccomplie)) {
      this.logger.log(
        `Resynchronisation complète demandée par le serveur (${ordres.resyncDemandeeAt})`,
      )
      this.resyncDemande = ordres.resyncDemandeeAt
      this.resyncReinitPrevue = true
      void this.triggerSync('resynchronisation complète')
    }
  }

  /**
   * Range le mode du système annoncé par le serveur dans la base LOCALE (ligne réservée de
   * `ParametreSysteme`, non synchronisée) : l'interface du poste lit ainsi le même endpoint que le
   * web, et affiche le même bandeau « MODE TEST ». Sans effet si rien ne change.
   */
  private async memoriserMode(mode: ModeSysteme | null): Promise<void> {
    if (!mode || mode === this.modeConnu) return
    try {
      await this.prisma.parametreSysteme.upsert({
        where: { cle: CLE_MODE },
        update: { valeur: mode },
        create: { cle: CLE_MODE, valeur: mode },
      })
      this.modeConnu = mode
      this.logger.log(
        `Mode du système : ${mode} (annoncé par le serveur central)`,
      )
    } catch (e) {
      // Un mode non rangé n'empêche rien : le prochain battement réessaiera.
      this.logger.warn(
        `Mode du système non enregistré : ${(e as Error).message}`,
      )
    }
  }

  private marquerSuspendu(motif: string | null): void {
    if (!this.suspendu)
      this.logger.warn(
        `Échanges suspendus par un administrateur${motif ? ` — ${motif}` : ''} : le poste garde son travail en local.`,
      )
    this.suspendu = true
    this.motifSuspension = motif
  }

  /** Dit au serveur que la resynchronisation complète est faite. Vrai si c'est acquis. */
  private async accuserResync(demandeeAt: string): Promise<boolean> {
    try {
      const res = await fetch(
        `${this.serverUrl}/sync/poste/${encodeURIComponent(this.posteLocalId)}/resync-terminee`,
        {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({ demandeeAt }),
        },
      )
      return res.ok
    } catch {
      return false
    }
  }

  /** Erreur d'une réponse HTTP refusée : une SUSPENSION n'est pas une panne. */
  private async erreurHttp(nom: string, res: Response): Promise<Error> {
    if (res.status === 423) {
      const suspension = refusDeSuspension(
        res.status,
        await res.json().catch(() => null),
      )
      if (suspension) return suspension
    }
    return new Error(`${nom} HTTP ${res.status}`)
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
    // Suspendu : on n'insiste pas. Le battement de vie dira quand c'est levé.
    if (this.verrou || this.suspendu) return
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
      // Le poste dit qui il est : c'est ce qui permet au serveur de refuser un poste suspendu
      // aussi à la RÉCEPTION (pas seulement à l'envoi).
      const url = `${this.serverUrl}/sync/pull?posteLocalId=${encodeURIComponent(this.posteLocalId)}${since ? `&since=${encodeURIComponent(since)}` : ''}`
      const res = await fetch(url, { headers: this.headers() })
      if (!res.ok) throw await this.erreurHttp('pull', res)
      const body = (await res.json()) as SyncPullResponseV2
      for (const env of body.changes) {
        // UN changement inapplicable ne doit jamais figer la synchronisation. Avant, une
        // seule erreur (fiche créée hors ligne en double sur ce poste…) faisait échouer le
        // pull entier ; le push n'était même pas tenté, et plus rien ne circulait.
        try {
          const r = await this.sync.ingest(env)
          if (r.applied) {
            applied++
            this.rediffuser(env)
          }
        } catch (e) {
          // Passagère : on interrompt comme avant — le curseur n'avance pas, le prochain
          // cycle réessaiera cette page. Seule une erreur définitive est mise de côté.
          if (!estRejetDefinitif(e)) throw e
          this.rejetsPull++
          this.logger.warn(
            `pull: ${env.model} ${env.id} ignoré — ${raisonRejet(e)}`,
          )
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

  /** Changements reçus du central mais inapplicables ici (journalisés), depuis le démarrage. */
  private rejetsPull = 0

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
    if (!res.ok) throw await this.erreurHttp('push', res)
    const out = (await res.json()) as SyncPushResponseV2
    // Les refus sont en QUARANTAINE au central (supervision, avec la donnée du poste) : le
    // curseur peut avancer sans rien perdre, et le reste du lot n'attend plus.
    if (out.rejected?.length) {
      this.logger.warn(
        `push: ${out.rejected.length} changement(s) refusé(s) par le central, en quarantaine — ` +
          out.rejected.map((r) => `${r.model} ${r.id} (${r.raison})`).join(' ; '),
      )
    }
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
    /** Changements du central ignorés ici depuis le démarrage (cf. journal du poste). */
    rejetsPull: number
    /** Échanges suspendus par un administrateur, et son motif éventuel. */
    suspendu: boolean
    motifSuspension: string | null
    /** Une resynchronisation complète est en cours ou attendue. */
    resyncEnCours: boolean
  }> {
    const c = await this.cursor()
    return {
      enabled: this.enabled,
      online: this.enabled ? await this.isOnline() : false,
      ready: this.ready,
      ...c,
      rejetsPull: this.rejetsPull,
      ...this.etatControle,
    }
  }

  /** Ce que l'interface du poste doit savoir des ordres du serveur (bulle, carte de synchro). */
  get etatControle(): {
    suspendu: boolean
    motifSuspension: string | null
    resyncEnCours: boolean
  } {
    return {
      suspendu: this.suspendu,
      motifSuspension: this.motifSuspension,
      resyncEnCours: this.resyncDemande !== null,
    }
  }

  /** Cycle complet : pull (minimise les conflits) PUIS push. Best-effort, non bloquant. */
  async runCycle(): Promise<{
    pulled: number
    pushed: number
    conflicts: number
  } | null> {
    if (!this.enabled || this.verrou || this.suspendu) return null
    this.verrou = true
    try {
      if (!(await this.isOnline())) return null
      return await this.cycle()
    } finally {
      this.verrou = false
    }
  }

  /** Le cycle lui-même, serveur déjà reconnu joignable : `running` n'est vrai que pendant son travail. */
  private async cycle(): Promise<{
    pulled: number
    pushed: number
    conflicts: number
  } | null> {
    this.running = true
    try {
      // Resynchronisation complète demandée : on repart de zéro. Le curseur d'ENVOI reste
      // intact — ce que le poste n'a pas encore envoyé part ensuite, rien n'est perdu — et la
      // réception ne supprime jamais rien de local : elle ne fait que combler ce qui manque.
      if (this.resyncReinitPrevue) {
        await this.saveCursor({ lastPulledAt: CURSEUR_ORIGINE })
        this.resyncReinitPrevue = false
        this.resyncPullDepuisZero = true
      }
      const pulled = await this.pull()
      this.initialSyncDone = true // 1er pull abouti → données initiales en place
      // Réception complète terminée : on l'accuse. Si l'accusé n'est pas acquis (réseau), il
      // est retenté au prochain cycle — la demande reste « en cours » côté poste.
      if (this.resyncPullDepuisZero && this.resyncDemande) {
        if (await this.accuserResync(this.resyncDemande)) {
          this.logger.log('Resynchronisation complète terminée, accusée au serveur')
          this.resyncAccomplie = this.resyncDemande
          this.resyncDemande = null
          this.resyncPullDepuisZero = false
        }
      }
      const out = await this.push()
      return {
        pulled,
        pushed: out?.applied.length ?? 0,
        conflicts: out?.conflicts.length ?? 0,
      }
    } catch (e) {
      // Une suspension n'est pas une panne : pas de trace d'erreur, et on cesse d'insister.
      if (e instanceof PosteSuspenduError) {
        this.marquerSuspendu(e.motif)
        return null
      }
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
