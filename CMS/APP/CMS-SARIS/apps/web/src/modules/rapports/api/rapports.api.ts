import { api } from '@/lib/api'
import type { StatistiquesActivite } from '@/modules/dashboard/api/dashboard.api'

export type TypeRapport = 'HEBDOMADAIRE' | 'MENSUEL' | 'ANNUEL'

export interface RapportResume {
  id:           string
  type:         TypeRapport
  periodeDebut: string
  periodeFin:   string
  genereLe:     string
}

/** Un constat notable, calculé au moment de la génération. La PHRASE est composée côté
 *  client (cf. SyntheseRapport) : le rapport stocke des données, jamais du texte. */
export interface AlerteRapport {
  code: string
  niveau: 'info' | 'attention' | 'critique'
  params: Record<string, string | number>
}

/** Un point de la tendance : une période échue et son volume. */
export interface PointSerie {
  debut:         string
  fin:           string
  consultations: number
  reposJours:    number
}

/**
 * Contenu figé d'un rapport : les statistiques de la période, PLUS de quoi les
 * interpréter — la période précédente, six périodes de tendance, et les constats notables.
 * Les trois derniers champs sont optionnels : les rapports générés avant cette évolution
 * ne les portent pas, et doivent rester lisibles.
 */
export interface ContenuRapport extends StatistiquesActivite {
  precedent?: StatistiquesActivite | null
  serie?:     PointSerie[]
  alertes?:   AlerteRapport[]
}

export interface RapportDetail extends RapportResume {
  contenu: ContenuRapport
}

export const rapportsApi = {
  list:    (type?: TypeRapport) => api.get<RapportResume[]>('/rapports', type ? { type } : undefined),
  findOne: (id: string) => api.get<RapportDetail>(`/rapports/${id}`),
  /** Génère un rapport MAINTENANT sur une période choisie (permission rapport.export). */
  generer: (type: TypeRapport, debut: string, fin: string) =>
    api.post<RapportResume>('/rapports/generer', { type, debut, fin }),
}
