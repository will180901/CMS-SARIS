/**
 * Connexion depuis un poste de bureau : le SITE de travail est celui de la MACHINE, pas celui du compte.
 *
 * Quand l'écran parle directement au serveur central, la personne ouvre une vraie session de personne (avec la
 * session unique, le mot de passe temporaire…), et chacun de ses actes porte le site de la session. Ce site doit
 * être celui du poste où elle est assise. `machineId` ne sert qu'à CELA : contrairement à `posteLocalId`, il ne
 * transforme pas la session en session de synchronisation.
 */
import type { NestExpressApplication } from '@nestjs/platform-express'
import { baseDe, demarrerApp } from './support/app-test'
import { appelAnonyme, COMPTES } from './support/client'

interface Connexion {
  accessToken?: string
  refreshToken?: string
  sessionActive?: boolean
  tempToken?: string
  user?: { siteId: string }
}

function sidDe(jeton: string): string {
  return (JSON.parse(Buffer.from(jeton.split('.')[1]!, 'base64url').toString('utf8')) as { sid: string }).sid
}

describe('Connexion depuis un poste : le site est celui de la machine', () => {
  let app: NestExpressApplication
  const s = `${Date.now() % 100_000}`
  const POSTE = `poste-machine-${s}`
  let siteDuCompte = ''
  let autreSite = ''
  const base = () => baseDe(app)

  /** Connexion de l'infirmier de test, avec ou sans identifiant de machine ; une session ouverte ailleurs est remplacée. */
  async function ouvrir(machineId?: string, extra: object = {}): Promise<Connexion> {
    const corps = {
      login: COMPTES.infirmierSansDelegation.login,
      password: COMPTES.infirmierSansDelegation.motDePasse,
      appareilId: `tests-machine-${s}`,
      ...(machineId ? { machineId } : {}),
      ...extra,
    }
    let r = await appelAnonyme(app, 'post', '/auth/login', {}, corps)
    let c = r.body as Connexion
    if (c.sessionActive) {
      r = await appelAnonyme(app, 'post', '/auth/session/confirmer', {}, { tempToken: c.tempToken, action: 'REMPLACER' })
      c = r.body as Connexion
    }
    return c
  }

  beforeAll(async () => {
    app = await demarrerApp()
    const compte = await base().raw.utilisateur.findUniqueOrThrow({
      where: { login: COMPTES.infirmierSansDelegation.login },
      select: { siteId: true },
    })
    siteDuCompte = compte.siteId
    const autre = await base().raw.site.findFirstOrThrow({ where: { id: { not: siteDuCompte } }, select: { id: true } })
    autreSite = autre.id
    await base().raw.posteLocal.create({ data: { id: POSTE, siteId: autreSite, libelle: `Poste machine ${s}` } })
  })
  afterAll(async () => {
    await base().raw.posteLocal.deleteMany({ where: { id: POSTE } })
    await app.close()
  })

  it('sans machine (navigateur) : le site du compte', async () => {
    const c = await ouvrir()
    expect(c.user?.siteId).toBe(siteDuCompte)
  })

  it('avec l’identifiant de la machine : le site de la MACHINE, et il survit au renouvellement du jeton', async () => {
    const c = await ouvrir(POSTE)
    expect(c.user?.siteId).toBe(autreSite)
    const r = await appelAnonyme(app, 'post', '/auth/refresh', {}, { refreshToken: c.refreshToken })
    expect((r.body as Connexion).user?.siteId).toBe(autreSite)
  })

  it('une machine inconnue ne bloque rien : le site du compte', async () => {
    const c = await ouvrir('poste-qui-n-existe-pas')
    expect(c.user?.siteId).toBe(siteDuCompte)
  })

  it('la session reste une session de PERSONNE : elle n’est pas marquée « session de synchronisation »', async () => {
    const c = await ouvrir(POSTE)
    const session = await base().raw.sessionUtilisateur.findUniqueOrThrow({
      where: { id: sidDe(c.accessToken!) },
      select: { posteLocalId: true, appareilId: true },
    })
    expect(session.posteLocalId).toBeNull()
    expect(session.appareilId).toBe(`tests-machine-${s}`)
  })

  it('et la règle de session unique s’applique toujours (un autre appareil est averti)', async () => {
    await ouvrir(POSTE) // ouvre une session sur « tests-machine-… »
    const r = await appelAnonyme(app, 'post', '/auth/login', {}, {
      login: COMPTES.infirmierSansDelegation.login,
      password: COMPTES.infirmierSansDelegation.motDePasse,
      appareilId: `autre-appareil-${s}`,
      machineId: POSTE,
    })
    expect((r.body as Connexion).sessionActive).toBe(true)
  })
})
