/**
 * Quand la bulle de synchronisation doit-elle se montrer — logique pure.
 *
 * Elle existe pour dire à la personne quelque chose qui la concerne : « tes données attendent d'être envoyées »,
 * « l'envoi est en cours », « un administrateur a suspendu les échanges ». Elle n'a RIEN à dire quand l'écran
 * parle directement au serveur central : la copie locale de la machine s'y met à jour en arrière-plan, au gré
 * de ce que les autres postes écrivent — des cycles qui se succèdent toute la journée et que la personne n'a pas
 * à voir. Affichés tels quels, ils faisaient clignoter la bulle sans cesse.
 */

export interface EtatSynchro {
  enCours: boolean
  pendingPush: boolean
  suspendu: boolean
  resync: boolean
}

export type Bulle = 'suspendue' | 'resync' | 'enCours' | 'enAttente'

/** Ce que la bulle devrait dire d'après l'état lu à l'instant (ou `null` : se taire). */
export function bulleVoulue(etat: EtatSynchro | null, parleAuCentral: boolean): Bulle | null {
  if (!etat) return null
  // Ordres d'un administrateur : toujours montrés, ils expliquent pourquoi rien ne part ni n'arrive.
  if (etat.suspendu) return 'suspendue'
  if (etat.resync) return 'resync'
  // Connecté au central : l'entretien de la copie locale se fait en silence.
  if (parleAuCentral) return null
  if (etat.enCours) return 'enCours'
  if (etat.pendingPush) return 'enAttente'
  return null
}

/** Lectures consécutives nécessaires avant de changer ce qui est affiché. */
const CONFIRMATIONS_POUR_APPARAITRE = 2
const CONFIRMATIONS_POUR_DISPARAITRE = 3

export interface LissageEtat {
  affichee: Bulle | null
  /** Ce que les dernières lectures réclament, et depuis combien de lectures de suite. */
  candidate: Bulle | null
  vuesDeSuite: number
}

export const LISSAGE_INITIAL: LissageEtat = { affichee: null, candidate: null, vuesDeSuite: 0 }

/**
 * Lisse l'affichage : un changement n'est retenu qu'après plusieurs lectures consécutives qui le réclament. Une
 * bulle qui apparaît et disparaît à chaque cycle de deux secondes fatigue sans informer ; une qui persiste a
 * quelque chose à dire.
 */
export function lisser(prec: LissageEtat, voulue: Bulle | null): LissageEtat {
  if (voulue === prec.affichee) return { affichee: prec.affichee, candidate: null, vuesDeSuite: 0 }
  const vuesDeSuite = voulue === prec.candidate ? prec.vuesDeSuite + 1 : 1
  const requis = voulue === null ? CONFIRMATIONS_POUR_DISPARAITRE : CONFIRMATIONS_POUR_APPARAITRE
  if (vuesDeSuite >= requis) return { affichee: voulue, candidate: null, vuesDeSuite: 0 }
  return { affichee: prec.affichee, candidate: voulue, vuesDeSuite }
}
