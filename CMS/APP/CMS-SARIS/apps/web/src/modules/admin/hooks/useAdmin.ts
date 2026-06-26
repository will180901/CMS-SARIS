/**
 * Hooks TanStack Query — Administration système (/admin/*).
 */

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from '@workspace/ui/components/sonner'
import { adminApi } from '../api/admin.api'
import type {
  CreateUtilisateurPayload, UpdateUtilisateurPayload,
  SetRolesPayload, SetStatutPayload, ResetPasswordPayload,
  CreateRolePayload, UpdateRolePayload,
  SetPermissionOverridesPayload, BulkPermissionPayload,
  UpdatePreferencesPayload,
} from '../api/admin.api'
import { ApiError, isOfflineQueued } from '@/lib/api'
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

export function useUtilisateurs(params?: { search?: string; statut?: string; siteId?: string; roleId?: string }) {
  return useQuery({
    queryKey: [...ADMIN_KEYS.utilisateurs, params],
    queryFn:  () => adminApi.utilisateurs.list(params),
    staleTime: 15_000,
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
    mutationFn: (data: ResetPasswordPayload) => adminApi.utilisateurs.resetPassword(id, data),
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

export function useDeclencherSauvegarde() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => adminApi.synchronisation.declencher(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SYNC_KEY })
      toast.success(i18n.t('admin.toastBackupCreated'))
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
}

export function useMyPreferences() {
  return useQuery({
    queryKey: ME_KEYS.preferences,
    queryFn:  () => adminApi.me.getPreferences(),
    staleTime: 60_000,
  })
}

export function useUpdateMyPreferences() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdatePreferencesPayload) => adminApi.me.updatePreferences(data),
    onSuccess: (pref) => {
      qc.setQueryData(ME_KEYS.preferences, pref)
      toast.success(i18n.t('admin.toastPreferencesSaved'))
    },
    onError: toastErr,
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
