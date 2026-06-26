export interface Site {
  id:            string
  code:          string
  libelle:       string
  localisation?: string
  statut:        'ACTIF' | 'INACTIF'
  createdAt?:    string
}

export interface CategoriePatient {
  id:      string
  code:    string
  libelle: string
  statut:  'ACTIVE' | 'INACTIVE'
}

export interface MotifConsultation {
  id:        string
  code:      string
  libelle:   string
  statut:    'ACTIF' | 'INACTIF'
}

export interface MedicamentReference {
  id:             string
  nomGenerique:   string
  nomCommercial?: string
  familleThera?:  string
  statut:         'ACTIF' | 'INACTIF'
}

export interface PathologieReference {
  id:        string
  code:      string
  libelle:   string
  chronique: boolean
  statut:    'ACTIVE' | 'INACTIVE'
}

export interface TypeExamen {
  id:      string
  code:    string
  libelle: string
  domaine: 'BIOLOGIE' | 'IMAGERIE' | 'SPECIALISE'
  statut:  'ACTIF' | 'INACTIF'
}

export interface TypeConsultation {
  id:      string
  code:    string
  libelle: string
  statut:  'ACTIF' | 'INACTIF'
}
