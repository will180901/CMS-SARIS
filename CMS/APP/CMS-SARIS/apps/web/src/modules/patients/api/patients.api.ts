/**
 * patients.api.ts — Couche d'accès API pour le module Dossier Patient
 */

import { api } from '@/lib/api'
import type {
  PatientListItem, PatientDossier,
  AllergiePatient, AntecedentPatient, AlerteMedicale,
  RattachementAyantDroitCdi, RattachementSousTraitant,
  ConstanteVitale,
} from '@cms-saris/types'

// ── Payload types ─────────────────────────────────────────────────────────────

export interface CreatePatientPayload {
  nom:               string
  prenom:            string
  dateNaissance:     string
  sexe:              'M' | 'F'
  categoriePatientId: string
  siteCreationId:    string
  telephone?:        string
  adresse?:          string
  matricule?:        string
  // Données professionnelles (CDI/CDD) — recueil
  fonction?:         string
  sectionPaie?:      string
  service?:          string
  departement?:      string
  // Rattachement saisi à la création (recueil §5)
  cdiMatricule?:     string   // ayant droit : matricule du CDI rattaché
  typeLien?:         string   // ayant droit : CONJOINT | ENFANT | PARENT | AUTRE
  societeId?:        string   // sous-traitant : société
  // Ayant droit : CDI à enregistrer au registre si son matricule est inconnu
  nouvelEmploye?: {
    nom:           string
    prenom:        string
    dateNaissance?: string
    sexe?:         string
    fonction?:     string
    sectionPaie?:  string
    service?:      string
    departement?:  string
  }
  contactUrgence?: {
    nom:       string
    prenom:    string
    telephone: string
    lien:      string
  }
}

export interface UpdateIdentitePayload {
  nom?:           string
  prenom?:        string
  dateNaissance?: string
  sexe?:          'M' | 'F'
  telephone?:     string
  adresse?:       string
  matricule?:     string
  fonction?:      string
  sectionPaie?:   string
  service?:       string
  departement?:   string
  contactUrgence?: {
    nom?:       string
    prenom?:    string
    telephone?: string
    lien?:      string
  }
}

export interface ChangerCategoriePayload {
  nouvelleCategId: string
  motif:           string
}

// Mode de vie (recueil) — toutes catégories
export interface ModeViePayload {
  tabac?:            string
  alcool?:           string
  drogues?:          string
  activitePhysique?: string
  alimentation?:     string
  sommeil?:          string
  troublesSommeil?:  string
  sedentarite?:      string
  portCharges?:      string
  observations?:     string
}

export interface PatientQueryParams {
  search?:     string
  categorieId?: string
  siteId?:     string
  statut?:     string
}

export interface SimilarPatientQuery {
  nom:            string
  prenom:         string
  dateNaissance?: string
  sexe?:          'M' | 'F'
}

export interface SimilarPatient {
  id:            string
  numeroPatient: string
  identite:      { nom: string; prenom: string; dateNaissance: string; sexe: string } | null
  categoriePatient: { id: string; code: string; libelle: string } | null
  correspondanceDate:   boolean
  correspondanceExacte: boolean
}

export interface AlerteClinique {
  type:    'ALLERGIE_MEDICAMENT' | 'CONSTANTE_CRITIQUE' | 'CHRONIQUE_SANS_SUIVI'
  gravite: 'CRITIQUE' | 'ELEVE' | 'MODERE'
  titre:   string
  detail:  string
}

export interface AllergiePayload {
  substance: string
  gravite:   string
  confirme?: boolean
  statut?:   string
}

export interface AntecedentPayload {
  type:        string
  description: string
  statut?:     string
}

export interface AlertePayload {
  type:    string
  message: string
  gravite: string
  statut?: string
}

export interface RattachementADPayload {
  cdiId:    string
  typeLien: string
  dateDebut: string
  dateFin?:  string
  statut?:  string
}

export interface RattachementSTPayload {
  societeId: string
  dateDebut: string
  dateFin?:  string
  statut?:   string
}

// Ayant droit (dépendant) d'un travailleur CDI + son activité médicale récente.
export interface AyantDroitLien {
  id:        string
  typeLien:  string
  dateDebut: string
  patient: {
    id:               string
    numeroPatient:    string
    categoriePatient: { code: string; libelle: string }
    identite:         { nom: string; prenom: string; dateNaissance: string; sexe: string } | null
    visites: Array<{
      id:             string
      dateOuverture:  string
      statut:         string
      motifPrincipal: { libelle: string }
      consultations:  Array<{ id: string; statut: string }>
    }>
  }
}

// Rapprochement d'un travailleur CDI par matricule (inscription ayant droit).
export interface MatriculeLookup {
  id:               string
  numeroPatient:    string
  matricule:        string | null
  categoriePatient: { code: string; libelle: string }
  identite:         { nom: string; prenom: string; dateNaissance: string; sexe: string } | null
}

// ── API ───────────────────────────────────────────────────────────────────────

export const patientsApi = {
  // Liste + dossier
  list:    (params?: PatientQueryParams) => api.get<PatientListItem[]>('/patients', params as Record<string, string>),
  findById: (id: string)                 => api.get<PatientDossier>(`/patients/${id}`),
  create:  (data: CreatePatientPayload)  => api.post<PatientDossier>('/patients', data),
  findSimilar: (q: SimilarPatientQuery)  => api.get<SimilarPatient[]>('/patients/similar', q as unknown as Record<string, string>),
  constantes: (id: string)               => api.get<ConstanteVitale[]>(`/patients/${id}/constantes`),
  alertesCliniques: (id: string)         => api.get<AlerteClinique[]>(`/patients/${id}/alertes-cliniques`),
  ayantsDroits: (id: string)             => api.get<AyantDroitLien[]>(`/patients/${id}/ayants-droits`),
  byMatricule:  (matricule: string)      => api.get<MatriculeLookup>(`/patients/by-matricule/${encodeURIComponent(matricule)}`),

  // Photo (upload fichier)
  uploadPhoto: (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.upload<{ photoUrl: string }>(`/patients/${id}/photo`, form)
  },

  // Identité & catégorie
  updateIdentite:   (id: string, data: UpdateIdentitePayload)     => api.patch<PatientDossier>(`/patients/${id}/identite`, data),
  updateModeVie:    (id: string, data: ModeViePayload)            => api.patch<PatientDossier>(`/patients/${id}/mode-vie`, data),
  changerCategorie: (id: string, data: ChangerCategoriePayload)   => api.patch<PatientDossier>(`/patients/${id}/categorie`, data),
  updateStatut:     (id: string, statut: string)                  => api.patch<PatientDossier>(`/patients/${id}/statut`, { statut }),
  setVerrou:        (id: string, verrouille: boolean, motif?: string) => api.patch<{ id: string; verrouille: boolean; verrouilleLe: string | null; motifVerrou: string | null }>(`/patients/${id}/verrou`, { verrouille, motif }),
  remove:           (id: string)                                  => api.delete<{ id: string; deleted: true }>(`/patients/${id}`),

  // Allergies
  createAllergie: (id: string, data: AllergiePayload)                    => api.post<AllergiePatient>(`/patients/${id}/allergies`, data),
  updateAllergie: (id: string, aId: string, data: Partial<AllergiePayload>) => api.patch<AllergiePatient>(`/patients/${id}/allergies/${aId}`, data),
  deleteAllergie: (id: string, aId: string)                              => api.delete<{ id: string; deleted: true }>(`/patients/${id}/allergies/${aId}`),

  // Antécédents
  createAntecedent: (id: string, data: AntecedentPayload)                       => api.post<AntecedentPatient>(`/patients/${id}/antecedents`, data),
  updateAntecedent: (id: string, aId: string, data: Partial<AntecedentPayload>) => api.patch<AntecedentPatient>(`/patients/${id}/antecedents/${aId}`, data),
  deleteAntecedent: (id: string, aId: string)                                   => api.delete<{ id: string; deleted: true }>(`/patients/${id}/antecedents/${aId}`),

  // Alertes médicales
  createAlerte: (id: string, data: AlertePayload)                      => api.post<AlerteMedicale>(`/patients/${id}/alertes`, data),
  updateAlerte: (id: string, aId: string, data: Partial<AlertePayload>) => api.patch<AlerteMedicale>(`/patients/${id}/alertes/${aId}`, data),
  deleteAlerte: (id: string, aId: string)                              => api.delete<{ id: string; deleted: true }>(`/patients/${id}/alertes/${aId}`),

  // Rattachements ayant droit CDI
  createRattachementAD: (id: string, data: RattachementADPayload)                         => api.post<RattachementAyantDroitCdi>(`/patients/${id}/rattachements-ad`, data),
  updateRattachementAD: (id: string, rId: string, data: Partial<RattachementADPayload>)   => api.patch<RattachementAyantDroitCdi>(`/patients/${id}/rattachements-ad/${rId}`, data),
  deleteRattachementAD: (id: string, rId: string)                                         => api.delete<{ id: string; deleted: true }>(`/patients/${id}/rattachements-ad/${rId}`),

  // Rattachements sous-traitant
  createRattachementST: (id: string, data: RattachementSTPayload)                         => api.post<RattachementSousTraitant>(`/patients/${id}/rattachements-st`, data),
  updateRattachementST: (id: string, rId: string, data: Partial<RattachementSTPayload>)   => api.patch<RattachementSousTraitant>(`/patients/${id}/rattachements-st/${rId}`, data),
  deleteRattachementST: (id: string, rId: string)                                         => api.delete<{ id: string; deleted: true }>(`/patients/${id}/rattachements-st/${rId}`),
}
