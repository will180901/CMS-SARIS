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
import { Prisma } from '@prisma/client'
import { Subject, interval, merge, type Observable } from 'rxjs'
import { filter, map } from 'rxjs/operators'
import type { MessageEvent } from '@nestjs/common'
import { NotificationService } from '../notification/notification.service'
import { PrismaService } from '../../prisma/prisma.service'
import {
  SYNC_MODELS,
  SYNC_MODEL_BY_NAME,
  type SyncModelDef,
} from './sync-models'
import { SOFT_DELETE_MODELS } from '../../prisma/soft-delete.extension'
import {
  resolveConflict,
  diffFields,
  raisonRejet,
  estRejetDefinitif,
  type ConflictDecision,
} from './conflict'
import {
  SyncSupervisionService,
  type SyncConflictDetail,
  type SyncRecordInput,
} from './sync-supervision.service'
import type {
  SyncEntityEnvelope,
  SyncPullResponseV2,
  SyncPushResponseV2,
  SyncConflictReport,
  SyncRejet,
  SyncStatusV2,
} from '@cms-saris/types/sync'

/**
 * Colonnes connues de chaque modèle, d'après le schéma de CETTE version du serveur.
 * Un poste resté sur une version antérieure peut envoyer une colonne qui n'existe plus
 * (ex. `employeId`, retiré avec le registre des employés) : elle est ignorée, au lieu de
 * faire rejeter toute la ligne — et avec elle la synchronisation de ce poste.
 */
const COLONNES_PAR_MODELE = new Map(
  Prisma.dmmf.datamodel.models.map((m) => [
    m.name,
    new Set(
      m.fields
        .filter((f) => f.kind === 'scalar' || f.kind === 'enum')
        .map((f) => f.name),
    ),
  ]),
)

/** Garde seulement les colonnes que ce serveur connaît pour ce modèle. */
export function colonnesConnues(
  model: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const connues = COLONNES_PAR_MODELE.get(model)
  if (!connues) return { ...data }
  return Object.fromEntries(
    Object.entries(data).filter(([k]) => connues.has(k)),
  )
}

interface AnyDelegate {
  findMany: (a: unknown) => Promise<Array<Record<string, unknown>>>
  findUnique: (a: unknown) => Promise<Record<string, unknown> | null>
  upsert: (a: unknown) => Promise<unknown>
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger('Sync')
  /**
   * SONNETTE TEMPS RÉEL (serveur central uniquement).
   *
   * Ne transporte AUCUNE donnée : uniquement « il y a du neuf, et voici qui l'a produit ».
   * Les postes abonnés déclenchent alors une synchronisation immédiate, qui passe par les
   * contrôles d'accès habituels. Un canal muet ne peut pas fuiter.
   */
  private readonly cloche$ = new Subject<{ origine: string | null }>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly supervision: SyncSupervisionService,
    private readonly notif: NotificationService,
  ) {
    // Écritures faites depuis le WEB (navigateur branché sur le central) : elles ne
    // passent pas par /sync/push, donc personne ne sonnerait. On se greffe sur le flux
    // des notifications, qui couvre précisément ce qui doit apparaître sans délai.
    this.notif.activite$.subscribe(() => this.sonner(null))
  }

  /** Fait sonner. `origine` = le poste à l'origine de l'écriture, pour ne pas le réveiller
   *  pour son propre travail (il a déjà les données : c'est lui qui les a écrites). */
  sonner(origine: string | null): void {
    this.cloche$.next({ origine })
  }

  /**
   * Abonnement d'un poste à la sonnette.
   *
   * BATTEMENT : un canal muet est coupé par les intermédiaires réseau (Render, proxies
   * d'entreprise) au bout d'une minute environ. Sans battement, chaque poste se
   * reconnecterait sans cesse — sur un parc de 200 postes, un flot permanent de
   * reconnexions pour zéro information. On envoie donc un signe de vie régulier, plus
   * court que le délai de coupure le plus agressif rencontré en pratique.
   *
   * Le battement porte un type DIFFÉRENT de la sonnerie : le poste ne doit surtout pas
   * synchroniser à chaque battement, sinon on aurait réinventé l'interrogation périodique
   * qu'on cherchait justement à supprimer.
   */
  clochePour(posteLocalId: string | null): Observable<MessageEvent> {
    const sonneries = this.cloche$.pipe(
      filter((e) => !e.origine || e.origine !== posteLocalId),
      map(() => ({ data: { t: 'sync' } }) as MessageEvent),
    )
    const battement = interval(25000).pipe(
      map(() => ({ data: { t: 'ping' } }) as MessageEvent),
    )
    return merge(sonneries, battement)
  }

  private get isSqlite(): boolean {
    return process.env['DATABASE_PROVIDER'] === 'sqlite'
  }

  private delegate(name: string): AnyDelegate | undefined {
    // Client BRUT (non étendu soft-delete) : la synchro DOIT voir les tombstones et
    // écrire sans interception (upsert + restauration de l'updatedAt source).
    return (this.prisma.raw as unknown as Record<string, AnyDelegate>)[name]
  }

  private toIso(v: unknown): string {
    return v instanceof Date
      ? v.toISOString()
      : v
        ? String(v)
        : new Date(0).toISOString()
  }

  private toEnvelope(
    def: SyncModelDef,
    row: Record<string, unknown>,
  ): SyncEntityEnvelope {
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
  private keyWhere(
    def: SyncModelDef,
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    if (def.idFields.length === 1)
      return { [def.idFields[0]]: data[def.idFields[0]] }
    const compound: Record<string, unknown> = {}
    for (const f of def.idFields) compound[f] = data[f]
    return { [def.idFields.join('_')]: compound }
  }

  // ── PULL ────────────────────────────────────────────────────────────────────
  /** Deltas du site depuis `since` (tombstones inclus, scope par site, paginé). */
  async pull(
    siteId: string,
    since: string | undefined,
    limit = 500,
  ): Promise<SyncPullResponseV2> {
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
          where: {
            ...def.scopeWhere(siteId),
            updatedAt: { gt: sinceDate },
            deletedAt: undefined,
          },
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
        this.logger.warn(
          `pull: modèle ${def.model} ignoré — ${(e as Error).message.split('\n')[0]}`,
        )
      }
    }

    // On NE trie PAS par updatedAt : on conserve l'ordre du registre (parents avant enfants)
    // pour que l'application côté client respecte les contraintes de clés étrangères.
    // Le curseur = le plus grand updatedAt du lot (sinon l'heure serveur).
    let maxUpdated = ''
    for (const c of changes)
      if (c.updatedAt > maxUpdated) maxUpdated = c.updatedAt
    const nextSince = maxUpdated || serverTime.toISOString()
    return { changes, serverTime: serverTime.toISOString(), hasMore, nextSince }
  }

  // ── INGEST (1 delta) — partagé push serveur / pull client ───────────────────
  async ingest(
    env: SyncEntityEnvelope,
  ): Promise<{ decision: ConflictDecision; applied: boolean }> {
    const def = SYNC_MODEL_BY_NAME.get(env.model)
    const delegate = def && this.delegate(def.delegate)
    if (!def || !delegate) return { decision: { kind: 'skip' }, applied: false }

    const existingRow = await delegate.findUnique({
      where: this.keyWhere(def, env.data),
    })
    const existing = existingRow
      ? {
          updatedAt: this.toIso(existingRow['updatedAt']),
          deletedAt: existingRow['deletedAt']
            ? this.toIso(existingRow['deletedAt'])
            : null,
        }
      : null

    const decision = resolveConflict(
      {
        updatedAt: env.updatedAt,
        deletedAt: env.deletedAt,
        baseUpdatedAt: env.baseUpdatedAt,
      },
      existing,
    )
    const winnerIncoming =
      decision.kind === 'apply' ||
      (decision.kind === 'conflict' && decision.winner === 'incoming')
    if (winnerIncoming) await this.applyEnvelope(def, env)
    return { decision, applied: winnerIncoming }
  }

  // ── PUSH (lot) ──────────────────────────────────────────────────────────────
  async push(
    siteId: string,
    userId: string,
    posteLocalId: string,
    changes: SyncEntityEnvelope[],
  ): Promise<SyncPushResponseV2> {
    const startedAt = new Date()
    const applied: string[] = []
    const skipped: string[] = []
    const conflicts: SyncConflictReport[] = []
    const conflictDetails: SyncConflictDetail[] = []
    const rejected: SyncRejet[] = []
    const rejets: NonNullable<SyncRecordInput['rejets']> = []

    for (const env of changes) {
      // UN changement en échec ne doit jamais bloquer le lot. Avant, une seule erreur (un
      // matricule déjà pris par une fiche créée hors ligne sur un autre poste, un parent
      // absent…) faisait échouer la requête entière : le poste ne faisait pas avancer son
      // curseur et renvoyait le même lot à chaque cycle — plus rien ne remontait, jamais.
      // Le changement refusé part en QUARANTAINE (supervision), le reste passe.
      let existingRow: Record<string, unknown> | null = null
      let decision: ConflictDecision
      let ok: boolean
      try {
        const def = SYNC_MODEL_BY_NAME.get(env.model)
        existingRow = def
          ? ((await this.delegate(def.delegate)?.findUnique({
              where: this.keyWhere(def, env.data),
            })) ?? null)
          : null
        ;({ decision, applied: ok } = await this.ingest(env))
      } catch (e) {
        // Erreur passagère (base occupée, connexion) : on laisse échouer le lot, le poste
        // réessaiera tel quel — mettre en quarantaine une donnée saine serait une perte.
        if (!estRejetDefinitif(e)) throw e
        const raison = raisonRejet(e)
        this.logger.warn(`push: ${env.model} ${env.id} mis en quarantaine — ${raison}`)
        rejected.push({ id: env.id, model: env.model, raison })
        rejets.push({ id: env.id, model: env.model, raison, valeurLocale: env.data })
        continue
      }
      if (decision.kind === 'conflict') {
        conflicts.push({
          model: env.model,
          id: env.id,
          winner: decision.winner,
          fields: existingRow ? diffFields(env.data, existingRow) : [],
        })
        conflictDetails.push({
          id: env.id,
          model: env.model,
          winner: decision.winner,
          valeurLocale: env.data,
          valeurServeur: existingRow ?? null,
        })
      }
      ;(ok ? applied : skipped).push(env.id)
    }

    // Traçabilité + temps réel (serveur central uniquement, no-op si pas de poste).
    if (posteLocalId) {
      await this.supervision.record({
        posteLocalId,
        siteId,
        userId,
        startedAt,
        applied: applied.length,
        conflicts: conflictDetails,
        rejets,
      })
    }

    // Un poste vient d'écrire : on prévient TOUS LES AUTRES sur-le-champ, sans attendre
    // leur prochain cycle. C'est ce qui rend la messagerie instantanée entre postes.
    // On ne sonne que si quelque chose a réellement été appliqué — un push vide (le cas
    // le plus fréquent) ne doit réveiller personne.
    if (applied.length > 0) this.sonner(posteLocalId ?? null)

    return {
      applied,
      skipped,
      conflicts,
      rejected,
      serverTime: new Date().toISOString(),
    }
  }

  // ── Écriture préservant l'updatedAt SOURCE (LWW correct) ────────────────────
  async applyEnvelope(
    def: SyncModelDef,
    env: SyncEntityEnvelope,
  ): Promise<void> {
    const delegate = this.delegate(def.delegate)
    if (!delegate) return
    const data = colonnesConnues(def.model, env.data)
    await delegate.upsert({
      where: this.keyWhere(def, data),
      create: data,
      update: data,
    })
    // `@updatedAt` vient de ré-horodater → on restaure l'updatedAt source (SQL brut).
    // `deletedAt` n'est restauré QUE pour les modèles tombstone-able. Clé simple OU composite.
    const p = (i: number) => (this.isSqlite ? '?' : `$${i}`)
    // PostgreSQL : l'heure passe en TEXTE ISO, convertie explicitement en UTC. Liée comme
    // une Date, elle était lue dans le fuseau de la SESSION (ex. Europe/Paris) puis rangée
    // dans une colonne sans fuseau : décalée d'une à deux heures — et « le plus récent
    // gagne » comparait ensuite des heures fausses (une modification plus récente pouvait
    // être ignorée). SQLite range l'instant tel quel : la Date y reste.
    const heure = (i: number) =>
      this.isSqlite ? '?' : `($${i}::text)::timestamptz AT TIME ZONE 'UTC'`
    const valeur = (iso: string | null | undefined) =>
      iso ? (this.isSqlite ? new Date(iso) : new Date(iso).toISOString()) : null
    const setParts = [`"updatedAt" = ${heure(1)}`]
    const params: unknown[] = [valeur(env.updatedAt)]
    if (SOFT_DELETE_MODELS.has(def.model)) {
      setParts.push(`"deletedAt" = ${heure(2)}`)
      params.push(valeur(env.deletedAt))
    }
    const whereParts = def.idFields.map(
      (f, i) => `"${f}" = ${p(params.length + 1 + i)}`,
    )
    for (const f of def.idFields) params.push(data[f])
    const sql = `UPDATE "${def.model}" SET ${setParts.join(', ')} WHERE ${whereParts.join(' AND ')}`
    await this.prisma.raw.$executeRawUnsafe(sql, ...params)
  }

  async status(
    siteId: string,
  ): Promise<SyncStatusV2 & { siteId: string; models: number }> {
    return { siteId, models: SYNC_MODELS.length, online: true, pendingPush: 0 }
  }
}
