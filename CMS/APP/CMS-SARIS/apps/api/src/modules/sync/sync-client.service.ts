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
import type { SyncPullResponseV2, SyncPushResponseV2, SyncEntityEnvelope } from '@cms-saris/types/sync'

interface SyncStateDelegate {
  findUnique: (a: unknown) => Promise<{ lastPulledAt?: Date | null; lastPushedAt?: Date | null } | null>
  upsert: (a: unknown) => Promise<unknown>
}

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
    setInterval(() => void this.triggerSync('filet'), Math.max(60, safetySec) * 1000)
  }

  /** Sonde la joignabilité du serveur ; sur la transition hors-ligne → EN LIGNE, lance une
   *  synchronisation IMMÉDIATE (reprise du travail en attente). */
  private async probe(): Promise<void> {
    const online = await this.isOnline()
    if (online && !this.wasOnline) {
      this.wasOnline = true
      this.logger.log('Connexion au serveur détectée → synchronisation immédiate')
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
        this.logger.log(`Synchro (${raison}) : ${r.pulled} reçu(s), ${r.pushed} envoyé(s), ${r.conflicts} conflit(s)`)
      }
    } else if (this.enabled) {
      // Échec / serveur injoignable → nouvelle tentative après un backoff borné.
      this.backoffMs = Math.min(this.backoffMs ? this.backoffMs * 2 : 5000, 60000)
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
      try { return fs.readFileSync(file, 'utf8').trim() } catch { /* pas encore écrit */ }
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
    return !!this.serverUrl && process.env['DATABASE_PROVIDER'] === 'sqlite' && !!this.siteId
  }

  private headers(): Record<string, string> {
    return { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) }
  }

  private get stateDelegate(): SyncStateDelegate {
    return (this.prisma as unknown as Record<string, SyncStateDelegate>)['syncState']
  }

  private async cursor(): Promise<{ lastPulledAt?: string; lastPushedAt?: string }> {
    try {
      const row = await this.stateDelegate.findUnique({
        where: { posteLocalId_siteId: { posteLocalId: this.posteLocalId, siteId: this.siteId } },
      })
      return {
        lastPulledAt: row?.lastPulledAt ? row.lastPulledAt.toISOString() : undefined,
        lastPushedAt: row?.lastPushedAt ? row.lastPushedAt.toISOString() : undefined,
      }
    } catch {
      return {}
    }
  }

  private async saveCursor(patch: { lastPulledAt?: Date; lastPushedAt?: Date }): Promise<void> {
    await this.stateDelegate.upsert({
      where: { posteLocalId_siteId: { posteLocalId: this.posteLocalId, siteId: this.siteId } },
      create: { posteLocalId: this.posteLocalId, siteId: this.siteId, ...patch },
      update: patch,
    })
  }

  /** Serveur central joignable ? */
  async isOnline(): Promise<boolean> {
    if (!this.serverUrl) return false
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 4000)
      const res = await fetch(`${this.serverUrl}/health`, { signal: ctrl.signal })
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
    let serverTime: string | undefined
    for (let guard = 0; guard < 1000; guard++) {
      // Le site est résolu par le serveur depuis le JWT (jamais envoyé dans l'URL).
      const url = `${this.serverUrl}/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ''}`
      const res = await fetch(url, { headers: this.headers() })
      if (!res.ok) throw new Error(`pull HTTP ${res.status}`)
      const body = (await res.json()) as SyncPullResponseV2
      for (const env of body.changes) {
        const r = await this.sync.ingest(env)
        if (r.applied) applied++
      }
      serverTime = body.serverTime
      since = body.nextSince
      // Reprise incrémentale : on persiste le curseur APRÈS chaque page appliquée, pour
      // reprendre EXACTEMENT là où on s'est arrêté en cas d'interruption (réseau coupé).
      if (body.nextSince) await this.saveCursor({ lastPulledAt: new Date(body.nextSince) })
      if (!body.hasMore) break
    }
    if (serverTime) await this.saveCursor({ lastPulledAt: new Date(serverTime) })
    return applied
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
      body: JSON.stringify({ posteLocalId: this.posteLocalId, changes: collected }),
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

  /** État de synchro pour l'UI (mode local). */
  async clientStatus(): Promise<{ enabled: boolean; online: boolean; ready: boolean; lastPulledAt?: string; lastPushedAt?: string }> {
    const c = await this.cursor()
    return { enabled: this.enabled, online: this.enabled ? await this.isOnline() : false, ready: this.ready, ...c }
  }

  /** Cycle complet : pull (minimise les conflits) PUIS push. Best-effort, non bloquant. */
  async runCycle(): Promise<{ pulled: number; pushed: number; conflicts: number } | null> {
    if (!this.enabled || this.running) return null
    if (!(await this.isOnline())) return null
    this.running = true
    try {
      const pulled = await this.pull()
      this.initialSyncDone = true // 1er pull abouti → données initiales en place
      const out = await this.push()
      return { pulled, pushed: out?.applied.length ?? 0, conflicts: out?.conflicts.length ?? 0 }
    } catch (e) {
      const err = e as Error
      this.logger.error('cycle de synchronisation échoué : ' + (err.message || String(e)), err.stack)
      return null
    } finally {
      this.running = false
    }
  }
}
