/**
 * labels.ts — Dictionnaire CENTRAL des libellés métier.
 *
 * Règle d'or : aucun composant ne doit afficher directement un code technique
 * (UPPER_SNAKE_CASE, snake.case, etc.). Toujours passer par les helpers ici.
 *
 * Depuis l'i18n FR/EN, ces helpers résolvent les libellés via le namespace
 * `labels` (voir `@/i18n/locales/modules/labels`). Leur SIGNATURE est inchangée :
 * les ~24 appelants n'ont pas besoin d'être modifiés.
 *
 * Si un code arrive et n'est pas connu de la table i18n, le helper retourne le
 * code "humanisé" (underscores → espaces, capitalisation) via `defaultValue`,
 * au lieu de planter — mais c'est le signal qu'il faut compléter `labels.ts`.
 */

import i18n from '@/i18n/config'

// ════════════════════════════════════════════════════════════════════════════════
//  ROLES SYSTÈME
// ════════════════════════════════════════════════════════════════════════════════

export function labelRole(code: string): string {
  if (!code) return ''
  return i18n.t(`labels.role.${code}`, { defaultValue: humanize(code) })
}

// ════════════════════════════════════════════════════════════════════════════════
//  MÉTIERS DU PERSONNEL MÉDICAL (champ personnel.role)
// ════════════════════════════════════════════════════════════════════════════════

export function labelMetier(code: string): string {
  if (!code) return ''
  return i18n.t(`labels.metier.${code}`, { defaultValue: humanize(code) })
}

// ════════════════════════════════════════════════════════════════════════════════
//  MODULES (utilisé dans les journaux d'audit)
// ════════════════════════════════════════════════════════════════════════════════

export function labelModule(code: string): string {
  if (!code) return ''
  const key = code.toLowerCase()
  return i18n.t(`labels.module.${key}`, { defaultValue: humanize(code) })
}

// ════════════════════════════════════════════════════════════════════════════════
//  ACTIONS D'AUDIT (champ JournalAudit.action)
// ════════════════════════════════════════════════════════════════════════════════

export function labelAction(code: string): string {
  if (!code) return ''
  const key = code.toUpperCase()
  return i18n.t(`labels.action.${key}`, { defaultValue: humanize(code) })
}

// ════════════════════════════════════════════════════════════════════════════════
//  STATUTS (par famille)
// ════════════════════════════════════════════════════════════════════════════════

export function labelStatut(famille: string, code: string): string {
  if (!code) return ''
  // 1) clé exacte famille.code
  const exact = i18n.t(`labels.statut.${famille}.${code}`, { defaultValue: '' })
  if (exact) return exact
  // 2) fallback : dictionnaire générique
  const generique = i18n.t(`labels.statut.generique.${code}`, { defaultValue: '' })
  if (generique) return generique
  // 3) dernier recours : humanisation
  return humanize(code)
}

// ════════════════════════════════════════════════════════════════════════════════
//  GRAVITÉS / NIVEAUX
// ════════════════════════════════════════════════════════════════════════════════

export function labelGravite(code: string): string {
  if (!code) return ''
  return i18n.t(`labels.gravite.${code}`, { defaultValue: humanize(code) })
}

export function labelUrgence(code: string): string {
  if (!code) return ''
  return i18n.t(`labels.urgence.${code}`, { defaultValue: humanize(code) })
}

// ════════════════════════════════════════════════════════════════════════════════
//  DOMAINES D'EXAMEN (TypeExamen.domaine)
// ════════════════════════════════════════════════════════════════════════════════

export function labelDomaine(code: string | null | undefined): string {
  if (!code) return ''
  return i18n.t(`labels.domaine.${code}`, { defaultValue: humanize(code) })
}

// ════════════════════════════════════════════════════════════════════════════════
//  PERMISSIONS — libellés "humains" pour la matrice de rôles
//  (le backend fournit déjà des libellés dans le catalogue ; ce mapping sert
//   uniquement de filet de sécurité si le libellé backend est manquant)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Libellé d'une permission. Si l'objet permission vient du backend (avec son
 * propre `libelle`), on l'utilise d'abord ; sinon on retombe sur la table i18n.
 */
export function labelPermission(code: string, backendLibelle?: string | null): string {
  if (backendLibelle && backendLibelle.trim().length > 0) return backendLibelle
  if (!code) return ''
  return i18n.t(`labels.permission.${code}`, { defaultValue: humanize(code) })
}

// ════════════════════════════════════════════════════════════════════════════════
//  ENTITÉS (pour les colonnes "Type entité" des journaux d'audit)
// ════════════════════════════════════════════════════════════════════════════════

export function labelEntite(code: string | null | undefined): string {
  if (!code) return ''
  return i18n.t(`labels.entite.${code}`, { defaultValue: humanize(code) })
}

// ════════════════════════════════════════════════════════════════════════════════
//  DÉCISIONS MÉDICALES (consultation.decisionMedicale)
// ════════════════════════════════════════════════════════════════════════════════

export function labelDecision(code: string | null | undefined): string {
  if (!code) return '—'
  return i18n.t(`labels.decision.${code}`, { defaultValue: humanize(code) })
}

// ════════════════════════════════════════════════════════════════════════════════
//  TYPES DE SUIVI D'ACCIDENT DU TRAVAIL (SuiviAccidentTravail.type)
// ════════════════════════════════════════════════════════════════════════════════

export function labelSuiviAccident(code: string | null | undefined): string {
  if (!code) return ''
  return i18n.t(`labels.suiviAccident.${code}`, { defaultValue: humanize(code) })
}

// ════════════════════════════════════════════════════════════════════════════════
//  TYPES D'ANTÉCÉDENT (AntecedentPatient.type)
// ════════════════════════════════════════════════════════════════════════════════

export function labelAntecedentType(code: string | null | undefined): string {
  if (!code) return ''
  return i18n.t(`labels.antecedentType.${code}`, { defaultValue: humanize(code) })
}

// ════════════════════════════════════════════════════════════════════════════════
//  TYPES D'ALERTE MÉDICALE (AlerteMedicale.type)
// ════════════════════════════════════════════════════════════════════════════════

export function labelAlerteType(code: string | null | undefined): string {
  if (!code) return ''
  return i18n.t(`labels.alerteType.${code}`, { defaultValue: humanize(code) })
}

// ════════════════════════════════════════════════════════════════════════════════
//  Fallback : "humanise" un code SNAKE_CASE / dot.case en texte lisible
// ════════════════════════════════════════════════════════════════════════════════

function humanize(code: string): string {
  if (!code) return ''
  const cleaned = code
    .replace(/[._]+/g, ' ')
    .trim()
    .toLowerCase()
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

/** Version publique de `humanize` — pour les fallbacks d'affichage (jamais de code brut). */
export function humanizeCode(code: string | null | undefined): string {
  return humanize(code ?? '')
}
