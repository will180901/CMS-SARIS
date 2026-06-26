/**
 * Purge des notifications anciennes selon le paramètre système `notif.retention_jours`.
 * Tourne sur le SERVEUR CENTRAL uniquement (les postes locaux SQLite ne purgent pas :
 * le central fait foi). Les lectures (NotificationLecture) sont supprimées en cascade.
 */
import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../../prisma/prisma.service'
import { ParametresService } from '../parametres/parametres.service'

@Injectable()
export class NotificationPurgeCron {
  private readonly logger = new Logger('NotificationPurge')

  constructor(
    private readonly prisma: PrismaService,
    private readonly params: ParametresService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purge(): Promise<void> {
    if (process.env['DATABASE_PROVIDER'] === 'sqlite') return

    const jours = await this.params.getNumber('notif.retention_jours')
    if (!jours || jours < 1) return

    const cutoff = new Date(Date.now() - jours * 86_400_000)
    const res = await this.prisma.notification.deleteMany({
      where: { createdAt: { lt: cutoff } },
    })
    if (res.count) {
      this.logger.log(`Purge notifications : ${res.count} supprimée(s) (> ${jours} j, < ${cutoff.toISOString()})`)
    }
  }
}
