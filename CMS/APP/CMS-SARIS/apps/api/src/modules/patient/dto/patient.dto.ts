import {
  IsString, IsNotEmpty, IsOptional, IsDateString,
  IsIn, IsUUID, MaxLength, ValidateNested, IsBoolean,
} from 'class-validator'
import { Type } from 'class-transformer'
import { PartialType } from '@nestjs/mapped-types'

// ── Contact urgence ───────────────────────────────────────────────────────────

export class CreateContactUrgenceDto {
  @IsString() @IsNotEmpty() @MaxLength(100) nom:      string
  @IsString() @IsNotEmpty() @MaxLength(100) prenom:   string
  @IsString() @IsNotEmpty() @MaxLength(20)  telephone: string
  @IsString() @IsNotEmpty() @MaxLength(50)  lien:     string
}

export class UpdateContactUrgenceDto extends PartialType(CreateContactUrgenceDto) {}

// ── Nouvel employé CDI (registre) — saisi à la volée si le matricule du CDI rattaché
//    d'un ayant droit n'existe pas encore au registre des employés SARIS. ──────────

export class NouvelEmployeDto {
  @IsString() @IsNotEmpty() @MaxLength(100) nom:    string
  @IsString() @IsNotEmpty() @MaxLength(100) prenom: string
  @IsOptional() @IsDateString()             dateNaissance?: string
  @IsOptional() @IsIn(['M', 'F'])           sexe?: string
  @IsOptional() @IsString() @MaxLength(100) fonction?:    string
  @IsOptional() @IsString() @MaxLength(100) sectionPaie?: string
  @IsOptional() @IsString() @MaxLength(100) service?:     string
  @IsOptional() @IsString() @MaxLength(100) departement?: string
}

// ── Création patient ──────────────────────────────────────────────────────────

export class CreatePatientDto {
  // Identité civile
  @IsString() @IsNotEmpty() @MaxLength(100) nom:           string
  @IsString() @IsNotEmpty() @MaxLength(100) prenom:        string
  @IsDateString()                           dateNaissance:  string
  @IsIn(['M', 'F'])                         sexe:           string
  @IsUUID()                                 categoriePatientId: string
  @IsUUID()                                 siteCreationId: string
  @IsOptional() @IsString() @MaxLength(20)  telephone?:    string
  @IsOptional() @IsString() @MaxLength(200) adresse?:      string
  // Matricule employeur (travailleur CDI) — sert au rattachement des ayants droit.
  @IsOptional() @IsString() @MaxLength(50)  matricule?:    string

  // Données professionnelles (personnel CDI/CDD) — recueil §5. Obligation imposée
  // par catégorie côté backend (assertDonneesCategorie), pas seulement par l'UI.
  @IsOptional() @IsString() @MaxLength(100) fonction?:    string
  @IsOptional() @IsString() @MaxLength(100) sectionPaie?: string
  @IsOptional() @IsString() @MaxLength(100) service?:     string
  @IsOptional() @IsString() @MaxLength(100) departement?: string

  // Rattachement saisi DÈS la création (recueil §5) :
  //  - AYANT_DROIT_CDI : matricule du CDI rattaché + lien de parenté (obligatoires)
  //  - SOUS_TRAITANT   : société sous-traitante (obligatoire)
  @IsOptional() @IsString() @MaxLength(50)  cdiMatricule?: string
  @IsOptional() @IsIn(['CONJOINT', 'ENFANT', 'PARENT', 'AUTRE']) typeLien?: string
  @IsOptional() @IsUUID()                   societeId?:    string
  // Ayant droit : si le matricule du CDI rattaché est INCONNU au registre, on enregistre
  // le travailleur CDI à la volée via ces informations.
  @IsOptional()
  @ValidateNested()
  @Type(() => NouvelEmployeDto)
  nouvelEmploye?: NouvelEmployeDto

  // Contact urgence — optionnel à la création (accueil rapide au triage) ;
  // peut être complété ensuite dans le dossier (cf. WF-05 « si requis »).
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateContactUrgenceDto)
  contactUrgence?: CreateContactUrgenceDto
}

// ── Mise à jour identité ──────────────────────────────────────────────────────

export class UpdateIdentiteDto {
  @IsOptional() @IsString() @MaxLength(100) nom?:          string
  @IsOptional() @IsString() @MaxLength(100) prenom?:       string
  @IsOptional() @IsDateString()             dateNaissance?: string
  @IsOptional() @IsIn(['M', 'F'])           sexe?:          string
  @IsOptional() @IsString() @MaxLength(20)  telephone?:    string
  @IsOptional() @IsString() @MaxLength(200) adresse?:      string
  // Matricule + données professionnelles (CDI/CDD)
  @IsOptional() @IsString() @MaxLength(50)  matricule?:    string
  @IsOptional() @IsString() @MaxLength(100) fonction?:    string
  @IsOptional() @IsString() @MaxLength(100) sectionPaie?: string
  @IsOptional() @IsString() @MaxLength(100) service?:     string
  @IsOptional() @IsString() @MaxLength(100) departement?: string

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateContactUrgenceDto)
  contactUrgence?: UpdateContactUrgenceDto
}

// ── Mode de vie (recueil) ─────────────────────────────────────────────────────

export class UpsertModeVieDto {
  @IsOptional() @IsString() @MaxLength(200) tabac?:            string
  @IsOptional() @IsString() @MaxLength(200) alcool?:           string
  @IsOptional() @IsString() @MaxLength(200) drogues?:          string
  @IsOptional() @IsString() @MaxLength(200) activitePhysique?: string
  @IsOptional() @IsString() @MaxLength(200) alimentation?:     string
  @IsOptional() @IsString() @MaxLength(200) sommeil?:          string
  @IsOptional() @IsString() @MaxLength(200) troublesSommeil?:  string
  @IsOptional() @IsString() @MaxLength(200) sedentarite?:      string
  @IsOptional() @IsString() @MaxLength(200) portCharges?:      string
  @IsOptional() @IsString() @MaxLength(1000) observations?:    string
}

// Verrou de confidentialité du dossier (médecin-chef).
export class VerrouPatientDto {
  @IsBoolean() verrouille: boolean
  @IsOptional() @IsString() @MaxLength(300) motif?: string
}

// ── Changement de catégorie ───────────────────────────────────────────────────

export class ChangerCategorieDto {
  @IsUUID()                      nouvelleCategId: string
  @IsString() @IsNotEmpty() @MaxLength(500) motif: string
}

// ── Changement de statut ──────────────────────────────────────────────────────

const STATUTS_PATIENT = ['ACTIF', 'ARCHIVE', 'DECEDE'] as const

export class ToggleStatutPatientDto {
  @IsIn(STATUTS_PATIENT) statut: string
}

// ── Filtres liste ─────────────────────────────────────────────────────────────

export class PatientQueryDto {
  @IsOptional() @IsString() search?:       string
  @IsOptional() @IsUUID()   categorieId?:  string
  @IsOptional() @IsUUID()   siteId?:       string
  @IsOptional() @IsIn(['ACTIF', 'ARCHIVE', 'DECEDE', 'FUSIONNE']) statut?: string
}

// ── Détection de doublons (triage) ────────────────────────────────────────────

export class FindSimilarPatientDto {
  @IsString() @IsNotEmpty() @MaxLength(100) nom:    string
  @IsString() @IsNotEmpty() @MaxLength(100) prenom: string
  @IsOptional() @IsDateString()             dateNaissance?: string
  @IsOptional() @IsIn(['M', 'F'])           sexe?:  string
}
