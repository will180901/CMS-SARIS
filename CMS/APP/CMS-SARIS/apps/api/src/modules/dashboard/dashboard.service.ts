/**
 * DashboardService — données du tableau de bord, adaptées au persona.
 *
 * Toutes les requêtes cliniques héritent du siteId du JWT. Chaque méthode
 * alimente un bloc précis du dashboard (KPI, séries temporelles, répartitions).
 * Les méthodes admin (système / médical) sont gardées par permission côté
 * contrôleur → un persona ne charge QUE les données qui le concernent.
 */

import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

// ── Helpers de dates ──────────────────────────────────────────────────────────

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function daysAgo(n: number): Date {
  const d = startOfToday()
  d.setDate(d.getDate() - n)
  return d
}

/** Clé jour locale YYYY-MM-DD (regroupement des séries temporelles). */
function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const j = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${j}`
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // ════════════════════════════════════════════════════════════════════════
  //  CLINIQUE
  // ════════════════════════════════════════════════════════════════════════

  /** KPI cliniques instantanés du jour (+ tendance vs hier). */
  async getOverview(siteId: string) {
    const startOfDay = startOfToday()
    const startOfYesterday = daysAgo(1)

    const [
      visitesAttente, visitesEnCours, visitesCloturees, visitesAnnulees,
      consultActives, consultClotureesJour,
      ordValidesJour,
      bonsAttente,
      evacEnCours,
      visitesHier,
    ] = await Promise.all([
      this.prisma.visite.count({ where: { siteId, statut: 'EN_ATTENTE' } }),
      this.prisma.visite.count({ where: { siteId, statut: 'EN_COURS'   } }),
      this.prisma.visite.count({ where: { siteId, statut: 'CLOTUREE', dateOuverture: { gte: startOfDay } } }),
      this.prisma.visite.count({ where: { siteId, statut: 'ANNULEE',  dateOuverture: { gte: startOfDay } } }),

      this.prisma.consultation.count({ where: { statut: 'OUVERTE', visite: { siteId } } }),
      this.prisma.consultation.count({ where: { statut: 'CLOTUREE', closedAt: { gte: startOfDay }, visite: { siteId } } }),

      this.prisma.ordonnance.count({ where: { statut: 'VALIDEE', createdAt: { gte: startOfDay }, consultation: { visite: { siteId } } } }),

      this.prisma.bonExamen.count({ where: { statut: 'EN_ATTENTE', consultation: { visite: { siteId } } } }),

      this.prisma.evacuation.count({ where: { statut: 'EN_COURS', consultation: { visite: { siteId } } } }),

      this.prisma.visite.count({
        where: { siteId, dateOuverture: { gte: startOfYesterday, lt: startOfDay } },
      }),
    ])

    const visitesAujourdhui = visitesAttente + visitesEnCours + visitesCloturees + visitesAnnulees

    // ── Temps moyen d'attente (min) sur les visites clôturées du jour ──
    const visitesCloAvecDate = await this.prisma.visite.findMany({
      where:  { siteId, statut: 'CLOTUREE', dateCloture: { not: null, gte: startOfDay } },
      select: { dateOuverture: true, dateCloture: true },
    })
    const tempsAttenteMoyenMin = visitesCloAvecDate.length === 0
      ? null
      : Math.round(
          visitesCloAvecDate.reduce(
            (acc, v) => acc + (v.dateCloture!.getTime() - v.dateOuverture.getTime()), 0,
          ) / visitesCloAvecDate.length / 60_000,
        )

    return {
      visitesAujourdhui, visitesAttente, visitesEnCours, visitesCloturees, visitesAnnulees,
      visitesHier,
      tendanceVisitesPct: visitesHier === 0 ? null : Math.round(((visitesAujourdhui - visitesHier) / visitesHier) * 100),
      tempsAttenteMoyenMin,
      consultationsActives:       consultActives,
      consultationsClotureesJour: consultClotureesJour,
      ordonnancesValideesJour:    ordValidesJour,
      bonsExamenAttente:          bonsAttente,
      evacuationsEnCours:         evacEnCours,
    }
  }

  /** Série temporelle : nombre de visites par jour sur `jours` jours (incl. aujourd'hui). */
  async getActivityTrend(siteId: string, jours = 14) {
    const debut = daysAgo(jours - 1)
    const visites = await this.prisma.visite.findMany({
      where:  { siteId, dateOuverture: { gte: debut } },
      select: { dateOuverture: true, statut: true },
    })

    // Comptage par jour (toutes / clôturées)
    const parJour = new Map<string, { total: number; cloturees: number }>()
    for (let i = 0; i < jours; i++) {
      const d = new Date(debut); d.setDate(debut.getDate() + i)
      parJour.set(dayKey(d), { total: 0, cloturees: 0 })
    }
    for (const v of visites) {
      const k = dayKey(v.dateOuverture)
      const slot = parJour.get(k)
      if (slot) {
        slot.total++
        if (v.statut === 'CLOTUREE') slot.cloturees++
      }
    }

    return [...parJour.entries()].map(([date, c]) => ({
      date,                       // YYYY-MM-DD
      visites:   c.total,
      cloturees: c.cloturees,
    }))
  }

  /** Affluence du jour par tranche horaire (0h→23h) — anticipation des pics. */
  async getHourlyAffluence(siteId: string) {
    const startOfDay = startOfToday()
    const visites = await this.prisma.visite.findMany({
      where:  { siteId, dateOuverture: { gte: startOfDay } },
      select: { dateOuverture: true },
    })

    // On présente la plage d'ouverture typique d'un centre (6h → 20h).
    const HEURE_MIN = 6, HEURE_MAX = 20
    const buckets = new Map<number, number>()
    for (let h = HEURE_MIN; h <= HEURE_MAX; h++) buckets.set(h, 0)
    for (const v of visites) {
      const h = v.dateOuverture.getHours()
      if (h >= HEURE_MIN && h <= HEURE_MAX) buckets.set(h, (buckets.get(h) ?? 0) + 1)
    }

    return [...buckets.entries()].map(([heure, count]) => ({
      heure,                                   // 6..20
      label: `${String(heure).padStart(2, '0')}h`,
      count,
    }))
  }

  /** Top 5 motifs du jour (pour donut / barres). */
  async getMotifsDuJour(siteId: string) {
    const startOfDay = startOfToday()
    const rows = await this.prisma.visite.groupBy({
      by: ['motifPrincipalId'],
      where: { siteId, dateOuverture: { gte: startOfDay } },
      _count: { _all: true },
      orderBy: { _count: { motifPrincipalId: 'desc' } },
      take: 5,
    })
    if (rows.length === 0) return []

    const motifs = await this.prisma.motifConsultation.findMany({
      where: { id: { in: rows.map(r => r.motifPrincipalId) } },
      select: { id: true, libelle: true },
    })
    const map = new Map(motifs.map(m => [m.id, m]))
    return rows.map(r => ({
      motifId:  r.motifPrincipalId,
      libelle:  map.get(r.motifPrincipalId)?.libelle ?? '—',
      count:    r._count._all,
    }))
  }

  /** File d'attente : visites en attente, par ordre d'arrivée (plus ancienne d'abord). */
  async getUrgences(siteId: string) {
    return this.prisma.visite.findMany({
      where: { siteId, statut: 'EN_ATTENTE' },
      include: {
        patient: {
          select: { numeroPatient: true, identite: { select: { nom: true, prenom: true } } },
        },
        motifPrincipal: { select: { id: true, code: true, libelle: true } },
      },
      orderBy: { dateOuverture: 'asc' },
      take: 10,
    })
  }

  // ════════════════════════════════════════════════════════════════════════
  //  ADMIN SYSTÈME (gouvernance) — gardé par `utilisateur.read`
  // ════════════════════════════════════════════════════════════════════════

  async getAdminSystemStats(siteId: string) {
    const since24h = new Date(Date.now() - 24 * 60 * 60_000)
    const since7j  = daysAgo(6)

    const [comptesActifs, comptesBloques, comptesDesactives, totalRoles, echecs24h, totalSessions] =
      await Promise.all([
        this.prisma.utilisateur.count({ where: { siteId, statut: 'ACTIF' } }),
        this.prisma.utilisateur.count({ where: { siteId, statut: 'BLOQUE' } }),
        this.prisma.utilisateur.count({ where: { siteId, statut: 'DESACTIVE' } }),
        this.prisma.role.count(),
        this.prisma.journalAuthentification.count({
          // Les résultats sont préfixés : SUCCES_LOGIN, ECHEC_MOT_DE_PASSE, etc.
          // Un échec = code commençant par « ECHEC » (≠ tout ce qui n'est pas SUCCES).
          where: { resultat: { startsWith: 'ECHEC' }, createdAt: { gte: since24h }, utilisateur: { siteId } },
        }),
        this.prisma.sessionUtilisateur.count({
          where: { revokedAt: null, expiresAt: { gt: new Date() }, utilisateur: { siteId } },
        }),
      ])

    // Série 7 jours : authentifications réussies vs échouées (utilisateurs du site)
    const auths = await this.prisma.journalAuthentification.findMany({
      where:  { createdAt: { gte: since7j }, utilisateur: { siteId } },
      select: { createdAt: true, resultat: true },
    })
    const parJour = new Map<string, { succes: number; echecs: number }>()
    for (let i = 0; i < 7; i++) {
      const d = new Date(since7j); d.setDate(since7j.getDate() + i)
      parJour.set(dayKey(d), { succes: 0, echecs: 0 })
    }
    for (const a of auths) {
      const slot = parJour.get(dayKey(a.createdAt))
      // Convention : SUCCES_* = réussite, ECHEC_* = échec (cf. journalisation).
      if (slot) { if (a.resultat.startsWith('SUCCES')) slot.succes++; else slot.echecs++ }
    }
    const authTrend = [...parJour.entries()].map(([date, c]) => ({ date, ...c }))

    // Volume d'actions d'audit sur 7 jours
    const auditActions7j = await this.prisma.journalAudit.count({ where: { createdAt: { gte: since7j } } })

    return {
      comptes: {
        actifs: comptesActifs, bloques: comptesBloques, desactives: comptesDesactives,
        total: comptesActifs + comptesBloques + comptesDesactives,
      },
      totalRoles,
      echecsConnexion24h: echecs24h,
      sessionsActives:    totalSessions,
      auditActions7j,
      authTrend,
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  STATISTIQUES (finalité « Jeannette ») — type × pathologie × catégorie
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Agrégation des consultations sur une période (défaut : 30 derniers jours),
   * site-scopée : répartition par type de consultation, par pathologie (diagnostic
   * principal) et par catégorie de patient, + repos maladie. Remplace le comptage
   * Excel manuel du système « Jeannette ».
   */
  async getStatistiques(siteId: string, fromStr?: string, toStr?: string) {
    const from = fromStr ? new Date(fromStr) : daysAgo(29)
    from.setHours(0, 0, 0, 0)
    const toEnd = toStr ? new Date(toStr) : new Date()
    toEnd.setHours(23, 59, 59, 999)
    const period = { gte: from, lte: toEnd }

    // 1. Par type de consultation
    const parTypeRows = await this.prisma.consultation.groupBy({
      by:     ['typeConsultationId'],
      where:  { visite: { siteId }, createdAt: period },
      _count: { _all: true },
    })
    const typeIds = parTypeRows.map(r => r.typeConsultationId).filter((x): x is string => !!x)
    const types = typeIds.length
      ? await this.prisma.typeConsultation.findMany({ where: { id: { in: typeIds } }, select: { id: true, libelle: true } })
      : []
    const typeMap = new Map(types.map(t => [t.id, t.libelle]))
    const parType = parTypeRows
      .map(r => ({ libelle: r.typeConsultationId ? (typeMap.get(r.typeConsultationId) ?? '—') : 'Non précisé', count: r._count._all }))
      .sort((a, b) => b.count - a.count)

    // 2. Par pathologie (diagnostic principal)
    const parPathoRows = await this.prisma.diagnosticConsultation.groupBy({
      by:     ['pathologieId'],
      where:  { type: 'PRINCIPAL', consultation: { visite: { siteId }, createdAt: period } },
      _count: { _all: true },
    })
    const pathoIds = parPathoRows.map(r => r.pathologieId)
    const pathos = pathoIds.length
      ? await this.prisma.pathologieReference.findMany({ where: { id: { in: pathoIds } }, select: { id: true, libelle: true } })
      : []
    const pathoMap = new Map(pathos.map(p => [p.id, p.libelle]))
    const parPathologie = parPathoRows
      .map(r => ({ libelle: pathoMap.get(r.pathologieId) ?? '—', count: r._count._all }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)

    // 3. Par catégorie de patient + repos (agrégation en mémoire)
    const consults = await this.prisma.consultation.findMany({
      where:  { visite: { siteId }, createdAt: period },
      select: {
        reposJours: true,
        visite: { select: { patient: { select: { categoriePatient: { select: { libelle: true } } } } } },
      },
    })
    const catMap = new Map<string, number>()
    let totalReposJours = 0, consultAvecRepos = 0
    for (const c of consults) {
      const lib = c.visite?.patient?.categoriePatient?.libelle ?? '—'
      catMap.set(lib, (catMap.get(lib) ?? 0) + 1)
      if (c.reposJours && c.reposJours > 0) { totalReposJours += c.reposJours; consultAvecRepos++ }
    }
    const parCategorie = [...catMap.entries()]
      .map(([libelle, count]) => ({ libelle, count }))
      .sort((a, b) => b.count - a.count)

    return {
      periode:            { from: dayKey(from), to: dayKey(toEnd) },
      totalConsultations: consults.length,
      repos:              { consultationsAvecRepos: consultAvecRepos, totalJours: totalReposJours },
      parType,
      parPathologie,
      parCategorie,
    }
  }
}
