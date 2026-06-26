// ── Personnel Médical ─────────────────────────────────────────────────────────

export type RolePersonnel =
  | 'MEDECIN'
  | 'INFIRMIER'
  | 'SAGE_FEMME'
  | 'TECHNICIEN_LAB'
  | 'ADMINISTRATIF'

export interface PersonnelMedical {
  id:         string
  matricule:  string
  nom:        string
  prenom:     string
  role:       RolePersonnel
  siteId?:    string | null
  statut:     'ACTIF' | 'INACTIF'
  createdAt?: string
}

// ── Délégations de prescription ───────────────────────────────────────────────

export interface PersonnelResume {
  id:        string
  nom:       string
  prenom:    string
  matricule: string
}

// Recueil §3.2 : la délégation autorise consultation + prescription des cas courants.
// `perimetre` = note textuelle des conditions (pas de filtre par médicament).
export interface DelegationPrescription {
  id:            string
  medecinChefId: string
  infirmierId:   string
  medecinChef:   PersonnelResume
  infirmier:     PersonnelResume
  dateDebut:     string
  dateFin:       string
  statut:        'ACTIVE' | 'INACTIVE'
  perimetre?:    string | null
}

// ── Sociétés sous-traitantes ──────────────────────────────────────────────────

export interface SocieteSousTraitante {
  id:        string
  nom:       string
  statut:    'ACTIVE' | 'INACTIVE'
  createdAt: string
}
