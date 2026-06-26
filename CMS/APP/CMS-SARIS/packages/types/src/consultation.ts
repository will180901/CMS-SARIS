import type { StatutSyncLocal } from './patient.js'
import type { SoignantResume, ConstanteVitale } from './visite.js'

// ── Enums & types ─────────────────────────────────────────────────────────────

export type StatutConsultation = 'OUVERTE' | 'CLOTUREE' | 'ANNULEE'

export type DecisionMedicale =
  | 'CLOTURE_SIMPLE'
  | 'PRESCRIPTION'
  | 'EXAMEN_COMPLEMENTAIRE'
  | 'EVACUATION'

export type TypeDiagnostic = 'PRINCIPAL' | 'ASSOCIE'
export type CertitudeDiagnostic = 'CONFIRME' | 'PROBABLE' | 'SUSPECTE'
export type StatutOrdonnance = 'BROUILLON' | 'VALIDEE' | 'ANNULEE'

// ── Entités de base ───────────────────────────────────────────────────────────

export interface Consultation {
  id:               string
  visiteId:         string
  soignantId:       string
  delegationId?:    string | null
  statut:           StatutConsultation
  examenClinique?:  string | null
  conclusion?:      string | null
  decisionMedicale?: DecisionMedicale | null
  motifAnnulation?: string | null
  typeConsultationId?: string | null
  reposJours?:      number | null
  reposInclutJour?: boolean | null
  dateReprise?:     string | null
  version:          number
  createdAt:        string
  closedAt?:        string | null
  pickedUpById?:    string | null
  pickedUpAt?:      string | null
}

/** Détenteur du verrou souple (qui a la consultation en main). */
export interface PriseEnCharge {
  userId: string
  nom:    string
  at:     string | null
}

export interface DiagnosticConsultation {
  id:             string
  consultationId: string
  pathologieId:   string
  type:           TypeDiagnostic
  certitude:      CertitudeDiagnostic
}

export interface Ordonnance {
  id:              string
  consultationId:  string
  prescripteurId:  string
  delegationId?:   string | null
  statut:          StatutOrdonnance
  motifAnnulation?: string | null
  createdAt:       string
}

export interface LigneOrdonnance {
  id:             string
  ordonnanceId:   string
  medicamentId:   string
  posologie:      string
  duree:          string
  voieAdmin:      string
  instructions?:  string | null
  justification?: string | null
}

// ── Résumés pour les relations ────────────────────────────────────────────────

export interface PathologieResume {
  id:       string
  code:     string
  libelle:  string
  chronique: boolean
}

export interface MedicamentResume {
  id:           string
  nomGenerique:  string
  nomCommercial?: string | null
}

export interface TypeConsultationResume {
  id:      string
  code:    string
  libelle: string
}

// ── Types enrichis (avec relations) ──────────────────────────────────────────

export interface DiagnosticDetail extends DiagnosticConsultation {
  pathologie: PathologieResume
}

export interface LigneOrdonnanceDetail extends LigneOrdonnance {
  medicament: MedicamentResume
}

export interface OrdonnanceDetail extends Ordonnance {
  lignes: LigneOrdonnanceDetail[]
}

export interface VisiteResume {
  id:             string
  dateOuverture:  string
  notesAccueil?:  string | null
  patient: {
    id:              string
    numeroPatient:   string
    identite:        { nom: string; prenom: string; dateNaissance: string; sexe: string } | null
    categoriePatient: { id: string; code: string; libelle: string }
    allergies:        { id: string; substance: string; gravite: string }[]
    alertesMedicales: { id: string; type: string; message: string; gravite: string }[]
  }
  motifPrincipal: { id: string; code: string; libelle: string }
  constantes:     ConstanteVitale[]
}

export interface ConsultationListItem extends Consultation {
  soignant: SoignantResume | null
  visite:   VisiteResume
  typeConsultation: TypeConsultationResume | null
  _count: { diagnostics: number; ordonnances: number }
}

export interface ConsultationDetail extends ConsultationListItem {
  diagnostics: DiagnosticDetail[]
  ordonnances: OrdonnanceDetail[]
  /** Présence d'une évacuation (relation 1-1) + son statut (pour ignorer une évacuation ANNULE). */
  evacuation:      { id: string; statut: string } | null
  /** Compteurs des relations 1-N non chargées en entier (pour les badges d'onglets). */
  _count: {
    diagnostics:    number
    ordonnances:    number
    bonsExamen:     number
  }
  /** Verrou souple : utilisateur qui a la consultation en main (null si libre). */
  priseEnCharge?: PriseEnCharge | null
}

// ── Offline ───────────────────────────────────────────────────────────────────

export interface ConsultationLocal extends Consultation {
  syncStatus: StatutSyncLocal
}
