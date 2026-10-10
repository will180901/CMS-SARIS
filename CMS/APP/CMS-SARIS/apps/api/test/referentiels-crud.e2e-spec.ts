/**
 * La pile complète sur un référentiel et sur le dossier patient (chantier 7, étape 6 —
 * reprise des anciens tests d'intégration `crud-integration` et `soft-delete-revive`,
 * qui tapaient la base de DÉVELOPPEMENT avec des mots de passe écrits en dur).
 *
 * Contrôleur → jeton et droits → validation → service → base, sur la base de test :
 *  - création, lecture, modification, désactivation, suppression ;
 *  - une saisie invalide est refusée (400), un code déjà pris aussi (409) ;
 *  - un code supprimé peut être recréé : la ligne supprimée est « ressuscitée » avec ses
 *    nouvelles données (avant : collision de clé unique → erreur 500) ;
 *  - un dossier patient se crée, se lit, se modifie et se supprime.
 */
import type { NestExpressApplication } from '@nestjs/platform-express'
import { demarrerApp } from './support/app-test'
import { COMPTES, appelAnonyme, connecter, type Client } from './support/client'
import { referentiels } from './support/donnees'

interface Pathologie {
  id: string
  code: string
  libelle: string
  chronique: boolean
  statut: string
}
type Liste<T> = T[] | { data: T[] }
const elements = <T>(corps: Liste<T>): T[] =>
  Array.isArray(corps) ? corps : corps.data

describe('CRUD de bout en bout : référentiel et dossier patient', () => {
  let app: NestExpressApplication
  let admin: Client
  const s = `${Date.now() % 100_000}`
  const URL = '/referentiels/pathologies'

  const chercher = async (code: string) =>
    elements(
      (await admin.get<Liste<Pathologie>>(`${URL}?search=${code}`)).body,
    ).filter((p) => p.code === code)

  beforeAll(async () => {
    app = await demarrerApp()
    admin = await connecter(app, COMPTES.admin)
  })
  afterAll(async () => {
    await app.close()
  })

  it('sans jeton, rien ne se lit ni ne s’écrit (401)', async () => {
    expect((await appelAnonyme(app, 'get', URL)).status).toBe(401)
    expect((await appelAnonyme(app, 'post', URL)).status).toBe(401)
  })

  it('une pathologie : création, lecture, modification, désactivation, suppression', async () => {
    const code = `IT${s}`
    const cree = await admin.post<Pathologie>(URL, {
      code,
      libelle: 'Test CRUD',
      chronique: false,
    })
    expect(cree.status).toBe(201)
    const id = cree.body.id
    expect((await chercher(code)).map((p) => p.id)).toEqual([id])

    const modifiee = await admin.patch<Pathologie>(`${URL}/${id}`, {
      libelle: 'Test CRUD modifié',
    })
    expect(modifiee.status).toBe(200)
    expect(modifiee.body.libelle).toBe('Test CRUD modifié')

    expect(
      (await admin.patch(`${URL}/${id}/statut`, { statut: 'INACTIF' })).status,
    ).toBe(200)
    // Le serveur accepte ACTIF/INACTIF et les range sous la forme des référentiels.
    expect((await chercher(code))[0]?.statut).toBe('INACTIVE')

    expect((await admin.delete(`${URL}/${id}`)).status).toBe(200)
    expect(await chercher(code)).toEqual([])
  })

  it('une saisie invalide (400) ou un code déjà pris (409) est refusé', async () => {
    expect((await admin.post(URL, { libelle: 'Sans code' })).status).toBe(400)
    const code = `DUP${s}`
    expect(
      (await admin.post(URL, { code, libelle: 'Premier', chronique: false }))
        .status,
    ).toBe(201)
    expect(
      (await admin.post(URL, { code, libelle: 'Second', chronique: false }))
        .status,
    ).toBe(409)
  })

  it('un code supprimé se recrée : la ligne revit avec ses nouvelles données', async () => {
    const code = `REV${s}`
    const premier = await admin.post<Pathologie>(URL, {
      code,
      libelle: 'Avant',
      chronique: false,
    })
    expect(premier.status).toBe(201)
    expect((await admin.delete(`${URL}/${premier.body.id}`)).status).toBe(200)
    expect(await chercher(code)).toEqual([])

    const recree = await admin.post<Pathologie>(URL, {
      code,
      libelle: 'Après',
      chronique: true,
    })
    expect(recree.status).toBe(201)
    expect(await chercher(code)).toEqual([
      expect.objectContaining({
        code,
        libelle: 'Après',
        chronique: true,
        statut: 'ACTIVE',
      }),
    ])
  })

  it('un dossier patient : création, lecture, modification, suppression', async () => {
    const ref = await referentiels(admin)
    const cree = await admin.post<{ id: string }>('/patients', {
      nom: `CRUD${s}`,
      prenom: 'Patient',
      dateNaissance: '1990-01-01',
      sexe: 'M',
      categoriePatientId: ref.categories['PATIENT_EXTERNE'],
      siteCreationId: ref.siteId,
    })
    expect(cree.status).toBe(201)
    const url = `/patients/${cree.body.id}`
    const lu = await admin.get<{ identite: { nom: string } }>(url)
    expect(lu.body.identite.nom).toBe(`CRUD${s}`)

    expect(
      (await admin.patch(`${url}/identite`, { nom: `CRUDMOD${s}` })).status,
    ).toBe(200)
    expect(
      (await admin.get<{ identite: { nom: string } }>(url)).body.identite.nom,
    ).toBe(`CRUDMOD${s}`)

    expect((await admin.delete(url)).status).toBe(200)
    expect((await admin.get(url)).status).toBe(404)
  })
})
