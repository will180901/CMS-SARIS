/**
 * bon-examen.api.ts — Couche d'accès API pour les bons d'examen complémentaires.
 */

import { api } from '@/lib/api'

export interface LigneExamen {
  id:           string
  bonId:        string
  typeExamenId: string
  typeExamen: {
    id:      string
    code:    string
    libelle: string
    domaine: string
  }
}

export interface ResultatExamen {
  id:             string
  bonId:          string
  laboratoire:    string | null
  contenu:        string
  interpretation: string | null
  statut:         string
  saisiePar:      string
  createdAt:      string
}

export interface BonExamen {
  id:               string
  consultationId:   string
  /** Ordonnance PRESCRIPTION_EXAMEN dont ce bon a été généré (null pour un bon historique). */
  ordonnanceId?:    string | null
  /** Statut actuel de cette ordonnance — signale un bon dont l'ordonnance a été annulée après coup. */
  ordonnance?:      { id: string; statut: string } | null
  indicationClinik: string
  etablissementId:  string | null
  statut:           'EN_ATTENTE' | 'VALIDE' | 'ANNULE'
  motifAnnulation:  string | null
  createdAt:        string
  lignes:           LigneExamen[]
  resultats:        ResultatExamen[]
  consultation: {
    id: string
    visite: {
      patient: {
        id: string
        numeroPatient: string
        identite: { nom: string; prenom: string; dateNaissance: string | null; sexe: string | null } | null
      }
    }
  }
}

// ── Payloads ──────────────────────────────────────────────────────────────────
// Pas de payload de création ici : un bon d'examen naît exclusivement de « Générer un
// bon » sur une ordonnance PRESCRIPTION_EXAMEN validée (consultationApi.genererBon).

export interface UpdateBonExamenPayload {
  indicationClinik?: string
  etablissementId?:  string | null
}

export interface ValiderBonExamenPayload {
  statut:           'VALIDE' | 'ANNULE'
  motifAnnulation?: string
}

export interface SaisirResultatPayload {
  contenu:        string
  laboratoire?:   string
  interpretation?: string
}

export interface BonExamenQueryParams {
  consultationId?: string
  patientId?:      string
  statut?:         'EN_ATTENTE' | 'VALIDE' | 'ANNULE' | 'TOUS'
}

// ── API ───────────────────────────────────────────────────────────────────────

export const bonExamenApi = {
  list:        (params?: BonExamenQueryParams) =>
    api.get<BonExamen[]>('/bons-examen', params as Record<string, string>),
  findById:    (id: string) =>
    api.get<BonExamen>(`/bons-examen/${id}`),
  update:      (id: string, data: UpdateBonExamenPayload) =>
    api.patch<BonExamen>(`/bons-examen/${id}`, data),
  validerOuAnnuler: (id: string, data: ValiderBonExamenPayload) =>
    api.patch<BonExamen>(`/bons-examen/${id}/statut`, data),
  annuler: (id: string, motifAnnulation: string) =>
    api.patch<BonExamen>(`/bons-examen/${id}/annuler`, { motifAnnulation }),
  saisirResultat: (id: string, data: SaisirResultatPayload) =>
    api.post<BonExamen>(`/bons-examen/${id}/resultats`, data),
  remove: (id: string) =>
    api.delete<{ id: string; deleted: boolean }>(`/bons-examen/${id}`),
}
