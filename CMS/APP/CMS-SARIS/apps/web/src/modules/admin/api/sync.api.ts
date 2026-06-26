/**
 * API de synchronisation offline-first (mode local). Le backend embarqué expose
 * /sync/status (état) et /sync/run (déclenche un cycle pull+push).
 */
import { api } from '@/lib/api'
import type { SyncStatusV2 } from '@cms-saris/types/sync'

export interface SyncStatusResponse extends SyncStatusV2 {
  siteId: string
  models: number
  client: {
    enabled: boolean
    online: boolean
    lastPulledAt?: string
    lastPushedAt?: string
  }
}

export interface SyncRunResult {
  pulled?: number
  pushed?: number
  conflicts?: number
  skipped?: boolean
  reason?: string
}

// ── Supervision (serveur central) ─────────────────────────────────────────────

export interface SyncSupervisionPoste {
  id: string
  libelle: string
  derniereSyncAt: string | null
  enLigne: boolean
}
export interface SyncSupervisionJournal {
  id: string
  poste: string
  startedAt: string
  finishedAt: string | null
  statut: string
  nbMutations: number
  nbConflits: number
}
export interface SyncSupervisionConflit {
  id: string
  entiteType: string
  entiteId: string
  typeConflit: string
  createdAt: string
}
export interface SyncSupervision {
  postes: SyncSupervisionPoste[]
  journaux: SyncSupervisionJournal[]
  conflits: SyncSupervisionConflit[]
}

export const syncApi = {
  status: () => api.get<SyncStatusResponse>('/sync/status'),
  run: () => api.post<SyncRunResult>('/sync/run', {}),
  supervision: () => api.get<SyncSupervision>('/sync/supervision'),
}
