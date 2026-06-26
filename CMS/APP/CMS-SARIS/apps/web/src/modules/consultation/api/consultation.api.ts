/**
 * consultation.api.ts — Couche d'accès API pour le module Consultation
 */

import { api } from '@/lib/api'
import type {
  ConsultationListItem, ConsultationDetail,
  DiagnosticDetail, OrdonnanceDetail, LigneOrdonnanceDetail,
} from '@cms-saris/types'

// ── Payload types ─────────────────────────────────────────────────────────────

export interface CreateConsultationPayload {
  visiteId:      string
}

export interface AddDiagnosticPayload {
  pathologieId: string
  type:         'PRINCIPAL' | 'ASSOCIE'
  certitude:    'CONFIRME' | 'PROBABLE' | 'SUSPECTE'
}

export interface CloturerPayload {
  decisionMedicale: string
  conclusion?:      string
}

export interface SetReposPayload {
  reposJours?:      number | null
  reposInclutJour?: boolean
  dateReprise?:     string | null
}

export interface AddLignePayload {
  medicamentId:  string
  posologie:     string
  duree:         string
  voieAdmin:     string
  instructions?: string
  justification?: string
  /** Confirmation médicale explicite pour passer outre une contre-indication bloquante. */
  acknowledgeWarnings?: boolean
}

export interface ConsultationQueryParams {
  statut?:    'ACTIVES' | 'OUVERTE' | 'CLOTUREE' | 'ANNULEE' | 'TOUTES'
  patientId?: string
}

export interface PatientDocument {
  id:             string
  type:           'ORDONNANCE' | 'BON_EXAMEN' | 'BON_PHARMACIE' | 'EVACUATION'
  consultationId: string
  date:           string
  statut:         string
  titre:          string
  details:        string
  motif:          string
  /** Site où l'acte a été réalisé (repère continuité multi-site). */
  site:           string | null
}

// ── API ───────────────────────────────────────────────────────────────────────

export const consultationApi = {
  // Liste
  list: (params?: ConsultationQueryParams) =>
    api.get<ConsultationListItem[]>('/consultations', params as Record<string, string>),

  // Détail
  findById: (id: string) =>
    api.get<ConsultationDetail>(`/consultations/${id}`),

  // Documents générés d'un patient (dossier → onglet Documents)
  patientDocuments: (patientId: string) =>
    api.get<PatientDocument[]>(`/consultations/patient/${patientId}/documents`),

  // Créer
  create: (data: CreateConsultationPayload) =>
    api.post<ConsultationDetail>('/consultations', data),

  // Examen clinique
  updateExamen: (id: string, examenClinique: string | null) =>
    api.patch(`/consultations/${id}/examen`, { examenClinique }),

  // Conclusion
  updateConclusion: (id: string, conclusion: string | null) =>
    api.patch(`/consultations/${id}/conclusion`, { conclusion }),

  // Diagnostics
  addDiagnostic: (id: string, data: AddDiagnosticPayload) =>
    api.post<DiagnosticDetail>(`/consultations/${id}/diagnostics`, data),

  removeDiagnostic: (id: string, diagId: string) =>
    api.delete<void>(`/consultations/${id}/diagnostics/${diagId}`),

  // Clôturer
  cloturer: (id: string, data: CloturerPayload) =>
    api.patch<ConsultationDetail>(`/consultations/${id}/cloturer`, data),

  // Annuler
  annuler: (id: string, motifAnnulation: string) =>
    api.patch(`/consultations/${id}/annuler`, { motifAnnulation }),

  // Supprimer définitivement (consultation ANNULÉE sans documents)
  remove: (id: string) =>
    api.delete<{ deleted: boolean }>(`/consultations/${id}`),

  // Verrou souple : prendre la consultation en main
  prendreEnCharge: (id: string) =>
    api.post<ConsultationDetail>(`/consultations/${id}/prise-en-charge`, {}),

  // Ordonnances
  createOrdonnance: (id: string) =>
    api.post<OrdonnanceDetail>(`/consultations/${id}/ordonnances`, {}),

  addLigne: (id: string, ordId: string, data: AddLignePayload) =>
    api.post<LigneOrdonnanceDetail>(`/consultations/${id}/ordonnances/${ordId}/lignes`, data),

  removeLigne: (id: string, ordId: string, ligneId: string) =>
    api.delete<void>(`/consultations/${id}/ordonnances/${ordId}/lignes/${ligneId}`),

  validerOrdonnance: (id: string, ordId: string) =>
    api.patch<OrdonnanceDetail>(`/consultations/${id}/ordonnances/${ordId}/valider`),

  annulerOrdonnance: (id: string, ordId: string) =>
    api.patch<OrdonnanceDetail>(`/consultations/${id}/ordonnances/${ordId}/annuler`),

  deleteOrdonnance: (id: string, ordId: string) =>
    api.delete<void>(`/consultations/${id}/ordonnances/${ordId}`),

  // Type de consultation
  setType: (id: string, typeConsultationId: string | null) =>
    api.patch<ConsultationDetail>(`/consultations/${id}/type`, { typeConsultationId }),

  // Repos maladie
  setRepos: (id: string, data: SetReposPayload) =>
    api.patch<ConsultationDetail>(`/consultations/${id}/repos`, data),
}
