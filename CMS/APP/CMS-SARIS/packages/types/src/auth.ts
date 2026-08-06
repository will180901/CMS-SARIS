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
  photoUrl:           string | null
  token:              string
}

export interface LoginDto {
  login:    string
  password: string
  /** Identifiant stable du poste — évite l'avertissement de double connexion lors
   *  d'une simple reconnexion depuis le même appareil (cf. lib/appareil.ts). */
  appareilId?: string
}

export interface TotpVerifyDto {
  code:       string
  tempToken:  string
  appareilId?: string
}

/** Session déjà ouverte ailleurs, présentée à l'utilisateur qui se connecte. */
export interface SessionConcurrente {
  ouverteA:          string
  /** `null` pour les sessions ouvertes avant le suivi d'activité. */
  derniereActiviteA: string | null
  /** Brut : mis en forme côté client (parseUserAgent). */
  userAgent:         string | null
  lieu:              string | null
}

/** Décision de l'utilisateur face à une session concurrente. */
export interface ConfirmerSessionDto {
  tempToken: string
  /** `REMPLACER` = « c'était moi » ; `SIGNALER` = « ce n'est pas moi ». */
  action:    'REMPLACER' | 'SIGNALER'
}

export interface AuthResponse {
  accessToken:   string
  refreshToken:  string
  user:          Omit<UserSession, 'token'>
}
