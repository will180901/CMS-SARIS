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
  /** Site de rattachement, choisi une fois pour toutes à l'installation du poste. */
  siteId: string
  /** Libellé lisible de ce site — `null` si le site a été supprimé depuis. */
  siteLibelle: string | null
  /** Nom (ou identifiant) du dernier utilisateur ayant synchronisé depuis ce poste. */
  utilisateurNom: string | null
  /** Rôle de ce dernier utilisateur (le plus élevé s'il en porte plusieurs). */
  utilisateurRole: string | null
  derniereSyncAt: string | null
  enLigne: boolean
}
export interface SyncSupervisionPosteDetail extends SyncSupervisionPoste {
  /** Début de la dernière session connectée (suite contiguë de cycles de synchro). */
  sessionDebut: string | null
  /** Fin de cette session (= derniereSyncAt si toujours la même session). */
  sessionFin: string | null
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
  conflits: SyncSupervisionConflit[]
}

/** Filtres du journal d'activité — tous facultatifs. */
export interface ActiviteParams {
  page?: number
  pageSize?: number
  posteId?: string
  statut?: string
  depuis?: string
}
export interface ActivitePage {
  items: SyncSupervisionJournal[]
  total: number
  page: number
  pageSize: number
}

export const syncApi = {
  status: () => api.get<SyncStatusResponse>('/sync/status'),
  run: () => api.post<SyncRunResult>('/sync/run', {}),
  supervision: () => api.get<SyncSupervision>('/sync/supervision'),
  /** Journal d'activité paginé et filtré par le serveur — le parc peut en produire
   *  des milliers de lignes par jour, on n'en rapatrie qu'une page. */
  activite: (p: ActiviteParams = {}) => {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== '') q.set(k, String(v))
    const s = q.toString()
    return api.get<ActivitePage>(`/sync/supervision/activite${s ? `?${s}` : ''}`)
  },
  posteDetail: (id: string) => api.get<SyncSupervisionPosteDetail>(`/sync/supervision/postes/${id}`),
  masquerPoste: (id: string) => api.delete<{ ok: boolean }>(`/sync/supervision/postes/${id}`),
  /** Rattache un poste à un AUTRE site. Le site appartient au poste, pas à la personne :
   *  seul un administrateur le change, et la machine l'adopte à sa prochaine déclaration. */
  configurerPoste: (posteLocalId: string, siteId: string) =>
    api.post<{ id: string; siteId: string }>('/sync/poste', { posteLocalId, siteId }),
  renamePoste: (id: string, libelle: string) =>
    api.patch<{ libelle: string }>(`/sync/supervision/postes/${id}`, { libelle }),
}
