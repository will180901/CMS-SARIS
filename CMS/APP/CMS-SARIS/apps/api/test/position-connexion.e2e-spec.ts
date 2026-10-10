/**
 * La position de l'APPAREIL, relevée par le navigateur à chaque connexion web (jamais
 * déduite de l'adresse IP, qui ne dit que la ville de l'opérateur).
 *
 *  - elle se range sur la ligne du journal que cette connexion a ouverte ;
 *  - un refus ou une indisponibilité sont enregistrés (ils se voient en rouge au journal)
 *    et peuvent être corrigés ; une position relevée, elle, n'est jamais remplacée ;
 *  - chaque connexion recommence à zéro ;
 *  - le centre peut l'exiger : l'application se verrouille — sauf pour l'administrateur
 *    système, qui reste tracé mais ne peut pas être enfermé dehors.
 */
import type { NestExpressApplication } from '@nestjs/platform-express'
import { demarrerApp } from './support/app-test'
import { COMPTES, appelAnonyme, connecter, type Client } from './support/client'

interface EtatPosition {
  suivie: boolean
  statut: string | null
  obligatoire: boolean
  bloquant: boolean
}
interface Position {
  etat: string
  latitude: number | null
  longitude: number | null
  precisionM: number | null
}
interface Session {
  current: boolean
  position: Position | null
}
interface LigneJournal {
  login: string
  resultat: string
  connexionId: string | null
  position: Position | null
}

const PARAM = '/admin/parametres/auth.position_obligatoire'

describe("Position de l'appareil à la connexion web", () => {
  let app: NestExpressApplication
  let admin: Client
  let inf: Client

  const etat = async (c: Client) =>
    (await c.get<EtatPosition>('/me/position')).body
  const signaler = (c: Client, corps: object) =>
    c.post<{ ok: boolean; statut: string | null }>('/me/position', corps)
  const maSession = async (c: Client) =>
    (await c.get<Session[]>('/me/sessions')).body.find((x) => x.current)
  const journalDe = async (login: string) => {
    const r = await admin.get<{ data: LigneJournal[] }>(
      '/admin/audit/authentifications?limit=200',
    )
    return r.body.data.filter(
      (l) => l.login === login && l.resultat.startsWith('SUCCES_LOGIN'),
    )
  }

  beforeAll(async () => {
    app = await demarrerApp()
    admin = await connecter(app, COMPTES.admin)
    inf = await connecter(app, COMPTES.infirmier)
  })
  afterAll(async () => {
    await admin.post(`${PARAM}/reset`)
    await app.close()
  })

  it('une connexion fraîche n’a encore reçu aucune position', async () => {
    expect(await etat(inf)).toEqual({
      suivie: true,
      statut: null,
      obligatoire: false,
      bloquant: false,
    })
    expect((await maSession(inf))?.position).toMatchObject({
      etat: 'NON_RECUE',
      latitude: null,
    })
  })

  it('un refus est enregistré, puis corrigé quand la position est enfin donnée', async () => {
    expect((await signaler(inf, { statut: 'REFUSEE' })).body).toEqual({
      ok: true,
      statut: 'REFUSEE',
    })
    expect((await etat(inf)).statut).toBe('REFUSEE')
    expect((await maSession(inf))?.position?.etat).toBe('REFUSEE')

    const ok = await signaler(inf, {
      statut: 'OK',
      latitude: -4.2634,
      longitude: 15.2429,
      precisionM: 35,
    })
    expect(ok.body).toEqual({ ok: true, statut: 'OK' })
    expect((await maSession(inf))?.position).toMatchObject({
      etat: 'OK',
      latitude: -4.2634,
      longitude: 15.2429,
      precisionM: 35,
    })
  })

  it("une position relevée n'est jamais remplacée", async () => {
    const r = await signaler(inf, {
      statut: 'OK',
      latitude: 48.8566,
      longitude: 2.3522,
      precisionM: 5,
    })
    expect(r.body).toEqual({ ok: true, statut: 'OK' })
    const refus = await signaler(inf, { statut: 'REFUSEE' })
    expect(refus.body.statut).toBe('OK')
    expect((await maSession(inf))?.position).toMatchObject({
      latitude: -4.2634,
      longitude: 15.2429,
    })
  })

  it('le journal des connexions montre la position sur la ligne qui a ouvert la connexion', async () => {
    const lignes = await journalDe(COMPTES.infirmier.login)
    const derniere = lignes[0]
    expect(derniere.connexionId).toBeTruthy()
    expect(derniere.position).toMatchObject({
      etat: 'OK',
      latitude: -4.2634,
      longitude: 15.2429,
      precisionM: 35,
    })
  })

  it('les valeurs absurdes sont refusées', async () => {
    const autre = await connecter(app, COMPTES.infirmierSansDelegation)
    for (const corps of [
      { statut: 'OK' },
      { statut: 'OK', latitude: 120, longitude: 15, precisionM: 10 },
      { statut: 'OK', latitude: -4, longitude: 200, precisionM: 10 },
      { statut: 'OK', latitude: -4, longitude: 15, precisionM: -1 },
      { statut: 'PEUT-ETRE' },
      {},
    ])
      expect((await signaler(autre, corps)).status).toBe(400)
    expect((await etat(autre)).statut).toBeNull()
  })

  it("chaque connexion recommence à zéro, et l'ancienne garde sa position", async () => {
    const dejaVu = (await journalDe(COMPTES.infirmier.login)).length
    const neuve = await connecter(app, COMPTES.infirmier)
    expect((await etat(neuve)).statut).toBeNull()
    const lignes = await journalDe(COMPTES.infirmier.login)
    expect(lignes).toHaveLength(dejaVu + 1)
    expect(lignes[0].position?.etat).toBe('NON_RECUE')
    expect(lignes[1].position?.etat).toBe('OK')
  })

  it("exigée par le centre : l'application se verrouille, sauf pour l'administrateur système", async () => {
    expect((await admin.patch(PARAM, { valeur: 'true' })).status).toBe(200)
    const moi = await connecter(app, COMPTES.infirmierSansDelegation)
    expect(await etat(moi)).toMatchObject({
      obligatoire: true,
      bloquant: true,
      statut: null,
    })
    expect(await etat(admin)).toMatchObject({
      obligatoire: true,
      bloquant: false,
    })
    // Donner la position lève le verrou… sans changer l'exigence.
    await signaler(moi, {
      statut: 'OK',
      latitude: -4.3,
      longitude: 15.3,
      precisionM: 80,
    })
    expect((await etat(moi)).statut).toBe('OK')
    expect((await admin.post(`${PARAM}/reset`)).status).toBe(200)
    expect((await etat(moi)).obligatoire).toBe(false)
  })

  it('il faut être connecté', async () => {
    expect((await appelAnonyme(app, 'get', '/me/position')).status).toBe(401)
    expect(
      (await appelAnonyme(app, 'post', '/me/position', {}, { statut: 'OK' }))
        .status,
    ).toBe(401)
  })
})
