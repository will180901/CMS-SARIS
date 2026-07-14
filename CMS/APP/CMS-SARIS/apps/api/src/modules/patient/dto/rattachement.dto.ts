import { IsOptional, IsIn, IsDateString } from 'class-validator'

// ── Rattachement Ayant Droit CDI ──────────────────────────────────────────────
// Création retirée : le rattachement se crée automatiquement à la visite
// (PatientService.create(), catégorie AYANT_DROIT_CDI) — seule reste l'édition
// du type de lien / des dates / du statut d'un rattachement déjà existant.
// Rattachement Sous-Traitant : gestion manuelle retirée entièrement (idem, plus
// d'onglet Administratif du tout pour cette catégorie — voir DossierPage.tsx).

const LIENS_PARENTE = ['CONJOINT', 'ENFANT', 'PARENT', 'AUTRE'] as const

export class UpdateRattachementADDto {
  @IsOptional() @IsIn(LIENS_PARENTE)        typeLien?:  string
  @IsOptional() @IsDateString()             dateDebut?: string
  @IsOptional() @IsDateString()             dateFin?:   string
  @IsOptional() @IsIn(['ACTIF', 'INACTIF']) statut?:    string
}
