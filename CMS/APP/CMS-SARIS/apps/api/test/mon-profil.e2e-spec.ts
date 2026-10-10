/**
 * « Mon profil » (décision du 2026-10-09) : chacun change lui-même son nom, son prénom
 * (ceux de sa fiche du personnel, repris partout) et son e-mail. Identifiant, rôles,
 * matricule et site restent du ressort de l'administrateur.
 */
import type { NestExpressApplication } from '@nestjs/platform-express'
import { demarrerApp } from './support/app-test'
import { COMPTES, appelAnonyme, connecter, type Client } from './support/client'

interface Profil {
  login: string
  email: string
  aUneFiche: boolean
  nom: string | null
  prenom: string | null
  matricule: string | null
  fonction: string | null
  roles: string[]
  site: string | null
}

describe('Mon profil', () => {
  let app: NestExpressApplication
  let inf: Client
  let admin: Client
  let avant: Profil
  let avantAdmin: Profil

  beforeAll(async () => {
    app = await demarrerApp()
    inf = await connecter(app, COMPTES.infirmierSansDelegation)
    admin = await connecter(app, COMPTES.admin)
    avant = (await inf.get<Profil>('/me/profil')).body
    avantAdmin = (await admin.get<Profil>('/me/profil')).body
  })
  afterAll(async () => {
    // Les comptes du seed servent aux autres fichiers de test : on les rend intacts.
    await inf.patch('/me/profil', {
      nom: avant.nom,
      prenom: avant.prenom,
      email: avant.email,
    })
    await admin.patch('/me/profil', { email: avantAdmin.email })
    await app.close()
  })

  it('affiche son identité, sa fiche et ce que gère l’administrateur', () => {
    expect(avant).toMatchObject({
      login: COMPTES.infirmierSansDelegation.login,
      aUneFiche: true,
      fonction: 'INFIRMIER',
    })
    expect(avant.nom).toBeTruthy()
    expect(avant.matricule).toBeTruthy()
    expect(avant.roles.length).toBeGreaterThan(0)
    expect(avant.site).toBeTruthy()
  })

  it('changer son nom, son prénom et son e-mail met à jour sa fiche du personnel', async () => {
    const r = await inf.patch<Profil>('/me/profil', {
      nom: '  NOUVEAUNOM ',
      prenom: 'Nouveau',
      email: 'Profil.Test@Cms-Saris.cg',
    })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({
      nom: 'NOUVEAUNOM',
      prenom: 'Nouveau',
      email: 'profil.test@cms-saris.cg',
      login: avant.login,
      matricule: avant.matricule,
    })
    const annuaire =
      await admin.get<{ nom: string; prenom: string | null }[]>('/me/annuaire')
    expect(annuaire.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ nom: 'NOUVEAUNOM', prenom: 'Nouveau' }),
      ]),
    )
  })

  it("l'identifiant, le matricule et les rôles ne se changent pas ici", async () => {
    const r = await inf.patch<Profil>('/me/profil', {
      login: 'pirate',
      matricule: 'X-1',
      roles: ['ADMIN_SYSTEME'],
    })
    expect([200, 400]).toContain(r.status)
    const apres = (await inf.get<Profil>('/me/profil')).body
    expect(apres).toMatchObject({
      login: avant.login,
      matricule: avant.matricule,
      roles: avant.roles,
    })
  })

  it('un e-mail déjà pris ou mal formé est refusé', async () => {
    expect(
      (await inf.patch('/me/profil', { email: avantAdmin.email })).status,
    ).toBe(409)
    expect(
      (await inf.patch('/me/profil', { email: 'pas-un-email' })).status,
    ).toBe(400)
    expect((await inf.patch('/me/profil', { nom: 'X' })).status).toBe(400)
  })

  it("sans fiche du personnel, le nom ne se change pas, l'e-mail si", async () => {
    expect(avantAdmin.aUneFiche).toBe(false)
    expect((await admin.patch('/me/profil', { nom: 'ADMIN' })).status).toBe(400)
    const r = await admin.patch<Profil>('/me/profil', {
      email: 'admin.profil@cms-saris.cg',
    })
    expect(r.status).toBe(200)
    expect(r.body.email).toBe('admin.profil@cms-saris.cg')
  })

  it('il faut être connecté', async () => {
    expect((await appelAnonyme(app, 'get', '/me/profil')).status).toBe(401)
  })
})
