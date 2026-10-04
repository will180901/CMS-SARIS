/**
 * suivi-traitement.api.ts — API pour Suivi de traitement.
 */

import { api } from '@/lib/api'

// ── Suivi de traitement ─────────────────────────────────────────────────────────

export interface FicheSuiviTraitement {
  id:                     string
  suiviTraitementId:      string
  temperature:            number | null
  tensionSystolique:      number | null
  tensionDiastolique:     number | null
  frequenceCardiaque:     number | null
  frequenceRespiratoire:  number | null
  saturationO2:           number | null
  poids:                  number | null
  noteEvolution:          string | null
  medicamentsAdministres: string | null
  resultatExamen:         string | null
  createdAt:              string
  createdBy:              string | null
  /** Nom du soignant qui a saisi la fiche (résolu par le serveur). */
  auteurNom?:             string | null
}

export interface SuiviTraitement {
  id:              string
  consultationId:  string
  motif:           string
  statut:          'EN_COURS' | 'CLOTURE' | 'ANNULE'
  motifCloture:    string | null
  motifAnnulation: string | null
  createdAt:       string
  closedAt:        string | null
  consultation: {
    id: string; createdAt: string
    visite: { patient: { id: string; numeroPatient: string; identite: { nom: string; prenom: string; dateNaissance: string | null; sexe: string | null } | null } }
  }
  fiches: FicheSuiviTraitement[]
  /** Date à laquelle revoir le patient. */
  prochainControle?: string | null
  /** Séances de suivi (consultations rattachées à l'épisode). */
  seances?: { id: string; statut: string; createdAt: string }[]
}

// ── Épisode complet (dossier) ─────────────────────────────────────────────────

export interface RencontreEpisode {
  id:                  string
  statut:              string
  createdAt:           string
  closedAt:            string | null
  motifSeance:         string | null
  conclusion:          string | null
  soignant:            { nom: string; prenom: string; role: string } | null
  diagnosticPrincipal: string | null
}

export interface AdministrationEpisode {
  id:           string
  administreLe: string
  dose:         string | null
  observation:  string | null
  createdBy:    string | null
  auteurNom:    string | null
  /** Relevé au cours duquel elle a été notée (null = notée seule). */
  ficheId:      string | null
}

export interface LigneEpisode {
  id:            string
  posologie:     string | null
  duree:         string | null
  voieAdmin:     string | null
  quantite:      string | null
  instructions:  string | null
  arreteLe:      string | null
  motifArret:    string | null
  arretePar:     string | null
  remplaceParId: string | null
  arreteParNom:  string | null
  medicament:    { id: string; nomGenerique: string; nomCommercial: string | null } | null
  typeExamen:    { libelle: string } | null
  administrations: AdministrationEpisode[]
}

export interface OrdonnanceEpisode {
  id:               string
  consultationId:   string
  statut:           string
  typeOrdonnance:   string | null
  indicationClinik: string | null
  createdAt:        string
  prescripteur:     { id: string; nom: string; prenom: string; role: string } | null
  lignes:           LigneEpisode[]
  bonsPharmacie:    { statut: string; delivreLe: string | null }[]
}

export interface BonEpisode {
  id:               string
  consultationId:   string
  statut:           string
  createdAt:        string
  indicationClinik: string
  lignes:           { id: string; typeExamen: { libelle: string } }[]
  resultats:        { id: string; ligneExamenId: string | null; contenu: string; anormal: boolean | null; dateRealisation: string | null; laboratoire: string | null; interpretation: string | null; createdAt: string; corrigeId: string | null }[]
}

export interface EpisodeSuivi {
  suivi:                SuiviTraitement
  consultationInitiale: RencontreEpisode | null
  seances:              RencontreEpisode[]
  ordonnances:          OrdonnanceEpisode[]
  bons:                 BonEpisode[]
}

export interface CreateSuiviTraitementPayload {
  consultationId: string
  motif:          string
}

export interface AddFicheSuiviPayload {
  temperature?:            number
  tensionSystolique?:      number
  tensionDiastolique?:     number
  frequenceCardiaque?:     number
  frequenceRespiratoire?:  number
  saturationO2?:           number
  poids?:                  number
  noteEvolution?:          string
  medicamentsAdministres?: string
  /** Traitements prescrits administrés lors de ce relevé. */
  administrations?:        { ligneOrdonnanceId: string; dose?: string }[]
}

// ── API ───────────────────────────────────────────────────────────────────────

export const suiviTraitementApi = {
  /** L'épisode en entier : séances, traitements, examens et résultats, fiches. */
  episode: (id: string) => api.get<EpisodeSuivi>(`/suivi-traitement/${id}/episode`),
  setProchainControle: (id: string, prochainControle: string | null) =>
    api.patch<SuiviTraitement>(`/suivi-traitement/${id}/prochain-controle`, { prochainControle }),
  /** Séance de suivi lancée depuis l'épisode (sans triage) → la consultation à ouvrir. */
  creerSeance: (suiviTraitementId: string, motifSeance?: string) =>
    api.post<{ consultationId: string; existante: boolean }>('/consultations/seances-suivi', { suiviTraitementId, motifSeance }),
  list:     (params?: { consultationId?: string; patientId?: string; statut?: string }) =>
    api.get<SuiviTraitement[]>('/suivi-traitement', params as Record<string, string>),
  findById: (id: string) => api.get<SuiviTraitement>(`/suivi-traitement/${id}`),
  create:   (data: CreateSuiviTraitementPayload) => api.post<SuiviTraitement>('/suivi-traitement', data),
  addFiche: (id: string, data: AddFicheSuiviPayload) => api.post<SuiviTraitement>(`/suivi-traitement/${id}/fiches`, data),
  updateFiche: (id: string, ficheId: string, data: AddFicheSuiviPayload) => api.patch<SuiviTraitement>(`/suivi-traitement/${id}/fiches/${ficheId}`, data),
  cloturer: (id: string, motifCloture?: string) => api.patch<SuiviTraitement>(`/suivi-traitement/${id}/cloturer`, { motifCloture }),
  annuler:  (id: string, motif: string) => api.patch<SuiviTraitement>(`/suivi-traitement/${id}/annuler`, { motifAnnulation: motif }),
  supprimer: (id: string) => api.delete<{ id: string; deleted: boolean }>(`/suivi-traitement/${id}`),
  /** Arrêt d'un traitement avant sa fin prévue (date, motif, auteur tracés). */
  arreterTraitement: (id: string, ligneId: string, motifArret: string) =>
    api.patch<{ ok: true }>(`/suivi-traitement/${id}/traitements/${ligneId}/arret`, { motifArret }),
  administrer: (id: string, data: { ligneOrdonnanceId: string; dose?: string; observation?: string; administreLe?: string }) =>
    api.post<{ ok: true }>(`/suivi-traitement/${id}/administrations`, data),
  retirerAdministration: (id: string, administrationId: string) =>
    api.delete<{ deleted: true }>(`/suivi-traitement/${id}/administrations/${administrationId}`),
}
