/**
 * Générateur pseudo-aléatoire SEMÉ : la même graine redonne exactement la même suite de tirages.
 *
 * Sert à fabriquer des données de test reproductibles (même graine → mêmes personnes, mêmes
 * visites), et à les tester. Ce n'est PAS de l'aléa de sécurité — les identifiants, eux, viennent de
 * `crypto` (cf. marque-test.ts) : un générateur à état de 128 bits comme celui-ci produirait des
 * collisions d'identifiants d'un lot à l'autre.
 *
 * sfc32 (Chris Doty-Humphrey, domaine public) initialisé par cyrb128 (bryc, domaine public).
 */

function cyrb128(s: string): [number, number, number, number] {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762
  for (let i = 0; i < s.length; i++) {
    const k = s.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  return [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1) >>> 0,
    (h3 ^ h1) >>> 0,
    (h4 ^ h1) >>> 0,
  ]
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a >>>= 0
    b >>>= 0
    c >>>= 0
    d >>>= 0
    let t = (a + b) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    d = (d + 1) | 0
    t = (t + d) | 0
    c = (c + t) | 0
    return (t >>> 0) / 4294967296
  }
}

export interface Alea {
  /** Nombre dans [0, 1[. */
  float(): number
  /** Entier dans [min, max], bornes comprises. */
  entier(min: number, max: number): number
  /** Vrai avec la probabilité p (0 → jamais, 1 → toujours). */
  proba(p: number): boolean
  /** Un élément au hasard. */
  choisir<T>(liste: readonly T[]): T
  /** Un élément au hasard, selon des poids : [[valeur, poids], …]. */
  pondere<T>(liste: readonly (readonly [T, number])[]): T
  /** Loi normale (Box–Muller). */
  normale(moyenne: number, ecartType: number): number
  /** Loi normale ramenée dans [min, max]. */
  normaleBornee(
    moyenne: number,
    ecartType: number,
    min: number,
    max: number,
  ): number
  /** Copie mélangée. */
  melanger<T>(liste: readonly T[]): T[]
  /** Un autre générateur, indépendant, dérivé de celui-ci et d'une étiquette. */
  sousFlux(etiquette: string): Alea
}

export function creerAlea(graine: string | number): Alea {
  const base = String(graine)
  const [a, b, c, d] = cyrb128(base)
  const prochain = sfc32(a, b, c, d)
  // On chauffe un peu le générateur : les premières sorties d'une graine courte se ressemblent.
  for (let i = 0; i < 12; i++) prochain()

  const alea: Alea = {
    float: prochain,
    entier(min, max) {
      return min + Math.floor(prochain() * (max - min + 1))
    },
    proba(p) {
      return prochain() < p
    },
    choisir(liste) {
      if (liste.length === 0) throw new Error('choisir : liste vide')
      return liste[Math.floor(prochain() * liste.length)] as never
    },
    pondere(liste) {
      let total = 0
      for (const [, poids] of liste) total += Math.max(0, poids)
      if (total <= 0) throw new Error('pondere : aucun poids positif')
      let tirage = prochain() * total
      for (const [valeur, poids] of liste) {
        tirage -= Math.max(0, poids)
        if (tirage < 0) return valeur
      }
      return (liste[liste.length - 1] as readonly [never, number])[0]
    },
    normale(moyenne, ecartType) {
      // 1 - float() ∈ ]0, 1] : jamais de log(0).
      const u = 1 - prochain()
      const v = prochain()
      return (
        moyenne +
        ecartType * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
      )
    },
    normaleBornee(moyenne, ecartType, min, max) {
      return Math.min(max, Math.max(min, alea.normale(moyenne, ecartType)))
    },
    melanger(liste) {
      const copie = [...liste]
      for (let i = copie.length - 1; i > 0; i--) {
        const j = Math.floor(prochain() * (i + 1))
        const t = copie[i] as never
        copie[i] = copie[j] as never
        copie[j] = t
      }
      return copie
    },
    sousFlux(etiquette) {
      return creerAlea(`${base}|${etiquette}`)
    },
  }
  return alea
}
