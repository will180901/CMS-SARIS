/**
 * fonctions.ts — les fonctions que l'on peut attribuer à une personne.
 *
 * Le système ne connaît que TROIS rôles (cf. ROLE_CATALOG côté serveur) :
 * Administrateur Système, Médecin Chef, Infirmier. Proposer davantage de
 * « métiers » au moment de l'enregistrement recréait une seconde nomenclature
 * concurrente — c'est précisément ce qui avait été retiré du produit.
 *
 * `PersonnelMedical.role` conserve ses valeurs historiques : on ne les renomme
 * pas (aucune migration, aucun historique clinique cassé), on se contente de
 * n'en PROPOSER que trois, chacune correspondant à un rôle réel :
 *
 *     Administrateur Système  ->  ADMINISTRATIF
 *     Médecin Chef            ->  MEDECIN
 *     Infirmier               ->  INFIRMIER
 *
 * SAGE_FEMME et TECHNICIEN_LAB restent parfaitement lisibles sur les fiches qui
 * les portent déjà (cf. `optionsFonction`), simplement on n'en crée plus.
 */

import { labelMetier } from './labels'

/** Valeur stockée dans `PersonnelMedical.role` pour chacun des trois rôles. */
export const FONCTIONS = ['MEDECIN', 'INFIRMIER', 'ADMINISTRATIF'] as const

export type Fonction = (typeof FONCTIONS)[number]

/**
 * Libellé aligné sur le rôle correspondant — c'est ainsi que la personne qui
 * remplit le formulaire nomme les choses, et non « Médecin » vs « Médecin Chef ».
 */
const LIBELLE_FONCTION: Record<Fonction, string> = {
  MEDECIN:       'Médecin Chef',
  INFIRMIER:     'Infirmier',
  ADMINISTRATIF: 'Administrateur Système',
}

export function labelFonction(code: string): string {
  return LIBELLE_FONCTION[code as Fonction] ?? labelMetier(code)
}

/**
 * Rôle d'accès qui découle naturellement d'une fonction.
 *
 * Sert à PRÉ-COCHER le rôle au moment d'ouvrir un accès : sans cela on demandait
 * deux fois la même chose (« quelle fonction ? » puis « quel rôle ? »), avec le
 * risque d'enregistrer un médecin chef doté des droits d'infirmier. Le choix
 * reste modifiable — c'est une proposition, pas une contrainte.
 */
const ROLE_POUR_FONCTION: Record<Fonction, string> = {
  MEDECIN:       'MEDECIN_CHEF',
  INFIRMIER:     'INFIRMIER',
  ADMINISTRATIF: 'ADMIN_SYSTEME',
}

export function roleParDefaut(fonction: string): string | undefined {
  return ROLE_POUR_FONCTION[fonction as Fonction]
}

/**
 * Options du sélecteur de fonction.
 *
 * `actuelle` : la valeur déjà portée par la fiche. Si elle sort de la liste
 * (sage-femme, technicien de laboratoire — créés avant la réduction à trois
 * rôles), elle est ajoutée pour rester sélectionnée. Sans cela, le sélecteur
 * afficherait un champ vide et le premier enregistrement écraserait la fonction
 * réelle de la personne.
 */
export function optionsFonction(actuelle?: string | null) {
  const options = FONCTIONS.map(f => ({ value: f as string, label: labelFonction(f) }))
  if (actuelle && !FONCTIONS.includes(actuelle as Fonction)) {
    options.push({ value: actuelle, label: labelMetier(actuelle) })
  }
  return options
}
