/**
 * Employé = personnel = utilisateur : jamais de doublon, jamais de ressaisie (plan du
 * 2026-10-09, étape 6). Les cas qui traversent les étapes : la fiche du personnel reste
 * la source de l'identité d'un membre du centre, quel que soit le chemin par lequel son
 * dossier patient s'ouvre — lui-même à l'accueil, son ayant droit, ou une correction de
 * son matricule.
 */
import type { NestExpressApplication } from '@nestjs/platform-express'
import { demarrerApp } from './support/app-test'
import { COMPTES, connecter, type Client } from './support/client'
import { referentiels, type Referentiels } from './support/donnees'

interface Dossier {
  id: string
  numeroPatient: string
  matricule: string | null
  categoriePatient: { code: string }
  identite: { nom: string; prenom: string; sexe: string | null } | null
  donneesEmploi: { fonction: string | null; sectionPaie: string | null } | null
  rattachementsAD?: { cdiId: string | null }[]
}

describe('Employés du centre : jamais de doublon, jamais de ressaisie', () => {
  let app: NestExpressApplication
  let admin: Client
  let inf: Client
  let ref: Referentiels
  const s = `${Date.now() % 100_000}`

  const enregistrer = async (corps: object) => {
    const r = await admin.post<{ id: string }>('/personnel', {
      role: 'INFIRMIER',
      dateNaissance: '1982-06-14',
      sexe: 'F',
      sectionPaie: 'S2',
      departement: 'Santé',
      ...corps,
    })
    expect(r.status).toBe(201)
    return r.body.id
  }
  const dossierDu = (matricule: string) =>
    inf.get<Dossier>(`/patients/by-matricule/${encodeURIComponent(matricule)}`)
  const sansDossier = async (q: string) =>
    (
      await inf.get<{ id: string }[]>(
        `/patients/personnel-sans-dossier?search=${encodeURIComponent(q)}`,
      )
    ).body
  const ayantDroit = (cdiMatricule: string, extra: object = {}) =>
    inf.post<{ id: string }>('/patients', {
      nom: `ENFANT${s}`,
      prenom: 'Petit',
      dateNaissance: '2015-01-01',
      sexe: 'M',
      siteCreationId: ref.siteId,
      categoriePatientId: ref.categories['AYANT_DROIT_CDI'],
      fonction: 'Élève',
      cdiMatricule,
      typeLien: 'ENFANT',
      ...extra,
    })
  const ouvrir = (id: string) =>
    inf.post<{ id: string; cree: boolean }>(
      `/patients/depuis-personnel/${id}`,
      {
        siteCreationId: ref.siteId,
      },
    )

  beforeAll(async () => {
    app = await demarrerApp()
    admin = await connecter(app, COMPTES.admin)
    inf = await connecter(app, COMPTES.infirmier)
    ref = await referentiels(inf)
  })
  afterAll(async () => {
    await app.close()
  })

  describe("ayant droit d'un membre du personnel qui n'a jamais consulté", () => {
    it('son dossier s’ouvre depuis SA FICHE, sans retaper son identité', async () => {
      const id = await enregistrer({
        matricule: `ED-A-${s}`,
        nom: `PARENT${s}`,
        prenom: 'Fiche',
      })
      const r = await ayantDroit(`ED-A-${s}`)
      expect(r.status).toBe(201)

      const travailleur = await dossierDu(`ED-A-${s}`)
      expect(travailleur.status).toBe(200)
      const complet = await inf.get<Dossier>(`/patients/${travailleur.body.id}`)
      expect(complet.body).toMatchObject({
        categoriePatient: { code: 'ASSURE_CDI' },
        identite: { nom: `PARENT${s}`, prenom: 'Fiche', sexe: 'F' },
        donneesEmploi: { fonction: 'Infirmier', sectionPaie: 'S2' },
      })
      const enfant = await inf.get<Dossier>(`/patients/${r.body.id}`)
      expect(enfant.body.rattachementsAD?.[0]?.cdiId).toBe(travailleur.body.id)

      // Il n'est plus « sans dossier », et le rouvrir reprend le même.
      expect(await sansDossier(`PARENT${s}`)).toEqual([])
      expect((await ouvrir(id)).body).toEqual({
        id: travailleur.body.id,
        cree: false,
      })
    })

    it('une identité retapée différemment à l’accueil ne remplace pas la fiche', async () => {
      await enregistrer({
        matricule: `ED-B-${s}`,
        nom: `VRAI${s}`,
        prenom: 'Nom',
      })
      const r = await ayantDroit(`ED-B-${s}`, {
        nouveauTravailleur: { nom: 'FAUTE', prenom: 'Defrappe' },
      })
      expect(r.status).toBe(201)
      expect((await dossierDu(`ED-B-${s}`)).body.identite).toMatchObject({
        nom: `VRAI${s}`,
        prenom: 'Nom',
      })
    })

    it('un membre du personnel en CDD ne peut pas avoir d’ayant droit', async () => {
      await enregistrer({
        matricule: `ED-C-${s}`,
        nom: `CDD${s}`,
        prenom: 'Contrat',
        typeContrat: 'CDD',
      })
      const r = await ayantDroit(`ED-C-${s}`, {
        nouveauTravailleur: { nom: `CDD${s}`, prenom: 'Contrat' },
      })
      expect(r.status).toBe(409)
      expect((await dossierDu(`ED-C-${s}`)).status).toBe(404)
    })
  })

  describe('matricule corrigé sur la fiche', () => {
    it('le dossier déjà ouvert suit : aucun second dossier possible', async () => {
      const id = await enregistrer({
        matricule: `ED-D-${s}`,
        nom: `CORRIGE${s}`,
        prenom: 'Matricule',
      })
      const premier = await ouvrir(id)
      expect(premier.body.cree).toBe(true)

      const r = await admin.patch(`/personnel/${id}`, {
        matricule: `ED-D2-${s}`,
      })
      expect(r.status).toBe(200)
      expect((await dossierDu(`ED-D2-${s}`)).body.id).toBe(premier.body.id)
      expect((await dossierDu(`ED-D-${s}`)).status).toBe(404)
      expect(await sansDossier(`CORRIGE${s}`)).toEqual([])
      expect((await ouvrir(id)).body).toEqual({
        id: premier.body.id,
        cree: false,
      })
    })

    it('deux dossiers ne se fondent pas en un par une correction de matricule', async () => {
      const a = await enregistrer({
        matricule: `ED-E-${s}`,
        nom: `UN${s}`,
        prenom: 'A',
      })
      await ouvrir(a)
      // Un travailleur de la SARIS hors du centre, avec son propre dossier.
      const travailleur = await inf.post('/patients', {
        nom: `DEUX${s}`,
        prenom: 'B',
        dateNaissance: '1975-03-03',
        sexe: 'M',
        siteCreationId: ref.siteId,
        categoriePatientId: ref.categories['ASSURE_CDI'],
        matricule: `ED-F-${s}`,
        fonction: 'Soudeur',
        sectionPaie: 'S9',
        service: 'Atelier',
        departement: 'Usine',
      })
      expect(travailleur.status).toBe(201)
      const r = await admin.patch(`/personnel/${a}`, { matricule: `ED-F-${s}` })
      expect(r.status).toBe(409)
      expect((await dossierDu(`ED-E-${s}`)).status).toBe(200)
      expect((await dossierDu(`ED-F-${s}`)).body.identite?.nom).toBe(`DEUX${s}`)
    })

    it('une fiche sans dossier peut prendre le matricule d’un dossier existant (c’est le sien)', async () => {
      const dossier = await inf.post<{ id: string }>('/patients', {
        nom: `ANCIEN${s}`,
        prenom: 'Dossier',
        dateNaissance: '1970-09-09',
        sexe: 'F',
        siteCreationId: ref.siteId,
        categoriePatientId: ref.categories['ASSURE_CDI'],
        matricule: `ED-H-${s}`,
        fonction: 'Infirmier',
        sectionPaie: 'S2',
        service: 'Centre Médico-Sanitaire',
        departement: 'Santé',
      })
      expect(dossier.status).toBe(201)
      const id = await enregistrer({
        matricule: `ED-H0-${s}`,
        nom: `ANCIEN${s}`,
        prenom: 'Dossier',
      })
      expect(
        (await admin.patch(`/personnel/${id}`, { matricule: `ED-H-${s}` }))
          .status,
      ).toBe(200)
      expect(await sansDossier(`ANCIEN${s}`)).toEqual([])
      expect((await ouvrir(id)).body).toEqual({
        id: dossier.body.id,
        cree: false,
      })
    })
  })

  it("« Créer un dossier » à la main avec le matricule d'un membre du personnel est refusé", async () => {
    await enregistrer({
      matricule: `ED-G-${s}`,
      nom: `MAIN${s}`,
      prenom: 'Saisie',
    })
    const r = await inf.post<{ message?: string }>('/patients', {
      nom: 'AUTRE',
      prenom: 'Orthographe',
      dateNaissance: '1982-06-14',
      sexe: 'F',
      siteCreationId: ref.siteId,
      categoriePatientId: ref.categories['ASSURE_CDI'],
      matricule: `ED-G-${s}`,
      fonction: 'Infirmier',
      sectionPaie: 'S2',
      service: 'Centre Médico-Sanitaire',
      departement: 'Santé',
    })
    expect(r.status).toBe(409)
    expect(JSON.stringify(r.body)).toContain(`MAIN${s}`)
    expect((await dossierDu(`ED-G-${s}`)).status).toBe(404)
    expect(await sansDossier(`MAIN${s}`)).toHaveLength(1)
  })
})
