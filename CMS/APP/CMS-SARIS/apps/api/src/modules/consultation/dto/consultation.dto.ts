import {
  IsUUID, IsOptional, IsString, IsIn, MaxLength, IsNotEmpty,
  IsInt, Min, Max, IsBoolean, IsDateString, ValidateIf,
} from 'class-validator'
import { Type } from 'class-transformer'

// ── Décisions médicales autorisées ────────────────────────────────────────────

export const DECISIONS_MEDICALES = [
  'CLOTURE_SIMPLE',
  'PRESCRIPTION',
  'EXAMEN_COMPLEMENTAIRE',
  'EVACUATION',
] as const

// ── Créer une consultation ────────────────────────────────────────────────────

export class CreateConsultationDto {
  @IsUUID()
  visiteId!: string

  /**
   * Optionnel : override du soignant.
   * Par défaut on utilise le soignant assigné à la visite.
   */
  @IsOptional()
  @IsUUID()
  soignantId?: string

  /** Type de consultation (référentiel) — optionnel à l'ouverture, modifiable ensuite. */
  @IsOptional()
  @IsUUID()
  typeConsultationId?: string
}

// ── Saisir / modifier l'examen clinique ──────────────────────────────────────

export class UpdateExamenCliniqueDto {
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  examenClinique?: string | null
}

// ── Ajouter un diagnostic ─────────────────────────────────────────────────────

export class AddDiagnosticDto {
  @IsUUID()
  pathologieId!: string

  @IsIn(['PRINCIPAL', 'ASSOCIE'])
  type!: string

  @IsIn(['CONFIRME', 'PROBABLE', 'SUSPECTE'])
  certitude!: string
}

// ── Mettre à jour conclusion ──────────────────────────────────────────────────

export class UpdateConclusionDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  conclusion?: string | null
}

// ── Clôturer la consultation ──────────────────────────────────────────────────

export class CloturerConsultationDto {
  @IsIn(DECISIONS_MEDICALES)
  decisionMedicale!: string

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  conclusion?: string | null
}

// ── Annuler la consultation ───────────────────────────────────────────────────

export class AnnulerConsultationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  motifAnnulation!: string
}

// ── Créer une ordonnance ──────────────────────────────────────────────────────

export class CreateOrdonnanceDto {
  // Corps vide — prescripteurId vient du JWT, consultationId du path param
}

// ── Ajouter une ligne d'ordonnance ────────────────────────────────────────────

export class AddLigneOrdonnanceDto {
  @IsUUID()
  medicamentId!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  posologie!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  duree!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  voieAdmin!: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(500)
  justification?: string | null

  /**
   * Confirme explicitement la connaissance des contre-indications BLOCKING.
   * Si false (ou absent) et que des contre-indications majeures sont
   * détectées, l'API renvoie 409 avec la liste à afficher en confirmation.
   */
  @IsOptional()
  acknowledgeWarnings?: boolean
}

// ── Query params ──────────────────────────────────────────────────────────────

export class ConsultationQueryDto {
  @IsOptional()
  @IsIn(['OUVERTE', 'CLOTUREE', 'ANNULEE', 'ACTIVES', 'TOUTES'])
  statut?: string

  /** Filtrer par patientId (dossier patient — toutes les consultations) */
  @IsOptional()
  @IsUUID()
  patientId?: string
}

// ── Type de consultation ──────────────────────────────────────────────────────

export class SetTypeConsultationDto {
  // null = retirer le type
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  typeConsultationId?: string | null
}

// ── Repos maladie (PEC supplémentaire) ────────────────────────────────────────

export class UpdateReposDto {
  @IsOptional() @IsInt() @Min(0) @Max(365) @Type(() => Number) reposJours?: number | null
  @IsOptional() @IsBoolean()                                   reposInclutJour?: boolean
  @IsOptional() @IsDateString()                                dateReprise?: string | null
}
