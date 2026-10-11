/**
 * Fabrique d'identités fictives qui ne se répètent JAMAIS : un nom complet, un numéro de téléphone,
 * un matricule, un numéro de dossier ne sortent qu'une seule fois — ni entre eux, ni face à ce qui
 * existe déjà en base (les vraies personnes comprises).
 *
 * Deux personnes de même prénom OU de même nom sont normales (c'est la vie) ; ce qui ne doit pas
 * exister, c'est deux fois la même identité, qui se confondrait au guichet.
 */
import type { Alea } from './alea'
import {
  NOMS_DE_FAMILLE,
  PREFIXES_MOBILES,
  PRENOMS_FEMININS,
  PRENOMS_MASCULINS,
} from './catalogue-identites'

export type Sexe = 'M' | 'F'

/** Clé de comparaison d'un nom complet : sans accents, sans casse, sans ponctuation. */
export function cleNom(prenom: string, nom: string): string {
  return `${prenom}${nom}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
}

/** Les chiffres d'un numéro de téléphone (« +242 06 123 4567 » → « 242061234567 »). */
export function chiffres(telephone: string): string {
  return telephone.replace(/\D/g, '')
}

export interface DejaPris {
  /** Clés de nom complet (cf. `cleNom`). */
  noms?: Iterable<string>
  /** Numéros de téléphone, sous n'importe quelle forme. */
  telephones?: Iterable<string>
  matricules?: Iterable<string>
}

export class FabriqueIdentites {
  private readonly noms = new Set<string>()
  private readonly telephones = new Set<string>()
  private readonly matricules = new Set<string>()

  constructor(
    private readonly alea: Alea,
    deja: DejaPris = {},
  ) {
    for (const n of deja.noms ?? []) this.noms.add(n)
    for (const t of deja.telephones ?? []) this.telephones.add(chiffres(t))
    for (const m of deja.matricules ?? [])
      this.matricules.add(m.trim().toLowerCase())
  }

  /**
   * Un nom complet inédit. `nomImpose` : le nom de famille est celui d'une famille (un enfant
   * porte le nom de son parent) — on ne varie alors que le prénom.
   */
  nomComplet(sexe: Sexe, nomImpose?: string): { nom: string; prenom: string } {
    const prenoms = sexe === 'M' ? PRENOMS_MASCULINS : PRENOMS_FEMININS
    for (let essai = 0; essai < 200; essai++) {
      const nom = nomImpose ?? this.alea.choisir(NOMS_DE_FAMILLE)
      const prenom = this.alea.choisir(prenoms)
      const cle = cleNom(prenom, nom)
      if (!this.noms.has(cle)) {
        this.noms.add(cle)
        return { nom, prenom }
      }
    }
    // Espace saturé (milliers de personnes de la même famille) : prénom composé, toujours inédit
    // tant qu'il reste une combinaison.
    for (let essai = 0; essai < 5000; essai++) {
      const nom = nomImpose ?? this.alea.choisir(NOMS_DE_FAMILLE)
      const prenom = `${this.alea.choisir(prenoms)}-${this.alea.choisir(prenoms)}`
      const cle = cleNom(prenom, nom)
      if (!this.noms.has(cle)) {
        this.noms.add(cle)
        return { nom, prenom }
      }
    }
    throw new Error('Plus aucun nom complet inédit disponible')
  }

  /** Un numéro mobile congolais inédit, au format du dossier : « +242 06 123 4567 ». */
  telephone(): string {
    for (let essai = 0; essai < 1000; essai++) {
      const prefixe = this.alea.choisir(PREFIXES_MOBILES)
      const a = String(this.alea.entier(100, 999))
      const b = String(this.alea.entier(0, 9999)).padStart(4, '0')
      const numero = `+242 ${prefixe} ${a} ${b}`
      const cle = chiffres(numero)
      if (!this.telephones.has(cle)) {
        this.telephones.add(cle)
        return numero
      }
    }
    throw new Error('Plus aucun numéro de téléphone inédit disponible')
  }

  /** Un matricule d'employé inédit : 6 chiffres, 1xxxxx à 4xxxxx pour un CDI, 5xxxxx–6xxxxx pour un CDD. */
  matricule(type: 'CDI' | 'CDD'): string {
    const [min, max] = type === 'CDI' ? [100000, 499999] : [500000, 699999]
    for (let essai = 0; essai < 1000; essai++) {
      const m = String(this.alea.entier(min, max))
      if (!this.matricules.has(m)) {
        this.matricules.add(m)
        return m
      }
    }
    throw new Error('Plus aucun matricule inédit disponible')
  }
}

/**
 * Numéros de dossier « PAT-XXX-00001 », à la suite de ce qui existe déjà pour chaque site (le
 * même préfixe et la même largeur que la numérotation du centre : un dossier de test ne se
 * distingue pas, au numéro, d'un vrai — c'est son identifiant qui le marque).
 */
export class Numerotation {
  private readonly dernier = new Map<string, number>()

  constructor(deja: ReadonlyMap<string, number> = new Map()) {
    for (const [prefixe, n] of deja) this.dernier.set(prefixe, n)
  }

  prochain(prefixe: string): string {
    const n = (this.dernier.get(prefixe) ?? 0) + 1
    this.dernier.set(prefixe, n)
    return `PAT-${prefixe}-${String(n).padStart(5, '0')}`
  }
}
