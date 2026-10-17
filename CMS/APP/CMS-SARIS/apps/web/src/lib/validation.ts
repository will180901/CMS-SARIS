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
import i18n from '../i18n/config'

/**
 * Message de validation PARESSEUX : le texte est composé au moment où la règle échoue (et non au chargement
 * du module), dans la langue active à cet instant. Les schémas de ce fichier sont créés une fois pour
 * toutes ; un texte figé à la création resterait dans la langue de l'ouverture de l'application.
 */
export const msgValidation = (cle: string, opts?: Record<string, unknown>) => () => ({ message: i18n.t(cle, opts) })
const msg = msgValidation
/** Libellé de champ passé par l'appelant : texte déjà traduit, ou fonction évaluée à l'échec. */
type Etiquette = string | (() => string)
const nomChamp = (e: Etiquette) => (typeof e === 'function' ? e() : e)

// ── Noms propres ────────────────────────────────────────────────────────────
// Lettres (accents inclus), espaces, tiret, apostrophe, point. Pas de chiffres.
const NOM_REGEX = /^[A-Za-zÀ-ÿ'’.\- ]+$/

export function nomPersonne(label: Etiquette = () => i18n.t('validation.ceChamp'), min = 2, max = 100) {
  const l = () => nomChamp(label)
  return z.string()
    .trim()
    .refine(v => v.length >= min, () => ({ message: i18n.t('validation.min', { label: l(), n: min }) }))
    .refine(v => v.length <= max, () => ({ message: i18n.t('validation.max', { label: l(), n: max }) }))
    .refine(v => NOM_REGEX.test(v), () => ({ message: i18n.t('validation.lettresSeulement', { label: l() }) }))
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
  .refine(v => v.length >= 1, msg('validation.telRequis'))
  .refine(v => v.length <= 20, msg('validation.telTropLong'))
  .refine(isTelephone, msg('validation.telInvalide'))

/** Téléphone optionnel : vide accepté, sinon validé. */
export const telephoneOpt = z.string()
  .trim()
  .refine(v => v.length <= 20, msg('validation.telTropLong'))
  .refine(v => v === '' || isTelephone(v), msg('validation.telInvalide'))
  .optional()

/** Formatage doux à la frappe : conserve « + » en tête, chiffres et espaces. */
export function sanitizeTelephoneInput(v: string): string {
  const plus = v.trimStart().startsWith('+') ? '+' : ''
  const rest = v.replace(/[^\d\s]/g, '').replace(/\s{2,}/g, ' ')
  return (plus + rest).slice(0, 20)
}

// ── E-mail ──────────────────────────────────────────────────────────────────
const EMAIL_OK = z.string().email()
export const email = z.string()
  .trim()
  .toLowerCase()
  .refine(v => v.length >= 1, msg('validation.emailRequis'))
  .refine(v => v.length <= 120, msg('validation.emailTropLong'))
  .refine(v => EMAIL_OK.safeParse(v).success, msg('validation.emailInvalide'))

export const emailOpt = z.string()
  .trim()
  .toLowerCase()
  .refine(v => v.length <= 120, msg('validation.emailTropLong'))
  .refine(v => v === '' || EMAIL_OK.safeParse(v).success, msg('validation.emailInvalide'))
  .optional()

// ── Date de naissance ───────────────────────────────────────────────────────
const MAX_AGE_ANS = 120
export const dateNaissance = z.string()
  .refine(v => v.length >= 1, msg('validation.naissanceRequise'))
  .refine(v => !Number.isNaN(Date.parse(v)), msg('validation.dateInvalide'))
  .refine(v => new Date(v) <= new Date(), msg('validation.dateFutur'))
  .refine(v => {
    const min = new Date()
    min.setFullYear(min.getFullYear() - MAX_AGE_ANS)
    return new Date(v) >= min
  }, msg('validation.ageMax', { n: MAX_AGE_ANS }))

/** Borne `max` pour <input type="date"> de naissance : aujourd'hui (inclus). */
export function todayISO(): string {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10)
}
/** Jour (yyyy-MM-dd, heure locale) d'un horodatage — borne `min`/`max` d'un DatePicker. */
export function jourISO(iso: string | Date): string {
  const d = new Date(iso)
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
    .refine(v => v.length >= min, () => ({ message: i18n.t('validation.min', { label: i18n.t('validation.code'), n: min }) }))
    .refine(v => v.length <= max, () => ({ message: i18n.t('validation.max', { label: i18n.t('validation.code'), n: max }) }))
    .refine(v => CODE_REGEX.test(v), msg('validation.codeFormat'))
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
  .refine(v => v.length >= 10, msg('validation.mdpMin'))
  .refine(v => v.length <= 200, msg('validation.mdpTropLong'))
  .refine(v => PASSWORD_REGEX.test(v), msg('validation.mdpPolitique'))

// ── Matricule (identifiant agent) ───────────────────────────────────────────
const MATRICULE_REGEX = /^[A-Z0-9-]+$/
export function matricule(min = 2, max = 20) {
  return z.string()
    .trim()
    .toUpperCase()
    .refine(v => v.length >= min, () => ({ message: i18n.t('validation.min', { label: i18n.t('validation.matricule'), n: min }) }))
    .refine(v => v.length <= max, () => ({ message: i18n.t('validation.max', { label: i18n.t('validation.matricule'), n: max }) }))
    .refine(v => MATRICULE_REGEX.test(v), msg('validation.matriculeFormat'))
}
export function sanitizeMatriculeInput(v: string): string {
  return v.toUpperCase().replace(/[^A-Z0-9-]/g, '')
}

// ── Libellé / texte court obligatoire ───────────────────────────────────────
export function libelle(label: Etiquette = () => i18n.t('validation.libelle'), min = 2, max = 100) {
  const l = () => nomChamp(label)
  return z.string()
    .trim()
    .refine(v => v.length >= min, () => ({ message: i18n.t('validation.min', { label: l(), n: min }) }))
    .refine(v => v.length <= max, () => ({ message: i18n.t('validation.max', { label: l(), n: max }) }))
}
export function texteOpt(max = 200) {
  return z.string().trim().refine(v => v.length <= max, msg('validation.maxCaracteres', { n: max })).optional()
}

// ── Constantes vitales (plages physiologiques = DTO backend) ────────────────
export interface VitalRange { min: number; max: number; step: number; unit: string; label: string }

export const VITAL_RANGES = {
  temperature:        { min: 30,  max: 45,  step: 0.1,  unit: '°C',   label: 'Température' },
  tensionSystolique:  { min: 50,  max: 300, step: 1,    unit: 'mmHg', label: 'Tension systolique' },
  tensionDiastolique: { min: 30,  max: 200, step: 1,    unit: 'mmHg', label: 'Tension diastolique' },
  frequenceCardiaque: { min: 20,  max: 300, step: 1,    unit: 'bpm',  label: 'Fréquence cardiaque' },
  frequenceRespiratoire: { min: 4, max: 80,  step: 1,    unit: 'cpm',  label: 'Fréquence respiratoire' },
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
  if (Number.isNaN(n)) return { ok: false, error: i18n.t('validation.valeurNumerique') }
  const r = VITAL_RANGES[key]
  if (n < r.min || n > r.max) {
    return { ok: false, error: i18n.t('validation.horsPlage', { min: r.min, max: r.max, unit: r.unit }) }
  }
  return { ok: true, value: n }
}
