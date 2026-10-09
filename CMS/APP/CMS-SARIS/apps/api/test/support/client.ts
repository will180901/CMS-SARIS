/**
 * Client HTTP des tests : connexion d'un compte puis appels authentifiés.
 *
 * Les comptes viennent du seed (packages/db/prisma/seed.ts), rejoué à neuf sur la base
 * de test à chaque lancement : admin (mode E2E) et les comptes cliniques de démonstration.
 */
import request from 'supertest'
import type { NestExpressApplication } from '@nestjs/platform-express'

export const COMPTES = {
  admin: { login: 'admin', motDePasse: 'Admin123!' },
  medecinChef: { login: 'moukanda', motDePasse: 'Saris2026!' },
  /** Second médecin (Nkayi) : un médecin n'a qu'une consultation ouverte à la fois,
   *  les fichiers de test ne se marchent donc pas dessus. */
  autreMedecin: { login: 'nzinga', motDePasse: 'Saris2026!' },
  /** Infirmier AVEC une délégation de prescription active (seed : MOUKANDA → BATCHI). */
  infirmier: { login: 'batchi', motDePasse: 'Saris2026!' },
  /** Infirmier SANS délégation en cours (seed : délégation de MAFOUTA expirée). */
  infirmierSansDelegation: { login: 'mafouta', motDePasse: 'Saris2026!' },
} as const

/** Corps typé par l'appelant : `get<MonType>(…)`. Sans précision, `unknown`. */
export interface Reponse<T = unknown> {
  status: number
  body: T
}

export interface Client {
  jeton: string
  refreshToken: string
  user: {
    id: string
    login: string
    siteId?: string
    roles: string[]
    permissions: string[]
    personnelMedicalId?: string | null
  }
  get<T = unknown>(chemin: string): Promise<Reponse<T>>
  post<T = unknown>(chemin: string, corps?: object): Promise<Reponse<T>>
  patch<T = unknown>(chemin: string, corps?: object): Promise<Reponse<T>>
  delete<T = unknown>(chemin: string): Promise<Reponse<T>>
  /** Appel avec une méthode HTTP quelconque (inventaire des routes). */
  appel(methode: Methode, chemin: string): Promise<Reponse>
}

export type Methode = 'get' | 'post' | 'put' | 'patch' | 'delete'

/** Appel SANS jeton d'accès. */
export async function appelAnonyme(
  app: NestExpressApplication,
  methode: Methode,
  chemin: string,
): Promise<Reponse> {
  const r = await serveur(app)[methode](chemin)
  return { status: r.status, body: r.body as unknown }
}

/** Réponse de /auth/login et /auth/session/confirmer. */
interface CorpsConnexion {
  sessionActive?: boolean
  tempToken?: string
  accessToken?: string
  refreshToken?: string
  user?: Client['user']
}

function serveur(app: NestExpressApplication) {
  return request(app.getHttpServer())
}

/** Connexion d'un compte. Une session déjà ouverte ailleurs est remplacée, comme le
 *  ferait la personne en confirmant à l'écran. */
export async function connecter(
  app: NestExpressApplication,
  compte: { login: string; motDePasse: string },
): Promise<Client> {
  let r = await serveur(app)
    .post('/auth/login')
    .send({
      login: compte.login,
      password: compte.motDePasse,
      appareilId: `tests-${compte.login}`,
    })
  if (r.status >= 300)
    throw new Error(
      `Connexion ${compte.login} : HTTP ${r.status} ${JSON.stringify(r.body)}`,
    )
  let corps = r.body as CorpsConnexion
  if (corps.sessionActive) {
    r = await serveur(app)
      .post('/auth/session/confirmer')
      .send({ tempToken: corps.tempToken, action: 'REMPLACER' })
    corps = r.body as CorpsConnexion
  }
  if (!corps.accessToken || !corps.refreshToken || !corps.user)
    throw new Error(
      `Connexion ${compte.login} : pas de jeton (${Object.keys(corps).join(', ')})`,
    )
  return client(app, corps.accessToken, corps.refreshToken, corps.user)
}

function client(
  app: NestExpressApplication,
  jeton: string,
  refreshToken: string,
  user: Client['user'],
): Client {
  const auth = `Bearer ${jeton}`
  // Le corps est typé par l'appelant (cf. Reponse<T>) : supertest le renvoie non typé.
  const repondre = <T>(r: request.Response): Reponse<T> => ({
    status: r.status,
    body: r.body as T,
  })
  return {
    jeton,
    refreshToken,
    user,
    get: async (c) =>
      repondre(await serveur(app).get(c).set('Authorization', auth)),
    post: async (c, corps) =>
      repondre(
        await serveur(app)
          .post(c)
          .set('Authorization', auth)
          .send(corps ?? {}),
      ),
    patch: async (c, corps) =>
      repondre(
        await serveur(app)
          .patch(c)
          .set('Authorization', auth)
          .send(corps ?? {}),
      ),
    delete: async (c) =>
      repondre(await serveur(app).delete(c).set('Authorization', auth)),
    appel: async (methode, c) =>
      repondre(await serveur(app)[methode](c).set('Authorization', auth)),
  }
}
