/**
 * Les patients par catégorie (chantier 7, étape 4) — la règle centrale du recueil :
 *
 *  - chaque catégorie a ses données obligatoires à l'enregistrement ;
 *  - consultation et premiers soins sont dus à TOUS ; médicaments (bon de pharmacie) et
 *    examens (bon d'examens) seulement aux catégories qui y ouvrent droit — au départ le
 *    personnel CDI et ses ayants droit — et la matrice se règle dans les Référentiels ;
 *  - un ayant droit perd ces droits quand son lien au travailleur CDI se clôt, arrive à
 *    échéance, ou quand ce travailleur n'est plus CDI actif (sauf s'il a un 2e parent CDI) ;
 *  - un changement de catégorie suit les mêmes obligations et laisse une trace.
 *
 * Les droits sont vérifiés là où ils comptent : à la génération réelle des bons.
 */
import type { NestExpressApplication } from '@nestjs/platform-express'
import { demarrerApp } from './support/app-test'
import { COMPTES, connecter, type Client } from './support/client'
import { referentiels, type Referentiels } from './support/donnees'

type Prestation = 'CONSULTATION' | 'PREMIERS_SOINS' | 'MEDICAMENT' | 'EXAMEN'
interface Couverture {
  couvert: Record<Prestation, boolean>
  suspension: { motif: string; message: string } | null
}
interface Dossier {
  id: string
  matricule: string | null
  categoriePatient: { code: string }
  rattachementsAD: { id: string; statut: string; cdiId: string | null }[]
  rattachementsST?: { statut: string; societe?: { nom: string } | null }[]
  historiquesCateg: {
    motif: string | null
    nouvelleCategorie?: { code: string }
  }[]
}

describe('Patients par catégorie : obligations, droits, suspension', () => {
  let app: NestExpressApplication
  let admin: Client
  let inf: Client
  let med: Client
  let ref: Referentiels
  let societeId: string
  const s = `${Date.now() % 100_000}`
  let n = 0

  /** Patient d'une catégorie ; `extra` = les données administratives de la catégorie. */
  const creer = (code: string, extra: object = {}) => {
    n += 1
    return inf.post<{ id: string; message?: string }>('/patients', {
      nom: `CATEG${s}`,
      prenom: `P${n}`,
      dateNaissance: '1985-05-05',
      sexe: n % 2 ? 'M' : 'F',
      siteCreationId: ref.siteId,
      categoriePatientId: ref.categories[code],
      ...extra,
    })
  }
  const emploi = (matricule: string) => ({
    matricule,
    fonction: 'Opérateur',
    sectionPaie: 'S1',
    service: 'Production',
    departement: 'Usine',
  })
  const creerOk = async (code: string, extra: object = {}) => {
    const r = await creer(code, extra)
    if (r.status !== 201)
      throw new Error(`${code} : HTTP ${r.status} ${JSON.stringify(r.body)}`)
    return r.body.id
  }
  const couverture = async (id: string) =>
    (await inf.get<Couverture>(`/patients/${id}/couverture`)).body
  const dossier = async (id: string) =>
    (await med.get<Dossier>(`/patients/${id}`)).body

  /** Visite orientée vers le médecin, consultation ouverte avec son diagnostic. */
  const consulter = async (patientId: string) => {
    const v = await inf.post<{ id: string }>('/triage/visites', {
      patientId,
      motifPrincipalId: ref.motifId,
    })
    expect(v.status).toBe(201)
    await inf.patch(`/triage/visites/${v.body.id}/statut`, {
      statut: 'EN_COURS',
    })
    await inf.patch(`/triage/visites/${v.body.id}/soignant`, {
      soignantId: med.user.personnelMedicalId,
    })
    const c = await med.post<{ id: string }>('/consultations', {
      visiteId: v.body.id,
    })
    expect(c.status).toBe(201)
    const C = `/consultations/${c.body.id}`
    await med.patch(`${C}/type`, { typeConsultationId: ref.typeConsultationId })
    await med.post(`${C}/diagnostics`, {
      pathologieId: ref.pathologieId,
      type: 'PRINCIPAL',
      certitude: 'CONFIRME',
    })
    return c.body.id
  }
  /** Ordonnance validée puis demande de son bon : c'est là que les droits jouent. */
  const bon = async (
    consultationId: string,
    type: 'PRESCRIPTION_EXAMEN' | 'PHARMACEUTIQUE',
  ) => {
    const C = `/consultations/${consultationId}`
    const o = await med.post<{ id: string }>(`${C}/ordonnances`, {
      typeOrdonnance: type,
      ...(type === 'PRESCRIPTION_EXAMEN' && { indicationClinik: 'Bilan' }),
    })
    expect(o.status).toBe(201)
    const ligne =
      type === 'PRESCRIPTION_EXAMEN'
        ? { typesExamenIds: [ref.typesExamen[0].id] }
        : {
            medicamentId: ref.medicaments[0].id,
            posologie: '1 cp le soir',
            duree: '5 jours',
            voieAdmin: 'Orale',
            quantite: '5',
            acknowledgeWarnings: true,
          }
    expect(
      (await med.post(`${C}/ordonnances/${o.body.id}/lignes`, ligne)).status,
    ).toBe(201)
    expect(
      (await med.patch(`${C}/ordonnances/${o.body.id}/valider`)).status,
    ).toBe(200)
    return med.post<{ message?: string }>(
      `${C}/ordonnances/${o.body.id}/generer-bon`,
    )
  }
  const cloturer = async (consultationId: string) =>
    expect(
      (
        await med.patch(`/consultations/${consultationId}/cloturer`, {
          conclusion: 'Test des droits par catégorie',
        })
      ).status,
    ).toBe(200)
  /** Les deux bons d'une consultation, puis clôture (un médecin = une consultation ouverte). */
  const bons = async (patientId: string) => {
    const c = await consulter(patientId)
    const examen = await bon(c, 'PRESCRIPTION_EXAMEN')
    const pharmacie = await bon(c, 'PHARMACEUTIQUE')
    await cloturer(c)
    return { examen, pharmacie }
  }

  beforeAll(async () => {
    app = await demarrerApp()
    admin = await connecter(app, COMPTES.admin)
    inf = await connecter(app, COMPTES.infirmier)
    med = await connecter(app, COMPTES.medecinChef)
    ref = await referentiels(inf)
    const st = await admin.post<{ id: string }>('/sous-traitants', {
      nom: `Société test ${s}`,
    })
    expect(st.status).toBe(201)
    societeId = st.body.id
  })
  afterAll(async () => {
    await app.close()
  })

  describe("à l'enregistrement, chaque catégorie a ses données obligatoires", () => {
    it('CDI et CDD : matricule, fonction, section de paie, service, département', async () => {
      for (const code of ['ASSURE_CDI', 'ASSURE_CDD']) {
        const r = await creer(code, { matricule: `M-${code}-${s}` })
        expect(r.status).toBe(400)
        expect(JSON.stringify(r.body)).toMatch(
          /fonction.*section de paie.*service.*département/,
        )
        expect((await creer(code, emploi(`OK-${code}-${s}`))).status).toBe(201)
      }
    })

    it('sous-traitant : une société active, et le patient y est rattaché', async () => {
      expect((await creer('SOUS_TRAITANT')).status).toBe(400)
      const inactive = await admin.post<{ id: string }>('/sous-traitants', {
        nom: `Société fermée ${s}`,
      })
      await admin.patch(`/sous-traitants/${inactive.body.id}/statut`, {
        statut: 'INACTIVE',
      })
      expect(
        (await creer('SOUS_TRAITANT', { societeId: inactive.body.id })).status,
      ).toBe(400)
      const id = await creerOk('SOUS_TRAITANT', { societeId })
      const d = await dossier(id)
      expect(d.rattachementsST?.[0]).toMatchObject({ statut: 'ACTIF' })
    })

    it('ayant droit : occupation, matricule du travailleur CDI et lien de parenté', async () => {
      const cdi = `AD-CDI-${s}`
      await creerOk('ASSURE_CDI', emploi(cdi))
      for (const manque of ['fonction', 'cdiMatricule', 'typeLien']) {
        const complet: Record<string, string> = {
          fonction: 'Élève',
          cdiMatricule: cdi,
          typeLien: 'ENFANT',
        }
        delete complet[manque]
        expect((await creer('AYANT_DROIT_CDI', complet)).status).toBe(400)
      }
    })

    it("riverain, retraité, agent fonctionnaire, externe : l'identité suffit", async () => {
      for (const code of [
        'RIVERAIN',
        'RETRAITE',
        'AGENT_FONCTIONNAIRE',
        'PATIENT_EXTERNE',
      ])
        expect((await creer(code)).status).toBe(201)
    })
  })

  describe('droits par catégorie (matrice du seed)', () => {
    it('consultation et premiers soins pour tous ; médicaments et examens : CDI et ayants droit', async () => {
      const matrice = await inf.get<
        { categorieId: string; bonExamen: boolean; bonPharmacie: boolean }[]
      >('/referentiels/categories-patient/droits')
      expect(matrice.status).toBe(200)
      const ouverts = Object.entries(ref.categories)
        .filter(([, id]) =>
          matrice.body.some(
            (m) => m.categorieId === id && m.bonExamen && m.bonPharmacie,
          ),
        )
        .map(([code]) => code)
        .sort()
      expect(ouverts).toEqual(['ASSURE_CDI', 'AYANT_DROIT_CDI'])

      const cdi = `MAT-CDI-${s}`
      const patients: Record<string, string> = {
        ASSURE_CDI: await creerOk('ASSURE_CDI', emploi(cdi)),
        ASSURE_CDD: await creerOk('ASSURE_CDD', emploi(`MAT-CDD-${s}`)),
        AYANT_DROIT_CDI: await creerOk('AYANT_DROIT_CDI', {
          fonction: 'Élève',
          cdiMatricule: cdi,
          typeLien: 'ENFANT',
        }),
        SOUS_TRAITANT: await creerOk('SOUS_TRAITANT', { societeId }),
        RIVERAIN: await creerOk('RIVERAIN'),
        RETRAITE: await creerOk('RETRAITE'),
        AGENT_FONCTIONNAIRE: await creerOk('AGENT_FONCTIONNAIRE'),
        PATIENT_EXTERNE: await creerOk('PATIENT_EXTERNE'),
      }
      for (const [code, id] of Object.entries(patients)) {
        const c = await couverture(id)
        const complet = code === 'ASSURE_CDI' || code === 'AYANT_DROIT_CDI'
        expect({ code, ...c.couvert }).toEqual({
          code,
          CONSULTATION: true,
          PREMIERS_SOINS: true,
          MEDICAMENT: complet,
          EXAMEN: complet,
        })
        expect(c.suspension).toBeNull()
      }
    })

    it('les bons sont délivrés au CDI et à son ayant droit…', async () => {
      const cdi = `BON-CDI-${s}`
      const travailleur = await creerOk('ASSURE_CDI', emploi(cdi))
      const enfant = await creerOk('AYANT_DROIT_CDI', {
        fonction: 'Élève',
        cdiMatricule: cdi,
        typeLien: 'ENFANT',
      })
      for (const id of [travailleur, enfant]) {
        const { examen, pharmacie } = await bons(id)
        expect([examen.status, pharmacie.status]).toEqual([201, 201])
      }
    })

    it('… et refusés, en le disant, aux autres catégories (qui restent consultées)', async () => {
      for (const [code, extra] of [
        ['ASSURE_CDD', emploi(`BON-CDD-${s}`)],
        ['RIVERAIN', {}],
        ['SOUS_TRAITANT', { societeId }],
        ['PATIENT_EXTERNE', {}],
      ] as const) {
        const id = await creerOk(code, extra)
        const { examen, pharmacie } = await bons(id)
        expect({
          code,
          examen: examen.status,
          pharmacie: pharmacie.status,
        }).toEqual({
          code,
          examen: 403,
          pharmacie: 403,
        })
        expect(examen.body.message).toMatch(
          /n'ouvre pas droit aux bons d'examens/,
        )
        expect(pharmacie.body.message).toMatch(
          /n'ouvre pas droit à la prise en charge des médicaments/,
        )
      }
    })

    it('la matrice se règle dans les Référentiels, sans jamais retirer la consultation', async () => {
      const riverain = await creerOk('RIVERAIN')
      const url = `/referentiels/categories-patient/${ref.categories['RIVERAIN']}/droits`
      try {
        expect(
          (
            await admin.patch(url, {
              couvreMedicament: false,
              couvreExamen: true,
            })
          ).status,
        ).toBe(200)
        expect((await couverture(riverain)).couvert).toEqual({
          CONSULTATION: true,
          PREMIERS_SOINS: true,
          MEDICAMENT: false,
          EXAMEN: true,
        })
        const { examen, pharmacie } = await bons(riverain)
        expect([examen.status, pharmacie.status]).toEqual([201, 403])
      } finally {
        // La base de test sert aux autres fichiers : la matrice du seed est rétablie.
        await admin.patch(url, { couvreMedicament: false, couvreExamen: false })
      }
      expect((await couverture(riverain)).couvert.EXAMEN).toBe(false)
    })
  })

  describe("suspension des droits d'un ayant droit (sa catégorie reste)", () => {
    const parentsEtEnfant = async (prefixe: string) => {
      const a = `${prefixe}-A-${s}`
      const b = `${prefixe}-B-${s}`
      const parentA = await creerOk('ASSURE_CDI', emploi(a))
      const parentB = await creerOk('ASSURE_CDI', emploi(b))
      const enfant = await creerOk('AYANT_DROIT_CDI', {
        fonction: 'Élève',
        cdiMatricule: a,
        typeLien: 'ENFANT',
      })
      return { a, b, parentA, parentB, enfant }
    }

    it('lien clôturé : droits suspendus, et le bon est refusé avec la raison', async () => {
      const { enfant } = await parentsEtEnfant('CLO')
      const [lien] = (await dossier(enfant)).rattachementsAD
      expect(
        (
          await inf.patch(`/patients/${enfant}/rattachements-ad/${lien.id}`, {
            statut: 'INACTIF',
          })
        ).status,
      ).toBe(200)
      const c = await couverture(enfant)
      expect(c.suspension?.motif).toBe('RATTACHEMENT_CLOTURE')
      expect([
        c.couvert.MEDICAMENT,
        c.couvert.EXAMEN,
        c.couvert.CONSULTATION,
      ]).toEqual([false, false, true])
      expect((await dossier(enfant)).categoriePatient.code).toBe(
        'AYANT_DROIT_CDI',
      )
      const { examen, pharmacie } = await bons(enfant)
      expect([examen.status, pharmacie.status]).toEqual([403, 403])
      expect(examen.body.message).toMatch(
        /Rattachement au travailleur CDI clôturé/,
      )
    })

    it('lien arrivé à échéance : même suspension', async () => {
      const { enfant } = await parentsEtEnfant('ECH')
      const [lien] = (await dossier(enfant)).rattachementsAD
      const r = await inf.patch(
        `/patients/${enfant}/rattachements-ad/${lien.id}`,
        {
          dateDebut: '2025-01-01T00:00:00.000Z',
          dateFin: '2025-12-31T00:00:00.000Z',
        },
      )
      expect(r.status).toBe(200)
      expect((await couverture(enfant)).suspension?.motif).toBe(
        'RATTACHEMENT_CLOTURE',
      )
    })

    it('deux parents CDI : le départ de l’un ne suspend rien, celui des deux suspend', async () => {
      const { b, parentA, parentB, enfant } = await parentsEtEnfant('DEUX')
      expect(
        (
          await inf.post(`/patients/${enfant}/rattachements-ad`, {
            cdiMatricule: b,
            typeLien: 'ENFANT',
          })
        ).status,
      ).toBeLessThan(300)
      // Un second lien vers le même parent serait un doublon.
      expect(
        (
          await inf.post(`/patients/${enfant}/rattachements-ad`, {
            cdiMatricule: b,
            typeLien: 'ENFANT',
          })
        ).status,
      ).toBe(409)

      expect(
        (await med.patch(`/patients/${parentA}/statut`, { statut: 'ARCHIVE' }))
          .status,
      ).toBe(200)
      let c = await couverture(enfant)
      expect(c.suspension).toBeNull()
      expect(c.couvert.MEDICAMENT).toBe(true)

      expect(
        (await med.patch(`/patients/${parentB}/statut`, { statut: 'ARCHIVE' }))
          .status,
      ).toBe(200)
      c = await couverture(enfant)
      expect(c.suspension?.motif).toBe('CDI_INACTIF')
      expect(c.couvert.EXAMEN).toBe(false)
    })

    it('le travailleur CDI lui-même archivé : ses propres droits sont suspendus', async () => {
      const id = await creerOk('ASSURE_CDI', emploi(`ARCH-${s}`))
      await med.patch(`/patients/${id}/statut`, { statut: 'ARCHIVE' })
      const c = await couverture(id)
      expect(c.suspension?.motif).toBe('CDI_INACTIF')
      expect(c.couvert.MEDICAMENT).toBe(false)
    })
  })

  describe('changement de catégorie', () => {
    const changer = (id: string, code: string, extra: object = {}) =>
      med.patch(`/patients/${id}/categorie`, {
        nouvelleCategId: ref.categories[code],
        motif: 'Test du changement de catégorie',
        ...extra,
      })

    it('devenir CDI demande ses données, ouvre ses droits et laisse une trace', async () => {
      const id = await creerOk('PATIENT_EXTERNE')
      expect((await changer(id, 'ASSURE_CDI')).status).toBe(400)
      expect(
        (await changer(id, 'ASSURE_CDI', emploi(`DEV-CDI-${s}`))).status,
      ).toBe(200)
      const d = await dossier(id)
      expect(d).toMatchObject({
        matricule: `DEV-CDI-${s}`,
        categoriePatient: { code: 'ASSURE_CDI' },
      })
      expect(d.historiquesCateg[0]).toMatchObject({
        motif: 'Test du changement de catégorie',
        nouvelleCategorie: { code: 'ASSURE_CDI' },
      })
      expect((await couverture(id)).couvert.EXAMEN).toBe(true)
    })

    it('ayant droit et sous-traitant ne s’attribuent pas ici (ils passent par la visite)', async () => {
      const id = await creerOk('RIVERAIN')
      expect((await changer(id, 'AYANT_DROIT_CDI')).status).toBe(409)
      expect((await changer(id, 'SOUS_TRAITANT')).status).toBe(409)
    })

    it('un CDI qui a des ayants droit ne quitte pas la catégorie sans eux : ils sont nommés', async () => {
      const mat = `QUIT-${s}`
      const cdi = await creerOk('ASSURE_CDI', emploi(mat))
      await creerOk('AYANT_DROIT_CDI', {
        fonction: 'Élève',
        cdiMatricule: mat,
        typeLien: 'ENFANT',
      })
      const r = await changer(cdi, 'ASSURE_CDD', emploi(mat))
      expect(r.status).toBe(409)
      expect(JSON.stringify(r.body)).toContain(`CATEG${s}`)
    })

    it("un ayant droit qui change de catégorie perd ses liens, et les droits qu'ils ouvraient", async () => {
      const mat = `PERD-${s}`
      await creerOk('ASSURE_CDI', emploi(mat))
      const enfant = await creerOk('AYANT_DROIT_CDI', {
        fonction: 'Étudiant',
        cdiMatricule: mat,
        typeLien: 'ENFANT',
      })
      expect((await changer(enfant, 'RIVERAIN')).status).toBe(200)
      const d = await dossier(enfant)
      expect(d.rattachementsAD.map((l) => l.statut)).toEqual(['INACTIF'])
      const c = await couverture(enfant)
      expect(c.couvert.MEDICAMENT).toBe(false)
      expect(c.suspension).toBeNull()
    })
  })
})
