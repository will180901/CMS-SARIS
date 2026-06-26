export type MutationAction  = 'CREATE' | 'UPDATE' | 'DELETE' | 'CLOSE'
export type MutationStatut  = 'PENDING' | 'SENT' | 'APPLIED' | 'REJECTED' | 'CONFLICT'
export type ModuleName =
  | 'patients'
  | 'visites'
  | 'consultations'
  | 'acteurs'
  | 'referentiels'
  | 'triage'
  | 'sorties_critiques'

export interface FileMutation {
  id?:            number
  mutationUuid:   string
  module:         ModuleName
  entiteType:     string
  entiteId:       string
  action:         MutationAction
  payloadJson:    string        // JSON chiffré AES-256-GCM
  statut:         MutationStatut
  ordreLocal:     number
  createdLocalAt: Date
  sentAt?:        Date
  serverAckedAt?: Date
  errorMessage?:  string
}

export interface JournalSync {
  id?:          number
  posteLocalId: string
  siteId:       string
  startedAt:    Date
  finishedAt?:  Date
  statut:       'EN_COURS' | 'SUCCES' | 'ECHEC' | 'PARTIEL'
  nbMutations:  number
  nbConflits:   number
}

export interface SyncPushPayload {
  posteLocalId: string
  siteId:       string
  mutations:    Omit<FileMutation, 'id'>[]
}

export interface SyncPushResponse {
  applied:   string[]
  rejected:  Array<{ mutationUuid: string; reason: string }>
  conflicts: Array<{ mutationUuid: string; type: 'SAME_FIELD' | 'DIFFERENT_FIELDS' }>
}

export interface SyncPullResponse {
  patients:      unknown[]
  visites:       unknown[]
  consultations: unknown[]
  referentiels:  Record<string, unknown[]>
  syncedAt:      string
}

// ── Synchronisation offline-first v2 (base locale SQLite ↔ serveur central) ──────
// Delta par enregistrement (curseur `updatedAt`), tombstone-aware, conscient des
// conflits via `baseUpdatedAt`. Cf. logique pure dans `@cms-saris/types/sync-conflict`.

/** Une entité transportée dans un delta de synchronisation (upsert ou tombstone). */
export interface SyncEntityEnvelope {
  /** Nom du modèle Prisma (ex. « Patient »). */
  model:          string
  /** Identifiant UUID de l'enregistrement. */
  id:             string
  op:             'upsert' | 'delete'
  /** Colonnes scalaires de la ligne (déjà chiffrées le cas échéant). */
  data:           Record<string, unknown>
  /** ISO 8601 — horodatage de la mutation (curseur). */
  updatedAt:      string
  /** ISO 8601 si suppression logique (tombstone). */
  deletedAt?:     string | null
  /** Version connue du client avant édition — sert à détecter un vrai conflit. */
  baseUpdatedAt?: string | null
}

export interface SyncPullResponseV2 {
  changes:    SyncEntityEnvelope[]
  /** ISO 8601 — borne haute appliquée par le serveur. */
  serverTime: string
  /** Pagination par curseur `updatedAt` : redemander tant que `true`. */
  hasMore:    boolean
  /** Curseur à renvoyer au prochain pull. */
  nextSince:  string
}

export interface SyncPushPayloadV2 {
  posteLocalId: string
  siteId:       string
  changes:      SyncEntityEnvelope[]
}

export interface SyncConflictReport {
  model:   string
  id:      string
  winner:  'incoming' | 'existing'
  fields:  string[]
}

export interface SyncPushResponseV2 {
  /** IDs effectivement appliqués côté serveur. */
  applied:    string[]
  /** IDs ignorés (existant plus récent, ou renvoi idempotent). */
  skipped:    string[]
  /** Conflits réels tranchés par LWW (journalisés pour revue). */
  conflicts:  SyncConflictReport[]
  serverTime: string
}

/** État de synchronisation exposé à l'UI (écran Synchronisation). */
export interface SyncStatusV2 {
  /** Serveur central joignable ? */
  online:       boolean
  lastPulledAt?: string
  lastPushedAt?: string
  /** Nombre de mutations locales en attente d'envoi. */
  pendingPush:  number
}
