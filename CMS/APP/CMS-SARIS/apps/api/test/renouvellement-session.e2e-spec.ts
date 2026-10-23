/**
 * Renouvellement de session — par les vraies routes et la vraie base de test.
 *
 * Le jeton de renouvellement est à usage UNIQUE : chaque renouvellement en crée un nouveau et révoque
 * l'ancien. Si la page est rechargée avant d'avoir reçu la réponse (plusieurs actualisations de suite),
 * le nouveau jeton n'est jamais enregistré et l'ancien était refusé : la personne était renvoyée à la
 * connexion sans rien avoir fait de mal (constaté : à partir d'environ trois actualisations rapides).
 *
 * Ce que ce test prouve :
 *  - un jeton qui vient de servir est encore accepté quelques secondes, et donne une session neuve ;
 *  - cette tolérance ne rouvre RIEN de ce qui a été fermé : après une déconnexion, une fermeture forcée
 *    ou le délai écoulé, le jeton reste mort.
 */
import type { NestExpressApplication } from '@nestjs/platform-express'
import { baseDe, demarrerApp } from './support/app-test'
import { appelAnonyme, COMPTES, connecter, type Client, type Reponse } from './support/client'

interface Jetons {
  accessToken: string
  refreshToken: string
}

/** Le `sid` (session) porté par un jeton d'accès. */
function sidDe(jeton: string): string {
  return (JSON.parse(Buffer.from(jeton.split('.')[1]!, 'base64url').toString('utf8')) as { sid: string }).sid
}

describe('Renouvellement de session : une réponse perdue ne déconnecte plus personne', () => {
  let app: NestExpressApplication
  const base = () => baseDe(app)
  const renouveler = (refreshToken: string): Promise<Reponse> =>
    appelAnonyme(app, 'post', '/auth/refresh', {}, { refreshToken })
  const jetons = (r: Reponse): Jetons => r.body as Jetons
  const seConnecter = (): Promise<Client> => connecter(app, COMPTES.infirmierSansDelegation)

  beforeAll(async () => {
    app = await demarrerApp()
  })
  afterAll(async () => {
    await app.close()
  })

  it('un renouvellement ordinaire fait tourner le jeton : le nouveau fonctionne', async () => {
    const c = await seConnecter()
    const r1 = await renouveler(c.refreshToken)
    expect([200, 201]).toContain(r1.status)
    expect(jetons(r1).refreshToken).not.toBe(c.refreshToken)
    expect([200, 201]).toContain((await renouveler(jetons(r1).refreshToken)).status)
  })

  it('le jeton qui vient de servir (réponse perdue) est encore accepté, et donne une session neuve', async () => {
    const c = await seConnecter()
    // 1er renouvellement : la réponse « n'arrive jamais » (la page est rechargée) — on ne garde rien.
    const perdu = await renouveler(c.refreshToken)
    expect([200, 201]).toContain(perdu.status)
    // La page rechargée n'a que l'ancien jeton : elle doit pouvoir se renouveler quand même.
    const r2 = await renouveler(c.refreshToken)
    expect([200, 201]).toContain(r2.status)
    expect(jetons(r2).refreshToken).not.toBe(c.refreshToken)
    // Et la session obtenue fonctionne : un accès, et un nouveau renouvellement.
    const moi = await appelAnonyme(app, 'get', '/auth/me', { Authorization: `Bearer ${jetons(r2).accessToken}` })
    expect(moi.status).toBe(200)
    expect([200, 201]).toContain((await renouveler(jetons(r2).refreshToken)).status)
  })

  it('plusieurs actualisations de suite (jeton d’origine représenté à chaque fois) ne coupent jamais la session', async () => {
    const c = await seConnecter()
    let dernier = c.refreshToken
    for (let i = 0; i < 6; i++) {
      // Chaque page rechargée n'a que le jeton d'origine ; seule la DERNIÈRE réponse est conservée.
      const r = await renouveler(c.refreshToken)
      expect([200, 201]).toContain(r.status)
      dernier = jetons(r).refreshToken
    }
    expect([200, 201]).toContain((await renouveler(dernier)).status)
  })

  it('après une DÉCONNEXION, le jeton est mort — même dans le délai de tolérance', async () => {
    const c = await seConnecter()
    expect([200, 201]).toContain((await renouveler(c.refreshToken)).status)
    const sortie = await appelAnonyme(app, 'post', '/auth/logout', { Authorization: `Bearer ${jetons(await renouveler(c.refreshToken)).accessToken}` })
    expect(sortie.status).toBe(204)
    expect((await renouveler(c.refreshToken)).status).toBe(401)
  })

  it('après une FERMETURE FORCÉE des sessions, le jeton est mort', async () => {
    const c = await seConnecter()
    expect([200, 201]).toContain((await renouveler(c.refreshToken)).status)
    await base().raw.sessionUtilisateur.updateMany({
      where: { utilisateurId: c.user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    expect((await renouveler(c.refreshToken)).status).toBe(401)
  })

  it('une fois le délai de tolérance écoulé, le jeton qui a servi est refusé', async () => {
    const c = await seConnecter()
    expect([200, 201]).toContain((await renouveler(c.refreshToken)).status)
    // La session d'origine a été révoquée il y a deux minutes.
    await base().raw.sessionUtilisateur.update({
      where: { id: sidDe(c.jeton) },
      data: { revokedAt: new Date(Date.now() - 2 * 60_000) },
    })
    expect((await renouveler(c.refreshToken)).status).toBe(401)
  })

  it('un jeton inventé est refusé', async () => {
    expect((await renouveler('pas-un-jeton')).status).toBe(401)
  })
})
