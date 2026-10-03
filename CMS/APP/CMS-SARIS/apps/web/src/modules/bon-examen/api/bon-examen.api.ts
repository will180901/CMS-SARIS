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
  /** RECU (en vigueur) | REMPLACE (corrigé par un résultat plus récent) */
  statut:         string
  saisiePar:      string
  createdAt:      string
  /** Examen prescrit visé ; null = ancienne saisie globale, pour tout le bon. */
  ligneExamenId?:   string | null
  /** Date à laquelle l'examen a été réalisé (≠ date de saisie). */
  dateRealisation?: string | null
  anormal?:         boolean | null
  /** Ce résultat corrige le résultat `corrigeId`. */
  corrigeId?:       string | null
  motifCorrection?: string | null
}

/** Compte rendu du laboratoire joint au bon (métadonnées ; le contenu se lit à la demande). */
export interface PieceJointeResultat {
  id:         string
  nomFichier: string
  mimeType:   string
  taille:     number
  createdAt:  string
  createdBy:  string | null
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
  piecesJointes?:   PieceJointeResultat[]
  /** Établissement choisi à la prescription — pré-remplit le laboratoire. */
  etablissementNom?: string | null
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
  /** Un résultat par examen prescrit (saisie partielle permise). */
  resultats?:       { ligneExamenId: string; contenu: string; anormal?: boolean }[]
  /** Ancienne forme : un texte pour tout le bon. */
  contenu?:         string
  laboratoire?:     string
  interpretation?:  string
  dateRealisation?: string
}

export interface CorrigerResultatPayload {
  contenu:          string
  anormal?:         boolean
  laboratoire?:     string
  interpretation?:  string
  dateRealisation?: string
  motifCorrection:  string
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
  corrigerResultat: (id: string, resultatId: string, data: CorrigerResultatPayload) =>
    api.patch<BonExamen>(`/bons-examen/${id}/resultats/${resultatId}`, data),
  ajouterCompteRendu: (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.upload<BonExamen>(`/bons-examen/${id}/pieces-jointes`, form)
  },
  lireCompteRendu: (id: string, pieceId: string) =>
    api.get<{ id: string; nomFichier: string; mimeType: string; dataUrl: string }>(`/bons-examen/${id}/pieces-jointes/${pieceId}`),
  retirerCompteRendu: (id: string, pieceId: string) =>
    api.delete<BonExamen>(`/bons-examen/${id}/pieces-jointes/${pieceId}`),
  remove: (id: string) =>
    api.delete<{ id: string; deleted: boolean }>(`/bons-examen/${id}`),
}
