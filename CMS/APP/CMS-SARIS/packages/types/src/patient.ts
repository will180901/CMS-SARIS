// ── Enums & types de base ─────────────────────────────────────────────────────

export type StatutPatient     = 'ACTIF' | 'ARCHIVE' | 'DECEDE' | 'FUSIONNE'
export type StatutSyncLocal   = 'PENDING' | 'SYNCED' | 'CONFLICT' | 'ERROR'
export type GraviteAllergie   = 'SEVERE' | 'MODERE' | 'FAIBLE'
export type GraviteAlerte     = 'CRITIQUE' | 'IMPORTANT' | 'INFO'
export type TypeAntecedent    = 'MEDICAL' | 'CHIRURGICAL' | 'FAMILIAL' | 'GYNECO_OBSTETRICAL' | 'AUTRE'
export type TypeAlerteMed     = 'ALLERGIE' | 'PATHOLOGIE_CHRONIQUE' | 'CONTRE_INDICATION' | 'SURVEILLANCE' | 'AUTRE'
export type LienParente       = 'CONJOINT' | 'ENFANT' | 'PARENT' | 'AUTRE'

// ── Résumés (sélects légers) ──────────────────────────────────────────────────

export interface CategorieResume {
  id:      string
  code:    string
  libelle: string
}

export interface SiteResume {
  id:      string
  code:    string
  libelle: string
}

// ── Patient (base) ────────────────────────────────────────────────────────────

export interface Patient {
  id:                  string
  numeroPatient:       string
  matricule:           string | null
  siteCreationId:      string
  categoriePatientId:  string
  statut:              StatutPatient
  version:             number
  /** Verrou de confidentialité (médecin-chef) : accès restreint à la supervision. */
  verrouille:          boolean
  verrouilleLe:        string | null
  motifVerrou:         string | null
  createdAt:           string
  createdBy:           string | null
  updatedAt:           string
}

// Version locale Dexie (avec syncStatus)
export interface PatientLocal extends Patient {
  syncStatus: StatutSyncLocal
}

// ── Sous-entités ──────────────────────────────────────────────────────────────

export interface IdentitePatient {
  id:            string
  patientId:     string
  nom:           string
  prenom:        string
  dateNaissance: string
  sexe:          'M' | 'F'
  telephone?:    string | null
  adresse?:      string | null
  photoUrl?:     string | null
}

export interface ContactUrgence {
  id:        string
  patientId: string
  nom:       string
  prenom:    string
  telephone: string
  lien:      string
}

// Données professionnelles (personnel CDI/CDD) — recueil
export interface DonneesEmploi {
  id:          string
  patientId:   string
  fonction?:    string | null
  sectionPaie?: string | null
  service?:     string | null
  departement?: string | null
}

// Mode de vie (recueil) — capturé au triage
export interface ModeViePatient {
  id:               string
  patientId:        string
  tabac?:            string | null
  alcool?:           string | null
  drogues?:          string | null
  activitePhysique?: string | null
  alimentation?:     string | null
  sommeil?:          string | null
  troublesSommeil?:  string | null
  sedentarite?:      string | null
  portCharges?:      string | null
  observations?:     string | null
}

export interface AllergiePatient {
  id:        string
  patientId: string
  substance: string
  gravite:   GraviteAllergie
  confirme:  boolean
  statut:    'ACTIVE' | 'INACTIVE'
  createdAt: string
}

export interface AntecedentPatient {
  id:          string
  patientId:   string
  type:        TypeAntecedent
  description: string
  statut:      'ACTIF' | 'RESOLU'
}

export interface AlerteMedicale {
  id:         string
  patientId:  string
  type:       TypeAlerteMed
  message:    string
  gravite:    GraviteAlerte
  statut:     'ACTIVE' | 'INACTIVE'
  createdAt:  string
  resolvedAt: string | null
}

export interface HistoriqueCategoriePatient {
  id:               string
  patientId:        string
  ancienneCategId:  string | null
  nouvelleCategId:  string
  dateEffet:        string
  motif:            string | null
  createdBy:        string | null
  createdAt:        string
  nouvelleCategorie: CategorieResume
}

export interface HistoriqueRattachement {
  id:             string
  rattachementId: string
  evenement:      string
  createdAt:      string
  createdBy:      string | null
}

export interface RattachementAyantDroitCdi {
  id:         string
  patientId:  string
  cdiId:      string
  typeLien:   LienParente
  statut:     'ACTIF' | 'INACTIF'
  dateDebut:  string
  dateFin:    string | null
  historiques: HistoriqueRattachement[]
}

export interface RattachementSousTraitant {
  id:         string
  patientId:  string
  societeId:  string
  statut:     'ACTIF' | 'INACTIF'
  dateDebut:  string
  dateFin:    string | null
  societe:    { id: string; nom: string; statut: string }
  historiques: HistoriqueRattachement[]
}

// ── Patient liste (payload léger) ─────────────────────────────────────────────

export interface PatientListItem {
  id:               string
  numeroPatient:    string
  statut:           StatutPatient
  createdAt:        string
  categoriePatient: CategorieResume
  siteCreation:     SiteResume
  identite:         IdentitePatient | null
  allergies:        Pick<AllergiePatient, 'id' | 'substance' | 'gravite' | 'confirme' | 'statut' | 'createdAt' | 'patientId'>[]
  alertesMedicales: Pick<AlerteMedicale, 'id' | 'type' | 'gravite' | 'message' | 'statut' | 'createdAt' | 'resolvedAt' | 'patientId'>[]
}

// ── Dossier complet ───────────────────────────────────────────────────────────

export interface PatientDossier extends Patient {
  categoriePatient:  CategorieResume
  siteCreation:      SiteResume
  identite:          IdentitePatient | null
  contactUrgence:    ContactUrgence  | null
  donneesEmploi:     DonneesEmploi   | null
  modeVie:           ModeViePatient  | null
  allergies:         AllergiePatient[]
  antecedents:       AntecedentPatient[]
  alertesMedicales:  AlerteMedicale[]
  historiquesCateg:  HistoriqueCategoriePatient[]
  rattachementsAD:   RattachementAyantDroitCdi[]
  rattachementsST:   RattachementSousTraitant[]
}
