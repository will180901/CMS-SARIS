import type { StatutSyncLocal } from './patient.js'

export type StatutVisite =
  | 'EN_ATTENTE'
  | 'EN_COURS'
  | 'CLOTUREE'
  | 'ANNULEE'

export interface Visite {
  id:               string
  patientId:        string
  siteId:           string
  motifPrincipalId: string
  statut:           StatutVisite
  dateOuverture:    string
  dateCloture?:     string | null
  soignantId?:      string | null
  notesAccueil?:    string | null
  motifAnnulation?: string | null
  createdAt:        string
  creerHorsLigne:   boolean
}

export type TypeEvenementVisite =
  | 'STATUT_CHANGE'
  | 'PRIORITE_CHANGE'
  | 'SOIGNANT_CHANGE'
  | 'NOTES_UPDATE'

export interface VisiteEvenement {
  id:          string
  visiteId:    string
  type:        TypeEvenementVisite
  ancienneVal: string | null
  nouvelleVal: string | null
  acteurId:    string
  commentaire: string | null
  createdAt:   string
  acteur?:     SoignantResume | null   // enrichi par le backend
}

export interface ConstanteVitale {
  id:               string
  visiteId:         string
  patientId:        string
  temperature?:     number | null
  tensionSystolique?: number | null
  tensionDiastolique?: number | null
  frequenceCardiaque?: number | null
  saturationO2?:    number | null
  poids?:           number | null
  taille?:          number | null
  imc?:             number | null
  glycemie?:        number | null
  etatConscience?:  string | null
  scoreGlasgow?:    number | null
  etatGeneral?:     string | null
  hydratation?:     string | null
  coloration?:      string | null
  saisiePar:        string
  createdAt:        string
}

// ── Types enrichis pour l'affichage (avec relations) ─────────────────────────

export interface SoignantResume {
  id:        string
  nom:       string
  prenom:    string
  matricule: string
  role:      string
}

export interface VisitePatientResume {
  id:              string
  numeroPatient:   string
  identite:        { nom: string; prenom: string; dateNaissance: string; sexe: string; photoUrl?: string | null } | null
  categoriePatient: { id: string; code: string; libelle: string }
  allergies:       { id: string; substance: string; gravite: string }[]
  alertesMedicales: { id: string; type: string; message: string; gravite: string }[]
  /** Renseigné uniquement sur le détail (findById), pas dans la liste. */
  antecedents?:    { id: string; type: string; description: string; statut: string }[]
}

export interface VisiteListItem extends Visite {
  patient:        VisitePatientResume
  site:           { id: string; code: string; libelle: string }
  motifPrincipal: { id: string; code: string; libelle: string }
  soignant:       SoignantResume | null
}

export interface VisiteDetail extends VisiteListItem {
  constantes: ConstanteVitale[]
  evenements: VisiteEvenement[]
}

// ── Offline ───────────────────────────────────────────────────────────────────

export interface VisiteLocal extends Visite {
  syncStatus: StatutSyncLocal
}
