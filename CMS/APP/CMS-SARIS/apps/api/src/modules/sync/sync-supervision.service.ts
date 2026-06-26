/**
 * SyncSupervisionService — traçabilité + supervision de la synchronisation,
 * côté SERVEUR CENTRAL uniquement.
 *
 *  - record()        : à chaque lot reçu d'un poste, enregistre le poste (dernière synchro),
 *                      un journal (JournalSynchronisation), les conflits détaillés
 *                      (ConflitSynchronisation) et l'état par poste (SyncState), puis
 *                      pousse un événement TEMPS RÉEL (broadcastLive) pour rafraîchir l'UI.
 *  - getSupervision(): postes (en ligne/hors-ligne + dernière synchro), activité récente
 *                      (journaux) et conflits en attente — pour l'écran de supervision.
 */
import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationService } from '../notification/notification.service'

export interface SyncConflictDetail {
  /** uuid de la mutation / id de l'entité en conflit */
  id: string
  model: string
  winner: 'incoming' | 'existing'
  valeurLocale: unknown
  valeurServeur: unknown
}

export interface SyncRecordInput {
  posteLocalId: string
  siteId: string
  startedAt: Date
  applied: number
  conflicts: SyncConflictDetail[]
}

/** Un poste est considéré « en ligne » s'il s'est synchronisé dans les 3 dernières minutes. */
const ONLINE_WINDOW_MS = 3 * 60_000

@Injectable()
export class SyncSupervisionService {
  private readonly logger = new Logger('SyncSupervision')

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  private get isSqlite(): boolean {
    return process.env['DATABASE_PROVIDER'] === 'sqlite'
  }

  /** Enregistre un cycle de synchro reçu d'un poste (no-op sur un poste local SQLite). */
  async record(input: SyncRecordInput): Promise<void> {
    if (this.isSqlite) return
    const { posteLocalId, siteId, startedAt, applied, conflicts } = input
    const now = new Date()

    try {
      // 1. Poste connu + horodatage de la dernière synchro.
      await this.prisma.posteLocal.upsert({
        where:  { id: posteLocalId },
        update: { derniereSyncAt: now, siteId },
        create: { id: posteLocalId, siteId, libelle: `Poste ${posteLocalId.slice(0, 8)}`, derniereSyncAt: now },
      })

      // 2. Journal du cycle (réussi / avec conflits).
      const journal = await this.prisma.journalSynchronisation.create({
        data: {
          posteLocalId,
          startedAt,
          finishedAt:  now,
          statut:      conflicts.length ? 'CONFLITS' : 'REUSSIE',
          nbMutations: applied,
          nbConflits:  conflicts.length,
        },
      })

      // 3. Conflits détaillés (valeur locale vs serveur, pour inspection).
      for (const c of conflicts) {
        await this.prisma.conflitSynchronisation.create({
          data: {
            journalId:     journal.id,
            mutationUuid:  c.id,
            entiteType:    c.model,
            entiteId:      c.id,
            typeConflit:   c.winner === 'incoming' ? 'LOCAL_GAGNE' : 'SERVEUR_GAGNE',
            valeurLocale:  (c.valeurLocale ?? {}) as object,
            valeurServeur: (c.valeurServeur ?? {}) as object,
          },
        })
      }

      // 4. État de synchro par poste.
      await this.prisma.syncState.upsert({
        where:  { posteLocalId_siteId: { posteLocalId, siteId } },
        update: { lastPushedAt: now },
        create: { posteLocalId, siteId, lastPushedAt: now },
      })
    } catch (e) {
      // La traçabilité ne doit jamais casser la synchro.
      this.logger.warn(`record() ignoré : ${(e as Error).message}`)
    }

    // 5. Temps réel : rafraîchit l'écran de supervision des administrateurs.
    this.notifications.broadcastLive('SYNC_ACTIVITY', { requiredPermission: 'synchronisation.read' })
  }

  /** Données de l'écran de supervision (scope par site). */
  async getSupervision(siteId: string) {
    const now = Date.now()
    const [postes, journaux, conflits] = await Promise.all([
      this.prisma.posteLocal.findMany({ where: { siteId }, orderBy: { derniereSyncAt: 'desc' } }),
      this.prisma.journalSynchronisation.findMany({
        where:   { posteLocal: { siteId } },
        orderBy: { startedAt: 'desc' },
        take:    30,
        include: { posteLocal: { select: { libelle: true } } },
      }),
      this.prisma.conflitSynchronisation.findMany({
        where:   { statut: 'EN_ATTENTE', journal: { posteLocal: { siteId } } },
        orderBy: { createdAt: 'desc' },
        take:    50,
      }),
    ])

    return {
      postes: postes.map((p) => ({
        id:             p.id,
        libelle:        p.libelle,
        derniereSyncAt: p.derniereSyncAt,
        enLigne:        !!p.derniereSyncAt && now - +p.derniereSyncAt < ONLINE_WINDOW_MS,
      })),
      journaux: journaux.map((j) => ({
        id:          j.id,
        poste:       j.posteLocal.libelle,
        startedAt:   j.startedAt,
        finishedAt:  j.finishedAt,
        statut:      j.statut,
        nbMutations: j.nbMutations,
        nbConflits:  j.nbConflits,
      })),
      conflits: conflits.map((c) => ({
        id:          c.id,
        entiteType:  c.entiteType,
        entiteId:    c.entiteId,
        typeConflit: c.typeConflit,
        createdAt:   c.createdAt,
      })),
    }
  }
}
