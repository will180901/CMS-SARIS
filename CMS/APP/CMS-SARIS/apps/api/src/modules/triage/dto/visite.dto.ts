import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsIn,
  IsNumber,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

const STATUTS_VISITE = [
  'EN_ATTENTE',
  'EN_COURS',
  'CLOTUREE',
  'ANNULEE',
] as const

// ── Saisie des constantes vitales ─────────────────────────────────────────────
// Déclaré AVANT CreateVisiteDto : référencé par @Type() + emitDecoratorMetadata
// (un usage après-coup déclencherait un ReferenceError de TDZ à l'import).
//
// Plages réalistes :
//   • Température        : 30 → 45 °C   (hypothermie sévère / hyperthermie extrême)
//   • Tension sys / dia  : 50–300 / 30–200 mmHg
//   • Fréquence cardiaque: 20 → 300 bpm
//   • Saturation O2      : 50 → 100 %
//   • Poids              : 0.5 → 300 kg  (du nouveau-né au pathologique)
//   • Taille             : 30 → 250 cm
//   • Glycémie           : 0.1 → 10 g/L  (≈ 0.55 → 55 mmol/L)

export class CreateConstanteVitaleDto {
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(45)
  @Type(() => Number)
  temperature?: number
  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(300)
  @Type(() => Number)
  tensionSystolique?: number
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(200)
  @Type(() => Number)
  tensionDiastolique?: number
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(300)
  @Type(() => Number)
  frequenceCardiaque?: number
  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(80)
  @Type(() => Number)
  frequenceRespiratoire?: number
  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(100)
  @Type(() => Number)
  saturationO2?: number
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(300)
  @Type(() => Number)
  poids?: number
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(250)
  @Type(() => Number)
  taille?: number
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(10)
  @Type(() => Number)
  glycemie?: number
  // Signes généraux (modèle Jeannette)
  @IsOptional() @IsString() @MaxLength(40) etatConscience?: string
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(15)
  @Type(() => Number)
  scoreGlasgow?: number
  @IsOptional() @IsString() @MaxLength(40) etatGeneral?: string
  @IsOptional() @IsString() @MaxLength(40) hydratation?: string
  @IsOptional() @IsString() @MaxLength(40) coloration?: string
}

// ── Créer une visite ──────────────────────────────────────────────────────────
// Acte de triage unique : la visite est ouverte AVEC ses notes d'accueil et ses
// constantes vitales dans une seule transaction (cf. TriageService.create).

export class CreateVisiteDto {
  @IsUUID() patientId: string
  @IsUUID() motifPrincipalId: string
  @IsOptional() @IsUUID() soignantId?: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notesAccueil?: string

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateConstanteVitaleDto)
  constantes?: CreateConstanteVitaleDto
}

// ── Changer le statut ─────────────────────────────────────────────────────────

export class UpdateStatutVisiteDto {
  @IsIn(STATUTS_VISITE) statut: string

  /** Obligatoire uniquement si statut = ANNULEE. */
  @ValidateIf((o) => o.statut === 'ANNULEE')
  @IsString()
  @MaxLength(500)
  motifAnnulation?: string

  /** Commentaire libre — utile pour CLOTUREE manuelle, ré-évaluation. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  commentaire?: string
}

// ── Mettre à jour les notes d'accueil ─────────────────────────────────────────

export class UpdateNotesVisiteDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notesAccueil?: string | null
}

// ── Assigner / retirer un soignant ────────────────────────────────────────────

export class UpdateSoignantVisiteDto {
  // `null` = désassigner ; sinon UUID valide d'un soignant.
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  soignantId?: string | null

  // Motif de la réaffectation (ex. transfert formalisé « cas complexe → médecin »,
  // recueil §4.2) — consigné dans l'audit trail VisiteEvenement.commentaire.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motif?: string
}

// ── Filtres liste ─────────────────────────────────────────────────────────────
// Note : la recherche texte, le tri par heure d'arrivée et le filtre soignant/motif
// sont gérés côté client (queue chargée par statut, multi-site, est compacte). Si le
// volume grossit, ajouter `search` + indexation pgtrgm côté backend.

export class VisiteQueryDto {
  @IsOptional() @IsIn([...STATUTS_VISITE, 'ACTIVES']) statut?: string
}

/**
 * Historique des visites (onglets « Clôturées » et « Annulées » du triage) : par PAGES, avec la
 * recherche et les filtres faits par le serveur — il y en a des milliers, on ne les envoie plus
 * toutes. La file ACTIVE, elle, reste une liste complète (quelques lignes) : `VisiteQueryDto`.
 */
export const VISITES_HISTORIQUE_LIMITE_DEFAUT = 40
export const VISITES_HISTORIQUE_LIMITE_MAX = 100

export class VisiteHistoriqueQueryDto {
  @IsIn(['CLOTUREE', 'ANNULEE']) statut!: string

  /** Mots cherchés (dans n'importe quel ordre) : patient, numéro, motif. */
  @IsOptional() @IsString() @MaxLength(100) search?: string

  /** Visites ouvertes par ce soignant (le filtre « soignant » du triage). */
  @IsOptional() @IsUUID() soignantId?: string

  /** Visites pour ce motif principal. */
  @IsOptional() @IsUUID() motifId?: string

  /** Dernière visite reçue : la page demandée commence juste après elle. */
  @IsOptional() @IsUUID() curseur?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(VISITES_HISTORIQUE_LIMITE_MAX)
  limite?: number
}
