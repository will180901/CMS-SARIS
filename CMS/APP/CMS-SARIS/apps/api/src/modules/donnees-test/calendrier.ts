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
  const pics: (readonly [number, number])[] = h.demiJournee
    ? [[h.ouverture + 75, 55]]
    : [
        [h.ouverture + 90, 70],
        [h.ouverture + 375, 65],
      ]
  const arrivees: number[] = []
  for (let i = 0; i < n; i++) {
    let m: number
    if (alea.proba(0.12)) {
      m = alea.entier(h.ouverture, dernier)
    } else {
      const [centre, dispersion] = alea.pondere(
        pics.map((p, k) => [p, k === 0 ? 58 : 42] as const),
      )
      m = Math.round(alea.normale(centre, dispersion))
    }
    arrivees.push(Math.min(dernier, Math.max(h.ouverture, m)))
  }
  return arrivees.sort((x, y) => x - y)
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
