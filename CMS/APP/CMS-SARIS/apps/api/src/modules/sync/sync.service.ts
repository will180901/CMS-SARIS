/**
 * SyncService — moteur de synchronisation offline-first.
 *
 *  - pull(siteId, since)        : deltas du site depuis `since` (tombstones inclus), paginés.
 *  - ingest(env)                : applique UN delta avec résolution de conflit LWW (réutilisé
 *                                 par le push serveur ET le pull du client embarqué).
 *  - push(siteId, changes)      : applique un lot, renvoie applied/skipped/conflicts.
 *  - applyEnvelope(def, env)    : upsert PUIS restaure l'updatedAt/deletedAt SOURCE via SQL
 *                                 brut (sinon `@updatedAt` ré-horodaterait → LWW cassé).
 *
 * ⚠️ Validation runtime requise (base + 2 postes) : ordre FK parent→enfant, chaînes de
 * scope (sync-models.ts), binding Date selon provider. Le point `@updatedAt` est, lui,
 * traité ici (restauration SQL) — à confirmer en base.
 */
import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { SYNC_MODELS, SYNC_MODEL_BY_NAME, type SyncModelDef } from './sync-models'
import { SOFT_DELETE_MODELS } from '../../prisma/soft-delete.extension'
import { resolveConflict, diffFields, type ConflictDecision } from './conflict'
import { SyncSupervisionService, type SyncConflictDetail } from './sync-supervision.service'
import type {
  SyncEntityEnvelope,
  SyncPullResponseV2,
  SyncPushResponseV2,
  SyncConflictReport,
  SyncStatusV2,
} from '@cms-saris/types/sync'

interface AnyDelegate {
  findMany: (a: unknown) => Promise<Array<Record<string, unknown>>>
  findUnique: (a: unknown) => Promise<Record<string, unknown> | null>
  upsert: (a: unknown) => Promise<unknown>
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger('Sync')
  constructor(
    private readonly prisma: PrismaService,
    private readonly supervision: SyncSupervisionService,
  ) {}

  private get isSqlite(): boolean {
    return process.env['DATABASE_PROVIDER'] === 'sqlite'
  }

  private delegate(name: string): AnyDelegate | undefined {
    // Client BRUT (non étendu soft-delete) : la synchro DOIT voir les tombstones et
    // écrire sans interception (upsert + restauration de l'updatedAt source).
    return (this.prisma.raw as unknown as Record<string, AnyDelegate>)[name]
  }

  private toIso(v: unknown): string {
    return v instanceof Date ? v.toISOString() : v ? String(v) : new Date(0).toISOString()
  }

  private toEnvelope(def: SyncModelDef, row: Record<string, unknown>): SyncEntityEnvelope {
    const deletedAt = row['deletedAt'] as Date | null | undefined
    return {
      model: def.model,
      id: def.idFields.map((f) => String(row[f])).join('::'),
      op: deletedAt ? 'delete' : 'upsert',
      data: row,
      updatedAt: this.toIso(row['updatedAt']),
      deletedAt: deletedAt ? this.toIso(deletedAt) : null,
    }
  }

  /** `where` de clé primaire (simple ou composite) construit depuis les données. */
  private keyWhere(def: SyncModelDef, data: Record<string, unknown>): Record<string, unknown> {
    if (def.idFields.length === 1) return { [def.idFields[0]!]: data[def.idFields[0]!] }
    const compound: Record<string, unknown> = {}
    for (const f of def.idFields) compound[f] = data[f]
    return { [def.idFields.join('_')]: compound }
  }

  // ── PULL ────────────────────────────────────────────────────────────────────
  /** Deltas du site depuis `since` (tombstones inclus, scope par site, paginé). */
  async pull(siteId: string, since: string | undefined, limit = 500): Promise<SyncPullResponseV2> {
    const sinceDate = since ? new Date(since) : new Date(0)
    const serverTime = new Date()
    const changes: SyncEntityEnvelope[] = []
    let hasMore = false

    for (const def of SYNC_MODELS) {
      const delegate = this.delegate(def.delegate)
      if (!delegate?.findMany) continue
      // `deletedAt: undefined` neutralise l'auto-filtre soft-delete → tombstones inclus.
      try {
        const rows = await delegate.findMany({
          where: { ...def.scopeWhere(siteId), updatedAt: { gt: sinceDate }, deletedAt: undefined },
          orderBy: { updatedAt: 'asc' },
          take: limit + 1,
        })
        if (rows.length > limit) {
          hasMore = true
          rows.length = limit
        }
        for (const r of rows) changes.push(this.toEnvelope(def, r))
      } catch (e) {
        // Un modèle au scope invalide ne doit pas casser toute la synchro : on l'ignore + log.
        this.logger.warn(`pull: modèle ${def.model} ignoré — ${(e as Error).message.split('\n')[0]}`)
      }
    }

    // On NE trie PAS par updatedAt : on conserve l'ordre du registre (parents avant enfants)
    // pour que l'application côté client respecte les contraintes de clés étrangères.
    // Le curseur = le plus grand updatedAt du lot (sinon l'heure serveur).
    let maxUpdated = ''
    for (const c of changes) if (c.updatedAt > maxUpdated) maxUpdated = c.updatedAt
    const nextSince = maxUpdated || serverTime.toISOString()
    return { changes, serverTime: serverTime.toISOString(), hasMore, nextSince }
  }

  // ── INGEST (1 delta) — partagé push serveur / pull client ───────────────────
  async ingest(env: SyncEntityEnvelope): Promise<{ decision: ConflictDecision; applied: boolean }> {
    const def = SYNC_MODEL_BY_NAME.get(env.model)
    const delegate = def && this.delegate(def.delegate)
    if (!def || !delegate) return { decision: { kind: 'skip' }, applied: false }

    const existingRow = await delegate.findUnique({ where: this.keyWhere(def, env.data) })
    const existing = existingRow
      ? {
          updatedAt: this.toIso(existingRow['updatedAt']),
          deletedAt: existingRow['deletedAt'] ? this.toIso(existingRow['deletedAt']) : null,
        }
      : null

    const decision = resolveConflict(
      { updatedAt: env.updatedAt, deletedAt: env.deletedAt, baseUpdatedAt: env.baseUpdatedAt },
      existing,
    )
    const winnerIncoming = decision.kind === 'apply' || (decision.kind === 'conflict' && decision.winner === 'incoming')
    if (winnerIncoming) await this.applyEnvelope(def, env)
    return { decision, applied: winnerIncoming }
  }

  // ── PUSH (lot) ──────────────────────────────────────────────────────────────
  async push(siteId: string, posteLocalId: string, changes: SyncEntityEnvelope[]): Promise<SyncPushResponseV2> {
    const startedAt = new Date()
    const applied: string[] = []
    const skipped: string[] = []
    const conflicts: SyncConflictReport[] = []
    const conflictDetails: SyncConflictDetail[] = []

    for (const env of changes) {
      const def = SYNC_MODEL_BY_NAME.get(env.model)
      const existingRow = def ? await this.delegate(def.delegate)?.findUnique({ where: this.keyWhere(def, env.data) }) : null
      const { decision, applied: ok } = await this.ingest(env)
      if (decision.kind === 'conflict') {
        conflicts.push({
          model: env.model,
          id: env.id,
          winner: decision.winner,
          fields: existingRow ? diffFields(env.data, existingRow) : [],
        })
        conflictDetails.push({
          id: env.id, model: env.model, winner: decision.winner,
          valeurLocale: env.data, valeurServeur: existingRow ?? null,
        })
      }
      ;(ok ? applied : skipped).push(env.id)
    }

    // Traçabilité + temps réel (serveur central uniquement, no-op si pas de poste).
    if (posteLocalId) {
      await this.supervision.record({
        posteLocalId, siteId, startedAt, applied: applied.length, conflicts: conflictDetails,
      })
    }

    return { applied, skipped, conflicts, serverTime: new Date().toISOString() }
  }

  // ── Écriture préservant l'updatedAt SOURCE (LWW correct) ────────────────────
  async applyEnvelope(def: SyncModelDef, env: SyncEntityEnvelope): Promise<void> {
    const delegate = this.delegate(def.delegate)
    if (!delegate) return
    const data = { ...env.data }
    await delegate.upsert({ where: this.keyWhere(def, data), create: data, update: data })
    // `@updatedAt` vient de ré-horodater → on restaure l'updatedAt source (SQL brut).
    // `deletedAt` n'est restauré QUE pour les modèles tombstone-able. Clé simple OU composite.
    const p = (i: number) => (this.isSqlite ? '?' : `$${i}`)
    const setParts = [`"updatedAt" = ${p(1)}`]
    const params: unknown[] = [new Date(env.updatedAt)]
    if (SOFT_DELETE_MODELS.has(def.model)) {
      setParts.push(`"deletedAt" = ${p(2)}`)
      params.push(env.deletedAt ? new Date(env.deletedAt) : null)
    }
    const whereParts = def.idFields.map((f, i) => `"${f}" = ${p(params.length + 1 + i)}`)
    for (const f of def.idFields) params.push(data[f])
    const sql = `UPDATE "${def.model}" SET ${setParts.join(', ')} WHERE ${whereParts.join(' AND ')}`
    await this.prisma.raw.$executeRawUnsafe(sql, ...params)
  }

  async status(siteId: string): Promise<SyncStatusV2 & { siteId: string; models: number }> {
    return { siteId, models: SYNC_MODELS.length, online: true, pendingPush: 0 }
  }
}
