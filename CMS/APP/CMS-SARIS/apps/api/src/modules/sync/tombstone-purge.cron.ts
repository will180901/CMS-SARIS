/**
 * Purge des tombstones (suppression PHYSIQUE des lignes soft-deletées anciennes), côté
 * SERVEUR CENTRAL uniquement. Garde-fou anti-« résurrection » : on ne purge que ce que
 * TOUS les postes ont déjà vu (deletedAt < min(SyncState.lastPulledAt)).
 *
 * DELETE en SQL brut pour contourner l'extension soft-delete (qui transformerait un
 * delete en update). ⚠️ Validation runtime requise (base).
 */
import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../../prisma/prisma.service'
import { SOFT_DELETE_MODELS } from '../../prisma/soft-delete.extension'

interface LastPulled {
  lastPulledAt: Date | null
}

@Injectable()
export class TombstonePurgeCron {
  private readonly logger = new Logger('TombstonePurge')
  private readonly retentionDays = 90

  constructor(private readonly prisma: PrismaService) {}

  private get isSqlite(): boolean {
    return process.env['DATABASE_PROVIDER'] === 'sqlite'
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purge(): Promise<void> {
    if (this.isSqlite) return // pas de purge sur les postes locaux (le central fait foi)

    const retentionCutoff = new Date(Date.now() - this.retentionDays * 86_400_000)
    // Borne de sécurité : le plus ancien lastPulledAt parmi les postes actifs.
    const states = (await (this.prisma as unknown as {
      syncState: { findMany: (a: unknown) => Promise<LastPulled[]> }
    }).syncState.findMany({ select: { lastPulledAt: true } }).catch(() => [] as LastPulled[]))
    const minPulled = states.length
      ? new Date(Math.min(...states.map((s) => (s.lastPulledAt ? +s.lastPulledAt : 0))))
      : new Date(0)
    const cutoff = retentionCutoff < minPulled ? retentionCutoff : minPulled

    const placeholder = this.isSqlite ? '?' : '$1'
    let total = 0
    for (const model of SOFT_DELETE_MODELS) {
      try {
        const n = await this.prisma.$executeRawUnsafe(
          `DELETE FROM "${model}" WHERE "deletedAt" IS NOT NULL AND "deletedAt" < ${placeholder}`,
          cutoff,
        )
        total += typeof n === 'number' ? n : 0
      } catch {
        /* modèle sans colonne deletedAt → ignoré */
      }
    }
    if (total) this.logger.log(`Purge tombstones : ${total} lignes supprimées définitivement (< ${cutoff.toISOString()})`)
  }
}
