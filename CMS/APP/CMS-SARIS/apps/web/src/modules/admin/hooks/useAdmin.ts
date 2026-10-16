/**
 * Hooks TanStack Query — Administration système (/admin/*).
 */

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from '@workspace/ui/components/sonner'
import { adminApi } from '../api/admin.api'
import type {
  CreateUtilisateurPayload, UpdateUtilisateurPayload,
  SetRolesPayload, SetStatutPayload,
  CreateRolePayload, UpdateRolePayload,
  SetPermissionOverridesPayload, BulkPermissionPayload,
  UpdatePreferencesPayload, UpdateMonProfilPayload,
  EtatPositionConnexion, PositionEnvoyee,
} from '../api/admin.api'
import { ApiError, isOfflineQueued } from '@/lib/api'
import { releverPosition, etatPermissionPosition, ErreurPosition } from '@/lib/position'
import { useSessionStore } from '@/stores/session.store'
import { ME_KEY, performTokenRefresh } from '@/modules/auth/hooks/useRefreshSession'
import i18n from '@/i18n/config'

// ── Clés ──────────────────────────────────────────────────────────────────────

export const ADMIN_KEYS = {
  utilisateurs:    ['admin', 'utilisateurs'] as const,
  utilisateur:     (id: string) => ['admin', 'utilisateurs', id] as const,
  userPermissions: (id: string) => ['admin', 'utilisateurs', id, 'permissions'] as const,
  roles:           ['admin', 'roles'] as const,
  role:            (id: string) => ['admin', 'roles', id] as const,
  permissions:     ['admin', 'permissions'] as const,
  audit:           ['admin', 'audit'] as const,
  auth:            ['admin', 'auth'] as const,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toastErr(err: unknown) {
  if (isOfflineQueued(err)) return
  toast.error(err instanceof ApiError ? err.serverMessage : i18n.t('admin.toastGenericError'))
}

/**
 * Re-synchronise FRONTEND + BACKEND (nouveau JWT) si la mutation concerne
 * le user courant.
 *
 * Sans le nouveau JWT, le backend continuerait d'utiliser l'ancienne liste
 * de permissions signées au moment de la connexion et renverrait 403 sur
 * les nouvelles actions, même si l'UI les autorise visuellement.
 *
 * Délègue à performTokenRefresh (auth/hooks) pour la mécanique complète :
 *   - POST /auth/refresh → nouveau JWT + nouveau refresh token + user à jour
 *   - setSession atomique
 *   - invalidation de toutes les queries (pour que les hooks `enabled: has(...)`
 *     se déclenchent avec les nouvelles permissions)
 */
async function refreshCurrentSessionIfNeeded(condition: boolean, qc: QueryClient) {
  if (!condition) return
  try {
    await performTokenRefresh(qc)
    toast.info(i18n.t('admin.toastPermissionsRefreshed'), { duration: 4000 })
  } catch {
    // performTokenRefresh fait déjà son fallback. Si vraiment tout échoue,
    // on laisse l'utilisateur se reconnecter manuellement.
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  UTILISATEURS
// ══════════════════════════════════════════════════════════════════════════════

export function useUtilisateurs(
  params?: { search?: string; statut?: string; roleId?: string },
  /** `false` quand l'appelant n'a pas `utilisateur.read` : la requête partirait
   *  pour rien et reviendrait en 403. */
  enabled = true,
) {
  return useQuery({
    queryKey: [...ADMIN_KEYS.utilisateurs, params],
    queryFn:  () => adminApi.utilisateurs.list(params),
    staleTime: 15_000,
    enabled,
  })
}

export function useUtilisateur(id: string) {
  return useQuery({
    queryKey: ADMIN_KEYS.utilisateur(id),
    queryFn:  () => adminApi.utilisateurs.findById(id),
    enabled:  !!id,
  })
}

export function useCreateUtilisateur() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateUtilisateurPayload) => adminApi.utilisateurs.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.utilisateurs })
      toast.success(i18n.t('admin.toastUserCreated'))
    },
    onError: toastErr,
  })
}

export function useUpdateUtilisateur(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateUtilisateurPayload) => adminApi.utilisateurs.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.utilisateurs })
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.utilisateur(id) })
      toast.success(i18n.t('admin.toastAccountUpdated'))
    },
    onError: toastErr,
  })
}

export function useDeleteUtilisateur() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.utilisateurs.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.utilisateurs })
      toast.success(i18n.t('admin.toastAccountDeleted'))
    },
    onError: toastErr,
  })
}

export function useSetRoles(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SetRolesPayload) => adminApi.utilisateurs.setRoles(id, data),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.utilisateurs })
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.utilisateur(id) })
      qc.invalidateQueries({ queryKey: ME_KEY })
      // Si l'utilisateur courant est celui dont les rôles ont changé,
      // re-synchroniser ses permissions locales immédiatement.
      const meId = useSessionStore.getState().user?.id
      await refreshCurrentSessionIfNeeded(meId === id, qc)
      toast.success(i18n.t('admin.toastUserRolesUpdated'))
    },
    onError: toastErr,
  })
}

export function useSetStatut(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SetStatutPayload) => adminApi.utilisateurs.setStatut(id, data),
    onSuccess: (_, data) => {
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.utilisateurs })
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.utilisateur(id) })
      toast.success(
        data.statut === 'ACTIF'    ? i18n.t('admin.toastAccountReactivated') :
        data.statut === 'DESACTIVE' ? i18n.t('admin.toastAccountDeactivated') : i18n.t('admin.toastStatusChanged'),
      )
    },
    onError: toastErr,
  })
}

export function useResetPassword(id: string) {
  return useMutation({
    mutationFn: () => adminApi.utilisateurs.resetPassword(id),
    onSuccess: () => toast.success(i18n.t('admin.toastPasswordReset')),
    onError:   toastErr,
  })
}

// ── Récupération de compte (admin reprend la main) ────────────────────────────

/** Retire la 2FA d'un utilisateur ayant perdu son téléphone. */
export function useResetTotp(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => adminApi.utilisateurs.resetTotp(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.utilisateur(id) })
      toast.success(i18n.t('admin.toastTotpReset'))
    },
    onError: toastErr,
  })
}

/** Régénère les codes de secours (retourne les codes en clair, une seule fois). */
export function useRegenerateBackupCodes(id: string) {
  return useMutation({
    mutationFn: () => adminApi.utilisateurs.regenerateBackupCodes(id),
    onError:   toastErr,
  })
}

/** Force la déconnexion : révoque toutes les sessions de l'utilisateur. */
export function useRevokeSessions(id: string) {
  return useMutation({
    mutationFn: () => adminApi.utilisateurs.revokeSessions(id),
    onSuccess: (r) => toast.success(i18n.t('admin.toastSessionsRevoked', { count: r.count })),
    onError:   toastErr,
  })
}

// ── Dérogations de permissions (GRANT / REVOKE par utilisateur) ───────────────

/** Ventilation des permissions effectives d'un utilisateur (rôles + dérogations) */
export function useUserPermissions(id: string) {
  return useQuery({
    queryKey: ADMIN_KEYS.userPermissions(id),
    queryFn:  () => adminApi.utilisateurs.getPermissions(id),
    enabled:  !!id,
    staleTime: 10_000,
  })
}

/** Remplace l'ensemble des dérogations d'un utilisateur */
export function useSetUserPermissions(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SetPermissionOverridesPayload) => adminApi.utilisateurs.setPermissions(id, data),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.userPermissions(id) })
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.utilisateur(id) })
      qc.invalidateQueries({ queryKey: ME_KEY })
      // Si c'est l'utilisateur courant, re-synchroniser son JWT immédiatement
      const meId = useSessionStore.getState().user?.id
      await refreshCurrentSessionIfNeeded(meId === id, qc)
      toast.success(i18n.t('admin.toastUserPermissionsUpdated'))
    },
    onError: toastErr,
  })
}

/** Applique une dérogation à plusieurs utilisateurs en une fois */
export function useBulkPermission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: BulkPermissionPayload) => adminApi.utilisateurs.bulkPermissions(data),
    onSuccess: async (res, vars) => {
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.utilisateurs })
      // Invalider la ventilation de chaque utilisateur touché
      for (const uid of vars.utilisateurIds) {
        qc.invalidateQueries({ queryKey: ADMIN_KEYS.userPermissions(uid) })
      }
      const meId = useSessionStore.getState().user?.id
      await refreshCurrentSessionIfNeeded(!!meId && vars.utilisateurIds.includes(meId), qc)
      const key =
        vars.mode === 'GRANT'  ? 'admin.toastBulkPermissionGranted'  :
        vars.mode === 'REVOKE' ? 'admin.toastBulkPermissionRevoked'  :
                                 'admin.toastBulkPermissionReset'
      toast.success(i18n.t(key, { count: res.count }))
    },
    onError: toastErr,
  })
}

// ══════════════════════════════════════════════════════════════════════════════
//  RÔLES & PERMISSIONS
// ══════════════════════════════════════════════════════════════════════════════

export function useRoles() {
  return useQuery({
    queryKey: ADMIN_KEYS.roles,
    queryFn:  () => adminApi.roles.list(),
    staleTime: 30_000,
  })
}

/** Détenteurs d'un rôle (tous sites — vue gouvernance, cohérent avec nbUtilisateurs). */
export function useRoleUtilisateurs(roleId: string | null) {
  return useQuery({
    queryKey: [...ADMIN_KEYS.roles, roleId, 'utilisateurs'],
    queryFn:  () => adminApi.roles.utilisateurs(roleId!),
    enabled:  !!roleId,
    staleTime: 30_000,
  })
}

export function usePermissions() {
  return useQuery({
    queryKey: ADMIN_KEYS.permissions,
    queryFn:  () => adminApi.permissions.list(),
    staleTime: 5 * 60_000, // catalogue stable
  })
}

export function useCreateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateRolePayload) => adminApi.roles.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.roles })
      toast.success(i18n.t('admin.toastRoleCreated'))
    },
    onError: toastErr,
  })
}

export function useUpdateRole(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateRolePayload) => adminApi.roles.update(id, data),
    onSuccess: async (updatedRole) => {
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.roles })
      qc.invalidateQueries({ queryKey: ME_KEY })

      // Si le rôle modifié est l'un de ceux que possède l'utilisateur courant,
      // re-synchroniser ses permissions ET son JWT immédiatement.
      // On lit `updatedRole.code` depuis la réponse de la mutation (pas le cache,
      // qui vient d'être invalidé).
      const meRoles = useSessionStore.getState().user?.roles ?? []
      const concernedByMe = meRoles.includes(updatedRole.code as any)
      await refreshCurrentSessionIfNeeded(concernedByMe, qc)

      toast.success(i18n.t('admin.toastRoleUpdated'))
    },
    onError: toastErr,
  })
}

export function useDeleteRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.roles.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.roles })
      toast.success(i18n.t('admin.toastRoleDeleted'))
    },
    onError: toastErr,
  })
}

// ══════════════════════════════════════════════════════════════════════════════
//  AUDIT
// ══════════════════════════════════════════════════════════════════════════════

export function useAuditActions(params?: Record<string, string | undefined>, enabled = true) {
  return useQuery({
    queryKey: [...ADMIN_KEYS.audit, 'actions', params],
    queryFn:  () => adminApi.audit.actions(params),
    staleTime: 10_000,
    enabled,
  })
}

export function useAuditAuth(params?: Record<string, string | undefined>) {
  return useQuery({
    queryKey: [...ADMIN_KEYS.auth, params],
    queryFn:  () => adminApi.audit.authentifications(params),
    staleTime: 10_000,
  })
}

/** Purge des journaux. Invalide les DEUX listes : la purge trace sa propre exécution,
 *  donc le journal des actions n'est jamais vide juste après. */
export function usePurgerAudit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (portee: 'actions' | 'authentifications' | 'tout' = 'tout') =>
      adminApi.audit.purger(portee),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ADMIN_KEYS.audit })
      void qc.invalidateQueries({ queryKey: ADMIN_KEYS.auth })
    },
  })
}

// ══════════════════════════════════════════════════════════════════════════════
//  PARAMÈTRES SYSTÈME
// ══════════════════════════════════════════════════════════════════════════════

export const PARAMETRES_KEY = ['admin', 'parametres'] as const

export function useParametres() {
  return useQuery({
    queryKey: PARAMETRES_KEY,
    queryFn:  () => adminApi.parametres.list(),
    staleTime: 30_000,
  })
}

export function useUpdateParametre() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ cle, valeur }: { cle: string; valeur: string }) =>
      adminApi.parametres.update(cle, valeur),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PARAMETRES_KEY })
      toast.success(i18n.t('admin.toastParameterUpdated'))
    },
    onError: toastErr,
  })
}

export function useResetParametre() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (cle: string) => adminApi.parametres.reset(cle),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PARAMETRES_KEY })
      toast.success(i18n.t('admin.toastParameterReset'))
    },
    onError: toastErr,
  })
}

// ══════════════════════════════════════════════════════════════════════════════
//  SYNCHRONISATION
// ══════════════════════════════════════════════════════════════════════════════

export const SYNC_KEY = ['admin', 'sync'] as const

export function useSyncStatus() {
  return useQuery({
    queryKey: [...SYNC_KEY, 'status'],
    queryFn:  () => adminApi.synchronisation.status(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

export function useSauvegardes() {
  return useQuery({
    queryKey: [...SYNC_KEY, 'sauvegardes'],
    queryFn:  () => adminApi.synchronisation.sauvegardes(),
    staleTime: 30_000,
  })
}

// `useDeclencherSauvegarde` a été retiré : le déclenchement MANUEL d'une sauvegarde a
// été supprimé de l'interface en juillet (la sauvegarde est planifiée), mais le hook
// était resté — défini, appelé nulle part, et laissant croire que la fonction existait
// encore quelque part. L'endpoint serveur, lui, reste en place
// (POST /synchronisation/sauvegardes/manuelle) : rebrancher un bouton demanderait de
// recréer ces dix lignes, rien de plus.

/**
 * Supprime une sauvegarde. Contrairement à la restauration, la configuration en place
 * n'est pas touchée : on n'invalide donc que la liste des sauvegardes, pas tout le cache.
 */
export function useSupprimerSauvegarde() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.synchronisation.supprimer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'sauvegardes'] })
      toast.success(i18n.t('admin.toastBackupDeleted', { defaultValue: 'Sauvegarde supprimée' }))
    },
    onError: toastErr,
  })
}

export function useRestaurerSauvegarde() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.synchronisation.restaurer(id),
    onSuccess: () => {
      qc.invalidateQueries()   // la config (référentiels, rôles, paramètres) a changé
      toast.success(i18n.t('admin.toastConfigRestored'))
    },
    onError: toastErr,
  })
}

// ══════════════════════════════════════════════════════════════════════════════
//  MON COMPTE (utilisateur connecté) — préférences, sessions, 2FA
// ══════════════════════════════════════════════════════════════════════════════

export const ME_KEYS = {
  preferences: ['me', 'preferences'] as const,
  sessions:    ['me', 'sessions'] as const,
  totp:        ['me', 'totp'] as const,
  annuaire:    ['me', 'annuaire'] as const,
  profil:      ['me', 'profil'] as const,
  position:    ['me', 'position'] as const,
}

export function useMonProfil() {
  return useQuery({
    queryKey: ME_KEYS.profil,
    queryFn:  () => adminApi.me.getProfil(),
    staleTime: 60_000,
  })
}

/**
 * Changer SON identifiant : il figure partout (annuaire, listes du personnel et des comptes, en-tête),
 * et la session en cours le garde en mémoire — on la met à jour tout de suite. Pas de toast d'erreur ici :
 * la fenêtre montre elle-même l'erreur sous le champ (mot de passe faux, identifiant déjà pris…).
 */
export function useChangerMonIdentifiant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { login: string; motDePasse: string }) =>
      adminApi.me.changerIdentifiant(p.login, p.motDePasse),
    onSuccess: ({ login }) => {
      const { user, setUser } = useSessionStore.getState()
      if (user) setUser({ ...user, login })
      qc.invalidateQueries({ queryKey: ME_KEYS.profil })
      qc.invalidateQueries({ queryKey: ME_KEYS.annuaire })
      qc.invalidateQueries({ queryKey: ['personnel'] })
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.utilisateurs })
      toast.success(i18n.t('admin.idChangeFait', { login }))
    },
  })
}

/** Corriger l'identifiant d'un compte (administrateur) — même remarque : l'erreur se lit dans la fenêtre. */
export function useChangerIdentifiantUtilisateur(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (login: string) => adminApi.utilisateurs.changerIdentifiant(id, login),
    onSuccess: (u) => {
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.utilisateurs })
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.utilisateur(id) })
      qc.invalidateQueries({ queryKey: ME_KEYS.annuaire })
      qc.invalidateQueries({ queryKey: ['personnel'] })
      toast.success(i18n.t('admin.idChangeFait', { login: u.login }))
    },
  })
}

/** Nom, prénom, e-mail de l'utilisateur connecté. Le nom vit sur sa fiche du personnel :
 *  on rafraîchit donc aussi l'annuaire (avatars) et les listes du personnel et des comptes. */
export function useUpdateMonProfil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateMonProfilPayload) => adminApi.me.updateProfil(data),
    onSuccess: (profil) => {
      qc.setQueryData(ME_KEYS.profil, profil)
      qc.invalidateQueries({ queryKey: ME_KEYS.annuaire })
      qc.invalidateQueries({ queryKey: ['personnel'] })
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.utilisateurs })
      toast.success(i18n.t('settings.profilEnregistre'))
    },
    onError: toastErr,
  })
}

export function useMyPreferences() {
  return useQuery({
    queryKey: ME_KEYS.preferences,
    queryFn:  () => adminApi.me.getPreferences(),
    staleTime: 60_000,
  })
}

/** `silencieux` : pas de notification de succès (bascule rapide, ex. raccourci du thème). */
export function useUpdateMyPreferences({ silencieux = false }: { silencieux?: boolean } = {}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdatePreferencesPayload) => adminApi.me.updatePreferences(data),
    onSuccess: (pref) => {
      qc.setQueryData(ME_KEYS.preferences, pref)
      if (!silencieux) toast.success(i18n.t('admin.toastPreferencesSaved'))
    },
    onError: toastErr,
  })
}

/** Clé de l'état de position : propre à la personne connectée, pour qu'une autre connexion
 *  (même onglet, autre compte) ne reprenne jamais l'état de la précédente. */
export const cleEtatPosition = (userId?: string | null) => [...ME_KEYS.position, userId ?? ''] as const

/** Position de l'appareil pour CETTE connexion web, et exigence du centre (cf. PositionConnexion). */
export function useEtatPosition(enabled: boolean, userId?: string | null) {
  return useQuery({
    queryKey: cleEtatPosition(userId),
    queryFn:  () => adminApi.me.getPosition(),
    enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

/**
 * Relève la position de l'appareil et la signale au serveur (statut + coordonnées).
 * L'invite d'autorisation est celle du navigateur — tant que la personne n'a pas répondu,
 * la mutation reste en cours. Un délai dépassé déclenche un second essai sans GPS
 * (réseau / Wi-Fi), plus rapide mais moins précis.
 */
export function useReleverPosition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<PositionEnvoyee['statut']> => {
      const signaler = async (p: PositionEnvoyee) => { await adminApi.me.setPosition(p); return p.statut }
      // Déjà refusée dans le navigateur : aucune invite n'est possible, on le consigne tout de suite.
      if ((await etatPermissionPosition()) === 'denied') return signaler({ statut: 'REFUSEE' })
      let echec: unknown
      try {
        return await signaler({ statut: 'OK', ...(await releverPosition(20_000)) })
      } catch (e) {
        echec = e
      }
      if (echec instanceof ErreurPosition && echec.code === 'delai_depasse') {
        try {
          return await signaler({ statut: 'OK', ...(await releverPosition(10_000, false)) })
        } catch (e) {
          echec = e
        }
      }
      return signaler({ statut: echec instanceof ErreurPosition && echec.code === 'refuse' ? 'REFUSEE' : 'INDISPONIBLE' })
    },
    onSuccess: (statut) => {
      const userId = useSessionStore.getState().user?.id
      qc.setQueryData<EtatPositionConnexion>(cleEtatPosition(userId), (e) => (e ? { ...e, statut } : e))
      // Le journal des connexions et les sessions portent désormais cette position.
      qc.invalidateQueries({ queryKey: ME_KEYS.sessions })
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.auth })
    },
  })
}

/** Ce que le serveur voit de la requête (adresse retenue, relais) — Paramètres système › Réseau. */
export function useDiagnosticReseau() {
  return useQuery({
    queryKey: ['admin', 'reseau'] as const,
    queryFn:  () => adminApi.parametres.diagnosticReseau(),
    staleTime: 0,
    refetchOnWindowFocus: false,
  })
}

/** Acceptation des conditions d'utilisation par l'utilisateur connecté. */
export function useAcceptCgu() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => adminApi.me.accepterCgu(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ME_KEYS.preferences }) },
  })
}

/** Upload de la photo de profil — met aussi à jour la session (affichage immédiat, sans reload)
 *  ET l'annuaire (pour que TOUS les avatars de cet utilisateur, partout dans l'app, se rafraîchissent). */
export function useUploadMyPhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => adminApi.me.uploadPhoto(file),
    onSuccess: ({ photoUrl }) => {
      const { user, setUser } = useSessionStore.getState()
      if (user) setUser({ ...user, photoUrl })
      qc.invalidateQueries({ queryKey: ME_KEYS.annuaire })
      toast.success(i18n.t('admin.toastPhotoSaved'))
    },
    onError: toastErr,
  })
}

/** Retire la photo de profil (repli sur les initiales, partout — cf. useUploadMyPhoto). */
export function useRemoveMyPhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => adminApi.me.removePhoto(),
    onSuccess: () => {
      const { user, setUser } = useSessionStore.getState()
      if (user) setUser({ ...user, photoUrl: null })
      qc.invalidateQueries({ queryKey: ME_KEYS.annuaire })
      toast.success(i18n.t('admin.toastPhotoRemoved'))
    },
    onError: toastErr,
  })
}

/** Annuaire (identité + photo) de tous les comptes actifs du site — utilisé par UserAvatar
 *  pour afficher la VRAIE photo partout où un avatar représente un utilisateur. Long cache
 *  (les photos changent rarement) ; invalidé explicitement quand JE change la mienne. */
export function useAnnuaire() {
  return useQuery({
    queryKey: ME_KEYS.annuaire,
    queryFn:  () => adminApi.me.annuaire(),
    staleTime: 5 * 60_000,
  })
}

export function useMySessions() {
  return useQuery({
    queryKey: ME_KEYS.sessions,
    queryFn:  () => adminApi.me.listSessions(),
    staleTime: 10_000,
  })
}

export function useRevokeSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.me.revokeSession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ME_KEYS.sessions })
      toast.success(i18n.t('admin.toastSessionRevoked'))
    },
    onError: toastErr,
  })
}

export function useRevokeOtherSessions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => adminApi.me.revokeOthers(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ME_KEYS.sessions })
      toast.success(i18n.t('admin.toastOtherSessionsRevoked', { count: r.count }))
    },
    onError: toastErr,
  })
}

export function useTotpStatus() {
  return useQuery({
    queryKey: ME_KEYS.totp,
    queryFn:  () => adminApi.me.totpStatus(),
    staleTime: 30_000,
  })
}

export function useTotpSetup() {
  return useMutation({ mutationFn: () => adminApi.me.totpSetup(), onError: toastErr })
}

export function useTotpActivate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => adminApi.me.totpActivate(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ME_KEYS.totp })
      toast.success(i18n.t('admin.toastTotpEnabled'))
    },
    onError: toastErr,
  })
}

export function useTotpDisable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => adminApi.me.totpDisable(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ME_KEYS.totp })
      toast.success(i18n.t('admin.toastTotpDisabled'))
    },
    onError: toastErr,
  })
}
