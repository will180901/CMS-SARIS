/**
 * RapportsService — génération planifiée de rapports statistiques (recueil §6.1).
 *
 * Le Médecin Chef doit aujourd'hui produire manuellement les rapports hebdo/
 * mensuel/annuel destinés à la Direction Générale (charge administrative
 * signalée comme point de tension). Ce module automatise la production : un
 * cron génère un snapshot JSON GLOBAL (multi-site sans restriction — le CMS
 * centralise les données) des statistiques de la période échue, consultable/
 * exportable sans ressaisie.
 *
 * Le contenu réutilise EXACTEMENT la forme de `DashboardService.getStatistiques()`
 * (même shape que l'export manuel existant `statsExport.ts` côté web).
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../../prisma/prisma.service'
import { DashboardService } from '../dashboard/dashboard.service'

export type TypeRapport = 'HEBDOMADAIRE' | 'MENSUEL' | 'ANNUEL'

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

@Injectable()
export class RapportsService {
  private readonly logger = new Logger('Rapports')

  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardService,
  ) {}

  // ── Génération planifiée ──────────────────────────────────────────────────

  /** Chaque lundi 3h : rapport de la semaine écoulée (lundi→dimanche précédents). */
  @Cron(CronExpression.EVERY_WEEK, { name: 'rapport-hebdomadaire' })
  async genererHebdomadaires() {
    const fin = new Date()
    fin.setHours(0, 0, 0, 0)
    const debut = new Date(fin)
    debut.setDate(debut.getDate() - 7)
    await this.genererSiPossible('HEBDOMADAIRE', debut, fin)
  }

  /** Le 1er de chaque mois à 3h05 : rapport du mois écoulé. */
  @Cron('5 3 1 * *', { name: 'rapport-mensuel' })
  async genererMensuels() {
    const auj = new Date()
    const debut = new Date(auj.getFullYear(), auj.getMonth() - 1, 1)
    const fin = new Date(auj.getFullYear(), auj.getMonth(), 1)
    await this.genererSiPossible('MENSUEL', debut, fin)
  }

  /** Le 1er janvier à 3h10 : rapport de l'année écoulée. */
  @Cron('10 3 1 1 *', { name: 'rapport-annuel' })
  async genererAnnuels() {
    const auj = new Date()
    const debut = new Date(auj.getFullYear() - 1, 0, 1)
    const fin = new Date(auj.getFullYear(), 0, 1)
    await this.genererSiPossible('ANNUEL', debut, fin)
  }

  private async genererSiPossible(
    type: TypeRapport,
    periodeDebut: Date,
    periodeFin: Date,
  ) {
    try {
      await this.genererRapport(type, periodeDebut, periodeFin)
    } catch (err) {
      this.logger.error(`Échec génération rapport ${type}`, err as Error)
    }
  }

  /** Génère (ou régénère) le rapport global d'une période donnée. Idempotent. */
  async genererRapport(
    type: TypeRapport,
    periodeDebut: Date,
    periodeFin: Date,
  ) {
    const contenu = await this.dashboard.getStatistiques(
      dayKey(periodeDebut),
      dayKey(new Date(periodeFin.getTime() - 1)),
    )
    const existant = await this.prisma.rapportGenere.findFirst({
      where: { type, periodeDebut, periodeFin },
      select: { id: true },
    })
    const contenuJson = JSON.stringify(contenu)
    if (existant) {
      return this.prisma.rapportGenere.update({
        where: { id: existant.id },
        data: { contenuJson, genereLe: new Date() },
      })
    }
    return this.prisma.rapportGenere.create({
      data: { type, periodeDebut, periodeFin, contenuJson },
    })
  }

  // ── Consultation ──────────────────────────────────────────────────────────

  async list(type?: TypeRapport) {
    return this.prisma.rapportGenere.findMany({
      where: { ...(type ? { type } : {}) },
      orderBy: { periodeDebut: 'desc' },
      select: {
        id: true,
        type: true,
        periodeDebut: true,
        periodeFin: true,
        genereLe: true,
      },
    })
  }

  async findOne(id: string) {
    const rapport = await this.prisma.rapportGenere.findFirst({ where: { id } })
    if (!rapport) throw new NotFoundException('Rapport introuvable')
    return { ...rapport, contenu: JSON.parse(rapport.contenuJson) }
  }
}
