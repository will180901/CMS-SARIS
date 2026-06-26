/**
 * admin.api.ts — Couche d'accès API pour /admin/* (utilisateurs, rôles, audit)
 */

import { api } from '@/lib/api'
import type { Role, PermissionCode } from '@cms-saris/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UtilisateurAdmin {
  id:                 string
  login:              string
  email:              string
  statut:             'ACTIF' | 'DESACTIVE' | 'BLOQUE'
  motDePasseTemp:     boolean
  tentativesEchec:    number
  blocageJusquA:      string | null
  siteId:             string
  personnelMedicalId: string | null
  createdAt:          string
  updatedAt:          string

  site:             { id: string; code: string; libelle: string }
  roles:            { id: string; code: Role; libelle: string }[]
  personnelMedical: { id: string; nom: string; prenom: string; matricule: string; role: string; statut: string } | null
  /** Renvoyé par findById : l'utilisateur a-t-il la double authentification active. */
  aDeuxFacteurs?:   boolean
}

export interface RoleAdmin {
  id:             string
  code:           string
  libelle:        string
  isSystem:       boolean
  permissions:    PermissionCode[]
  nbUtilisateurs: number
}

export interface PermissionDb {
  id:       string
  code:     PermissionCode
  module:   string
  /** Libellé humain fourni par le catalogue backend (filet : labelPermission retombe sur la table locale). */
  libelle?: string
}

// Payloads
export interface CreateUtilisateurPayload {
  login:              string
  email:              string
  motDePasseInitial:  string
  siteId:             string
  personnelMedicalId?: string | null
  // Identité de la fiche clinique créée AVEC le compte (compte soignant) : le backend
  // crée la fiche PersonnelMedical liée. Requis si rôle clinique sans personnel existant.
  nom?:               string
  prenom?:            string
  matricule?:         string
  roleIds:            string[]
}
export interface UpdateUtilisateurPayload {
  email?:              string
  siteId?:             string
  personnelMedicalId?: string | null
}
export interface SetRolesPayload         { roleIds: string[] }
export interface SetStatutPayload        { statut: 'ACTIF' | 'DESACTIVE' | 'BLOQUE'; motif?: string }
export interface ResetPasswordPayload    { nouveauMotDePasse: string; forcerChangement?: boolean }

// ── Dérogations de permissions par utilisateur ────────────────────────────────
export interface PermissionOverrideEntry {
  code:       PermissionCode
  motif:      string | null
  creeLe:     string
  accordePar: string | null
}
export interface RoleUtilisateur {
  id:     string
  login:  string
  nom:    string | null
  prenom: string | null
  statut: string
  site:   string | null
}
export interface UserPermissionsBreakdown {
  utilisateurId: string
  roles:     { code: string; libelle: string }[]
  fromRoles: PermissionCode[]
  grants:    PermissionOverrideEntry[]
  revokes:   PermissionOverrideEntry[]
  effective: PermissionCode[]
}
export interface SetPermissionOverridesPayload {
  grants?:  PermissionCode[]
  revokes?: PermissionCode[]
  motif?:   string
}
export type BulkPermissionMode = 'GRANT' | 'REVOKE' | 'RESET'
export interface BulkPermissionPayload {
  utilisateurIds: string[]
  code:           PermissionCode
  mode:           BulkPermissionMode
  motif?:         string
}

export interface CreateRolePayload  { code: string; libelle: string; permissions: PermissionCode[] }
export interface UpdateRolePayload  { libelle: string; permissions: PermissionCode[] }

/**
 * Résultat paginé des journaux : `data` = lot renvoyé (plafonné à `limit`),
 * `total` = nombre RÉEL d'entrées correspondant aux filtres (pour les compteurs).
 */
export interface AuditPageResult<T> {
  data:  T[]
  total: number
}

export interface AuditEntry {
  id:            string
  utilisateurId: string | null
  action:        string
  module:        string
  entiteType:    string | null
  entiteId:      string | null
  avantJson:     unknown
  apresJson:     unknown
  ipAdresse:     string | null
  statut:        string
  createdAt:     string
  utilisateur:   { id: string; login: string; email: string } | null
}

export interface GeoLocalisation {
  ip:        string | null
  ville:     string | null
  region:    string | null
  pays:      string | null
  latitude:  number | null
  longitude: number | null
  timezone:  string | null
  label:     string
  source:    'local' | 'externe' | 'inconnue'
}

export interface AuthLogEntry {
  id:            string
  utilisateurId: string | null
  login:         string
  resultat:      string
  ipAdresse:     string | null
  userAgent:     string | null
  localisation:  GeoLocalisation | null
  createdAt:     string
  utilisateur:   { id: string; login: string; email: string } | null
}

export interface ParametreSysteme {
  cle:         string
  type:        'number' | 'string' | 'boolean' | 'duration_minutes' | 'enum'
  group:       string
  description: string
  valeur:      string
  defaultVal:  string
  min:         number | null
  max:         number | null
  options:     { value: string; label: string }[] | null
  modifie:     boolean
  updatedAt:   string | null
  updatedBy:   string | null
}

// ── « Mon compte » (utilisateur connecté) ─────────────────────────────────────
export interface Preferences {
  utilisateurId: string
  theme:         'clair' | 'sombre' | 'auto'
  densite:       'confort' | 'compact'
  langue:        'fr' | 'en'
  pageAccueil:   string
  lignesParPage: number
  notifEmail:    boolean
  updatedAt:     string | null
  cguAJour?:      boolean
  cguAccepteeLe?: string | null
  cguVersion?:    string | null
}
export type UpdatePreferencesPayload = Partial<Omit<Preferences, 'utilisateurId' | 'updatedAt' | 'cguAJour' | 'cguAccepteeLe' | 'cguVersion'>>

export interface SessionInfo {
  id:           string
  ipAdresse:    string | null
  userAgent:    string | null
  localisation: GeoLocalisation | null
  createdAt:    string
  expiresAt:    string
  current:      boolean
}
export interface TotpStatus  { actif: boolean; enAttente: boolean }
export interface TotpSetup   { secret: string; otpauthUrl: string; issuer: string }
export interface TotpActivated { success: boolean; backupCodes: string[] }

export interface SyncStatus {
  modules: { module: string; count: number }[]
  journaux: { audit: number; authentifications: number }
  derniereSauvegarde: SauvegardeSysteme | null
  planification?: { actif: boolean; expression: string; retention: number }
}

export interface SauvegardeSysteme {
  id:           string
  type:         string
  statut:       string
  declenchePar: string | null
  createdAt:    string
  perimetre?:   string | null
  taille?:      number | null
  finishedAt?:  string | null
  message?:     string | null
}

// ── API ───────────────────────────────────────────────────────────────────────

export const adminApi = {

  utilisateurs: {
    list: (params?: { search?: string; statut?: string; siteId?: string; roleId?: string }) =>
      api.get<UtilisateurAdmin[]>('/admin/utilisateurs', params as Record<string, string>),
    findById: (id: string) =>
      api.get<UtilisateurAdmin>(`/admin/utilisateurs/${id}`),
    create: (data: CreateUtilisateurPayload) =>
      api.post<UtilisateurAdmin>('/admin/utilisateurs', data),
    update: (id: string, data: UpdateUtilisateurPayload) =>
      api.patch<UtilisateurAdmin>(`/admin/utilisateurs/${id}`, data),
    setRoles: (id: string, data: SetRolesPayload) =>
      api.patch<UtilisateurAdmin>(`/admin/utilisateurs/${id}/roles`, data),
    setStatut: (id: string, data: SetStatutPayload) =>
      api.patch<UtilisateurAdmin>(`/admin/utilisateurs/${id}/statut`, data),
    remove: (id: string) =>
      api.delete<{ id: string; deleted: true }>(`/admin/utilisateurs/${id}`),
    resetPassword: (id: string, data: ResetPasswordPayload) =>
      api.post<{ success: boolean }>(`/admin/utilisateurs/${id}/reset-password`, data),
    // Récupération de compte (admin reprend la main)
    resetTotp: (id: string) =>
      api.post<{ ok: boolean }>(`/admin/utilisateurs/${id}/totp/reset`, {}),
    regenerateBackupCodes: (id: string) =>
      api.post<{ backupCodes: string[] }>(`/admin/utilisateurs/${id}/backup-codes`, {}),
    revokeSessions: (id: string) =>
      api.post<{ count: number }>(`/admin/utilisateurs/${id}/sessions/revoke`, {}),

    // Dérogations de permissions individuelles
    getPermissions: (id: string) =>
      api.get<UserPermissionsBreakdown>(`/admin/utilisateurs/${id}/permissions`),
    setPermissions: (id: string, data: SetPermissionOverridesPayload) =>
      api.put<UserPermissionsBreakdown>(`/admin/utilisateurs/${id}/permissions`, data),
    bulkPermissions: (data: BulkPermissionPayload) =>
      api.post<{ success: boolean; count: number; code: string; mode: string }>(
        '/admin/utilisateurs/permissions/bulk', data,
      ),
  },

  roles: {
    list:      ()                                   => api.get<RoleAdmin[]>('/admin/roles'),
    findById:  (id: string)                         => api.get<RoleAdmin>(`/admin/roles/${id}`),
    utilisateurs: (id: string)                      => api.get<RoleUtilisateur[]>(`/admin/roles/${id}/utilisateurs`),
    create:    (data: CreateRolePayload)            => api.post<RoleAdmin>('/admin/roles', data),
    update:    (id: string, data: UpdateRolePayload) => api.patch<RoleAdmin>(`/admin/roles/${id}`, data),
    remove:    (id: string)                         => api.delete<{ success: boolean }>(`/admin/roles/${id}`),
  },

  permissions: {
    list: () => api.get<PermissionDb[]>('/admin/permissions'),
  },

  audit: {
    actions: (params?: Record<string, string | undefined>) =>
      api.get<AuditPageResult<AuditEntry>>('/admin/audit/actions', params as Record<string, string>),
    authentifications: (params?: Record<string, string | undefined>) =>
      api.get<AuditPageResult<AuthLogEntry>>('/admin/audit/authentifications', params as Record<string, string>),
  },

  parametres: {
    list:   ()                                 => api.get<ParametreSysteme[]>('/admin/parametres'),
    update: (cle: string, valeur: string)      => api.patch<unknown>(`/admin/parametres/${encodeURIComponent(cle)}`, { valeur }),
    reset:  (cle: string)                      => api.post<{ success: boolean; valeur: string }>(`/admin/parametres/${encodeURIComponent(cle)}/reset`, {}),
  },

  // « Mon compte » — utilisateur connecté
  me: {
    getPreferences:    ()                              => api.get<Preferences>('/me/preferences'),
    updatePreferences: (data: UpdatePreferencesPayload) => api.put<Preferences>('/me/preferences', data),
    accepterCgu:       ()                              => api.post<{ ok: boolean; cguVersion: string }>('/me/cgu/accepter', {}),

    listSessions:      ()                              => api.get<SessionInfo[]>('/me/sessions'),
    revokeSession:     (id: string)                    => api.delete<{ success: boolean; wasCurrent: boolean }>(`/me/sessions/${id}`),
    revokeOthers:      ()                              => api.post<{ success: boolean; count: number }>('/me/sessions/revoke-others', {}),

    totpStatus:        ()                              => api.get<TotpStatus>('/me/totp'),
    totpSetup:         ()                              => api.post<TotpSetup>('/me/totp/setup', {}),
    totpActivate:      (code: string)                  => api.post<TotpActivated>('/me/totp/activate', { code }),
    totpDisable:       (code: string)                  => api.post<{ success: boolean }>('/me/totp/disable', { code }),
  },

  synchronisation: {
    status:        () => api.get<SyncStatus>('/synchronisation/status'),
    sauvegardes:   () => api.get<SauvegardeSysteme[]>('/synchronisation/sauvegardes'),
    declencher:    () => api.post<SauvegardeSysteme>('/synchronisation/sauvegardes/manuelle', {}),
    restaurer:     (id: string) => api.post<{ id: string; restored: true }>(`/synchronisation/sauvegardes/${id}/restaurer`, {}),
  },
}
