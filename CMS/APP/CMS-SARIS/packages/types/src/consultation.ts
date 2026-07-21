import type { StatutSyncLocal } from './patient.js'
import type { SoignantResume, ConstanteVitale } from './visite.js'

// ── Enums & types ─────────────────────────────────────────────────────────────

export type StatutConsultation = 'OUVERTE' | 'CLOTUREE' | 'ANNULEE'

/** Valeurs acceptées en ÉCRITURE (clôture). Les consultations historiques peuvent porter
 *  CLOTURE_SIMPLE/PRESCRIPTION/EXAMEN_COMPLEMENTAIRE — toujours lisibles (labelDecision()
 *  bascule sur un texte humanisé), jamais réémises. D'où Consultation.decisionMedicale
 *  ci-dessous typé en `string | null`, pas en `DecisionMedicale | null`. */
export type DecisionMedicale = 'EVACUATION' | 'SUIVI_TRAITEMENT'

export type TypeOrdonnance = 'PHARMACEUTIQUE' | 'PRESCRIPTION_EXAMEN'

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
  anamneseDateDebut?: string | null
  anamneseDuree?:     string | null
  anamneseModeDebut?: string | null
  anamneseSymptomes?: string | null
  conclusion?:      string | null
  /** string, pas DecisionMedicale : peut porter une valeur historique (voir DecisionMedicale). */
  decisionMedicale?: string | null
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
  /** null = ordonnance antérieure à cette colonne, implicitement PHARMACEUTIQUE. */
  typeOrdonnance?: TypeOrdonnance | null
  indicationClinik?: string | null
  etablissementId?:  string | null
  motifAnnulation?: string | null
  createdAt:       string
}

/** Branche PHARMACEUTIQUE (medicamentId/posologie/duree/voieAdmin/quantite) OU branche
 *  PRESCRIPTION_EXAMEN (typeExamenId) — jamais les deux, selon Ordonnance.typeOrdonnance. */
export interface LigneOrdonnance {
  id:             string
  ordonnanceId:   string
  medicamentId?:  string | null
  posologie?:     string | null
  duree?:         string | null
  voieAdmin?:     string | null
  quantite?:      string | null
  typeExamenId?:  string | null
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

export interface TypeExamenResume {
  id:      string
  code:    string
  libelle: string
  domaine: string
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
  medicament?: MedicamentResume | null
  typeExamen?: TypeExamenResume | null
}

export interface OrdonnanceDetail extends Ordonnance {
  lignes: LigneOrdonnanceDetail[]
  /** Bon(s) actif(s) déjà générés depuis cette ordonnance (hors ANNULE) — piloter le bouton
   *  « Générer un bon » (déjà généré vs disponible). Un seul type des deux est jamais peuplé. */
  bonsExamen?:    { id: string }[]
  bonsPharmacie?: { id: string }[]
}

export interface VisiteResume {
  id:             string
  dateOuverture:  string
  notesAccueil?:  string | null
  patient: {
    id:              string
    numeroPatient:   string
    identite:        { nom: string; prenom: string; dateNaissance: string | null; sexe: string | null } | null
    categoriePatient: { id: string; code: string; libelle: string }
    allergies:        { id: string; substance: string; gravite: string }[]
    alertesMedicales: { id: string; type: string; message: string; gravite: string }[]
  }
  motifPrincipal: { id: string; code: string; libelle: string }
  constantes:     ConstanteVitale[]
  site:           { libelle: string }
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
  /** Présence d'un suivi de traitement (relation 1-1) + son statut (ignorer un suivi ANNULE). */
  suiviTraitement: { id: string; statut: string } | null
  /** Compteurs des relations 1-N non chargées en entier (pour les badges d'onglets). */
  _count: {
    diagnostics:    number
    ordonnances:    number
    bonsExamen:     number
    bonsPharmacie:  number
    certificats:    number
  }
  /** Verrou souple : utilisateur qui a la consultation en main (null si libre). */
  priseEnCharge?: PriseEnCharge | null
}

// ── Offline ───────────────────────────────────────────────────────────────────

export interface ConsultationLocal extends Consultation {
  syncStatus: StatutSyncLocal
}
