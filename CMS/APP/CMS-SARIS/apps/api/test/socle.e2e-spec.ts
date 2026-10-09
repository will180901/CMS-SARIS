/**
 * Socle de la suite de tests : prouve que les tests tournent sur la base de TEST, remise
 * à neuf et amorcée, avec l'API complète et les comptes du seed.
 */
import type { NestExpressApplication } from '@nestjs/platform-express'
import { baseDe, demarrerApp } from './support/app-test'
import { COMPTES, connecter } from './support/client'
import { NOM_BASE_TEST } from './support/base-test'

describe('Socle des tests', () => {
  let app: NestExpressApplication

  beforeAll(async () => {
    app = await demarrerApp()
  })
  afterAll(async () => {
    await app.close()
  })

  it('travaille sur la base de test, jamais sur celle de développement', async () => {
    const [{ base }] = await baseDe(app).$queryRawUnsafe<{ base: string }[]>(
      'SELECT current_database() AS base',
    )
    expect(base).toBe(NOM_BASE_TEST)
  })

  it("part d'une base migrée et amorcée (référentiels du seed)", async () => {
    const admin = await connecter(app, COMPTES.admin)
    type Categorie = { code: string }
    const r = await admin.get<Categorie[] | { data: Categorie[] }>(
      '/referentiels/categories-patient',
    )
    expect(r.status).toBe(200)
    const codes = (Array.isArray(r.body) ? r.body : r.body.data).map(
      (c) => c.code,
    )
    expect(codes).toEqual(
      expect.arrayContaining([
        'ASSURE_CDI',
        'AYANT_DROIT_CDI',
        'SOUS_TRAITANT',
        'PATIENT_EXTERNE',
      ]),
    )
  })

  it('connecte les comptes de démonstration des trois rôles', async () => {
    for (const compte of Object.values(COMPTES)) {
      const c = await connecter(app, compte)
      expect(c.user.login).toBe(compte.login)
    }
  })

  it("n'est pas freinée par le limiteur de connexions (plus de 10 connexions par minute)", async () => {
    for (let i = 0; i < 12; i++) await connecter(app, COMPTES.admin)
  })
})
