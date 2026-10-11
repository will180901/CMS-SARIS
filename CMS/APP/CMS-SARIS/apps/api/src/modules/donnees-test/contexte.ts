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

/** Ce que le générateur LIT dans les référentiels du centre (jamais ne modifie). */
export interface ReferentielsTest {
  /** code de catégorie → id */
  categories: ReadonlyMap<string, string>
  motifs: ReadonlyMap<string, { id: string; triageAllege: boolean }>
  /** code de pathologie → id */
  pathologies: ReadonlyMap<string, string>
  /** code de type de consultation → id */
  typesConsultation: ReadonlyMap<string, string>
  /** Sociétés sous-traitantes ACTIVES. */
  societes: readonly string[]
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
}

export interface ContexteJour {
  /** « AAAA-MM-JJ », jour local. */
  jour: string
  alea: Alea
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

/** Une adresse IP de ce site pour cette personne : en général la sienne, parfois une autre. */
export function ipDe(ctx: ContexteJour, qui: Soignant): string | null {
  const pool = ctx.ips.get(qui.siteId)
  if (!pool || pool.length === 0) return null
  // Chacun a « son » poste : l'adresse est fixée par son identifiant, avec quelques écarts.
  let h = 0
  for (let i = 0; i < qui.utilisateurId.length; i++)
    h = (h * 31 + qui.utilisateurId.charCodeAt(i)) >>> 0
  if (ctx.alea.proba(0.12)) return ctx.alea.choisir(pool)
  return pool[h % pool.length]
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
