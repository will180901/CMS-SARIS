import {
  IsUUID,
  IsOptional,
  IsString,
  IsIn,
  MaxLength,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsDateString,
  ValidateIf,
  IsArray,
  ArrayMinSize,
} from 'class-validator'
import { Type } from 'class-transformer'

// ── Décisions médicales autorisées ────────────────────────────────────────────
// Réduites à EVACUATION/SUIVI_TRAITEMENT (refonte) : la voie normale d'une consultation est la
// clôture simple (pas besoin d'un choix explicite), et « prescription »/« examen complémentaire »
// sont désormais entièrement couvertes par le flux Ordonnance → Générer un bon. Les 3 valeurs
// historiques restent lisibles (labelDecision() bascule sur un texte humanisé) mais ne sont plus
// acceptées en écriture — ne jamais les retirer des clés i18n existantes pour autant.

export const DECISIONS_MEDICALES = ['EVACUATION', 'SUIVI_TRAITEMENT'] as const

// ── Types d'ordonnance autorisés ──────────────────────────────────────────────

export const TYPES_ORDONNANCE = [
  'PHARMACEUTIQUE',
  'PRESCRIPTION_EXAMEN',
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

  // Anamnèse structurée (recueil §3.2) — en complément du texte libre ci-dessus.
  @IsOptional() @IsDateString() anamneseDateDebut?: string | null
  @IsOptional() @IsString() @MaxLength(100) anamneseDuree?: string | null
  @IsOptional() @IsString() @MaxLength(200) anamneseModeDebut?: string | null
  @IsOptional() @IsString() @MaxLength(2000) anamneseSymptomes?: string | null
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
  // Optionnel : la voie normale (aucune décision, cas dominant) clôture directement.
  // Évacuation/Suivi de traitement sont désormais générés AVANT la clôture (étape Décision) —
  // ce champ ne fait plus que confirmer/tracer un choix déjà matérialisé par un enregistrement enfant.
  @IsOptional()
  @IsIn(DECISIONS_MEDICALES)
  decisionMedicale?: string

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
  // prescripteurId vient du JWT, consultationId du path param
  @IsIn(TYPES_ORDONNANCE)
  typeOrdonnance!: string

  /** Requis en pratique (vérifié en service) si typeOrdonnance === 'PRESCRIPTION_EXAMEN'. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  indicationClinik?: string

  @IsOptional()
  @IsUUID()
  etablissementId?: string
}

// ── Modifier l'indication clinique d'une ordonnance brouillon ────────────────────
// Seule l'indication clinique reste modifiable après création (type et lignes ont leurs
// propres routes dédiées) — verrouillée dès que l'ordonnance est validée (voir service).

export class UpdateOrdonnanceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  indicationClinik!: string
}

// ── Ajouter une ligne d'ordonnance ────────────────────────────────────────────
// Polymorphe : branche PHARMACEUTIQUE (medicamentId/posologie/duree/voieAdmin/quantite) OU
// branche PRESCRIPTION_EXAMEN (typesExamenIds — une LigneOrdonnance créée par id, miroir
// BonExamenService.create()). Tous les champs sont individuellement optionnels ici : le service
// vérifie ce qui est effectivement requis selon le typeOrdonnance de l'ordonnance ciblée.

export class AddLigneOrdonnanceDto {
  // ── Branche PHARMACEUTIQUE ──
  @IsOptional() @IsUUID() medicamentId?: string
  @IsOptional() @IsString() @MaxLength(500) posologie?: string
  @IsOptional() @IsString() @MaxLength(200) duree?: string
  @IsOptional() @IsString() @MaxLength(100) voieAdmin?: string
  @IsOptional() @IsString() @MaxLength(200) quantite?: string

  // ── Branche PRESCRIPTION_EXAMEN ──
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  typesExamenIds?: string[]

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

// dateReprise n'est plus envoyée par le client — calculée serveur (voir common/repos.ts).
export class UpdateReposDto {
  @IsOptional() @IsInt() @Min(0) @Max(365) @Type(() => Number) reposJours?:
    | number
    | null
  @IsOptional() @IsBoolean() reposInclutJour?: boolean
}
