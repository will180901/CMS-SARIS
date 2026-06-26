import { api } from '@/lib/api'

export interface DashboardOverview {
  visitesAujourdhui:        number
  visitesAttente:           number
  visitesEnCours:           number
  visitesCloturees:         number
  visitesAnnulees:          number
  visitesHier:              number
  tendanceVisitesPct:       number | null
  tempsAttenteMoyenMin:     number | null
  consultationsActives:     number
  consultationsClotureesJour: number
  ordonnancesValideesJour:  number
  bonsExamenAttente:        number
  evacuationsEnCours:       number
  accidentsTravailOuverts:  number
  suivisChroniquesActifs:   number
}

export interface MotifDuJour {
  motifId:  string
  libelle:  string
  count:    number
}

export interface UrgenceVisite {
  id:           string
  dateOuverture: string
  patient: {
    numeroPatient: string
    identite: { nom: string; prenom: string } | null
  }
  motifPrincipal: { id: string; code: string; libelle: string }
}

// ── Séries temporelles & affluence ────────────────────────────────────────────

export interface TrendPoint {
  date:      string   // YYYY-MM-DD
  visites:   number
  cloturees: number
}

export interface AffluencePoint {
  heure: number       // 6..20
  label: string       // "06h"
  count: number
}

// ── Stats gouvernance ─────────────────────────────────────────────────────────

export interface AuthTrendPoint { date: string; succes: number; echecs: number }

export interface AdminSystemStats {
  comptes: { actifs: number; bloques: number; desactives: number; total: number }
  totalRoles:          number
  echecsConnexion24h:  number
  sessionsActives:     number
  auditActions7j:      number
  authTrend:           AuthTrendPoint[]
}

export interface StatistiquesActivite {
  periode:            { from: string; to: string }
  totalConsultations: number
  repos:              { consultationsAvecRepos: number; totalJours: number }
  parType:            { libelle: string; count: number }[]
  parPathologie:      { libelle: string; count: number }[]
  parCategorie:       { libelle: string; count: number }[]
}

export const dashboardApi = {
  overview:     () => api.get<DashboardOverview>('/dashboard/overview'),
  statistiques: (params?: { from?: string; to?: string }) =>
    api.get<StatistiquesActivite>('/dashboard/statistiques', params as Record<string, string> | undefined),
  motifsJour:   () => api.get<MotifDuJour[]>('/dashboard/motifs-jour'),
  urgences:     () => api.get<UrgenceVisite[]>('/dashboard/urgences'),
  tendance:     () => api.get<TrendPoint[]>('/dashboard/tendance'),
  affluence:    () => api.get<AffluencePoint[]>('/dashboard/affluence'),
  adminSysteme: () => api.get<AdminSystemStats>('/dashboard/admin-systeme'),
}
