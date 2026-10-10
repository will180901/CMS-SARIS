/**
 * L'adresse du client derrière Cloudflare / Render.
 *
 * `X-Forwarded-For` est une liste que le client peut remplir lui-même : lue telle quelle
 * (`TRUST_PROXY=true`), elle permettrait de s'attribuer n'importe quelle adresse dans le
 * journal des connexions et de contourner la limitation des tentatives. Quand le
 * déploiement le demande (`CLIENT_IP_HEADER=cf-connecting-ip`), l'adresse vient de
 * l'en-tête que Cloudflare écrit lui-même — et seulement de lui.
 */
import type { NestExpressApplication } from '@nestjs/platform-express'
import { demarrerApp } from './support/app-test'
import { COMPTES, appelAnonyme, connecter, type Client } from './support/client'

interface Ligne {
  login: string
  resultat: string
  ipAdresse: string | null
}
interface Diagnostic {
  ip: string | null
  origine: 'ENTETE' | 'X_FORWARDED_FOR' | 'SOCKET'
  verdict: string
  enteteConfigure: string | null
  valeurEntete: string | null
  xForwardedFor: string | null
}

describe("Adresse du client : l'en-tête de confiance, pas X-Forwarded-For", () => {
  let app: NestExpressApplication
  let admin: Client
  let inf: Client
  const s = `${Date.now() % 100_000}`
  const IP_REELLE = '41.77.12.34'

  /** Tentative de connexion ratée : une ligne « identifiant inconnu » porte l'adresse vue. */
  const tenter = (entetes: Record<string, string>, login: string) =>
    appelAnonyme(app, 'post', '/auth/login', entetes, {
      login,
      password: 'Mauvais-mot-de-passe-1',
    })
  const adresseJournalisee = async (login: string) => {
    const r = await admin.get<{ data: Ligne[] }>(
      '/admin/audit/authentifications?limit=200',
    )
    return r.body.data.find((l) => l.login === login)?.ipAdresse
  }

  beforeAll(async () => {
    process.env['CLIENT_IP_HEADER'] = 'CF-Connecting-IP'
    app = await demarrerApp()
    // Les comptes sont connectés AVANT de relâcher le réglage : seule CETTE application
    // (créée ci-dessus) lit l'en-tête de confiance.
    admin = await connecter(app, COMPTES.admin)
    inf = await connecter(app, COMPTES.infirmier)
  })
  afterAll(async () => {
    delete process.env['CLIENT_IP_HEADER']
    await app.close()
  })

  it("le journal garde l'adresse écrite par le relais de confiance, pas celle de X-Forwarded-For", async () => {
    const login = `fantome-a-${s}`
    await tenter(
      {
        'CF-Connecting-IP': IP_REELLE,
        'X-Forwarded-For': '6.6.6.6, 7.7.7.7',
      },
      login,
    )
    expect(await adresseJournalisee(login)).toBe(IP_REELLE)
  })

  it("un en-tête de confiance invalide est ignoré : l'adresse inventée n'entre pas dans le journal", async () => {
    const login = `fantome-b-${s}`
    await tenter({ 'CF-Connecting-IP': 'pas-une-adresse' }, login)
    const ip = await adresseJournalisee(login)
    expect(ip).toBeTruthy()
    expect(ip).not.toBe('pas-une-adresse')
  })

  it("sans l'en-tête, l'adresse suit la règle d'Express (jamais une valeur inventée par l'appelant)", async () => {
    const login = `fantome-c-${s}`
    await tenter({}, login)
    const ip = await adresseJournalisee(login)
    expect(ip).toBeTruthy()
    expect(ip).not.toBe(IP_REELLE)
  })

  it("le diagnostic montre ce que voit le serveur, et d'où vient l'adresse", async () => {
    const r = await admin.appel('get', '/admin/parametres/diagnostic-reseau', {
      'CF-Connecting-IP': IP_REELLE,
      'X-Forwarded-For': '6.6.6.6',
    })
    expect(r.status).toBe(200)
    const d = r.body as Diagnostic
    expect(d).toMatchObject({
      ip: IP_REELLE,
      origine: 'ENTETE',
      verdict: 'OK',
      enteteConfigure: 'cf-connecting-ip',
      valeurEntete: IP_REELLE,
      xForwardedFor: '6.6.6.6',
    })
  })

  it('une adresse interne est signalée (le serveur ne voit pas celle du client)', async () => {
    const r = await admin.appel('get', '/admin/parametres/diagnostic-reseau', {
      'CF-Connecting-IP': '10.0.3.7',
    })
    expect((r.body as Diagnostic).verdict).toMatch(/ADRESSE_INTERNE|LOCAL/)
  })

  it('le diagnostic est réservé à qui peut lire les paramètres', async () => {
    expect(
      (await inf.appel('get', '/admin/parametres/diagnostic-reseau')).status,
    ).toBe(403)
    expect(
      (await appelAnonyme(app, 'get', '/admin/parametres/diagnostic-reseau'))
        .status,
    ).toBe(401)
  })
})
