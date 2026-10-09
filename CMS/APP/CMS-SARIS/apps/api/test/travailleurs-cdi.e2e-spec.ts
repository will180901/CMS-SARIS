/**
 * Travailleurs CDI sans registre des employés (décision du 2026-10-09).
 *
 * Un travailleur de la SARIS qui vient se soigner est un PATIENT : il se reconnaît à son
 * dossier (matricule), pas à une fiche de registre. Ses ayants droit sont rattachés à ce
 * dossier ; s'il n'en a pas encore, il est créé avec l'ayant droit. Le matricule d'un
 * dossier existant ne peut pas servir à en créer un second.
 *
 * + deux garde-fous techniques liés : la synchronisation ignore une colonne disparue
 * (poste resté en ancienne version), et la mise à niveau d'un poste voit qu'une colonne
 * retirée par une migration est encore là.
 */
import type { NestExpressApplication } from '@nestjs/platform-express'
import { demarrerApp } from './support/app-test'
import { COMPTES, connecter, type Client } from './support/client'
import { referentiels, type Referentiels } from './support/donnees'
import { colonnesConnues } from '../src/modules/sync/sync.service'
import {
  attentesDeMigration,
  etatFinal,
} from '../src/prisma/mise-a-niveau-locale'

interface Dossier {
  id: string
  numeroPatient: string
  matricule: string | null
  statut?: string
  categoriePatient: { code: string }
  donneesEmploi?: { fonction: string | null; service: string | null } | null
  rattachementsAD?: {
    cdiId: string | null
    statut: string
    cdi: { nom: string; prenom: string; patientId?: string | null } | null
  }[]
}

describe('Travailleurs CDI : le dossier fait foi (plus de registre)', () => {
  let app: NestExpressApplication
  let inf: Client
  let med: Client
  let ref: Referentiels
  const suffixe = `${Date.now() % 100_000}`
  const matCdi = `CDI-${suffixe}`
  const matInconnu = `NEW-${suffixe}`
  let cdiId: string

  const creer = (corps: object) =>
    inf.post<Dossier>('/patients', {
      dateNaissance: '1990-01-01',
      sexe: 'F',
      siteCreationId: ref.siteId,
      ...corps,
    })

  beforeAll(async () => {
    app = await demarrerApp()
    inf = await connecter(app, COMPTES.infirmier)
    med = await connecter(app, COMPTES.medecinChef)
    ref = await referentiels(inf)
  })
  afterAll(async () => {
    await app.close()
  })

  it("le registre des employés n'existe plus (ni écran, ni API)", async () => {
    expect((await med.get('/employes')).status).toBe(404)
    expect((await med.get(`/employes/lookup/${matCdi}`)).status).toBe(404)
  })

  it('un travailleur CDI se crée comme patient, avec ses données professionnelles', async () => {
    const r = await creer({
      nom: 'TRAVAIL',
      prenom: 'Cdi',
      sexe: 'M',
      categoriePatientId: ref.categories['ASSURE_CDI'],
      matricule: matCdi,
      fonction: 'Soudeur',
      sectionPaie: 'S1',
      service: 'Atelier',
      departement: 'Usine',
    })
    expect(r.status).toBe(201)
    cdiId = r.body.id
    const trouve = await inf.get<Dossier>(`/patients/by-matricule/${matCdi}`)
    expect(trouve.status).toBe(200)
    expect(trouve.body).toMatchObject({
      id: cdiId,
      statut: 'ACTIF',
      categoriePatient: { code: 'ASSURE_CDI' },
    })
  })

  it("le matricule d'un dossier existant ne crée pas de doublon", async () => {
    const r = await creer({
      nom: 'AUTRE',
      prenom: 'Personne',
      categoriePatientId: ref.categories['ASSURE_CDI'],
      matricule: matCdi,
      fonction: 'X',
      sectionPaie: 'X',
      service: 'X',
      departement: 'X',
    })
    expect(r.status).toBe(409)
  })

  it('un ayant droit se rattache au DOSSIER du travailleur CDI reconnu', async () => {
    const r = await creer({
      nom: 'ENFANT',
      prenom: 'Un',
      categoriePatientId: ref.categories['AYANT_DROIT_CDI'],
      fonction: 'Élève',
      cdiMatricule: matCdi,
      typeLien: 'ENFANT',
    })
    expect(r.status).toBe(201)
    const d = await med.get<Dossier>(`/patients/${r.body.id}`)
    expect(d.body.rattachementsAD?.[0]).toMatchObject({
      cdiId,
      statut: 'ACTIF',
      cdi: { nom: 'TRAVAIL', prenom: 'Cdi', patientId: cdiId },
    })
    const ayants = await med.get<
      { id: string }[] | { ayantsDroits: { id: string }[] }
    >(`/patients/${cdiId}/ayants-droits`)
    expect(ayants.status).toBe(200)
    expect(JSON.stringify(ayants.body)).toContain(r.body.id)
    const couv = await med.get<{
      couvert: Record<string, boolean>
      suspension: unknown
    }>(`/patients/${r.body.id}/couverture`)
    expect(couv.body.couvert.MEDICAMENT).toBe(true)
    expect(couv.body.suspension).toBeNull()
  })

  it("travailleur sans dossier : son dossier est créé avec l'ayant droit, puis reconnu", async () => {
    const sansIdentite = await creer({
      nom: 'ENFANT',
      prenom: 'Deux',
      categoriePatientId: ref.categories['AYANT_DROIT_CDI'],
      fonction: 'Élève',
      cdiMatricule: matInconnu,
      typeLien: 'ENFANT',
    })
    expect(sansIdentite.status).toBe(400)

    const r = await creer({
      nom: 'ENFANT',
      prenom: 'Deux',
      categoriePatientId: ref.categories['AYANT_DROIT_CDI'],
      fonction: 'Élève',
      cdiMatricule: matInconnu,
      typeLien: 'ENFANT',
      nouveauTravailleur: {
        nom: 'NOUVEAU',
        prenom: 'Travailleur',
        fonction: 'Cariste',
        service: 'Logistique',
      },
    })
    expect(r.status).toBe(201)
    const trav = await inf.get<Dossier>(`/patients/by-matricule/${matInconnu}`)
    expect(trav.status).toBe(200)
    expect(trav.body.categoriePatient.code).toBe('ASSURE_CDI')
    const complet = await med.get<Dossier>(`/patients/${trav.body.id}`)
    expect(complet.body.donneesEmploi).toMatchObject({
      fonction: 'Cariste',
      service: 'Logistique',
    })

    // Un second ayant droit du même travailleur le RECONNAÎT : pas de second dossier.
    const r2 = await creer({
      nom: 'ENFANT',
      prenom: 'Trois',
      categoriePatientId: ref.categories['AYANT_DROIT_CDI'],
      fonction: 'Élève',
      cdiMatricule: matInconnu,
      typeLien: 'ENFANT',
      nouveauTravailleur: { nom: 'DOUBLON', prenom: 'Ignoré' },
    })
    expect(r2.status).toBe(201)
    const d2 = await med.get<Dossier>(`/patients/${r2.body.id}`)
    expect(d2.body.rattachementsAD?.[0].cdiId).toBe(trav.body.id)
  })

  it("le matricule d'un CDD ne permet pas de rattacher un ayant droit", async () => {
    const matCdd = `CDD-${suffixe}`
    const cdd = await creer({
      nom: 'TRAVAIL',
      prenom: 'Cdd',
      categoriePatientId: ref.categories['ASSURE_CDD'],
      matricule: matCdd,
      fonction: 'Intérim',
      sectionPaie: 'S2',
      service: 'Atelier',
      departement: 'Usine',
    })
    expect(cdd.status).toBe(201)
    const r = await creer({
      nom: 'ENFANT',
      prenom: 'Quatre',
      categoriePatientId: ref.categories['AYANT_DROIT_CDI'],
      fonction: 'Élève',
      cdiMatricule: matCdd,
      typeLien: 'ENFANT',
    })
    expect(r.status).toBe(409)
  })

  it('travailleur archivé : les droits de ses ayants droit sont suspendus', async () => {
    const enfant = await creer({
      nom: 'ENFANT',
      prenom: 'Cinq',
      categoriePatientId: ref.categories['AYANT_DROIT_CDI'],
      fonction: 'Élève',
      cdiMatricule: matCdi,
      typeLien: 'ENFANT',
    })
    expect(enfant.status).toBe(201)
    const archive = await med.patch(`/patients/${cdiId}/statut`, {
      statut: 'ARCHIVE',
    })
    expect(archive.status).toBe(200)
    const couv = await med.get<{
      couvert: Record<string, boolean>
      suspension: { motif: string } | null
    }>(`/patients/${enfant.body.id}/couverture`)
    expect(couv.body.couvert.MEDICAMENT).toBe(false)
    expect(couv.body.suspension?.motif).toBe('CDI_INACTIF')
  })
})

describe('Garde-fous des postes de bureau', () => {
  it('la synchronisation ignore une colonne que ce serveur ne connaît plus', () => {
    const donnees = colonnesConnues('Patient', {
      id: 'p1',
      matricule: 'M1',
      employeId: 'colonne-disparue',
    })
    expect(donnees).toEqual({ id: 'p1', matricule: 'M1' })
  })

  it("la mise à niveau voit qu'une colonne retirée par une migration est encore là", () => {
    const creation =
      'CREATE TABLE "T" (\n    "id" TEXT NOT NULL,\n    "vieille" TEXT\n);'
    const retrait =
      'CREATE TABLE "new_T" (\n    "id" TEXT NOT NULL\n);\nINSERT INTO "new_T" ("id") SELECT "id" FROM "T";\nDROP TABLE "T";\nALTER TABLE "new_T" RENAME TO "T";'
    const attentes = attentesDeMigration(retrait, etatFinal([creation]))
    expect(attentes).toEqual(
      expect.arrayContaining([
        { genre: 'colonnesAbsentes', table: 'T', colonnes: ['vieille'] },
      ]),
    )
  })
})
