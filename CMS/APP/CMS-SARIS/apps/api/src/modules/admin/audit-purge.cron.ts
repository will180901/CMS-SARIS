/**
 * Purge automatique des journaux d'audit, selon `audit.retention_jours`.
 *
 * Même principe que la purge des notifications : le SERVEUR CENTRAL seul fait le
 * ménage (les postes locaux SQLite s'abstiennent, le central fait foi).
 *
 * Passe à 4h15 et non à 4h00 : la purge des notifications tourne déjà à 4h00, et
 * deux `deleteMany` massifs lancés à la même seconde se disputent la base au moment
 * précis où la sauvegarde nocturne peut encore tourner.
 *
 * La purge se journalise elle-même (cf. AuditService.purger) : le journal garde
 * donc la trace de ses propres nettoyages, avec le nombre d'entrées supprimées.
 */
import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { AuditService } from './audit.service'
import { ParametresService } from '../parametres/parametres.service'

@Injectable()
export class AuditPurgeCron {
  private readonly logger = new Logger('AuditPurge')

  constructor(
    private readonly audit: AuditService,
    private readonly params: ParametresService,
  ) {}

  @Cron('15 4 * * *', { name: 'purge-audit' })
  async purge(): Promise<void> {
    if (process.env['DATABASE_PROVIDER'] === 'sqlite') return

    const jours = await this.params.getNumber('audit.retention_jours')
    // Pas de réglage lisible → on ne touche à rien. Supprimer des traces sur la foi
    // d'une valeur douteuse serait pire que de ne rien purger.
    if (!jours || jours < 1) return

    const avant = new Date(Date.now() - jours * 86_400_000)
    try {
      const res = await this.audit.purger('tout', null, {
        avant,
        automatique: true,
      })
      if (res.actions || res.authentifications) {
        this.logger.log(
          `Rétention ${jours} j : ${res.actions} action(s) et ` +
            `${res.authentifications} authentification(s) supprimée(s).`,
        )
      }
    } catch (error) {
      this.logger.error('Purge automatique des journaux impossible', error)
    }
  }
}
