import Dexie, { type Table } from 'dexie'
import type {
  Patient,
  IdentitePatient,
  AllergiePatient,
  AlerteMedicale,
  ContactUrgence,
  FileMutation,
  JournalSync,
} from '@cms-saris/types'

// ── Types locaux (entités enrichies pour Dexie) ────────────────────────────────

export type SyncStatus = 'PENDING' | 'SYNCED' | 'CONFLICT' | 'ERROR'

/** Patient stocké localement dans IndexedDB */
export interface PatientLocal extends Patient {
  syncStatus: SyncStatus
}

/** Visite stockée localement */
export interface VisiteLocal {
  id:                  string
  patientId:           string
  siteId:              string
  personnelAccueilId:  string
  motifConsultationId?: string
  motifDetail?:        string
  statut:              'EN_ATTENTE' | 'EN_COURS' | 'CLOTUREE' | 'ANNULEE'
  createdAt:           string
  updatedAt:           string
  version:             number
  syncStatus:          SyncStatus
}

/** Consultation stockée localement */
export interface ConsultationLocal {
  id:               string
  visiteId:         string
  medecinId:        string
  statut:           'OUVERTE' | 'CLOTUREE' | 'ANNULEE'
  motifDetail?:     string
  examenClinique?:  string
  conclusion?:      string
  decisionMedicale?: string
  createdAt:        string
  updatedAt:        string
  version:          number
  syncStatus:       SyncStatus
}

// ── Référentiels (cache lecture seule, synchronisés depuis le serveur) ─────────

export interface CategoriePatientLocal {
  id:           string
  code:         string
  libelle:      string
  description?: string
  actif:        boolean
}

export interface MotifConsultationLocal {
  id:       string
  libelle:  string
  actif:    boolean
}

export interface MedicamentLocal {
  id:            string
  denomination:  string
  dosage?:       string
  forme?:        string
  actif:         boolean
}

export interface PathologieLocal {
  id:        string
  code:      string
  libelle:   string
  chronique: boolean
}

export interface SiteLocal {
  id:      string
  code:    string
  libelle: string
}

/** Clé de chiffrement de la file hors-ligne (web pur), stockée par structured clone. */
interface CryptoKeyRow {
  id:  string         // nom logique de la clé (= SECURE_KEY_NAME)
  key: CryptoKey      // CryptoKey non-extractible, stockée via structured clone
}

// ── Classe Dexie ──────────────────────────────────────────────────────────────

export class CmsSarisDatabase extends Dexie {
  // Données patients (offline-first, modifiables hors ligne)
  patients!:            Table<PatientLocal>
  identites_patient!:   Table<IdentitePatient>
  allergies_patient!:   Table<AllergiePatient>
  alertes_medicales!:   Table<AlerteMedicale>
  contacts_urgence!:    Table<ContactUrgence>

  // Visites et consultations (offline-first)
  visites!:             Table<VisiteLocal>
  consultations!:       Table<ConsultationLocal>

  // Référentiels (cache lecture seule)
  categories_patient!:  Table<CategoriePatientLocal>
  motifs_consultation!: Table<MotifConsultationLocal>
  medicaments!:         Table<MedicamentLocal>
  pathologies!:         Table<PathologieLocal>
  sites!:               Table<SiteLocal>

  // File de synchronisation
  file_mutations!:      Table<FileMutation>
  journal_sync!:        Table<JournalSync>

  // Clé de chiffrement de la file hors-ligne (web pur)
  crypto_keys!:         Table<CryptoKeyRow>

  constructor() {
    super('cms-saris-db')

    this.version(1).stores({
      // Clé primaire = UUID (string) pour les entités métier
      // Index secondaires = champs utilisés dans les requêtes WHERE
      patients:             'id, numeroPatient, siteCreationId, categoriePatientId, statut, syncStatus',
      identites_patient:    'id, patientId, nom, prenom',
      allergies_patient:    'id, patientId, statut',
      alertes_medicales:    'id, patientId, statut, gravite',
      contacts_urgence:     'id, patientId',

      visites:              'id, patientId, siteId, statut, syncStatus, createdAt',
      consultations:        'id, visiteId, medecinId, statut, syncStatus',

      // Référentiels (recherche par code ou libellé)
      categories_patient:   'id, code',
      motifs_consultation:  'id',
      medicaments:          'id, denomination',
      pathologies:          'id, code',
      sites:                'id, code',

      // Sync (clé autoincrement car pas d'UUID prédéfini)
      file_mutations:       '++id, mutationUuid, module, statut, ordreLocal, createdLocalAt',
      journal_sync:         '++id, siteId, statut, startedAt',
    })

    // v2 — store dédié à la clé de chiffrement de la file hors-ligne (web pur).
    // 'key' n'est PAS indexable (CryptoKey) → seul 'id' est clé primaire.
    this.version(2).stores({
      crypto_keys: 'id',
    })
  }
}

/** Instance singleton — importée partout dans l'application */
export const db = new CmsSarisDatabase()
