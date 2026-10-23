/**
 * Hooks de synchronisation offline-first (mode local) : état + déclenchement manuel.
 * En mode distant (web/desktop remote), /sync/status renvoie client.enabled = false.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { syncApi } from '../api/sync.api'
import type {
  ActiviteParams, ActiviteParPosteParams, ConflitsPosteParams, CreerCodeAppairageBody, PorteePurgeActivite,
} from '../api/sync.api'

export function useSyncStatus(enabled = true) {
  return useQuery({
    queryKey: ['sync', 'status'],
    queryFn: () => syncApi.status(),
    enabled,
    staleTime: 10_000,
    refetchInterval: 30_000,
  })
}

export function useSyncRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => syncApi.run(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sync'] }),
  })
}

/** Supervision temps réel (serveur central) : postes, activité, conflits.
 *  La clé ['admin','sync',...] est invalidée en direct par l'événement SSE SYNC_ACTIVITY. */
export function useSyncSupervision(enabled = true) {
  return useQuery({
    queryKey: ['admin', 'sync', 'supervision'],
    queryFn: () => syncApi.supervision(),
    enabled,
    staleTime: 5_000,
    refetchInterval: 60_000,
  })
}

/**
 * Journal d'activité — une page à la fois, filtrée par le serveur.
 *
 * `placeholderData` conserve la page précédente pendant le chargement de la suivante :
 * sans cela, chaque changement de page ou de filtre vide le tableau et fait sauter la
 * mise en page. La clé inclut les paramètres, donc chaque combinaison a son cache.
 */
export function useSyncActivite(params: ActiviteParams, enabled = true) {
  return useQuery({
    queryKey: ['admin', 'sync', 'supervision', 'activite', params],
    queryFn: () => syncApi.activite(params),
    enabled,
    staleTime: 5_000,
    placeholderData: (prev) => prev,
  })
}

/**
 * Activité regroupée par poste : UNE ligne par machine, filtrée et paginée par le serveur.
 * Même principe que `useSyncActivite` pour la page précédente conservée pendant le
 * chargement. La clé commence par ['admin','sync'] : l'événement SSE SYNC_ACTIVITY la
 * rafraîchit en direct.
 */
export function useActiviteParPoste(params: ActiviteParPosteParams, enabled = true) {
  return useQuery({
    queryKey: ['admin', 'sync', 'supervision', 'activite-postes', params],
    queryFn: () => syncApi.activiteParPoste(params),
    enabled,
    staleTime: 5_000,
    placeholderData: (prev) => prev,
  })
}

/** Bilan d'un poste (tiroir « Voir les détails ») — chargé à la demande. */
export function useBilanPoste(id: string | null) {
  return useQuery({
    queryKey: ['admin', 'sync', 'supervision', 'bilan', id],
    queryFn: () => syncApi.bilanPoste(id as string),
    enabled: !!id,
    staleTime: 5_000,
  })
}

/** Conflits et refus d'un poste, une page à la fois. */
export function useConflitsPoste(id: string | null, params: ConflitsPosteParams) {
  return useQuery({
    queryKey: ['admin', 'sync', 'supervision', 'conflits-poste', id, params],
    queryFn: () => syncApi.conflitsPoste(id as string, params),
    enabled: !!id,
    staleTime: 5_000,
    placeholderData: (prev) => prev,
  })
}

/** Vide l'historique des échanges (droit `synchronisation.purge`). */
export function usePurgerActivite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (portee: PorteePurgeActivite) => syncApi.purgerActivite(portee),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'sync'] }),
  })
}

/** Détail d'un poste (modale) — chargé à la demande (id = null tant que la modale est fermée). */
export function usePosteDetail(id: string | null) {
  return useQuery({
    queryKey: ['admin', 'sync', 'supervision', 'poste', id],
    queryFn: () => syncApi.posteDetail(id as string),
    enabled: !!id,
  })
}

/**
 * Contrôle du flux d'un poste. Chaque action rafraîchit toute la supervision : la fiche, les
 * lignes d'activité et les cartes du parc portent toutes l'état de suspension.
 */
function useControle<V>(action: (v: V) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: action,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'sync'] }),
  })
}
export function useSuspendrePoste() {
  return useControle(({ id, motif }: { id: string; motif?: string }) => syncApi.suspendrePoste(id, motif))
}
export function useReprendrePoste() {
  return useControle((id: string) => syncApi.reprendrePoste(id))
}
export function useDemanderResync() {
  return useControle((id: string) => syncApi.demanderResync(id))
}
export function useAnnulerResync() {
  return useControle((id: string) => syncApi.annulerResync(id))
}

/** Codes d'appairage : chargés à l'ouverture de l'onglet (jamais le code lui-même, seulement son état). */
export function useCodesAppairage(enabled = true) {
  return useQuery({
    queryKey: ['admin', 'sync', 'appairage', 'codes'],
    queryFn: () => syncApi.codesAppairage(),
    enabled,
    staleTime: 5_000,
  })
}
/** Crée un code : la réponse (typée) porte le code EN CLAIR, que l'écran montre une seule fois. */
export function useCreerCodeAppairage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreerCodeAppairageBody) => syncApi.creerCodeAppairage(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'sync'] }),
  })
}
export function useAnnulerCodeAppairage() {
  return useControle((id: string) => syncApi.annulerCodeAppairage(id))
}
/** Coupe l'accès d'un poste appairé ; la fiche et les cartes du parc se rafraîchissent. */
export function useRevoquerAccesPoste() {
  return useControle((id: string) => syncApi.revoquerAccesPoste(id))
}

/** Retire un poste de la liste de supervision (dismiss) — réapparaît à sa prochaine synchro. */
export function useMasquerPoste() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => syncApi.masquerPoste(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'sync', 'supervision'] }),
  })
}

/** Renomme un poste (nom unique par site) — supervision admin. */
export function useRenamePoste() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, libelle }: { id: string; libelle: string }) => syncApi.renamePoste(id, libelle),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'sync', 'supervision'] }),
  })
}
