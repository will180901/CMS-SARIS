/**
 * Avec QUI l'écran de ce poste doit-il parler : le serveur central, ou le service local de la machine ?
 *
 * La règle voulue (« en ligne d'abord ») :
 *  - CONNECTÉ : l'écran parle DIRECTEMENT au serveur central — messagerie et dossiers plus rapides et plus
 *    fluides, sans passer par la base de la machine ;
 *  - PAS CONNECTÉ : l'écran parle au service local ; ce qui est saisi est gardé dans la base de la machine ;
 *  - RETOUR D'INTERNET : on ne rend la main au central qu'UNE FOIS tout ce qui était en attente remonté. Sinon
 *    la personne verrait, depuis le central, un écran qui ne montre pas ce qu'elle vient de saisir hors ligne
 *    — elle le croirait perdu et le ressaisirait.
 *
 * Logique pure, sans Electron ni réseau : testée seule (test/interlocuteur.test.ts).
 */

export type Interlocuteur = 'central' | 'local'

export interface EtatReseau {
  /** Avec qui l'écran parle en ce moment. */
  actuel: Interlocuteur
  /** Le serveur central répond-il ? */
  enLigne: boolean
  /** Le service local a-t-il encore des écritures à remonter ? */
  travailEnAttente: boolean
}

/**
 * Le prochain interlocuteur.
 *
 * Une fois sur le central, on y reste tant qu'on est en ligne : la file d'envoi du service local peut se
 * remplir un instant (présence, écritures internes), cela ne justifie pas de renvoyer l'écran sur le local.
 * Seule une COUPURE ramène sur le local — immédiatement.
 */
export function choisirInterlocuteur(e: EtatReseau): Interlocuteur {
  if (!e.enLigne) return 'local'
  if (e.actuel === 'central') return 'central'
  return e.travailEnAttente ? 'local' : 'central'
}
