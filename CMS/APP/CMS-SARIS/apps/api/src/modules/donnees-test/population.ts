/**
 * La population fictive : les patients déjà fabriqués, et qui revient quand.
 *
 * Une patientèle réelle n'est pas un tirage uniforme : un malade chronique revient chaque mois, qui
 * vient de passer ne revient pas le lendemain, et la plupart ne viennent qu'une ou deux fois.
 * Tenue en mémoire pendant la génération (reconstruite depuis la base à la reprise d'un lot).
 */
import type { Alea } from './alea'
import type { Morphologie } from './constantes-vitales'
import type { Sexe } from './fabrique-identites'

export interface PatientSim {
  id: string
  numeroPatient: string
  categorieCode: string
  categorieId: string
  sexe: Sexe
  naissance: Date
  nom: string
  prenom: string
  /** Site où le dossier a été ouvert. */
  siteId: string
  matricule: string | null
  /** Pour un travailleur CDI : le nombre d'ayants droit déjà rattachés. */
  nbDependants: number
  /** Codes des profils cliniques de maladies qui se suivent (« HTA », « DIABETE »…). */
  chroniques: string[]
  prochainSuivi: Date | null
  derniereVisite: Date | null
  nbVisites: number
  /** Substances auxquelles la personne est allergique (utile à la prescription). */
  allergies: string[]
  /** Messages de ses alertes médicales actives (contre-indications déclarées d'un médicament). */
  alertes: string[]
  /** Codes des profils de maladies pour lesquels un suivi chronique est déjà défini. */
  suivisChroniques: string[]
  /** Silhouette de la personne, tenue d'une visite à l'autre. */
  morphologie: Morphologie
}

export const UN_JOUR_MS = 86_400_000

export class Population {
  readonly tous: PatientSim[] = []
  private readonly cdi: PatientSim[] = []

  ajouter(p: PatientSim): void {
    this.tous.push(p)
    if (p.categorieCode === 'ASSURE_CDI') this.cdi.push(p)
  }

  get taille(): number {
    return this.tous.length
  }

  /** Un travailleur CDI qui a de la place pour un ayant droit de plus (une famille compte rarement plus de 6). */
  cdiAvecPlace(alea: Alea): PatientSim | null {
    if (this.cdi.length === 0) return null
    for (let essai = 0; essai < 30; essai++) {
      const p = alea.choisir(this.cdi)
      if (p.nbDependants < 6) return p
    }
    return null
  }

  /**
   * Un patient déjà connu qui revient. Les malades chroniques dont le contrôle est dû pèsent huit
   * fois plus ; qui vient de passer, beaucoup moins. `dejaVusAujourdhui` : jamais deux passages le
   * même jour pour la même personne.
   */
  tirerExistant(
    alea: Alea,
    maintenant: Date,
    dejaVusAujourdhui: ReadonlySet<string>,
  ): PatientSim | null {
    const n = this.tous.length
    if (n === 0) return null
    const POIDS_MAX = 8
    for (let essai = 0; essai < 80; essai++) {
      const p = this.tous[alea.entier(0, n - 1)]
      if (dejaVusAujourdhui.has(p.id)) continue
      const depuis = p.derniereVisite
        ? (maintenant.getTime() - p.derniereVisite.getTime()) / UN_JOUR_MS
        : 999
      let poids = 1
      if (
        p.chroniques.length > 0 &&
        p.prochainSuivi &&
        p.prochainSuivi <= maintenant
      )
        poids = POIDS_MAX
      else if (depuis < 5) poids = 0.15
      else if (depuis < 14) poids = 0.5
      if (alea.float() * POIDS_MAX < poids) return p
    }
    return null
  }
}

/** Âge en années révolues à une date donnée. */
export function ageA(naissance: Date, date: Date): number {
  let age = date.getUTCFullYear() - naissance.getUTCFullYear()
  const m = date.getUTCMonth() - naissance.getUTCMonth()
  if (m < 0 || (m === 0 && date.getUTCDate() < naissance.getUTCDate())) age--
  return Math.max(0, age)
}
