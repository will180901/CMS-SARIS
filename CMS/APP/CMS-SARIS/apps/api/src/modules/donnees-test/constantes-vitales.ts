/**
 * Constantes vitales plausibles d'une personne, selon son âge, son sexe, sa morphologie et ce pour
 * quoi elle vient.
 *
 * On part d'une personne en bonne santé (valeurs de référence adulte / enfant), puis le profil
 * clinique déplace les mesures qui le concernent : fièvre du paludisme, tension de l'hypertendu,
 * glycémie du diabétique… Toutes les mesures ne sont pas prises à chaque fois : un infirmier ne
 * mesure pas la saturation de chaque patient.
 *
 * La MORPHOLOGIE est propre à chaque personne et tenue d'une visite à l'autre : un adulte garde sa
 * taille et à peu près son poids, un enfant grandit avec l'âge sur sa propre courbe.
 */
import type { Alea } from './alea'
import type { Gaussienne, ModifConstantes } from './catalogue-clinique'
import type { Sexe } from './fabrique-identites'

export interface ConstantesGenerees {
  temperature: number | null
  tensionSystolique: number | null
  tensionDiastolique: number | null
  frequenceCardiaque: number | null
  frequenceRespiratoire: number | null
  saturationO2: number | null
  poids: number | null
  taille: number | null
  glycemie: number | null
  etatConscience: string | null
  scoreGlasgow: number | null
  etatGeneral: string | null
  hydratation: string | null
  coloration: string | null
}

/** Ce qui fait la silhouette d'une personne, une fois pour toutes. */
export interface Morphologie {
  /** Taille adulte (cm). */
  tailleAdulte: number
  /** IMC habituel de l'adulte. */
  imc: number
  /** Position de l'enfant sur sa courbe de taille / de poids (écarts types). */
  zTaille: number
  zPoids: number
}

/** Taille (cm) et poids (kg) médians des enfants, par âge révolu de 0 à 14 ans. */
const TAILLE_ENFANT = [
  66, 80, 90, 98, 105, 111, 117, 123, 128, 133, 138, 144, 150, 156, 160,
]
const POIDS_ENFANT = [
  7.4, 10.3, 12.5, 14.5, 16.5, 18.5, 20.8, 23.2, 25.8, 28.6, 31.8, 35.8, 40.5,
  45, 49,
]

const arrondi = (x: number, decimales: number) => {
  const f = 10 ** decimales
  return Math.round(x * f) / f
}

function tirer(alea: Alea, g: Gaussienne): number {
  return alea.normaleBornee(g.moyenne, g.ecartType, g.min, g.max)
}

/** La silhouette d'une nouvelle personne. `surpoids` : décale l'IMC (maladies chroniques). */
export function nouvelleMorphologie(
  alea: Alea,
  sexe: Sexe,
  surpoids = 0,
): Morphologie {
  return {
    tailleAdulte:
      sexe === 'M'
        ? alea.normaleBornee(173, 7, 155, 196)
        : alea.normaleBornee(162, 6, 145, 182),
    imc: alea.normaleBornee(
      (sexe === 'M' ? 24.5 : 25.8) + surpoids,
      3.7,
      17.2,
      41,
    ),
    zTaille: alea.normaleBornee(0, 1, -2, 2),
    zPoids: alea.normaleBornee(0, 1, -2, 2),
  }
}

/** Taille (cm) et poids (kg) de cette personne à cet âge, avec la petite variation d'une pesée à l'autre. */
export function morphologieA(
  alea: Alea,
  m: Morphologie,
  age: number,
): { taille: number; poids: number } {
  if (age < 15) {
    // Médianes de croissance des enfants (moyenne des deux sexes), l'enfant s'en écarte de façon
    // constante d'une visite à l'autre sur sa propre courbe.
    const i = Math.min(14, Math.max(0, Math.floor(age)))
    const tailleMediane = TAILLE_ENFANT[i]
    const poidsMedian = POIDS_ENFANT[i]
    const taille = tailleMediane * (1 + 0.045 * m.zTaille)
    const poids = poidsMedian * (1 + 0.15 * m.zPoids)
    return {
      taille: Math.round(taille),
      poids: arrondi(Math.max(2.4, poids), 1),
    }
  }
  const taille = age >= 65 ? m.tailleAdulte - 2 : m.tailleAdulte
  return {
    taille: Math.round(taille),
    poids: arrondi(m.imc * (taille / 100) ** 2 + alea.normale(0, 0.7), 1),
  }
}

export interface DemandeConstantes {
  alea: Alea
  age: number
  morphologie: Morphologie
  profil: ModifConstantes
}

/** Les constantes saisies à l'accueil ; `null` si rien n'est mesuré. */
export function genererConstantes(
  d: DemandeConstantes,
): ConstantesGenerees | null {
  const { alea, age, profil } = d
  const adulte = age >= 15
  const { taille, poids } = morphologieA(alea, d.morphologie, age)

  const temperature = profil.temperature
    ? tirer(alea, profil.temperature)
    : alea.normaleBornee(36.8, 0.28, 35.9, 37.6)

  let sys = profil.tensionSystolique
    ? tirer(alea, profil.tensionSystolique)
    : adulte
      ? alea.normaleBornee(118 + Math.max(0, (age - 30) * 0.35), 11, 92, 150)
      : alea.normaleBornee(95 + age * 1.2, 8, 78, 125)
  let dia = profil.tensionDiastolique
    ? tirer(alea, profil.tensionDiastolique)
    : adulte
      ? alea.normaleBornee(76 + Math.max(0, (age - 30) * 0.12), 7, 56, 95)
      : alea.normaleBornee(60, 6, 45, 78)
  // Un écart systole/diastole de moins de 25 mmHg n'est pas plausible au repos.
  if (dia > sys - 25) dia = sys - 25 - alea.entier(0, 8)
  sys = Math.round(sys)
  dia = Math.round(Math.max(35, dia))

  const fc = profil.frequenceCardiaque
    ? tirer(alea, profil.frequenceCardiaque)
    : adulte
      ? alea.normaleBornee(76, 9, 55, 102)
      : alea.normaleBornee(Math.max(78, 112 - age * 2.5), 12, 66, 145)
  const fr = profil.frequenceRespiratoire
    ? tirer(alea, profil.frequenceRespiratoire)
    : adulte
      ? alea.normaleBornee(16, 2, 12, 22)
      : alea.normaleBornee(Math.max(18, 27 - age * 0.7), 3, 14, 38)
  const spo2 = profil.saturationO2
    ? tirer(alea, profil.saturationO2)
    : alea.normaleBornee(97.6, 0.9, 94, 100)
  const glycemie = profil.glycemie
    ? tirer(alea, profil.glycemie)
    : alea.normaleBornee(0.92, 0.11, 0.7, 1.25)

  const prise = (p: number) => alea.proba(p)
  const signe = (
    liste: readonly (readonly [string, number])[] | undefined,
    defaut: string,
    p: number,
  ) => {
    if (!prise(p)) return null
    return liste ? alea.pondere(liste) : defaut
  }
  const tensionPrise = prise(0.96)

  const resultat: ConstantesGenerees = {
    temperature: prise(0.97) ? arrondi(temperature, 1) : null,
    tensionSystolique: tensionPrise ? sys : null,
    tensionDiastolique: tensionPrise ? dia : null,
    frequenceCardiaque: prise(0.93) ? Math.round(fc) : null,
    frequenceRespiratoire: prise(0.45) ? Math.round(fr) : null,
    saturationO2: prise(0.65) ? Math.round(spo2) : null,
    poids: prise(0.92) ? poids : null,
    taille: prise(0.85) ? taille : null,
    glycemie: prise(profil.glycemieSystematique ? 0.95 : 0.07)
      ? arrondi(glycemie, 2)
      : null,
    etatConscience: prise(0.85)
      ? alea.proba(0.98)
        ? 'Conscient'
        : 'Somnolent'
      : null,
    scoreGlasgow: prise(0.1) ? 15 : null,
    etatGeneral: signe(profil.etatGeneral, 'Bon', 0.75),
    hydratation: signe(profil.hydratation, 'Normale', 0.55),
    coloration: signe(profil.coloration, 'Normale', 0.6),
  }
  const rien = Object.values(resultat).every((v) => v === null)
  return rien ? null : resultat
}
