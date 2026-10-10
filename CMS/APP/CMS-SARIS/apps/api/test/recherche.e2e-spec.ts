/**
 * La recherche d'une personne par son NOM COMPLET.
 *
 * Avant, la saisie entière devait tenir dans un seul champ : « Prénom Nom » ne trouvait
 * personne (« Aucun patient trouvé » devant un patient qui existe). Désormais chaque mot
 * doit se retrouver dans le nom, le prénom, le matricule ou le numéro, dans n'importe
 * quel ordre — à l'accueil, dans la liste des patients, la liste du personnel et celle des
 * comptes.
 */
import type { NestExpressApplication } from '@nestjs/platform-express'
import { demarrerApp } from './support/app-test'
import { COMPTES, connecter, type Client } from './support/client'
import { referentiels, type Referentiels } from './support/donnees'

describe('Recherche par nom complet', () => {
  let app: NestExpressApplication
  let admin: Client
  let inf: Client
  let ref: Referentiels
  const s = `${Date.now() % 100_000}`
  const nom = `LOUBAKI${s}`
  let patientId: string
  let numeroPatient: string

  const q = (chemin: string, recherche: string) =>
    `${chemin}?search=${encodeURIComponent(recherche)}`
  const idsPatients = async (recherche: string) =>
    (await inf.get<{ id: string }[]>(q('/patients', recherche))).body.map(
      (p) => p.id,
    )
  const idsPersonnel = async (chemin: string, recherche: string) =>
    (await admin.get<{ id: string }[]>(q(chemin, recherche))).body.map(
      (p) => p.id,
    )

  beforeAll(async () => {
    app = await demarrerApp()
    admin = await connecter(app, COMPTES.admin)
    inf = await connecter(app, COMPTES.infirmier)
    ref = await referentiels(inf)
    const r = await inf.post<{ id: string; numeroPatient: string }>(
      '/patients',
      {
        nom,
        prenom: 'Marie-Claire',
        dateNaissance: '1990-01-01',
        sexe: 'F',
        categoriePatientId: ref.categories['PATIENT_EXTERNE'],
        siteCreationId: ref.siteId,
      },
    )
    expect(r.status).toBe(201)
    patientId = r.body.id
    numeroPatient = r.body.numeroPatient
  })
  afterAll(async () => {
    await app.close()
  })

  it('un patient se trouve par son nom complet, dans les deux ordres', async () => {
    for (const saisie of [
      `Marie-Claire ${nom}`,
      `${nom} Marie-Claire`,
      `marie ${nom.toLowerCase()}`,
      `  ${nom}   claire  `,
    ])
      expect(await idsPatients(saisie)).toContain(patientId)
  })

  it('un seul mot, le numéro ou une partie du nom marchent comme avant', async () => {
    for (const saisie of [nom, 'Marie-Claire', numeroPatient, nom.slice(0, 8)])
      expect(await idsPatients(saisie)).toContain(patientId)
  })

  it('tous les mots doivent correspondre : un mot étranger ne trouve rien', async () => {
    expect(await idsPatients(`${nom} Inconnu`)).not.toContain(patientId)
    expect(await idsPatients(`Zzzz ${nom}`)).not.toContain(patientId)
  })

  it('sans saisie (ou que des espaces), la liste est complète, comme sans filtre', async () => {
    const tous = (await inf.get<{ id: string }[]>('/patients')).body.length
    expect((await idsPatients('   ')).length).toBe(tous)
  })

  it("à l'accueil, le personnel sans dossier se trouve par son nom complet ou matricule + nom", async () => {
    const r = await admin.post<{ id: string }>('/personnel', {
      matricule: `RC-${s}`,
      nom: `MAKOSSO${s}`,
      prenom: 'Jean-Pierre',
      role: 'INFIRMIER',
    })
    expect(r.status).toBe(201)
    for (const saisie of [
      `Jean-Pierre MAKOSSO${s}`,
      `makosso${s} jean`,
      `RC-${s} MAKOSSO${s}`,
    ]) {
      const trouves = await inf.get<{ id: string }[]>(
        q('/patients/personnel-sans-dossier', saisie),
      )
      expect(trouves.body.map((p) => p.id)).toEqual([r.body.id])
    }
    // La liste du personnel (écran Accès & habilitations) suit la même règle.
    expect(await idsPersonnel('/personnel', `Jean-Pierre MAKOSSO${s}`)).toEqual(
      [r.body.id],
    )
  })

  it('la liste des comptes cherche aussi par nom complet', async () => {
    interface Compte {
      id: string
      personnelMedical?: { nom: string; prenom: string } | null
    }
    const liste = await admin.get<Compte[] | { data: Compte[] }>(
      '/admin/utilisateurs',
    )
    const comptes = Array.isArray(liste.body) ? liste.body : liste.body.data
    const avecFiche = comptes.find((u) => u.personnelMedical)
    expect(avecFiche).toBeDefined()
    const { nom: n, prenom: p } = avecFiche?.personnelMedical ?? {
      nom: '',
      prenom: '',
    }
    const trouves = await admin.get<Compte[] | { data: Compte[] }>(
      q('/admin/utilisateurs', `${p} ${n}`),
    )
    const ids = (
      Array.isArray(trouves.body) ? trouves.body : trouves.body.data
    ).map((u) => u.id)
    expect(ids).toContain(avecFiche?.id)
  })
})
