/**
 * Identifiant stable de CE poste, pour l'avertissement de double connexion.
 *
 * Généré une fois puis conservé localement. Il permet au serveur de distinguer
 * « quelqu'un se connecte ailleurs » de « je relance mon application » : sans lui,
 * l'avertissement apparaîtrait à chaque redémarrage, deviendrait un réflexe qu'on
 * clique sans lire, et ne protégerait plus de rien.
 *
 * Ce n'est PAS un secret et il n'ouvre aucun droit : le mot de passe reste seul juge.
 * Le perdre (vidage du navigateur, autre profil) n'a qu'un effet : un avertissement de
 * trop à la prochaine connexion.
 *
 * `localStorage` et non `sessionStorage` : il doit survivre à la fermeture de l'onglet,
 * sinon chaque réouverture ressemblerait à un nouvel appareil.
 */
const CLE = 'saris.appareil.id'

export function getAppareilId(): string {
  try {
    const existant = localStorage.getItem(CLE)
    if (existant) return existant
    const nouveau = crypto.randomUUID()
    localStorage.setItem(CLE, nouveau)
    return nouveau
  } catch {
    // Stockage indisponible (mode privé strict, quota) : on renvoie un identifiant
    // éphémère. L'utilisateur verra un avertissement de trop — jamais un blocage.
    return crypto.randomUUID()
  }
}
