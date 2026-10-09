/**
 * Fiche du personnel = fiche d'employé de la SARIS (décision du 2026-10-09).
 *
 * Employé = personnel = utilisateur. Sa fiche porte, en plus de son identité et de sa
 * fonction, ce qu'il faudra pour ouvrir son dossier patient sans ressaisie le jour où il
 * passe à l'accueil : naissance, sexe, contrat, section de paie, service, département.
 */
import type { NestExpressApplication } from '@nestjs/platform-express'
import { demarrerApp } from './support/app-test'
import { COMPTES, connecter, type Client } from './support/client'

interface Fiche {
  id: string
  matricule: string
  role: string
  dateNaissance: string | null
  sexe: string | null
  typeContrat: string
  sectionPaie: string | null
  service: string
  departement: string | null
}

describe("Fiche du personnel : données d'employé de la SARIS", () => {
  let app: NestExpressApplication
  let admin: Client
  const suffixe = `${Date.now() % 100_000}`
  let id: string

  beforeAll(async () => {
    app = await demarrerApp()
    admin = await connecter(app, COMPTES.admin)
  })
  afterAll(async () => {
    await app.close()
  })

  it("l'enregistrement d'une personne garde ses données d'employé", async () => {
    const r = await admin.post<Fiche>('/personnel', {
      matricule: `EMP-${suffixe}`,
      nom: 'FICHE',
      prenom: 'Complete',
      role: 'INFIRMIER',
      dateNaissance: '1988-04-12',
      sexe: 'F',
      typeContrat: 'CDD',
      sectionPaie: 'S3',
      service: 'Pédiatrie',
      departement: 'Santé',
    })
    expect(r.status).toBe(201)
    id = r.body.id
    expect(r.body).toMatchObject({
      sexe: 'F',
      typeContrat: 'CDD',
      sectionPaie: 'S3',
      service: 'Pédiatrie',
      departement: 'Santé',
    })
    expect(r.body.dateNaissance?.slice(0, 10)).toBe('1988-04-12')
  })

  it('sans précision, une personne est en CDI au Centre Médico-Sanitaire', async () => {
    const r = await admin.post<Fiche>('/personnel', {
      matricule: `MIN-${suffixe}`,
      nom: 'FICHE',
      prenom: 'Minimale',
      role: 'MEDECIN',
      service: '   ',
    })
    expect(r.status).toBe(201)
    expect(r.body).toMatchObject({
      typeContrat: 'CDI',
      service: 'Centre Médico-Sanitaire',
      dateNaissance: null,
      sexe: null,
    })
  })

  it('la fiche se modifie, et un champ vidé est effacé', async () => {
    const r = await admin.patch<Fiche>(`/personnel/${id}`, {
      departement: '',
      sexe: null,
      dateNaissance: null,
      typeContrat: 'CDI',
    })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({
      departement: null,
      sexe: null,
      dateNaissance: null,
      typeContrat: 'CDI',
      sectionPaie: 'S3',
    })
  })

  it('une saisie incohérente est refusée', async () => {
    const base = { nom: 'FICHE', prenom: 'Refusee', role: 'INFIRMIER' }
    const futur = new Date(Date.now() + 86_400_000 * 30).toISOString()
    const cas = [
      { ...base, matricule: `F1-${suffixe}`, dateNaissance: futur },
      { ...base, matricule: `F2-${suffixe}`, typeContrat: 'STAGE' },
      { ...base, matricule: `F3-${suffixe}`, sexe: 'X' },
      { ...base, matricule: `F4-${suffixe}`, dateNaissance: 'hier' },
    ]
    for (const corps of cas)
      expect((await admin.post('/personnel', corps)).status).toBe(400)
  })
})
