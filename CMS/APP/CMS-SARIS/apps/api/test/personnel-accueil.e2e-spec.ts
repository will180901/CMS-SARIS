/**
 * Le personnel du centre à l'accueil (décision du 2026-10-09).
 *
 * Employé = personnel = utilisateur. Enregistrer une personne n'ouvre PAS de dossier
 * patient : il s'ouvre la première fois qu'elle passe à l'accueil, à partir de sa fiche,
 * sans ressaisie. Ce qui manque à sa fiche est complété une fois et gardé. Et jamais
 * deux dossiers pour la même personne, même ouverts au même instant.
 */
import type { NestExpressApplication } from '@nestjs/platform-express'
import { demarrerApp } from './support/app-test'
import { COMPTES, connecter, type Client } from './support/client'
import { referentiels, type Referentiels } from './support/donnees'

interface SansDossier {
  id: string
  nom: string
  matricule: string
  fonction: string
  typeContrat: string
  manquants: string[]
}
interface Dossier {
  id: string
  matricule: string | null
  categoriePatient: { code: string }
  identite: { nom: string; prenom: string; dateNaissance: string | null; sexe: string | null }
  donneesEmploi: {
    fonction: string | null
    sectionPaie: string | null
    service: string | null
    departement: string | null
  } | null
}

describe("Personnel du centre : son dossier s'ouvre à l'accueil, depuis sa fiche", () => {
  let app: NestExpressApplication
  let admin: Client
  let inf: Client
  let ref: Referentiels
  const suffixe = `${Date.now() % 100_000}`
  const nomComplet = `ACCUEIL${suffixe}`
  let completId: string

  const enregistrer = async (corps: object) => {
    const r = await admin.post<{ id: string }>('/personnel', corps)
    expect(r.status).toBe(201)
    return r.body.id
  }
  const chercher = async (q: string) => {
    const r = await inf.get<SansDossier[]>(
      `/patients/personnel-sans-dossier?search=${encodeURIComponent(q)}`,
    )
    expect(r.status).toBe(200)
    return r.body
  }
  const ouvrir = (id: string, corps: object = {}) =>
    inf.post<{ id: string; cree: boolean }>(`/patients/depuis-personnel/${id}`, {
      siteCreationId: ref.siteId,
      ...corps,
    })

  beforeAll(async () => {
    app = await demarrerApp()
    admin = await connecter(app, COMPTES.admin)
    inf = await connecter(app, COMPTES.infirmier)
    ref = await referentiels(inf)
    completId = await enregistrer({
      matricule: `PA-${suffixe}`,
      nom: nomComplet,
      prenom: 'Complete',
      role: 'INFIRMIER',
      dateNaissance: '1985-02-20',
      sexe: 'M',
      sectionPaie: 'S4',
      departement: 'Santé',
    })
  })
  afterAll(async () => {
    await app.close()
  })

  it("enregistrer une personne n'ouvre pas de dossier patient", async () => {
    const r = await inf.get(`/patients/by-matricule/PA-${suffixe}`)
    expect(r.status).toBe(404)
  })

  it("l'accueil la retrouve par son nom ou son matricule, sans dossier", async () => {
    for (const q of [nomComplet.toLowerCase(), `PA-${suffixe}`]) {
      const trouves = await chercher(q)
      expect(trouves).toEqual([
        expect.objectContaining({
          id: completId,
          fonction: 'Infirmier',
          typeContrat: 'CDI',
          manquants: [],
        }),
      ])
    }
  })

  it('son dossier s’ouvre depuis sa fiche, sans rien ressaisir', async () => {
    const r = await ouvrir(completId)
    expect(r.status).toBe(200)
    expect(r.body.cree).toBe(true)
    const d = await inf.get<Dossier>(`/patients/${r.body.id}`)
    expect(d.body).toMatchObject({
      matricule: `PA-${suffixe}`,
      categoriePatient: { code: 'ASSURE_CDI' },
      identite: { nom: nomComplet, prenom: 'Complete', sexe: 'M' },
      donneesEmploi: {
        fonction: 'Infirmier',
        sectionPaie: 'S4',
        service: 'Centre Médico-Sanitaire',
        departement: 'Santé',
      },
    })
    expect(d.body.identite.dateNaissance?.slice(0, 10)).toBe('1985-02-20')
  })

  it('jamais de second dossier : il est repris, et la personne sort des « sans dossier »', async () => {
    const premier = await inf.get<{ id: string }>(`/patients/by-matricule/PA-${suffixe}`)
    const r = await ouvrir(completId)
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ id: premier.body.id, cree: false })
    expect(await chercher(nomComplet)).toEqual([])
    const patients = await inf.get<{ id: string }[]>(
      `/patients?search=${encodeURIComponent(nomComplet)}`,
    )
    expect(patients.body).toHaveLength(1)
  })

  it('deux postes qui l’ouvrent au même instant obtiennent le MÊME dossier', async () => {
    const id = await enregistrer({
      matricule: `PB-${suffixe}`,
      nom: `SIMULT${suffixe}`,
      prenom: 'Deux',
      role: 'MEDECIN',
      dateNaissance: '1979-11-03',
      sexe: 'F',
      sectionPaie: 'S1',
      departement: 'Santé',
    })
    const [a, b] = await Promise.all([ouvrir(id), ouvrir(id)])
    expect([a.status, b.status]).toEqual([200, 200])
    expect(a.body.id).toBe(b.body.id)
    expect([a.body.cree, b.body.cree].filter(Boolean)).toHaveLength(1)
    const patients = await inf.get<{ id: string }[]>(`/patients?search=SIMULT${suffixe}`)
    expect(patients.body).toHaveLength(1)
  })

  it('fiche incomplète : l’accueil complète ce qui manque, et la fiche le garde', async () => {
    const id = await enregistrer({
      matricule: `PC-${suffixe}`,
      nom: `INCOMPLET${suffixe}`,
      prenom: 'Trois',
      role: 'INFIRMIER',
      typeContrat: 'CDD',
    })
    const [trouve] = await chercher(`INCOMPLET${suffixe}`)
    expect(trouve.manquants.sort()).toEqual(
      ['dateNaissance', 'departement', 'sectionPaie', 'sexe'].sort(),
    )

    const refus = await ouvrir(id)
    expect(refus.status).toBe(400)
    expect(JSON.stringify(refus.body)).toContain('date de naissance')

    const r = await ouvrir(id, {
      dateNaissance: '1995-07-09',
      sexe: 'F',
      sectionPaie: 'S7',
      departement: 'Logistique',
    })
    expect(r.status).toBe(200)
    const d = await inf.get<Dossier>(`/patients/${r.body.id}`)
    expect(d.body.categoriePatient.code).toBe('ASSURE_CDD')
    expect(d.body.donneesEmploi).toMatchObject({ sectionPaie: 'S7', departement: 'Logistique' })

    const fiche = await admin.get<{
      dateNaissance: string | null
      sexe: string | null
      sectionPaie: string | null
      departement: string | null
    }>(`/personnel/${id}`)
    expect(fiche.body).toMatchObject({ sexe: 'F', sectionPaie: 'S7', departement: 'Logistique' })
    expect(fiche.body.dateNaissance?.slice(0, 10)).toBe('1995-07-09')
  })

  it("une personne désactivée n'est pas proposée à l'accueil", async () => {
    const id = await enregistrer({
      matricule: `PD-${suffixe}`,
      nom: `PARTI${suffixe}`,
      prenom: 'Quatre',
      role: 'INFIRMIER',
    })
    expect((await admin.patch(`/personnel/${id}/statut`, { statut: 'INACTIF' })).status).toBe(200)
    expect(await chercher(`PARTI${suffixe}`)).toEqual([])
  })
})
