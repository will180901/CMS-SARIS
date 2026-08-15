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

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../../prisma/prisma.service'
import { DashboardService } from '../dashboard/dashboard.service'

export type TypeRapport = 'HEBDOMADAIRE' | 'MENSUEL' | 'ANNUEL'

/** Forme renvoyee par `DashboardService.getStatistiques()`. */
type StatsPeriode = Awaited<ReturnType<DashboardService['getStatistiques']>>

/** Un point de la courbe de tendance. */
interface PointSerie {
  debut: string
  fin: string
  consultations: number
  reposJours: number
}

/**
 * Constat notable, STRUCTURE et non redige : le client compose la phrase dans la langue
 * de la personne. Rediger ici figerait le rapport en francais pour tout le monde.
 */
interface AlerteRapport {
  code:
    | 'ACTIVITE_HAUSSE'
    | 'ACTIVITE_BAISSE'
    | 'AT_CONCENTRATION'
    | 'PATHOLOGIE_HAUSSE'
    | 'REPOS_HAUSSE'
  niveau: 'info' | 'attention' | 'critique'
  params: Record<string, string | number>
}

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

  /**
   * Recule une periode d'un cran. Le pas suit la NATURE du rapport : un mois n'a pas une
   * duree fixe, et comparer un mois calendaire aux « 30 jours precedents » fausserait la
   * lecture de fevrier a mars.
   */
  private periodePrecedente(
    type: TypeRapport,
    debut: Date,
    fin: Date,
  ): { debut: Date; fin: Date } {
    if (type === 'MENSUEL') {
      return {
        debut: new Date(debut.getFullYear(), debut.getMonth() - 1, 1),
        fin: new Date(debut),
      }
    }
    if (type === 'ANNUEL') {
      return {
        debut: new Date(debut.getFullYear() - 1, 0, 1),
        fin: new Date(debut),
      }
    }
    const duree = fin.getTime() - debut.getTime()
    return { debut: new Date(debut.getTime() - duree), fin: new Date(debut) }
  }

  /** Statistiques d'une periode (la borne de fin est exclusive). */
  private statsDe(debut: Date, fin: Date) {
    return this.dashboard.getStatistiques(
      dayKey(debut),
      dayKey(new Date(fin.getTime() - 1)),
    )
  }

  /**
   * ALERTES — ce qui SORT DE L'ORDINAIRE, et rien d'autre.
   *
   * Un rapport qui aligne des compteurs oblige son lecteur a faire lui-meme le travail de
   * comparaison ; en pratique il ne le fait pas. On calcule donc ici les quelques constats
   * qui meritent qu'on leve les yeux. Volontairement PEU nombreux : une page couverte
   * d'avertissements ne se lit plus, et plafonnee a cinq.
   */
  private calculerAlertes(
    stats: StatsPeriode,
    precedent: StatsPeriode | null,
  ): AlerteRapport[] {
    const alertes: AlerteRapport[] = []
    const total = stats.totalConsultations
    const totalAvant = precedent?.totalConsultations ?? 0

    // 1. Variation d'activite marquee. Seuil PLANCHER volontaire : passer de 2 a 3 actes
    //    fait +50% et ne signifie rien. Sans ce garde-fou, l'alerte devient du bruit.
    if (precedent && totalAvant >= 5) {
      const ecart = Math.round(((total - totalAvant) / totalAvant) * 100)
      if (ecart >= 30) {
        alertes.push({
          code: 'ACTIVITE_HAUSSE',
          niveau: 'info',
          params: { pct: ecart, avant: totalAvant, apres: total },
        })
      } else if (ecart <= -30) {
        alertes.push({
          code: 'ACTIVITE_BAISSE',
          niveau: 'info',
          params: { pct: Math.abs(ecart), avant: totalAvant, apres: total },
        })
      }
    }

    // 2. Accidents du travail concentres sur un departement : le constat le plus utile
    //    pour un centre d'entreprise, parce qu'il designe OU agir.
    const at = stats.parType.find((x) => /accident/i.test(x.libelle))
    if (at && at.count >= 2) {
      const top = [...stats.parDepartement].sort((a, b) => b.count - a.count)[0]
      if (top && top.count >= 2 && top.count / Math.max(total, 1) >= 0.5) {
        alertes.push({
          code: 'AT_CONCENTRATION',
          niveau: 'critique',
          params: { departement: top.libelle, cas: top.count, accidents: at.count },
        })
      }
    }

    // 3. Pathologie qui double : debut d'episode collectif, c'est de la veille sanitaire.
    if (precedent) {
      for (const path of stats.parPathologie) {
        const avant =
          precedent.parPathologie.find((x) => x.libelle === path.libelle)?.count ?? 0
        if (path.count >= 3 && path.count >= avant * 2) {
          alertes.push({
            code: 'PATHOLOGIE_HAUSSE',
            niveau: 'attention',
            params: { libelle: path.libelle, avant, apres: path.count },
          })
        }
      }
    }

    // 4. Absenteisme prescrit en forte hausse : c'est le COUT, donc ce qui parle a la
    //    Direction Generale.
    const jours = stats.repos.totalJours
    const joursAvant = precedent?.repos.totalJours ?? 0
    if (joursAvant >= 5 && jours >= joursAvant * 1.5) {
      alertes.push({
        code: 'REPOS_HAUSSE',
        niveau: 'attention',
        params: { avant: joursAvant, apres: jours },
      })
    }

    return alertes.slice(0, 5)
  }

  /**
   * LES CINQ VOLETS — ce qui fait qu'un rapport parle du CENTRE, et plus seulement des
   * consultations.
   *
   * Le rapport ne lisait qu'une table sur les quatre-vingt-dix de la base : `Consultation`.
   * Il ignorait donc combien de personnes etaient passees au centre, combien de dossiers
   * avaient ete ouverts, ce qui avait ete prescrit, et qui restait a suivre. Pour un centre
   * medical d'entreprise, ce sont precisement les questions qu'on pose.
   *
   * Volontairement des COMPTAGES : chacun est verifiable, aucun ne repose sur une
   * interpretation de statut dont la valeur pourrait changer. Un indicateur faux dans un
   * rapport medical est pire qu'un indicateur absent.
   */
  private async calculerVolets(debut: Date, fin: Date) {
    const periode = { gte: debut, lt: fin }

    const [
      visites,
      evacuations,
      certificats,
      nouveauxDossiers,
      dossiersActifs,
      ordonnances,
      bonsExamen,
      resultatsRecus,
      suivisChroniques,
      grossessesSuivies,
      alertesActives,
    ] = await Promise.all([
      // Volet 1 — ACTIVITE : la visite est le vrai volume de passage. La consultation n'en
      // est qu'une suite possible ; compter les consultations seules sous-estime le travail
      // du centre de tout le triage qui n'a pas donne lieu a un acte medical.
      this.prisma.visite.count({ where: { dateOuverture: periode } }),
      this.prisma.evacuation.count({ where: { createdAt: periode } }),

      // Volet 2 — SANTE AU TRAVAIL. Les jours d'arret figurent deja dans `repos` ; on
      // ajoute le nombre de certificats emis, qui mesure l'activite administrative reelle.
      this.prisma.certificatMedical.count({ where: { createdAt: periode } }),

      // Volet 3 — POPULATION. Les nouveaux dossiers disent la progression de la couverture ;
      // les dossiers actifs disent la population suivie a ce jour (donc HORS periode : c'est
      // un etat, pas un flux).
      this.prisma.patient.count({ where: { createdAt: periode } }),
      this.prisma.patient.count({ where: { statut: 'ACTIF' } }),

      // Volet 4 — PHARMACIE ET EXAMENS. Ce qui est prescrit, donc consomme et budgete.
      this.prisma.ordonnance.count({ where: { createdAt: periode } }),
      this.prisma.bonExamen.count({ where: { createdAt: periode } }),
      this.prisma.resultatExamen.count({ where: { createdAt: periode } }),

      // Volet 5 — SUIVI ET RISQUES. Des ETATS a la date du rapport, pas des flux : ce qui
      // reste ouvert est ce qui demande de l'attention.
      this.prisma.suiviChronique.count({ where: { closedAt: null } }),
      this.prisma.suiviGrossesse.count({ where: { dateFinReelle: null } }),
      this.prisma.alerteMedicale.count({ where: { resolvedAt: null } }),
    ])

    return {
      activite: {
        visites,
        evacuations,
        // Part des visites qui ont donne lieu a une consultation. Se calcule cote client
        // avec le total de consultations deja present : on ne duplique pas la donnee.
      },
      santeTravail: { certificats },
      population: { nouveauxDossiers, dossiersActifs },
      pharmacieExamens: { ordonnances, bonsExamen, resultatsRecus },
      suiviRisques: { suivisChroniques, grossessesSuivies, alertesActives },
    }
  }

  /** Génère (ou régénère) le rapport global d'une période donnée. Idempotent. */
  async genererRapport(
    type: TypeRapport,
    periodeDebut: Date,
    periodeFin: Date,
  ) {
    const stats = await this.statsDe(periodeDebut, periodeFin)

    // COMPARAISON. Sans elle, un chiffre n'informe pas : « 5 consultations » ne dit rien,
    // « 5 consultations, -40% » dit quelque chose.
    const pp = this.periodePrecedente(type, periodeDebut, periodeFin)
    let precedent: StatsPeriode | null = null
    try {
      precedent = await this.statsDe(pp.debut, pp.fin)
    } catch {
      /* premiere periode du systeme : il n'y a pas de passe, ce n'est pas une erreur */
    }

    // SERIE — six periodes, de la plus ancienne a la courante. Une tendance se lit d'un
    // coup d'oeil la ou une suite de rapports isoles oblige a tout rouvrir.
    const bornes: { debut: Date; fin: Date }[] = []
    let cd = periodeDebut
    let cf = periodeFin
    for (let i = 0; i < 6; i++) {
      bornes.unshift({ debut: cd, fin: cf })
      const prec = this.periodePrecedente(type, cd, cf)
      cd = prec.debut
      cf = prec.fin
    }
    const serie: PointSerie[] = []
    for (const b of bornes) {
      try {
        const st = await this.statsDe(b.debut, b.fin)
        serie.push({
          debut: b.debut.toISOString(),
          fin: b.fin.toISOString(),
          consultations: st.totalConsultations,
          reposJours: st.repos.totalJours,
        })
      } catch {
        /* periode anterieure aux donnees : on la saute plutot que d'afficher un zero,
           qui se lirait comme « aucune activite » alors qu'il n'y avait pas de systeme */
      }
    }

    const volets = await this.calculerVolets(periodeDebut, periodeFin)

    const contenu = {
      ...stats,
      precedent,
      serie,
      volets,
      alertes: this.calculerAlertes(stats, precedent),
    }
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

  /**
   * Génération A LA DEMANDE, sur une période libre.
   *
   * Sans elle, un centre qui vient d'installer le système voit une page vide jusqu'au
   * prochain passage de l'horloge — jusqu'au 1er du mois pour un rapport mensuel. On ne
   * peut pas non plus produire un bilan sur une période choisie, ce qui est pourtant la
   * demande la plus courante avant une réunion.
   *
   * Idempotent comme la génération planifiée : relancer sur la même période met à jour le
   * rapport existant au lieu d'en empiler un second.
   */
  async genererMaintenant(type: TypeRapport, debutISO: string, finISO: string) {
    const debut = new Date(debutISO)
    const fin = new Date(finISO)
    if (isNaN(debut.getTime()) || isNaN(fin.getTime()))
      throw new BadRequestException('Dates invalides')
    if (fin <= debut)
      throw new BadRequestException('La fin doit être postérieure au début')
    // Borne haute : au-delà, la série de six périodes ferait autant de parcours complets
    // de la base pour un résultat que personne ne lit.
    const jours = (fin.getTime() - debut.getTime()) / 86_400_000
    if (jours > 800)
      throw new BadRequestException('Période trop longue (2 ans maximum)')

    debut.setHours(0, 0, 0, 0)
    fin.setHours(0, 0, 0, 0)
    return this.genererRapport(type, debut, fin)
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
