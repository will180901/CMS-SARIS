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

export interface RapportDetail extends RapportResume {
  contenu: StatistiquesActivite
}

export const rapportsApi = {
  list:    (type?: TypeRapport) => api.get<RapportResume[]>('/rapports', type ? { type } : undefined),
  findOne: (id: string) => api.get<RapportDetail>(`/rapports/${id}`),
}
