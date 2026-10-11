/**
 * Ce que le planificateur reçoit et rend : l'équipe du centre, les référentiels, l'état qui passe
 * d'un jour au suivant, et les petits outils communs (journal d'audit, adresses IP).
 */
import type { Alea } from './alea'
import type { FabriqueIdentites, Numerotation } from './fabrique-identites'
import { nouvelIdTest } from './marque-test'
import type { PatientSim, Population } from './population'
import type { LignesJour } from './registre'

/** Un membre du personnel soignant AYANT UN COMPTE : c'est à lui que sont attribuées les actions. */
export interface Soignant {
  utilisateurId: string
  /** L'identifiant de connexion du compte (colonne « Login » du journal des connexions). */
  login: string
  /** `PersonnelMedical.id` — celui que portent les visites, consultations et ordonnances. */
  personnelId: string
  siteId: string
}

export interface EquipeSite {
  siteId: string
  /** Code du site (« MOUTELA ») : ses 3 premières lettres préfixent les numéros de dossier. */
  siteCode: string
  medecins: Soignant[]
  infirmiers: Soignant[]
}

/** Un médicament du référentiel du centre (actif). */
export interface MedicamentTest {
  id: string
  nomGenerique: string
  nomCommercial: string | null
  famille: string | null
  /** Conditions de contre-indication déclarées (texte). */
  contreIndications: readonly string[]
}

/** Ce que le générateur LIT dans les référentiels du centre (jamais ne modifie). */
export interface ReferentielsTest {
  /** code de catégorie → id */
  categories: ReadonlyMap<string, string>
  motifs: ReadonlyMap<string, { id: string; triageAllege: boolean }>
  /** code de pathologie → id */
  pathologies: ReadonlyMap<string, string>
  /** Identifiants des pathologies que le centre déclare chroniques (seules à pouvoir porter un suivi chronique). */
  pathologiesChroniques: ReadonlySet<string>
  /** code de type de consultation → id */
  typesConsultation: ReadonlyMap<string, string>
  /** Sociétés sous-traitantes ACTIVES. */
  societes: readonly string[]
  /** Médicaments actifs, par nom générique « ramené à ses lettres » (cf. `cleMedicament`). */
  medicaments: ReadonlyMap<string, MedicamentTest>
  /** code de type d'examen → id et domaine (BIOLOGIE, IMAGERIE…). */
  typesExamen: ReadonlyMap<string, { id: string; domaine: string }>
  /** code de catégorie → prestations couvertes parmi MEDICAMENT et EXAMEN (la matrice du centre). */
  droits: ReadonlyMap<string, ReadonlySet<string>>
  /** Établissements de référence actifs (évacuations, examens extérieurs). */
  etablissements: readonly string[]
}

/** Ce qui se transmet d'un jour de génération au suivant. */
export interface EtatGeneration {
  population: Population
  fabrique: FabriqueIdentites
  numerotation: Numerotation
}

export interface ParametresJour {
  /** Visites par jour d'ouverture, tous sites confondus (moyenne). */
  visitesParJour: number
  /** Rang du jour dans la période (0 = le plus ancien), et nombre total de jours. */
  indexJour: number
  totalJours: number
  /**
   * Dernier jour de la période (« AAAA-MM-JJ »). Ce qui se passe APRÈS (un résultat qui arrive, un
   * suivi qui se poursuit) n'est pas encore arrivé : on ne fabrique pas d'avenir.
   */
  finPeriode: string
}

export interface ContexteJour {
  /** « AAAA-MM-JJ », jour local. */
  jour: string
  alea: Alea
  /**
   * Le générateur de TOUTE la génération (celui de la graine), dont on tire ce qui doit être le
   * même d'un jour à l'autre : l'appareil de chacun, l'heure à laquelle il arrive demain. `sousFlux`
   * ne dépend pas de ce qui a déjà été tiré : le même nom rend toujours la même suite.
   */
  racine: Alea
  equipes: readonly EquipeSite[]
  ref: ReferentielsTest
  etat: EtatGeneration
  params: ParametresJour
  /** Adresses IP publiques des postes de chaque site (celles que le serveur verrait). */
  ips: ReadonlyMap<string, readonly string[]>
  /** Les dossiers ouverts dans la journée (renseigné par le planificateur lui-même, pas par l'appelant). */
  nouveaux?: PatientSim[]
}

export interface ResumeJour {
  visites: number
  nouveauxPatients: number
  consultations: number
  visitesAnnulees: number
  consultationsAnnulees: number
  /** Patients qu'aucun infirmier n'a pu recevoir avant la fermeture (volume au-delà de la capacité). */
  nonRecus: number
}

export function resumeVide(): ResumeJour {
  return {
    visites: 0,
    nouveauxPatients: 0,
    consultations: 0,
    visitesAnnulees: 0,
    consultationsAnnulees: 0,
    nonRecus: 0,
  }
}

// ── Journal d'audit ─────────────────────────────────────────────────────────

export type ActionAudit = 'CREATE' | 'UPDATE' | 'DELETE'

/**
 * L'adresse IP du poste habituel de cette personne : fixée par son identifiant parmi celles de son
 * site (un centre sort sur Internet par une ou deux adresses publiques).
 */
export function ipHabituelle(
  ips: ReadonlyMap<string, readonly string[]>,
  qui: Soignant,
): string | null {
  const pool = ips.get(qui.siteId)
  if (!pool || pool.length === 0) return null
  let h = 0
  for (let i = 0; i < qui.utilisateurId.length; i++)
    h = (h * 31 + qui.utilisateurId.charCodeAt(i)) >>> 0
  return pool[h % pool.length]
}

/** Une adresse IP de ce site pour cette personne : en général la sienne, parfois une autre. */
export function ipDe(ctx: ContexteJour, qui: Soignant): string | null {
  const pool = ctx.ips.get(qui.siteId)
  if (!pool || pool.length === 0) return null
  if (ctx.alea.proba(0.12)) return ctx.alea.choisir(pool)
  return ipHabituelle(ctx.ips, qui)
}

/**
 * Une ligne du journal d'audit, telle que l'écrit l'intercepteur du serveur pour un geste réussi :
 * qui, quoi, sur quoi, depuis quelle adresse. `entiteId` est le dossier / la visite / la consultation
 * de l'URL, vide pour une création.
 */
export function tracer(
  ctx: ContexteJour,
  lignes: LignesJour,
  qui: Soignant,
  quand: Date,
  action: ActionAudit,
  module: string,
  entiteType: string,
  entiteId: string | null,
): void {
  lignes.JournalAudit.push({
    id: nouvelIdTest(),
    utilisateurId: qui.utilisateurId,
    action,
    module,
    entiteType,
    entiteId,
    ipAdresse: ipDe(ctx, qui),
    statut: 'SUCCES',
    createdAt: quand,
  })
}

/** L'élément de plus petite valeur (le premier en cas d'égalité). */
export function leMoinsOccupe<T>(
  liste: readonly T[],
  valeur: (x: T) => number,
): T {
  let meilleur = liste[0]
  let min = valeur(meilleur)
  for (const x of liste) {
    const v = valeur(x)
    if (v < min) {
      min = v
      meilleur = x
    }
  }
  return meilleur
}
