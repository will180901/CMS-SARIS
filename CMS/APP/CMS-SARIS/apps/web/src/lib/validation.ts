/**
 * Bibliothèque de validation partagée — CMS SARIS
 *
 * Schémas zod et helpers réutilisables pour rendre les champs de saisie
 * « intelligents » : on bloque les mauvaises entrées le plus tôt possible
 * (noms avec chiffres, numéros invalides, dates incohérentes, valeurs vitales
 * hors plage physiologique…) avec des messages clairs en français.
 *
 * Les plages des constantes vitales sont alignées sur le DTO backend
 * (apps/api/src/modules/triage/dto/visite.dto.ts) pour éviter tout aller-retour
 * 400 inutile.
 */
import { z } from 'zod'

// ── Noms propres ────────────────────────────────────────────────────────────
// Lettres (accents inclus), espaces, tiret, apostrophe, point. Pas de chiffres.
const NOM_REGEX = /^[A-Za-zÀ-ÿ'’.\- ]+$/

export function nomPersonne(label = 'Ce champ', min = 2, max = 100) {
  return z.string()
    .trim()
    .min(min, `${label} : ${min} caractères minimum`)
    .max(max, `${label} : ${max} caractères maximum`)
    .regex(NOM_REGEX, `${label} : lettres uniquement (ni chiffres ni symboles)`)
}

// ── Téléphone (Congo / international) ────────────────────────────────────────
// Accepte un éventuel « + », chiffres et séparateurs courants (espace . - ( )).
// On exige 9 à 12 chiffres effectifs (national 9, international 11–12).
const PHONE_ALLOWED = /^\+?[0-9\s.\-()]+$/
export function digitsOnly(v: string): string {
  return (v ?? '').replace(/\D/g, '')
}
export function isTelephone(v: string): boolean {
  if (!PHONE_ALLOWED.test(v)) return false
  const d = digitsOnly(v)
  return d.length >= 9 && d.length <= 12
}

/** Téléphone obligatoire. */
export const telephone = z.string()
  .trim()
  .min(1, 'Numéro de téléphone requis')
  .max(20, 'Numéro trop long')
  .refine(isTelephone, 'Numéro invalide (9 à 12 chiffres, ex. +242 06 123 45 67)')

/** Téléphone optionnel : vide accepté, sinon validé. */
export const telephoneOpt = z.string()
  .trim()
  .max(20, 'Numéro trop long')
  .refine(v => v === '' || isTelephone(v), 'Numéro invalide (9 à 12 chiffres, ex. +242 06 123 45 67)')
  .optional()

/** Formatage doux à la frappe : conserve « + » en tête, chiffres et espaces. */
export function sanitizeTelephoneInput(v: string): string {
  const plus = v.trimStart().startsWith('+') ? '+' : ''
  const rest = v.replace(/[^\d\s]/g, '').replace(/\s{2,}/g, ' ')
  return (plus + rest).slice(0, 20)
}

// ── E-mail ──────────────────────────────────────────────────────────────────
export const email = z.string()
  .trim()
  .toLowerCase()
  .min(1, 'E-mail requis')
  .max(120, 'E-mail trop long')
  .email('Format d’e-mail invalide')

export const emailOpt = z.string()
  .trim()
  .toLowerCase()
  .max(120, 'E-mail trop long')
  .refine(v => v === '' || z.string().email().safeParse(v).success, 'Format d’e-mail invalide')
  .optional()

// ── Date de naissance ───────────────────────────────────────────────────────
const MAX_AGE_ANS = 120
export const dateNaissance = z.string()
  .min(1, 'Date de naissance requise')
  .refine(v => !Number.isNaN(Date.parse(v)), 'Date invalide')
  .refine(v => new Date(v) <= new Date(), 'La date ne peut pas être dans le futur')
  .refine(v => {
    const min = new Date()
    min.setFullYear(min.getFullYear() - MAX_AGE_ANS)
    return new Date(v) >= min
  }, `Âge supérieur à ${MAX_AGE_ANS} ans : vérifiez la date`)

/** Borne `max` pour <input type="date"> de naissance : aujourd'hui (inclus). */
export function todayISO(): string {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10)
}
/** Borne `min` raisonnable pour une date de naissance. */
export function minBirthISO(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - MAX_AGE_ANS)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10)
}

// ── Codes référentiels (slug majuscule) ─────────────────────────────────────
const CODE_REGEX = /^[A-Z0-9_-]+$/
export function codeReferentiel(min = 2, max = 30) {
  return z.string()
    .trim()
    .toUpperCase()
    .min(min, `Code : ${min} caractères minimum`)
    .max(max, `Code : ${max} caractères maximum`)
    .regex(CODE_REGEX, 'Code : majuscules, chiffres, « _ » et « - » uniquement')
}
/** Nettoyage à la frappe d'un champ code (majuscule, sans espaces ni symboles). */
export function sanitizeCodeInput(v: string): string {
  return v.toUpperCase().replace(/[^A-Z0-9_-]/g, '')
}

// ── Mot de passe ────────────────────────────────────────────────────────────
// Politique par défaut alignée sur le backend (assertPasswordValid) :
// 10 caractères, 1 majuscule, 1 minuscule, 1 chiffre.
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/
export const motDePasse = z.string()
  .min(10, '10 caractères minimum')
  .max(200, 'Mot de passe trop long')
  .regex(PASSWORD_REGEX, '10 caractères min., 1 majuscule, 1 minuscule et 1 chiffre')

// ── Matricule (identifiant agent) ───────────────────────────────────────────
const MATRICULE_REGEX = /^[A-Z0-9-]+$/
export function matricule(min = 2, max = 20) {
  return z.string()
    .trim()
    .toUpperCase()
    .min(min, `Matricule : ${min} caractères minimum`)
    .max(max, `Matricule : ${max} caractères maximum`)
    .regex(MATRICULE_REGEX, 'Matricule : majuscules, chiffres et « - » uniquement')
}
export function sanitizeMatriculeInput(v: string): string {
  return v.toUpperCase().replace(/[^A-Z0-9-]/g, '')
}

// ── Libellé / texte court obligatoire ───────────────────────────────────────
export function libelle(label = 'Libellé', min = 2, max = 100) {
  return z.string()
    .trim()
    .min(min, `${label} : ${min} caractères minimum`)
    .max(max, `${label} : ${max} caractères maximum`)
}
export function texteOpt(max = 200) {
  return z.string().trim().max(max, `${max} caractères maximum`).optional()
}

// ── Constantes vitales (plages physiologiques = DTO backend) ────────────────
export interface VitalRange { min: number; max: number; step: number; unit: string; label: string }

export const VITAL_RANGES = {
  temperature:        { min: 30,  max: 45,  step: 0.1,  unit: '°C',   label: 'Température' },
  tensionSystolique:  { min: 50,  max: 300, step: 1,    unit: 'mmHg', label: 'Tension systolique' },
  tensionDiastolique: { min: 30,  max: 200, step: 1,    unit: 'mmHg', label: 'Tension diastolique' },
  frequenceCardiaque: { min: 20,  max: 300, step: 1,    unit: 'bpm',  label: 'Fréquence cardiaque' },
  saturationO2:       { min: 50,  max: 100, step: 0.1,  unit: '%',    label: 'SpO₂' },
  poids:              { min: 0.5, max: 300, step: 0.1,  unit: 'kg',   label: 'Poids' },
  taille:             { min: 30,  max: 250, step: 1,    unit: 'cm',   label: 'Taille' },
  glycemie:           { min: 0.1, max: 10,  step: 0.01, unit: 'g/L',  label: 'Glycémie' },
} as const satisfies Record<string, VitalRange>

export type VitalKey = keyof typeof VITAL_RANGES

/**
 * Valide une saisie texte de constante vitale.
 * Retourne `{ ok, value?, error? }` :
 *  - '' → ok sans valeur (champ laissé vide = optionnel)
 *  - nombre hors plage → erreur explicite
 */
export function validateVital(key: VitalKey, raw: string): { ok: boolean; value?: number; error?: string } {
  const s = raw.trim()
  if (s === '') return { ok: true }
  const n = Number(s.replace(',', '.'))
  if (Number.isNaN(n)) return { ok: false, error: 'Valeur numérique attendue' }
  const r = VITAL_RANGES[key]
  if (n < r.min || n > r.max) {
    return { ok: false, error: `Hors plage (${r.min}–${r.max} ${r.unit})` }
  }
  return { ok: true, value: n }
}
