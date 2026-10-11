/**
 * Mode du système : PRODUCTION (les vraies données du centre) ou TEST (un bandeau orange
 * l'annonce à tout le monde, et — aux étapes suivantes — des données fictives marquées
 * peuvent être générées puis retirées).
 *
 * C'est le MÊME système et la MÊME base dans les deux cas : le mode n'isole rien, il avertit
 * et ouvre des outils. D'où ces garde-fous, qui vivent ici, dans des fonctions pures testées
 * sans base : le verrou de configuration, et ce que « le mode effectif » veut dire.
 */

export type ModeSysteme = 'PRODUCTION' | 'TEST'

/**
 * Clé RÉSERVÉE de `ParametreSysteme`. Absente du catalogue des paramètres, à dessein : la page
 * « Paramètres système » ne sait ni redemander un mot de passe ni respecter un verrou — le mode
 * ne se règle donc que par le contrôleur dédié.
 */
export const CLE_MODE = 'systeme.mode'

const AUTORISE = new Set([
  'true',
  '1',
  'oui',
  'yes',
  'on',
  'autorise',
  'autorisé',
])

/**
 * Le mode Test est-il INTERDIT par la configuration du serveur ?
 *
 * Variable d'environnement `MODE_TEST_AUTORISE` : absente ou vide = autorisé ; « true » (1, oui…)
 * = autorisé ; TOUTE autre valeur verrouille — « false », mais aussi une faute de frappe
 * (« flase ») : un verrou qui s'ouvre parce qu'on s'est trompé d'une lettre n'en est pas un.
 *
 * C'est le verrou de la MISE EN SERVICE : posé au niveau de l'hébergement, il ne se lève ni depuis
 * l'application ni par une écriture en base — même un administrateur dont le compte serait
 * compromis ne peut pas replacer un centre en service réel en mode test.
 */
export function modeTestVerrouille(valeurEnv: string | undefined): boolean {
  const v = (valeurEnv ?? '').trim().toLowerCase()
  if (v === '') return false
  return !AUTORISE.has(v)
}

/** Valeur enregistrée → mode demandé. Tout ce qui n'est pas « TEST » est « PRODUCTION ». */
export function modeEnregistre(valeur: string | null | undefined): ModeSysteme {
  return valeur === 'TEST' ? 'TEST' : 'PRODUCTION'
}

/**
 * Mode EFFECTIF : celui que le système applique et affiche.
 *
 * Verrouillé, il est toujours PRODUCTION, quoi que dise la base : un verrou qui se contourne en
 * écrivant « TEST » dans une table n'est pas un verrou.
 */
export function modeEffectif(
  valeur: string | null | undefined,
  verrouille: boolean,
): ModeSysteme {
  return verrouille ? 'PRODUCTION' : modeEnregistre(valeur)
}
