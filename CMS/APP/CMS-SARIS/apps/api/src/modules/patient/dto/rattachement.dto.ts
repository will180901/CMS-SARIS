import {
  IsOptional,
  IsIn,
  IsDateString,
  IsString,
  IsNotEmpty,
  MaxLength,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { NouvelEmployeDto } from './patient.dto'

// ── Rattachement Ayant Droit CDI ──────────────────────────────────────────────
// Création retirée : le rattachement se crée automatiquement à la visite
// (PatientService.create(), catégorie AYANT_DROIT_CDI) — seule reste l'édition
// du type de lien / des dates / du statut d'un rattachement déjà existant.
// Rattachement Sous-Traitant : gestion manuelle retirée entièrement (idem, plus
// d'onglet Administratif du tout pour cette catégorie — voir DossierPage.tsx).

const LIENS_PARENTE = ['CONJOINT', 'ENFANT', 'PARENT', 'AUTRE'] as const

/**
 * Rattacher un patient DÉJÀ ENREGISTRÉ à un travailleur CDI, depuis la visite.
 *
 * La création du dossier savait le faire, pas l'accueil d'un patient existant : un
 * conjoint déjà venu comme « population », ou un enfant à rattacher à son 2e parent CDI,
 * n'avait aucun chemin — le changement de catégorie renvoyait vers « une nouvelle
 * visite », qui ne le proposait pas.
 */
export class RattacherAyantDroitDto {
  @IsString() @IsNotEmpty() @MaxLength(50) cdiMatricule: string
  @IsIn(LIENS_PARENTE) typeLien: string
  /** Si le matricule est inconnu au registre : le travailleur CDI à enregistrer. */
  @IsOptional()
  @ValidateNested()
  @Type(() => NouvelEmployeDto)
  nouvelEmploye?: NouvelEmployeDto
}

export class UpdateRattachementADDto {
  @IsOptional() @IsIn(LIENS_PARENTE) typeLien?: string
  @IsOptional() @IsDateString() dateDebut?: string
  @IsOptional() @IsDateString() dateFin?: string
  @IsOptional() @IsIn(['ACTIF', 'INACTIF']) statut?: string
}
