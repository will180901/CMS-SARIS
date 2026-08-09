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
      // `posteLocalId` EXEMPTE de la règle de session unique — et c'est indispensable ici.
      //
      // Sans lui, le backend embarqué cherchait une session concurrente. Or les sessions
      // sont SYNCHRONISÉES depuis le central : il y voyait la session que l'utilisateur
      // vient d'ouvrir sur le serveur, la croyait concurrente, et refusait de délivrer un
      // jeton. Faute de jeton local, l'application présentait hors-ligne celui du central,
      // que le backend rejette — chaque écriture tournait indéfiniment.
      //
      // Cette détection n'a de toute façon aucun sens ici : le backend est en loopback et
      // ne sert qu'une personne, celle qui est devant la machine.
      body: JSON.stringify({ login, password, posteLocalId: desktopBridge()?.posteLocalId }),
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
