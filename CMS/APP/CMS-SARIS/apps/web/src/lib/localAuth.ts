/**
 * localAuth — obtention d'un jeton auprès du backend EMBARQUÉ (client de bureau).
 *
 * POURQUOI DEUX JETONS. En mode local, le poste parle au serveur CENTRAL quand il est
 * en ligne, et à son backend EMBARQUÉ quand il ne l'est plus. Ce sont DEUX autorités
 * d'authentification distinctes : chacune signe ses jetons avec SON secret. Un jeton
 * délivré par le central est donc rejeté par le backend local — et inversement.
 *
 * Jusqu'ici, la bascule ne changeait que l'URL : le jeton du central partait vers le
 * backend local, qui répondait 401. Résultat, hors-ligne : toute action tournait en
 * boucle puis déconnectait. Le hors-ligne ne pouvait pas fonctionner.
 *
 * On ne peut pas partager le secret du central : il finirait dans chaque installateur,
 * extractible, et permettrait de forger des jetons pour le serveur de production. La
 * seule voie saine est donc de s'authentifier AUSSI localement, au moment où l'on a
 * les identifiants sous la main : à la connexion.
 *
 * La table des utilisateurs étant synchronisée depuis le central, les mêmes identifiants
 * valent des deux côtés.
 */
import { desktopBridge } from './desktop'
import { useSessionStore } from '@/stores/session.store'

interface ReponseLocale {
  accessToken?: string
  refreshToken?: string
  requireTotp?: boolean
  sessionActive?: boolean
}

/**
 * S'authentifie auprès du backend embarqué et mémorise le jeton obtenu.
 *
 * Silencieux et non bloquant : un échec ici ne doit JAMAIS empêcher d'entrer dans
 * l'application. Le cas courant est un poste tout neuf dont la première synchronisation
 * n'a pas encore ramené les comptes — on réessaiera (cf. `assurerJetonLocal`).
 */
export async function obtenirJetonLocal(login: string, password: string): Promise<boolean> {
  const url = desktopBridge()?.localApiUrl
  if (!url) return false // navigateur, ou client de bureau en mode distant : rien à faire
  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Pas d'`appareilId` : cette session-ci n'est pas une session « humaine » de plus,
      // c'est le pendant local de celle du central. Le backend embarqué est seul sur
      // 127.0.0.1 — il n'a personne avec qui entrer en concurrence.
      body: JSON.stringify({ login, password }),
    })
    if (!res.ok) return false
    const data = (await res.json()) as ReponseLocale
    // Le backend local ne demande ni 2FA ni arbitrage de session concurrente ; si l'un
    // des deux remonte, on préfère ne rien mémoriser plutôt qu'un jeton douteux.
    if (data.sessionActive || data.requireTotp) return false
    if (!data.accessToken || !data.refreshToken) return false
    useSessionStore.getState().setLocalSession(data.accessToken, data.refreshToken)
    return true
  } catch {
    return false // backend local pas encore démarré : on réessaiera
  }
}

/**
 * Mémorise les identifiants le TEMPS de la session applicative, uniquement en mode
 * local, pour pouvoir retenter l'authentification locale si elle a échoué à la
 * connexion (poste neuf dont les comptes n'étaient pas encore synchronisés).
 *
 * En mémoire seulement — jamais sur disque, jamais dans le stockage du navigateur.
 * Effacé à la déconnexion.
 */
let identifiantsEnMemoire: { login: string; password: string } | null = null

export function memoriserPourRetentative(login: string, password: string): void {
  if (desktopBridge()?.localApiUrl) identifiantsEnMemoire = { login, password }
}

export function oublierIdentifiants(): void {
  identifiantsEnMemoire = null
}

/** Garantit un jeton local si c'est possible. Appelé avant de basculer hors-ligne. */
export async function assurerJetonLocal(): Promise<boolean> {
  if (useSessionStore.getState().localToken) return true
  if (!identifiantsEnMemoire) return false
  return obtenirJetonLocal(identifiantsEnMemoire.login, identifiantsEnMemoire.password)
}

/**
 * Donne au poste son identité de synchronisation à partir de la PREMIÈRE connexion.
 *
 * L'installation ne demande que l'adresse du serveur : aucun mot de passe administrateur
 * confié au technicien qui déploie les machines. Ce sont donc les jetons du premier
 * utilisateur qui se connecte qui provisionnent le poste, et SON site qui devient celui
 * de la machine.
 *
 * Sans effet si le poste est déjà provisionné (le processus principal le vérifie), et
 * sans conséquence en cas d'échec : le poste continue de travailler contre le central,
 * simplement sans hors-ligne, et l'on retentera à la connexion suivante.
 */
export function provisionnerPosteDepuisConnexion(
  accessToken: string,
  refreshToken: string,
  siteId?: string | null,
): void {
  const bridge = desktopBridge()
  if (!bridge?.provisionPoste || !siteId) return
  void bridge.provisionPoste({ accessToken, refreshToken, siteId }).catch(() => {
    /* best-effort : jamais bloquant pour l'utilisateur qui vient de se connecter */
  })
}
