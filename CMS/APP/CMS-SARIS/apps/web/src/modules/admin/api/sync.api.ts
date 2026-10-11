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
    /** Ordres du serveur : échanges suspendus par un administrateur (et son motif)… */
    suspendu?: boolean
    motifSuspension?: string | null
    /** …et resynchronisation complète en cours. */
    resyncEnCours?: boolean
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
  /** Contrôle du flux : échanges suspendus par un administrateur (par qui, depuis quand, pourquoi). */
  suspendu: boolean
  suspenduAt: string | null
  suspenduParNom: string | null
  suspensionMotif: string | null
  /** Resynchronisation complète demandée (pas encore accomplie) / dernière accomplie. */
  resyncDemandeeAt: string | null
  resyncFaiteAt: string | null
  /** Version de l'application du poste, et niveau des ordres du serveur qu'il comprend.
   *  `null` = poste ancien : il ne sait ni afficher une suspension ni se resynchroniser. */
  versionApp: string | null
  niveauControle: number | null
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

// ── Activité regroupée par poste, fiche d'un poste, vidage ───────────────────

/** Une ligne d'activité : UN poste, avec le bilan de tous ses échanges. */
export interface SyncActivitePoste extends SyncSupervisionPoste {
  /** Poste retiré du parc : son historique reste lisible, il n'est plus supervisé. */
  retire: boolean
  nbEchanges: number
  /** Échanges sans aucun désaccord ni refus. */
  nbReussis: number
  /** Échanges ayant produit au moins un conflit ou un refus. */
  nbAvecConflits: number
  nbMutations: number
  /** Somme des conflits et des refus de tous les échanges. */
  nbConflits: number
  premierEchangeAt: string | null
  dernierEchangeAt: string | null
}
export interface ActiviteParPosteParams {
  page?: number
  pageSize?: number
  /** Mots du nom du poste. */
  recherche?: string
  /** `CONFLITS` : seulement les postes ayant eu un conflit ou un refus. */
  statut?: 'CONFLITS'
}
export interface ActiviteParPostePage {
  items: SyncActivitePoste[]
  /** Nombre de postes (et non d'échanges) correspondant aux filtres. */
  total: number
  page: number
  pageSize: number
  /** Ce que contient l'historique, tous filtres confondus : ce qu'un vidage effacerait. */
  totaux: {
    echanges: number
    quarantaine: number
    conflitsAuto: number
    /** Échanges qui portent un refus en quarantaine : le vidage par défaut les conserve. */
    echangesAvecRefus: number
  }
}

export interface BilanPoste {
  poste: SyncSupervisionPosteDetail
  bilan: {
    nbEchanges: number
    nbReussis: number
    nbAvecConflits: number
    nbMutations: number
    nbConflits: number
    premierEchangeAt: string | null
    dernierEchangeAt: string | null
    /** Changements refusés par le serveur, gardés en quarantaine. */
    quarantaine: number
    /** Désaccords poste/serveur tranchés automatiquement (le plus récent gagne). */
    conflitsAuto: number
    dernieres24h: { echanges: number; mutations: number }
  }
}

/** `QUARANTAINE` : changements refusés ; `CONFLITS` : désaccords tranchés automatiquement. */
export type TypeConflitPoste = 'QUARANTAINE' | 'CONFLITS'
export interface ConflitPoste {
  id: string
  entiteType: string
  entiteId: string
  /** REJET_SERVEUR (refusé) · LOCAL_GAGNE · SERVEUR_GAGNE. */
  typeConflit: string
  createdAt: string
  /** Raison du refus — `null` pour un conflit tranché. Jamais le contenu de la fiche. */
  raison: string | null
}
export interface ConflitsPosteParams {
  page?: number
  pageSize?: number
  type?: TypeConflitPoste
}
export interface ConflitsPostePage {
  items: ConflitPoste[]
  total: number
  page: number
  pageSize: number
}

/** `echanges` : l'historique, en gardant la quarantaine · `tout` : y compris la quarantaine. */
export type PorteePurgeActivite = 'echanges' | 'tout'
export interface ResultatPurgeActivite {
  echanges: number
  conflits: number
  quarantaineConservee: number
}

function chaineRequete(p: object): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== '') q.set(k, String(v))
  const s = q.toString()
  return s ? `?${s}` : ''
}

/** État de contrôle d'un poste, renvoyé par chaque action de l'administrateur. */
export interface EtatControlePoste {
  suspendu: boolean
  suspenduAt: string | null
  motif: string | null
  resyncDemandeeAt: string | null
  resyncFaiteAt: string | null
}

export const syncApi = {
  status: () => api.get<SyncStatusResponse>('/sync/status'),
  run: () => api.post<SyncRunResult>('/sync/run', {}),
  supervision: () => api.get<SyncSupervision>('/sync/supervision'),
  /** Journal d'activité paginé et filtré par le serveur — le parc peut en produire
   *  des milliers de lignes par jour, on n'en rapatrie qu'une page. */
  activite: (p: ActiviteParams = {}) =>
    api.get<ActivitePage>(`/sync/supervision/activite${chaineRequete(p)}`),
  /** Activité regroupée : UNE ligne par poste, avec le bilan de tous ses échanges. */
  activiteParPoste: (p: ActiviteParPosteParams = {}) =>
    api.get<ActiviteParPostePage>(`/sync/supervision/activite/postes${chaineRequete(p)}`),
  /** Bilan d'un poste : identité, réussites, conflits, refus, flux des dernières 24 h. */
  bilanPoste: (id: string) => api.get<BilanPoste>(`/sync/supervision/postes/${id}/bilan`),
  /** Conflits et refus d'un poste (la raison du refus, jamais le contenu des fiches). */
  conflitsPoste: (id: string, p: ConflitsPosteParams = {}) =>
    api.get<ConflitsPostePage>(`/sync/supervision/postes/${id}/conflits${chaineRequete(p)}`),
  /** Vide l'historique des échanges (droit `synchronisation.purge`) — se trace elle-même. */
  purgerActivite: (portee: PorteePurgeActivite) =>
    api.delete<ResultatPurgeActivite>(`/sync/supervision/activite${chaineRequete({ portee })}`),
  /** SUSPEND les échanges d'un poste (le motif reste au journal d'audit et s'affiche sur le poste). */
  suspendrePoste: (id: string, motif?: string) =>
    api.post<EtatControlePoste>(`/sync/supervision/postes/${id}/suspension`, motif ? { motif } : {}),
  reprendrePoste: (id: string) =>
    api.delete<EtatControlePoste>(`/sync/supervision/postes/${id}/suspension`),
  /** Demande une resynchronisation COMPLÈTE : le poste retélécharge tout à son prochain contact. */
  demanderResync: (id: string) =>
    api.post<EtatControlePoste>(`/sync/supervision/postes/${id}/resynchronisation`, {}),
  annulerResync: (id: string) =>
    api.delete<EtatControlePoste>(`/sync/supervision/postes/${id}/resynchronisation`),
  posteDetail: (id: string) => api.get<SyncSupervisionPosteDetail>(`/sync/supervision/postes/${id}`),
  masquerPoste: (id: string) => api.delete<{ ok: boolean }>(`/sync/supervision/postes/${id}`),
  renamePoste: (id: string, libelle: string) =>
    api.patch<{ libelle: string }>(`/sync/supervision/postes/${id}`, { libelle }),

  /** État de configuration d'un poste — `null` s'il n'est pas encore déclaré. */
  lirePoste: (id: string) => api.get<PosteConfiguration | null>(`/sync/poste/${id}`),

  /**
   * Déclare (ou reconfigure) un poste : son site, son nom, et éventuellement sa
   * POSITION. La position est celle de la MACHINE, relevée une fois — voir
   * `CePosteCard`, seul endroit d'où elle peut être demandée, puisqu'il faut être
   * physiquement devant le poste pour que le relevé ait un sens.
   */
  configurerPoste: (body: {
    posteLocalId: string
    siteId: string
    libelle?: string
    latitude?: number
    longitude?: number
    precisionM?: number
  }) => api.post<PosteConfiguration>('/sync/poste', body),
}

export interface PosteConfiguration {
  id: string
  libelle: string
  siteId: string
  latitude?: number | null
  longitude?: number | null
  precisionM?: number | null
  positionAt?: string | null
}
