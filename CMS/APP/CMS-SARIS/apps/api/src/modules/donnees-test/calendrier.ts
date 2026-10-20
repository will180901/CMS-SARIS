/**
 * Le calendrier d'un centre médical du Congo : quels jours il ouvre, de quelle heure à quelle
 * heure, et à quel moment de la journée les patients arrivent.
 *
 * Les jours sont des chaînes « AAAA-MM-JJ » (jour LOCAL, Brazzaville), les heures des minutes
 * depuis minuit LOCAL ; `instantLocal` les convertit en instant UTC, seul format que la base
 * connaît. Le Congo (Brazzaville) est à UTC+1 toute l'année, sans heure d'été.
 */
import type { Alea } from './alea'

/** Brazzaville : UTC+1 toute l'année. */
export const DECALAGE_LOCAL_MIN = 60

const UN_JOUR_MS = 86_400_000

function composantes(jour: string): { a: number; m: number; j: number } {
  const [a, m, j] = jour.split('-').map(Number)
  return { a: a, m: m, j: j }
}

/** Minuit UTC du jour (sert uniquement à calculer jours et jours de la semaine). */
function minuitUtc(jour: string): number {
  const { a, m, j } = composantes(jour)
  return Date.UTC(a, m - 1, j)
}

export function formaterJour(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function ajouterJours(jour: string, n: number): string {
  return formaterJour(minuitUtc(jour) + n * UN_JOUR_MS)
}

/** Le jour local d'un instant. */
export function jourLocalDe(instant: Date): string {
  return formaterJour(instant.getTime() + DECALAGE_LOCAL_MIN * 60_000)
}

/** Tous les jours de `debut` à `fin` inclus. */
export function joursEntre(debut: string, fin: string): string[] {
  const jours: string[] = []
  for (let ms = minuitUtc(debut); ms <= minuitUtc(fin); ms += UN_JOUR_MS)
    jours.push(formaterJour(ms))
  return jours
}

/** 0 = dimanche … 6 = samedi. */
export function jourSemaine(jour: string): number {
  return new Date(minuitUtc(jour)).getUTCDay()
}

/** Jours fériés fixes du Congo-Brazzaville (les fêtes mobiles ne sont pas modélisées). */
const FERIES_FIXES = new Set([
  '01-01', // Jour de l'An
  '05-01', // Fête du travail
  '06-10', // Journée de la réconciliation nationale
  '08-15', // Fête de l'Indépendance
  '11-01', // Toussaint
  '11-28', // Proclamation de la République
  '12-25', // Noël
])

export function estFerie(jour: string): boolean {
  return FERIES_FIXES.has(jour.slice(5))
}

export interface Horaires {
  /** Ouverture, en minutes depuis minuit local. */
  ouverture: number
  fermeture: number
  /** Samedi : demi-journée. */
  demiJournee: boolean
  /**
   * La journée d'AUJOURD'HUI, coupée à « maintenant » : `fermeture` n'est plus celle du centre mais le
   * dernier moment où l'on fabrique encore des passages. Les arrivées qui tomberaient plus tard sont
   * tirées de nouveau (au lieu d'être ramenées à la coupure, où elles s'empileraient).
   */
  tronque?: boolean
}

/** Les horaires du centre ce jour-là ; `null` si fermé (dimanche, jour férié). */
export function horairesDuJour(jour: string): Horaires | null {
  const s = jourSemaine(jour)
  if (s === 0 || estFerie(jour)) return null
  if (s === 6)
    return { ouverture: 8 * 60, fermeture: 12 * 60 + 30, demiJournee: true }
  return { ouverture: 7 * 60 + 30, fermeture: 16 * 60 + 30, demiJournee: false }
}

/** Le jour est-il un jour d'ouverture ? */
export function estOuvert(jour: string): boolean {
  return horairesDuJour(jour) !== null
}

/** Minutes locales → instant UTC. */
export function instantLocal(jour: string, minutes: number): Date {
  return new Date(minuitUtc(jour) + (minutes - DECALAGE_LOCAL_MIN) * 60_000)
}

/** Secondes depuis minuit local → instant UTC (les plannings s'écrivent en secondes : l'ordre des gestes y est exact). */
export function instantSecondes(jour: string, secondesLocales: number): Date {
  return new Date(
    minuitUtc(jour) + (secondesLocales - DECALAGE_LOCAL_MIN * 60) * 1000,
  )
}

/** Les mêmes minutes locales, avec des secondes : deux lignes ne tombent jamais à la même seconde. */
export function instantAvecSecondes(
  alea: Alea,
  jour: string,
  minutes: number,
): Date {
  return new Date(
    instantLocal(jour, minutes).getTime() + alea.entier(0, 59) * 1000,
  )
}

/** Fréquentation selon le jour de la semaine : le lundi déborde, le vendredi s'allège. */
const FACTEUR_SEMAINE: Record<number, number> = {
  1: 1.15,
  2: 1.05,
  3: 1.0,
  4: 1.0,
  5: 0.9,
  6: 0.5,
}

/**
 * Fréquentation selon la saison : la saison des pluies (octobre à mai) ramène plus de paludisme et
 * de maladies respiratoires, la saison sèche (juin à septembre) un peu moins de monde.
 */
const FACTEUR_MOIS: Record<number, number> = {
  1: 1.05,
  2: 1.05,
  3: 1.1,
  4: 1.1,
  5: 1.0,
  6: 0.88,
  7: 0.85,
  8: 0.88,
  9: 0.95,
  10: 1.08,
  11: 1.12,
  12: 1.05,
}

export function facteurFrequentation(jour: string): number {
  const mois = Number(jour.slice(5, 7))
  return (FACTEUR_SEMAINE[jourSemaine(jour)] ?? 1) * (FACTEUR_MOIS[mois] ?? 1)
}

/** Saison des pluies (octobre → mai) : le paludisme et les infections respiratoires dominent. */
export function saisonDesPluies(jour: string): boolean {
  const mois = Number(jour.slice(5, 7))
  return mois >= 10 || mois <= 5
}

/**
 * Les minutes d'arrivée de `n` patients, triées : un pic en début de matinée, un second après
 * la pause de midi (journée entière), quelques arrivées à toute heure. Le dernier arrivant est
 * reçu au plus tard une demi-heure avant la fermeture.
 */
export function minutesArrivees(alea: Alea, n: number, h: Horaires): number[] {
  const dernier = h.fermeture - 30
  const pics = picsDArrivee(h)
  const tirer = (): number => {
    if (alea.proba(0.12)) return alea.entier(h.ouverture, dernier)
    const [centre, dispersion] = alea.pondere(
      pics.map((p, k) => [p, k === 0 ? 58 : 42] as const),
    )
    return Math.round(alea.normale(centre, dispersion))
  }
  const arrivees: number[] = []
  for (let i = 0; i < n; i++) {
    let m = tirer()
    if (h.tronque) {
      // Journée coupée : une arrivée au-delà de la coupure n'a pas encore eu lieu. On tire de nouveau
      // (la loi est celle de la journée entière, limitée à ce qui s'est déjà passé) ; ramenée à la
      // coupure, la moitié des arrivées s'y empilerait.
      for (let essai = 0; m > dernier && essai < 60; essai++) m = tirer()
      if (m > dernier) m = alea.entier(h.ouverture, dernier)
    }
    arrivees.push(Math.min(dernier, Math.max(h.ouverture, m)))
  }
  return arrivees.sort((x, y) => x - y)
}

/** Les pics d'affluence d'une journée : [minute du pic, dispersion]. */
function picsDArrivee(h: Horaires): (readonly [number, number])[] {
  return h.demiJournee
    ? [[h.ouverture + 75, 55]]
    : [
        [h.ouverture + 90, 70],
        [h.ouverture + 375, 65],
      ]
}

/** Fonction d'erreur (Abramowitz et Stegun 7.1.26, erreur < 1,5 × 10⁻⁷). */
function erf(x: number): number {
  const signe = x < 0 ? -1 : 1
  const t = 1 / (1 + 0.3275911 * Math.abs(x))
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x)
  return signe * y
}

/**
 * La part des arrivées d'une journée entière qui tombent avant la coupure d'une journée coupée
 * (`partielle.fermeture`). Les arrivées suivent un mélange de deux pics et d'un fond régulier, bornés
 * à l'ouverture : tout ce qui précède l'ouverture compte AVANT la coupure. C'est le facteur par lequel
 * on réduit le nombre de visites de la journée, pour qu'une journée coupée à midi n'en reçoive pas
 * autant qu'une journée entière.
 */
export function partDesArrivees(plein: Horaires, partielle: Horaires): number {
  const dernierPlein = plein.fermeture - 30
  const dernier = Math.min(partielle.fermeture - 30, dernierPlein)
  if (dernier >= dernierPlein) return 1
  if (dernier <= plein.ouverture) return 0
  const pics = picsDArrivee(plein)
  const poids = pics.map((_, k) => (k === 0 ? 58 : 42))
  const total = poids.reduce((a, b) => a + b, 0)
  const loiNormale = (x: number, centre: number, dispersion: number) =>
    0.5 * (1 + erf((x - centre) / (dispersion * Math.SQRT2)))
  const massePics = pics.reduce(
    (somme, [centre, dispersion], k) =>
      somme + ((poids[k] as number) / total) * loiNormale(dernier + 0.5, centre, dispersion),
    0,
  )
  const fond = (dernier - plein.ouverture + 1) / (dernierPlein - plein.ouverture + 1)
  return 0.12 * Math.min(1, fond) + 0.88 * massePics
}

/**
 * Rien n'est fabriqué dans les dernières heures avant « maintenant » : un passage dure jusqu'à une
 * heure et demie (accueil, attente du médecin, consultation), et ses suites (résultats, suivis) sont
 * datées après. Sans cette marge, des gestes tomberaient dans le futur.
 */
export const DELAI_AVANT_MAINTENANT_S = 2 * 3600

/**
 * La FILE D'ATTENTE du moment : entre la coupure de la journée (deux heures avant maintenant) et maintenant,
 * les passages ne sont pas fabriqués finis mais tels qu'ils sont À CET INSTANT — en attente à l'accueil, en
 * attente du médecin, en consultation. La dernière arrivée précède maintenant de cette marge : le temps que
 * la personne soit reçue et que sa visite soit ouverte.
 */
export const MARGE_FILE_ATTENTE_S = 3 * 60

/** Une journée coupée doit pouvoir accueillir au moins ce que valent 90 minutes d'arrivées. */
const FENETRE_MIN_MINUTES = 90

/**
 * Les horaires d'un jour pour la génération, selon « maintenant » :
 *  - jour ordinaire (ou pas celui de maintenant) : ses horaires ;
 *  - aujourd'hui, centre déjà fermé depuis plus de deux heures : ses horaires (journée entière) ;
 *  - aujourd'hui, en cours : coupés (`tronque`) deux heures avant maintenant ;
 *  - fermé, ou trop tôt pour qu'un passage ait pu se terminer : `null` (rien à fabriquer).
 */
export function horairesEffectifs(
  jour: string,
  limite: Moment | null,
): Horaires | null {
  const h = horairesDuJour(jour)
  if (!h) return null
  if (!limite || limite.jour !== jour) return h
  const fermeture = Math.floor((limite.s - DELAI_AVANT_MAINTENANT_S) / 60)
  if (fermeture >= h.fermeture) return h
  if (fermeture - h.ouverture < FENETRE_MIN_MINUTES) return null
  return { ...h, fermeture, tronque: true }
}

/**
 * Les minutes d'arrivée de la file d'attente du moment : de la coupure de la journée jusqu'à maintenant moins
 * une marge, SANS ressortir de l'horaire d'ouverture ni arriver moins d'une demi-heure avant la fermeture du
 * centre. `null` quand il n'y a pas de file à fabriquer : la journée n'est pas coupée (jour ordinaire, ou centre
 * fermé depuis plus de deux heures) ou maintenant n'est pas assez loin de la coupure.
 */
export function fenetreFileAttente(
  plein: Horaires,
  h: Horaires | null,
  limite: Moment | null,
): { debut: number; fin: number } | null {
  if (!h || !h.tronque || !limite) return null
  const debut = h.fermeture - 30 // les arrivées de la journée coupée s'arrêtent là
  const fin = Math.min(
    Math.floor((limite.s - MARGE_FILE_ATTENTE_S) / 60),
    plein.fermeture - 30,
  )
  return fin > debut ? { debut, fin } : null
}

/**
 * `n` minutes d'arrivée tirées sur la même loi que la journée (deux pics et un fond régulier), mais
 * seulement dans ]`debut`, `fin`] : on tire de nouveau ce qui tombe à côté, puis on complète au hasard dans la
 * fenêtre (la file d'attente est courte : elle ne couvre qu'une ou deux heures).
 */
export function minutesArriveesEntre(
  alea: Alea,
  n: number,
  plein: Horaires,
  debut: number,
  fin: number,
): number[] {
  const pics = picsDArrivee(plein)
  const tirer = (): number => {
    if (alea.proba(0.12)) return alea.entier(debut + 1, fin)
    const [centre, dispersion] = alea.pondere(
      pics.map((p, k) => [p, k === 0 ? 58 : 42] as const),
    )
    return Math.round(alea.normale(centre, dispersion))
  }
  const arrivees: number[] = []
  for (let i = 0; i < n; i++) {
    let m = tirer()
    for (let essai = 0; (m <= debut || m > fin) && essai < 60; essai++) m = tirer()
    if (m <= debut || m > fin) m = alea.entier(debut + 1, fin)
    arrivees.push(m)
  }
  return arrivees.sort((x, y) => x - y)
}

/** « Maintenant » comme moment du centre : le jour local et les secondes depuis minuit local. */
export function momentLocalDe(instant: Date): Moment {
  const jour = jourLocalDe(instant)
  return {
    jour,
    s: Math.floor((instant.getTime() - instantSecondes(jour, 0).getTime()) / 1000),
  }
}

/**
 * Ce moment est-il AU-DELÀ de la fin de la génération ? Oui après le dernier jour de la période ; et,
 * si ce dernier jour est aujourd'hui, plus tard que « maintenant » ce jour-là. Ce qui se passe après
 * (un résultat qui arrive, un suivi qui se poursuit) n'est pas encore arrivé : on ne fabrique pas
 * d'avenir.
 */
export function auDela(
  params: { finPeriode: string; limite?: Moment | null },
  m: Moment,
): boolean {
  if (m.jour > params.finPeriode) return true
  const l = params.limite
  return !!l && m.jour === l.jour && m.s > l.s
}

/** Le premier jour d'ouverture strictement après `jour`. */
export function jourOuvertSuivant(jour: string): string {
  let j = ajouterJours(jour, 1)
  for (let i = 0; i < 14 && !estOuvert(j); i++) j = ajouterJours(j, 1)
  return j
}

/** Un instant du centre : un jour local et des secondes depuis minuit local. */
export interface Moment {
  jour: string
  s: number
}

/**
 * Le moment qui suit `depuis` de `delaiS` secondes D'OUVERTURE : la nuit, le dimanche et les jours
 * fériés ne comptent pas (un résultat attendu « dans trois heures » à 15 h le vendredi arrive le
 * samedi matin). Un point de départ hors des heures d'ouverture est d'abord ramené à l'ouverture.
 */
export function apresDelaiOuvre(depuis: Moment, delaiS: number): Moment {
  let jour = depuis.jour
  let s = depuis.s
  let h = horairesDuJour(jour)
  if (!h) {
    jour = jourOuvertSuivant(jour)
    h = horairesDuJour(jour) as Horaires
    s = h.ouverture * 60
  }
  if (s < h.ouverture * 60) s = h.ouverture * 60
  if (s > h.fermeture * 60) {
    jour = jourOuvertSuivant(jour)
    h = horairesDuJour(jour) as Horaires
    s = h.ouverture * 60
  }
  let restant = Math.max(0, delaiS)
  for (let garde = 0; garde < 60; garde++) {
    const disponible = h.fermeture * 60 - s
    if (restant <= disponible) return { jour, s: s + restant }
    restant -= disponible
    jour = jourOuvertSuivant(jour)
    h = horairesDuJour(jour) as Horaires
    s = h.ouverture * 60
  }
  return { jour, s }
}

/** « 14/07/2026 » → pour les messages. */
export function jourFrancais(jour: string): string {
  const { a, m, j } = composantes(jour)
  return `${String(j).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`
}
