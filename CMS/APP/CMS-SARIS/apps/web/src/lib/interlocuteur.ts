/**
 * Les deux serveurs de l'application de bureau, et le jeton de chacun — logique pure.
 *
 * Connecté, l'écran parle au serveur CENTRAL ; sans réseau, au service LOCAL de la machine (cf. electron/
 * interlocuteur.ts). Chacun est une autorité d'authentification distincte : il signe SES jetons avec SON secret
 * et refuse ceux de l'autre. Partager le secret du central est exclu — il finirait dans chaque installateur,
 * extractible, et permettrait de forger des jetons pour la production.
 *
 * L'application s'authentifie donc auprès des DEUX, au moment où elle a les identifiants en main (la connexion),
 * et garde les deux jeux de jetons. Le jeu « actif » (`token`, `refreshToken` du store) est TOUJOURS celui du
 * serveur interrogé : tout le reste de l'application (requêtes, renouvellement, flux temps réel) n'a rien à
 * savoir de cette dualité. L'autre jeu attend à côté, dans `autres`.
 */

export type Interlocuteur = 'central' | 'local'

export interface Jetons {
  token: string
  refreshToken: string
}

/** La partie de la session qui concerne les jetons. */
export interface JetonsSession {
  /** À qui appartient le jeu actif ; `null` : pas de session. */
  interlocuteur: Interlocuteur | null
  token: string | null
  refreshToken: string | null
  /** Le jeu de l'autre serveur, s'il a pu être obtenu. */
  autres: Partial<Record<Interlocuteur, Jetons>>
}

/**
 * Passe le jeu actif sur l'interlocuteur visé : l'actuel rejoint `autres`, celui de la cible devient actif.
 * `null` si l'on n'a pas de jeu pour la cible (on ne peut pas lui parler en étant connecté).
 */
export function basculerJetons(s: JetonsSession, vers: Interlocuteur): JetonsSession | null {
  if (s.interlocuteur === vers) return s
  const cible = s.autres[vers]
  if (!cible) return null
  const autres: Partial<Record<Interlocuteur, Jetons>> = { ...s.autres }
  delete autres[vers]
  if (s.interlocuteur && s.token && s.refreshToken) {
    autres[s.interlocuteur] = { token: s.token, refreshToken: s.refreshToken }
  }
  return { interlocuteur: vers, token: cible.token, refreshToken: cible.refreshToken, autres }
}

/**
 * Avec qui l'écran peut-il VRAIMENT parler, quand le processus principal le prie de parler à `souhait` ?
 *  - pas de session : à qui l'on veut (l'écran de connexion s'adresse au serveur voulu) ;
 *  - session ouverte : à `souhait` seulement si l'on a le jeton de ce serveur ; sinon on reste sur celui dont on
 *    a le jeton — mieux vaut un serveur un peu moins direct qu'un 401 en boucle.
 */
export function interlocuteurPossible(souhait: Interlocuteur, s: JetonsSession): Interlocuteur {
  if (!s.interlocuteur || !s.token) return souhait
  if (s.interlocuteur === souhait) return souhait
  return s.autres[souhait] ? souhait : s.interlocuteur
}

/** Quel serveur est à l'adresse `url` ? Le service local a une adresse connue ; tout le reste est le central. */
export function interlocuteurDeLUrl(url: string, urlLocale: string | undefined): Interlocuteur {
  const propre = (u: string) => u.replace(/\/+$/, '')
  return urlLocale && propre(url) === propre(urlLocale) ? 'local' : 'central'
}
