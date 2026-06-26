import type { PermissionCode } from './permissions.js'

export type Role =
  | 'ADMIN_SYSTEME'
  | 'MEDECIN_CHEF'
  | 'INFIRMIER'

export interface JwtPayload {
  sub:               string
  siteId:            string
  roles:             Role[]
  permissions:       PermissionCode[]
  personnelMedicalId: string | null
  /** Identifiant de la session (= SessionUtilisateur.id) — pour la gestion des sessions */
  sid?:              string
  iat:               number
  exp:               number
}

export interface UserSession {
  id:                 string
  login:              string
  siteId:             string
  roles:              Role[]
  permissions:        PermissionCode[]
  personnelMedicalId: string | null
  token:              string
}

export interface LoginDto {
  login:    string
  password: string
}

export interface TotpVerifyDto {
  code:       string
  tempToken:  string
}

export interface AuthResponse {
  accessToken:   string
  refreshToken:  string
  user:          Omit<UserSession, 'token'>
}
