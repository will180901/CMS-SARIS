/**
 * Générateur de données de test, par ses vraies routes et la vraie base de test :
 *  - réservé à l'administrateur système, et au mode Test (jamais en production, ni sur un poste) ;
 *  - une vraie génération s'écrit en base, entièrement marquée, attribuée aux vrais comptes du
 *    personnel, sans aucun nom / téléphone / matricule / numéro répété — et les routes ordinaires de
 *    l'application savent la lire (dossier, visites, consultations) ;
 *  - elle ne touche ni aux comptes, ni au personnel, ni aux référentiels, ni aux notifications ;
 *  - elle s'arrête sur demande, se reprend là où elle s'est arrêtée, s'arrête d'elle-même si l'on
 *    quitte le mode Test ou si la base devient trop pleine ;
 *  - la suppression ramène la base exactement où elle était — y compris ce qu'un utilisateur a
 *    ajouté à la main sur un dossier de test — et l'opération reste tracée.
 */
import type { NestExpressApplication } from '@nestjs/platform-express'
import { cleNom } from '../src/modules/donnees-test/fabrique-identites'
import { MARQUE_ID, estIdTest } from '../src/modules/donnees-test/marque-test'
import { MODELES_TEST } from '../src/modules/donnees-test/registre'
import { supprimerMarquees } from '../src/modules/donnees-test/ecriture'
import { DonneesTestService } from '../src/modules/donnees-test/donnees-test.service'
import { baseDe, demarrerApp } from './support/app-test'
import { COMPTES, connecter, type Client } from './support/client'
import { creerPatientCdi, referentiels } from './support/donnees'

interface Lot {
  id: string
  statut: 'EN_COURS' | 'TERMINE' | 'INTERROMPU' | 'ANNULE' | 'ECHEC'
  message: string | null
  parametres: {
    mois: number
    visitesParJour: number
    graine: string
    debut: string
    fin: string
  }
  progression: {
    joursTotal: number
    joursFaits: number
    visites: number
    patients: number
    consultations: number
    visitesAnnulees: number
    consultationsAnnulees: number
    nonRecus: number
    lignes: Record<string, number>
  }
  bilan?: {
    tailleOctets: number | null
    sites: { code: string; visites: number; patients: number }[]
    categories: { code: string; patients: number }[]
    connexions: {
      reussies: number
      echecs: number
      deconnexions: number
      questions: number
      appareils: number
    }
    documents: { ordonnances: number }
  } | null
}
interface Etat {
  mode: 'PRODUCTION' | 'TEST'
  disponible: boolean
  raison: string | null
  lot: Lot | null
  enCours: boolean
  existantes: {
    total: number
    tables: { modele: string; libelle: string; n: number }[]
  }
  base: { tailleMo: number | null; limiteMo: number }
  equipe: { sites: number; medecins: number; infirmiers: number }
}
interface Previsions {
  joursOuverts: number
  visites: number
  patients: number
  capaciteParJour: number
  octets: number
  avertissements: string[]
}
interface Refus {
  code: string
  message: string
}

describe('Données de test (génération, lecture, suppression)', () => {
  let app: NestExpressApplication
  let admin: Client
  let infirmier: Client
  let medecin: Client
  const MDP = COMPTES.admin.motDePasse

  const base = () => baseDe(app)
  const etat = () => admin.get<Etat>('/systeme/donnees-test')
  const generer = (mois: number, visitesParJour: number, graine?: string) =>
    admin.post<Lot & Refus>('/systeme/donnees-test/generation', {
      mois,
      visitesParJour,
      ...(graine ? { graine } : {}),
    })
  const changerMode = (mode: 'TEST' | 'PRODUCTION') =>
    admin.appel('put', '/systeme/mode', {}, { mode, motDePasse: MDP })

  /** Attend (en laissant la génération avancer dans le même processus) qu'une condition soit vraie. */
  async function attendre<T>(
    lire: () => Promise<T>,
    ok: (v: T) => boolean,
    ms = 90_000,
  ): Promise<T> {
    const fin = Date.now() + ms
    for (;;) {
      const v = await lire()
      if (ok(v)) return v
      if (Date.now() > fin)
        throw new Error('délai dépassé : ' + JSON.stringify(v).slice(0, 400))
      await new Promise((r) => setTimeout(r, 150))
    }
  }
  const lotFini = () =>
    attendre(
      async () => (await etat()).body.lot,
      (l) => !!l && l.statut !== 'EN_COURS',
    )

  /** Ce que la génération ne doit jamais toucher. */
  const instantane = async () => ({
    utilisateurs: await base().utilisateur.count(),
    personnel: await base().personnelMedical.count(),
    sites: await base().site.count(),
    motifs: await base().motifConsultation.count(),
    pathologies: await base().pathologieReference.count(),
    medicaments: await base().medicamentReference.count(),
    examens: await base().typeExamen.count(),
    categories: await base().categoriePatient.count(),
    types: await base().typeConsultation.count(),
    societes: await base().societeSousTraitante.count(),
    roles: await base().role.count(),
    permissions: await base().permission.count(),
    conversations: await base().conversation.count(),
    messages: await base().message.count(),
    notifications: await base().notification.count(),
    patients: await base().patient.count(),
    visites: await base().visite.count(),
    consultations: await base().consultation.count(),
    ordonnances: await base().ordonnance.count(),
    lignesOrdonnance: await base().ligneOrdonnance.count(),
    bonsExamen: await base().bonExamen.count(),
    lignesExamen: await base().ligneExamen.count(),
    resultats: await base().resultatExamen.count(),
    piecesJointes: await base().pieceJointeResultat.count(),
    bonsPharmacie: await base().bonPharmacie.count(),
    lignesBonPharmacie: await base().ligneBonPharmacie.count(),
    suivisChroniques: await base().suiviChronique.count(),
    evacuations: await base().evacuation.count(),
    etapesEvacuation: await base().suiviEvacuation.count(),
    suivisTraitement: await base().suiviTraitement.count(),
    fiches: await base().ficheSuiviTraitement.count(),
    administrations: await base().administrationTraitement.count(),
    sessions: await base().sessionUtilisateur.count(),
    connexions: await base().journalAuthentification.count(),
    // l'audit des opérations sur les données de test est une trace légitime, pas une donnée de test
    audit: await base().journalAudit.count({
      where: { NOT: { entiteType: 'DonneesTest' } },
    }),
    parametres: await base().parametreSysteme.count({
      where: { cle: { notIn: ['systeme.mode', 'systeme.donnees_test'] } },
    }),
  })

  beforeAll(async () => {
    app = await demarrerApp()
    admin = await connecter(app, COMPTES.admin)
    infirmier = await connecter(app, COMPTES.infirmier)
    medecin = await connecter(app, COMPTES.medecinChef)
    delete process.env['MODE_TEST_AUTORISE']
    delete process.env['DONNEES_TEST_TAILLE_MAX_MO']
    await base().parametreSysteme.deleteMany({
      where: { cle: { in: ['systeme.mode', 'systeme.donnees_test'] } },
    })
  })
  afterAll(async () => {
    delete process.env['DONNEES_TEST_TAILLE_MAX_MO']
    await supprimerMarquees(base())
    await base().parametreSysteme.deleteMany({
      where: { cle: { in: ['systeme.mode', 'systeme.donnees_test'] } },
    })
    // Les traces d'audit des bascules de mode et des opérations sur les données de test sont de
    // vraies lignes (non marquées) : on les retire, sinon la suite du mode du système, qui compte
    // ses propres traces dans la même base, trouverait celles de ce fichier.
    await base().journalAudit.deleteMany({
      where: {
        module: 'systeme',
        entiteType: { in: ['ModeSysteme', 'DonneesTest'] },
      },
    })
    await app.close()
  })

  describe('Accès', () => {
    it('réservé à l’administrateur système : infirmier et médecin chef sont refusés partout', async () => {
      for (const c of [infirmier, medecin]) {
        expect((await c.get('/systeme/donnees-test')).status).toBe(403)
        expect(
          (
            await c.get(
              '/systeme/donnees-test/previsions?mois=4&visitesParJour=20',
            )
          ).status,
        ).toBe(403)
        expect(
          (
            await c.post('/systeme/donnees-test/generation', {
              mois: 1,
              visitesParJour: 5,
            })
          ).status,
        ).toBe(403)
        expect(
          (await c.post('/systeme/donnees-test/generation/reprise', {})).status,
        ).toBe(403)
        expect(
          (await c.post('/systeme/donnees-test/generation/arret', {})).status,
        ).toBe(403)
        expect((await c.delete('/systeme/donnees-test')).status).toBe(403)
      }
    })

    it('en production : l’état dit pourquoi, et générer ou supprimer est refusé (409)', async () => {
      const e = await etat()
      expect(e.status).toBe(200)
      expect(e.body).toMatchObject({
        mode: 'PRODUCTION',
        disponible: false,
        lot: null,
        enCours: false,
      })
      expect(e.body.raison).toMatch(/mode Test/)
      const g = await generer(1, 5)
      expect(g.status).toBe(409)
      expect(g.body.code).toBe('MODE_PRODUCTION')
      expect((await admin.delete<Refus>('/systeme/donnees-test')).status).toBe(
        409,
      )
      expect(
        (await admin.post('/systeme/donnees-test/generation/reprise', {}))
          .status,
      ).toBe(409)
    })

    it('sans aucune génération, arrêter ou reprendre est un refus clair', async () => {
      expect((await changerMode('TEST')).status).toBe(200)
      const arret = await admin.post<Refus>(
        '/systeme/donnees-test/generation/arret',
        {},
      )
      expect(arret.status).toBe(409)
      expect(arret.body.code).toBe('AUCUNE_GENERATION')
      const reprise = await admin.post<Refus>(
        '/systeme/donnees-test/generation/reprise',
        {},
      )
      expect(reprise.status).toBe(409)
      expect(reprise.body.code).toBe('RIEN_A_REPRENDRE')
    })
  })

  describe('Avant de générer', () => {
    it('en mode Test : disponible, avec l’équipe du centre et la place dans la base', async () => {
      const e = (await etat()).body
      expect(e).toMatchObject({ mode: 'TEST', disponible: true, raison: null })
      expect(e.equipe.medecins).toBeGreaterThanOrEqual(2)
      expect(e.equipe.infirmiers).toBeGreaterThanOrEqual(2)
      expect(e.equipe.sites).toBe(2)
      expect(e.base.tailleMo).toBeGreaterThan(0)
      expect(e.base.limiteMo).toBe(350)
      expect(e.existantes.total).toBe(0)
    })

    it('les prévisions : jours d’ouverture, visites, capacité, taille ; arguments invalides refusés', async () => {
      const r = await admin.get<Previsions>(
        '/systeme/donnees-test/previsions?mois=4&visitesParJour=40',
      )
      expect(r.status).toBe(200)
      expect(r.body.joursOuverts).toBeGreaterThan(90)
      expect(r.body.joursOuverts).toBeLessThan(110)
      expect(r.body.visites).toBeGreaterThan(1500)
      expect(r.body.patients).toBeGreaterThan(500)
      expect(r.body.capaciteParJour).toBeGreaterThan(20)
      expect(r.body.octets).toBeGreaterThan(5_000_000)
      for (const q of [
        'mois=0&visitesParJour=10',
        'mois=13&visitesParJour=10',
        'mois=4&visitesParJour=0',
        'mois=4&visitesParJour=999',
        'mois=abc&visitesParJour=5',
        'visitesParJour=5',
      ])
        expect(
          (await admin.get(`/systeme/donnees-test/previsions?${q}`)).status,
        ).toBe(400)
      // une demande très au-dessus de la capacité de l’équipe est annoncée
      const trop = await admin.get<Previsions>(
        '/systeme/donnees-test/previsions?mois=1&visitesParJour=250',
      )
      expect(trop.body.avertissements.join(' ')).toMatch(/absorbe/)
    })

    it('les prévisions avertissent quand la purge des journaux effacerait ce que la génération fabrique', async () => {
      const cle = 'audit.retention_jours'
      const avant = await base().parametreSysteme.findUnique({ where: { cle } })
      try {
        await base().parametreSysteme.upsert({
          where: { cle },
          update: { valeur: '30' },
          create: { cle, valeur: '30' },
        })
        const court = await admin.get<Previsions>(
          '/systeme/donnees-test/previsions?mois=4&visitesParJour=20',
        )
        expect(court.status).toBe(200)
        expect(court.body.avertissements.join(' ')).toMatch(
          /conservés 30 jours/,
        )
        await base().parametreSysteme.update({
          where: { cle },
          data: { valeur: '365' },
        })
        const long = await admin.get<Previsions>(
          '/systeme/donnees-test/previsions?mois=4&visitesParJour=20',
        )
        expect(long.body.avertissements.join(' ')).not.toMatch(/conservés/)
      } finally {
        if (avant)
          await base().parametreSysteme.update({
            where: { cle },
            data: { valeur: avant.valeur },
          })
        else await base().parametreSysteme.deleteMany({ where: { cle } })
      }
    })

    it('arguments de génération invalides : 400, rien ne démarre', async () => {
      for (const corps of [
        {},
        { mois: 0, visitesParJour: 10 },
        { mois: 4, visitesParJour: 0 },
        { mois: 2.5, visitesParJour: 10 },
        { mois: 4, visitesParJour: 10, graine: 'x'.repeat(61) },
      ])
        expect(
          (await admin.post('/systeme/donnees-test/generation', corps)).status,
        ).toBe(400)
      expect((await etat()).body.lot).toBeNull()
    })

    it('une base déjà trop pleine : refusé avant d’écrire quoi que ce soit (409)', async () => {
      process.env['DONNEES_TEST_TAILLE_MAX_MO'] = '1'
      try {
        const g = await generer(1, 5)
        expect(g.status).toBe(409)
        expect(g.body.code).toBe('TAILLE_TROP_GRANDE')
        expect(g.body.message).toMatch(/Mo/)
      } finally {
        delete process.env['DONNEES_TEST_TAILLE_MAX_MO']
      }
      expect((await etat()).body.existantes.total).toBe(0)
    })

    it('des référentiels que le centre a vidés : refusé en nommant ce qui manque, sans les toucher', async () => {
      const motifs = await base().motifConsultation.findMany({
        select: { id: true, statut: true },
      })
      await base().motifConsultation.updateMany({ data: { statut: 'INACTIF' } })
      try {
        const g = await generer(1, 5)
        expect(g.status).toBe(409)
        expect(g.body.code).toBe('REFERENTIELS_INCOMPLETS')
        expect(g.body.message).toMatch(/motifs de consultation/)
      } finally {
        for (const m of motifs)
          await base().motifConsultation.update({
            where: { id: m.id },
            data: { statut: m.statut },
          })
      }
      expect((await etat()).body.existantes.total).toBe(0)
    })

    it('sans médecin actif : refusé, sans rien écrire', async () => {
      const medecins = await base().utilisateur.findMany({
        where: {
          roles: { some: { role: { code: 'MEDECIN_CHEF' } } },
          personnelMedicalId: { not: null },
        },
        select: { id: true, statut: true },
      })
      await base().utilisateur.updateMany({
        where: { id: { in: medecins.map((m) => m.id) } },
        data: { statut: 'DESACTIVE' },
      })
      try {
        const g = await generer(1, 5)
        expect(g.status).toBe(409)
        expect(g.body.code).toBe('PERSONNEL_INSUFFISANT')
      } finally {
        for (const m of medecins)
          await base().utilisateur.update({
            where: { id: m.id },
            data: { statut: m.statut },
          })
      }
    })
  })

  describe('Une génération complète', () => {
    let avant: Awaited<ReturnType<typeof instantane>>
    let lot: Lot
    let patientTest: string
    let visiteTest: string

    it('démarre en arrière-plan : la réponse arrive tout de suite, la progression se lit pendant ce temps', async () => {
      avant = await instantane()
      const g = await generer(1, 8, 'graine-e2e')
      expect(g.status).toBe(201)
      expect(g.body).toMatchObject({ statut: 'EN_COURS' })
      expect(g.body.parametres.graine).toBe('graine-e2e')
      expect(g.body.progression.joursTotal).toBeGreaterThan(20)
      // un second lancement pendant que ça tourne est refusé
      const bis = await generer(1, 8)
      expect(bis.status).toBe(409)
      expect(bis.body.code).toBe('GENERATION_EN_COURS')
      lot = (await lotFini()) as Lot
    })

    it('elle va au bout : toutes les journées d’ouverture, sans échec', () => {
      expect(lot.statut).toBe('TERMINE')
      expect(lot.message).toBeNull()
      expect(lot.progression.joursFaits).toBe(lot.progression.joursTotal)
      expect(lot.progression.visites).toBeGreaterThan(80)
      expect(lot.progression.patients).toBeGreaterThan(20)
      expect(lot.progression.consultations).toBeGreaterThan(
        lot.progression.visites * 0.85,
      )
    })

    it('ce qui est annoncé est ce qui est en base : table par table, et tout est marqué', async () => {
      for (const m of MODELES_TEST) {
        const attendu = lot.progression.lignes[m.modele] ?? 0
        if (attendu === 0) continue
        const reel = await (
          base().raw as unknown as Record<
            string,
            { count: (a: unknown) => Promise<number> }
          >
        )[m.modele.charAt(0).toLowerCase() + m.modele.slice(1)].count({
          where: { id: { startsWith: MARQUE_ID } },
        })
        expect(reel).toBe(attendu)
      }
      const e = (await etat()).body
      expect(e.existantes.total).toBe(
        Object.values(lot.progression.lignes).reduce((s, n) => s + n, 0),
      )
      expect(e.existantes.tables.find((t) => t.modele === 'Visite')?.n).toBe(
        lot.progression.visites,
      )
      expect(e.enCours).toBe(false)
    })

    it('la période est respectée, les patients vus une fois par jour au plus, les visites cohérentes', async () => {
      const visites = await base().visite.findMany({
        where: { id: { startsWith: MARQUE_ID } },
        select: {
          patientId: true,
          dateOuverture: true,
          dateCloture: true,
          statut: true,
        },
      })
      const debut =
        new Date(lot.parametres.debut + 'T00:00:00Z').getTime() - 3600_000
      const fin =
        new Date(lot.parametres.fin + 'T23:59:59Z').getTime() + 3 * 3600_000
      const parJour = new Set<string>()
      for (const v of visites) {
        expect(+v.dateOuverture).toBeGreaterThanOrEqual(debut)
        expect(+v.dateOuverture).toBeLessThanOrEqual(fin)
        expect(+(v.dateCloture as Date)).toBeGreaterThan(+v.dateOuverture)
        expect(['CLOTUREE', 'ANNULEE']).toContain(v.statut)
        const cle = v.patientId + v.dateOuverture.toISOString().slice(0, 10)
        expect(parJour.has(cle)).toBe(false)
        parJour.add(cle)
      }
    })

    it('AUCUNE donnée d’identification répétée, tables comprises (vraies personnes incluses)', async () => {
      const identites = await base().raw.identitePatient.findMany({
        select: { nom: true, prenom: true, telephone: true },
      })
      const noms = new Set<string>()
      for (const i of identites) {
        const cle = cleNom(i.prenom, i.nom)
        expect(noms.has(cle)).toBe(false)
        noms.add(cle)
      }
      const tels = (
        await base().raw.$queryRaw<
          { n: bigint }[]
        >`SELECT count(*) AS n FROM (SELECT regexp_replace(t, '\\D', '', 'g') AS t, count(*) c FROM (SELECT telephone AS t FROM "IdentitePatient" UNION ALL SELECT telephone FROM "ContactUrgence") x WHERE t IS NOT NULL AND t <> '' GROUP BY 1 HAVING count(*) > 1) d`
      )[0].n
      expect(Number(tels)).toBe(0)
      const mats = await base().raw.patient.groupBy({
        by: ['matricule'],
        where: { matricule: { not: null } },
        _count: { _all: true },
        having: { matricule: { _count: { gt: 1 } } },
      })
      expect(mats).toHaveLength(0)
      const numeros = await base().raw.patient.groupBy({
        by: ['numeroPatient'],
        _count: { _all: true },
        having: { numeroPatient: { _count: { gt: 1 } } },
      })
      expect(numeros).toHaveLength(0)
      // aucun matricule de test ne coïncide avec celui d’un membre du personnel
      const personnel = new Set(
        (
          await base().raw.personnelMedical.findMany({
            select: { matricule: true },
          })
        ).map((p) => p.matricule),
      )
      const dossiers = await base().raw.patient.findMany({
        where: { id: { startsWith: MARQUE_ID }, matricule: { not: null } },
        select: { matricule: true },
      })
      expect(dossiers.length).toBeGreaterThan(0)
      for (const d of dossiers)
        expect(personnel.has(d.matricule as string)).toBe(false)
    })

    it('les gestes sont attribués à de VRAIS comptes du personnel, chacun dans son rôle', async () => {
      const comptes = await base().utilisateur.findMany({
        where: { personnelMedicalId: { not: null } },
        select: {
          id: true,
          personnelMedicalId: true,
          roles: { select: { role: { select: { code: true } } } },
        },
      })
      const medecins = new Set(
        comptes
          .filter((c) => c.roles.some((r) => r.role.code === 'MEDECIN_CHEF'))
          .map((c) => c.personnelMedicalId),
      )
      const medecinsUtilisateurs = new Set(
        comptes
          .filter((c) => c.roles.some((r) => r.role.code === 'MEDECIN_CHEF'))
          .map((c) => c.id),
      )
      const infirmiers = new Set(
        comptes
          .filter((c) => c.roles.some((r) => r.role.code === 'INFIRMIER'))
          .map((c) => c.id),
      )
      const consultations = await base().consultation.findMany({
        where: { id: { startsWith: MARQUE_ID } },
        select: { soignantId: true },
      })
      for (const c of consultations)
        expect(medecins.has(c.soignantId)).toBe(true)
      const constantes = await base().constanteVitale.findMany({
        where: { id: { startsWith: MARQUE_ID } },
        select: { saisiePar: true },
      })
      for (const c of constantes) expect(infirmiers.has(c.saisiePar)).toBe(true)
      const audit = await base().journalAudit.findMany({
        where: { id: { startsWith: MARQUE_ID } },
        select: {
          utilisateurId: true,
          module: true,
          ipAdresse: true,
          statut: true,
        },
      })
      expect(audit.length).toBeGreaterThan(lot.progression.visites * 6)
      for (const a of audit) {
        expect(a.utilisateurId).toBeTruthy()
        if (a.module === 'consultation')
          expect(medecinsUtilisateurs.has(a.utilisateurId as string)).toBe(true)
        if (a.module === 'visite')
          expect(infirmiers.has(a.utilisateurId as string)).toBe(true)
        expect(a.ipAdresse).toMatch(/^\d+\.\d+\.\d+\.\d+$/)
        expect(a.statut).toBe('SUCCES')
      }
    })

    it('tous les sites et tous les rôles du personnel travaillent', async () => {
      const visites = await base().visite.groupBy({
        by: ['siteId'],
        where: { id: { startsWith: MARQUE_ID } },
        _count: { _all: true },
      })
      expect(visites.length).toBe(2)
      const medecins = await base().consultation.groupBy({
        by: ['soignantId'],
        where: { id: { startsWith: MARQUE_ID } },
        _count: { _all: true },
      })
      expect(medecins.length).toBeGreaterThanOrEqual(2)
    })

    it('la génération ne touche ni aux comptes, ni au personnel, ni aux référentiels, ni aux notifications', async () => {
      const apres = await instantane()
      const fabriquees = {
        patients: 'Patient',
        visites: 'Visite',
        consultations: 'Consultation',
        audit: 'JournalAudit',
        ordonnances: 'Ordonnance',
        lignesOrdonnance: 'LigneOrdonnance',
        bonsExamen: 'BonExamen',
        lignesExamen: 'LigneExamen',
        resultats: 'ResultatExamen',
        bonsPharmacie: 'BonPharmacie',
        lignesBonPharmacie: 'LigneBonPharmacie',
        suivisChroniques: 'SuiviChronique',
        evacuations: 'Evacuation',
        etapesEvacuation: 'SuiviEvacuation',
        suivisTraitement: 'SuiviTraitement',
        fiches: 'FicheSuiviTraitement',
        administrations: 'AdministrationTraitement',
        sessions: 'SessionUtilisateur',
        connexions: 'JournalAuthentification',
      } as const
      const sauf = (x: Record<string, number>) =>
        Object.fromEntries(
          Object.entries(x).filter(([cle]) => !(cle in fabriquees)),
        )
      // Tout ce que la génération ne fabrique pas est strictement intact.
      expect(sauf(apres)).toEqual(sauf(avant))
      // Et ce qu'elle fabrique est exactement ce qu'elle annonce, table par table.
      const ecarts = Object.fromEntries(
        Object.entries(fabriquees).map(([cle, modele]) => [
          cle,
          apres[cle as keyof typeof fabriquees] -
            avant[cle as keyof typeof fabriquees] -
            (lot.progression.lignes[modele] ?? 0),
        ]),
      )
      expect(Object.values(ecarts).every((e) => e === 0)).toBe(true)
    })

    it('les routes ORDINAIRES de l’application lisent ces données comme n’importe quelles autres', async () => {
      const dossier = await base().patient.findFirstOrThrow({
        where: {
          id: { startsWith: MARQUE_ID },
          visites: {
            some: {
              statut: 'CLOTUREE',
              consultations: { some: { statut: 'CLOTUREE' } },
            },
          },
        },
        select: {
          id: true,
          numeroPatient: true,
          identite: { select: { nom: true, prenom: true } },
        },
      })
      patientTest = dossier.id
      expect(estIdTest(patientTest)).toBe(true)
      const fiche = await infirmier.get<{
        id: string
        numeroPatient: string
        identite: { nom: string }
      }>(`/patients/${patientTest}`)
      expect(fiche.status).toBe(200)
      expect(fiche.body.numeroPatient).toBe(dossier.numeroPatient)
      // la recherche par nom complet le retrouve
      const q = `${dossier.identite!.prenom} ${dossier.identite!.nom}`
      const recherche = await infirmier.get<
        { data?: { id: string }[] } | { id: string }[]
      >(`/patients?search=${encodeURIComponent(q)}`)
      expect(recherche.status).toBe(200)
      const liste = Array.isArray(recherche.body)
        ? recherche.body
        : (recherche.body.data ?? [])
      expect(liste.map((p) => p.id)).toContain(patientTest)
      // L'historique des visites passées est réservé au médecin chef (confidentialité du recueil).
      const visites = await medecin.get<{ id: string; statut: string }[]>(
        `/triage/visites/patient/${patientTest}`,
      )
      expect(visites.status).toBe(200)
      expect(visites.body.length).toBeGreaterThan(0)
      visiteTest = visites.body[0].id
      expect((await medecin.get(`/triage/visites/${visiteTest}`)).status).toBe(
        200,
      )
      expect(
        (await infirmier.get(`/triage/visites/patient/${patientTest}`)).status,
      ).toBe(200)
      const consultations = await medecin.get<{ id: string }[]>(
        `/consultations?patientId=${patientTest}&statut=TOUTES`,
      )
      expect(consultations.status).toBe(200)
      expect(consultations.body.length).toBeGreaterThan(0)
      expect(
        (await medecin.get(`/consultations/${consultations.body[0].id}`))
          .status,
      ).toBe(200)
      expect((await admin.get('/dashboard/statistiques')).status).toBeLessThan(
        500,
      )
    })

    it('ordonnances, bons, résultats, évacuations et suivis : fabriqués, et lisibles par les routes ordinaires', async () => {
      const l = lot.progression.lignes
      const absentes = [
        'Ordonnance',
        'LigneOrdonnance',
        'BonPharmacie',
        'LigneBonPharmacie',
        'SuiviChronique',
      ].filter((table) => !((l[table] ?? 0) > 0))
      expect(absentes).toEqual([])
      expect(l['LigneOrdonnance']).toBeGreaterThanOrEqual(l['Ordonnance'])
      // une consultation clôturée qui a prescrit des médicaments et dont le bon est délivré
      const ordonnance = await base().ordonnance.findFirstOrThrow({
        where: {
          id: { startsWith: MARQUE_ID },
          typeOrdonnance: 'PHARMACEUTIQUE',
          statut: 'VALIDEE',
          bonsPharmacie: { some: { statut: 'DELIVRE' } },
        },
        select: {
          id: true,
          consultationId: true,
          consultation: { select: { visite: { select: { patientId: true } } } },
        },
      })
      const patientId = ordonnance.consultation.visite.patientId
      const c = await medecin.get<{
        ordonnances: {
          id: string
          statut: string
          lignes: { posologie: string; medicament: { nomGenerique: string } }[]
        }[]
      }>(`/consultations/${ordonnance.consultationId}`)
      expect(c.status).toBe(200)
      const o = c.body.ordonnances.find((x) => x.id === ordonnance.id)
      expect(o?.statut).toBe('VALIDEE')
      expect(o?.lignes.length).toBeGreaterThan(0)
      for (const ligne of o?.lignes ?? []) {
        expect(ligne.posologie.length).toBeGreaterThan(3)
        expect(ligne.medicament.nomGenerique.length).toBeGreaterThan(2)
      }
      const bonsDeLaConsultation = await medecin.get<{ statut: string }[]>(
        `/bons-pharmacie?consultationId=${ordonnance.consultationId}`,
      )
      expect(bonsDeLaConsultation.status).toBe(200)
      expect(bonsDeLaConsultation.body.map((b) => b.statut)).toContain(
        'DELIVRE',
      )
      // l'onglet Documents du dossier : ordonnance, bon de pharmacie (et certificat de repos de la livraison 1)
      const docs = await medecin.get<{ type: string }[]>(
        `/consultations/patient/${patientId}/documents`,
      )
      expect(docs.status).toBe(200)
      const types = docs.body.map((d) => d.type)
      expect(types).toContain('BON_PHARMACIE')
      expect(types.some((t) => t.includes('ORDONNANCE'))).toBe(true)
      const bons = await medecin.get<{ id: string; statut: string }[]>(
        `/bons-pharmacie?patientId=${patientId}`,
      )
      expect(bons.status).toBe(200)
      expect(bons.body.length).toBeGreaterThan(0)
      expect(bons.body.every((b) => estIdTest(b.id))).toBe(true)

      // Résultats d'examen : un bon validé, ses examens, leurs résultats
      const bonExamen = await base().bonExamen.findFirst({
        where: {
          id: { startsWith: MARQUE_ID },
          resultats: { some: { statut: 'RECU' } },
        },
        select: {
          id: true,
          consultation: { select: { visite: { select: { patientId: true } } } },
        },
      })
      expect(bonExamen).not.toBeNull()
      const be = await medecin.get<
        {
          id: string
          statut: string
          lignes: unknown[]
          resultats: { contenu: string; statut: string }[]
        }[]
      >(`/bons-examen?patientId=${bonExamen?.consultation.visite.patientId}`)
      expect(be.status).toBe(200)
      const bon = be.body.find((b) => b.id === bonExamen?.id)
      expect(bon?.statut).toBe('VALIDE')
      expect(bon?.lignes.length).toBeGreaterThan(0)
      expect(bon?.resultats.some((r) => r.statut === 'RECU')).toBe(true)

      // Suivi de traitement : l'épisode et ses fiches sont lus comme n'importe quel autre
      const suivi = await base().suiviTraitement.findFirst({
        where: {
          id: { startsWith: MARQUE_ID },
          fiches: { some: {} },
        },
        select: {
          id: true,
          consultation: { select: { visite: { select: { patientId: true } } } },
        },
      })
      expect(suivi).not.toBeNull()
      const sl = await medecin.get<{ id: string }[]>(
        `/suivi-traitement?patientId=${suivi?.consultation.visite.patientId}`,
      )
      expect(sl.status).toBe(200)
      expect(sl.body.map((x) => x.id)).toContain(suivi?.id)
      const ep = await medecin.get<{ fiches?: unknown[] }>(
        `/suivi-traitement/${suivi?.id}/episode`,
      )
      expect(ep.status).toBe(200)

      // Évacuation : si la génération en a produit, la route des sorties critiques les lit
      const evac = await base().evacuation.findFirst({
        where: { id: { startsWith: MARQUE_ID } },
        select: {
          id: true,
          consultation: { select: { visite: { select: { patientId: true } } } },
        },
      })
      if (evac) {
        const el = await medecin.get<{ id: string }[]>(
          `/evacuations?patientId=${evac.consultation.visite.patientId}`,
        )
        expect(el.status).toBe(200)
        expect(el.body.map((x) => x.id)).toContain(evac.id)
      }
      // Rien n'est daté après la fin de la période : on ne fabrique pas d'avenir
      const finMs = new Date(lot.parametres.fin + 'T23:59:59Z').getTime()
      const marque = { startsWith: MARQUE_ID }
      const plusTard = [
        (
          await base().resultatExamen.aggregate({
            where: { id: marque },
            _max: { createdAt: true },
          })
        )._max.createdAt,
        (
          await base().ficheSuiviTraitement.aggregate({
            where: { id: marque },
            _max: { createdAt: true },
          })
        )._max.createdAt,
        (
          await base().suiviEvacuation.aggregate({
            where: { id: marque },
            _max: { createdAt: true },
          })
        )._max.createdAt,
        (
          await base().bonPharmacie.aggregate({
            where: { id: marque },
            _max: { delivreLe: true },
          })
        )._max.delivreLe,
      ]
      for (const d of plusTard) expect(+(d as Date)).toBeLessThanOrEqual(finMs)
      // Le suivi chronique apparaît dans le dossier (onglet Suivi)
      const sc = await base().suiviChronique.findFirstOrThrow({
        where: { id: { startsWith: MARQUE_ID } },
        select: { patientId: true },
      })
      expect(
        (await medecin.get(`/patients/${sc.patientId}/suivi`)).status,
      ).toBe(200)
    })

    it('connexions : lisibles par le journal d’authentification, aucune session laissée ouverte, bilan établi', async () => {
      const l = lot.progression.lignes
      expect(l['SessionUtilisateur'] ?? 0).toBeGreaterThan(0)
      expect(l['JournalAuthentification'] ?? 0).toBeGreaterThan(0)
      // Aucune session fabriquée ne reste ouverte à la fin : une personne qui se connecterait pour de vrai
      // depuis un autre appareil se verrait demander « une session est déjà ouverte ».
      const ouvertes = await base().sessionUtilisateur.count({
        where: { id: { startsWith: MARQUE_ID }, revokedAt: null },
      })
      expect(ouvertes).toBe(0)
      // Le journal de l'administration les lit comme n'importe quelle connexion
      const r = await admin.get<{
        data: {
          id: string
          resultat: string
          login: string
          connexion: { etat: string; dureeMinutes: number } | null
          position: { etat: string; latitude: number | null } | null
          poste: unknown
        }[]
        total: number
      }>('/admin/audit/authentifications?resultat=SUCCES_LOGIN&limit=500')
      expect(r.status).toBe(200)
      const fabriquees = r.body.data.filter((x) => estIdTest(x.id))
      expect(fabriquees.length).toBeGreaterThan(50)
      expect(fabriquees.every((x) => x.poste === null)).toBe(true)
      // la colonne « Login » du journal affiche un identifiant de connexion, pas un identifiant technique
      const logins = new Set(
        (await base().utilisateur.findMany({ select: { login: true } })).map(
          (u) => u.login,
        ),
      )
      expect(fabriquees.every((x) => logins.has(x.login))).toBe(true)
      expect(
        fabriquees.some((x) => (x.connexion?.dureeMinutes ?? 0) > 360),
      ).toBe(true)
      expect(
        fabriquees.every(
          (x) =>
            x.connexion?.etat === 'TERMINEE' ||
            x.connexion?.etat === 'INTERROMPUE',
        ),
      ).toBe(true)
      const etatsPosition = new Set(fabriquees.map((x) => x.position?.etat))
      expect(etatsPosition.has('OK')).toBe(true)
      // Le bilan de la génération
      const bilan = (await etat()).body.lot?.bilan
      expect(bilan).toBeTruthy()
      expect(bilan?.sites.length).toBe(2)
      expect(bilan?.sites.reduce((n, x) => n + x.visites, 0)).toBe(l['Visite'])
      expect(bilan?.categories.reduce((n, x) => n + x.patients, 0)).toBe(
        l['Patient'],
      )
      expect(bilan?.connexions.reussies).toBeGreaterThan(50)
      expect(bilan?.connexions.deconnexions).toBeGreaterThan(20)
      expect(bilan?.connexions.appareils).toBeGreaterThan(2)
      expect(bilan?.documents.ordonnances).toBe(l['Ordonnance'])
      expect(bilan?.tailleOctets ?? 0).toBeGreaterThan(100_000)
    })

    it('le journal d’audit les montre, avec leur auteur et leur adresse', async () => {
      const r = await admin.get<{
        data: { entiteId: string | null; module: string }[]
      }>(`/admin/audit/actions`)
      expect(r.status).toBe(200)
      expect(r.body.data.length).toBeGreaterThan(0)
    })

    it('tant que des données de test existent, une nouvelle génération est refusée', async () => {
      const g = await generer(1, 5)
      expect(g.status).toBe(409)
      expect(g.body.code).toBe('DONNEES_EXISTANTES')
    })

    it('SUPPRESSION : tout ce qui est marqué part, et la base revient EXACTEMENT où elle était', async () => {
      const r = await admin.delete<{
        lignes: number
        tables: Record<string, number>
      }>('/systeme/donnees-test')
      expect(r.status).toBe(200)
      expect(r.body.lignes).toBeGreaterThan(lot.progression.visites * 8)
      expect(r.body.tables['Visite']).toBe(lot.progression.lignes['Visite'])
      expect(r.body.tables['JournalAudit']).toBe(
        lot.progression.lignes['JournalAudit'],
      )
      // Plus rien de marqué, ni de rattaché à un dossier de test
      for (const m of MODELES_TEST) {
        const d = (
          base().raw as unknown as Record<
            string,
            { count: (a: unknown) => Promise<number> }
          >
        )[m.modele.charAt(0).toLowerCase() + m.modele.slice(1)]
        expect(await d.count({ where: m.perimetre })).toBe(0)
      }
      expect(await instantane()).toEqual(avant)
      const e = (await etat()).body
      expect(e.existantes.total).toBe(0)
      expect(e.lot).toBeNull()
    })

    it('l’opération est tracée dans le journal d’audit (non marquée, donc conservée)', async () => {
      const traces = await base().journalAudit.findMany({
        where: { module: 'systeme', entiteType: 'DonneesTest' },
        orderBy: { createdAt: 'asc' },
      })
      const actions = traces.map((t) => t.action)
      expect(actions).toContain('DONNEES_TEST_DEMARRAGE')
      expect(actions).toContain('DONNEES_TEST_SUPPRESSION')
      expect(traces.every((t) => !estIdTest(t.id))).toBe(true)
      const sup = traces.find((t) => t.action === 'DONNEES_TEST_SUPPRESSION')!
      expect(sup.utilisateurId).toBe(admin.user.id)
      expect(sup.ipAdresse).toBeTruthy()
      expect((sup.apresJson as { lignes: number }).lignes).toBeGreaterThan(0)
    })
  })

  describe('Arrêt, reprise, et garde-fous en cours de route', () => {
    it('arrêt demandé : la journée en cours finit, puis plus rien ; la reprise continue sans doublon ni trou', async () => {
      const g = await generer(1, 14, 'reprise-e2e')
      expect(g.status).toBe(201)
      await attendre(
        async () => (await etat()).body.lot,
        (l) => !!l && l.progression.joursFaits >= 2,
      )
      expect(
        (await admin.post('/systeme/donnees-test/generation/arret', {})).status,
      ).toBe(200)
      const arrete = (await lotFini()) as Lot
      expect(arrete.statut).toBe('ANNULE')
      expect(arrete.message).toMatch(/reprendre/)
      expect(arrete.progression.joursFaits).toBeGreaterThanOrEqual(2)
      expect(arrete.progression.joursFaits).toBeLessThan(
        arrete.progression.joursTotal,
      )
      // ce qui est écrit est cohérent : chaque visite a son patient et le nombre annoncé est le nombre réel
      expect(
        await base().visite.count({ where: { id: { startsWith: MARQUE_ID } } }),
      ).toBe(arrete.progression.visites)
      const fait = arrete.progression.joursFaits
      const dossiers = await base().patient.count({
        where: { id: { startsWith: MARQUE_ID } },
      })
      const dernierJourFait = (
        await base().visite.aggregate({
          where: { id: { startsWith: MARQUE_ID } },
          _max: { dateOuverture: true },
        })
      )._max.dateOuverture as Date
      const avantArret = await base().patient.findMany({
        where: { id: { startsWith: MARQUE_ID } },
        select: { id: true },
      })

      const rep = await admin.post<Lot>(
        '/systeme/donnees-test/generation/reprise',
        {},
      )
      expect(rep.status).toBe(201)
      const fini = (await lotFini()) as Lot
      expect(fini.statut).toBe('TERMINE')
      expect(fini.progression.joursFaits).toBe(fini.progression.joursTotal)
      expect(fini.progression.joursFaits).toBeGreaterThan(fait)
      expect(fini.progression.patients).toBeGreaterThan(0)
      expect(
        await base().patient.count({
          where: { id: { startsWith: MARQUE_ID } },
        }),
      ).toBeGreaterThan(dossiers)

      // La patientèle est RECONSTRUITE à la reprise : des personnes déjà vues avant l'arrêt reviennent après.
      const revenus = await base().visite.count({
        where: {
          id: { startsWith: MARQUE_ID },
          dateOuverture: { gt: dernierJourFait },
          patientId: { in: avantArret.map((x) => x.id) },
        },
      })
      expect(revenus).toBeGreaterThan(0)

      // Aucune répétition malgré l’arrêt : noms, numéros contigus par site, matricules
      const identites = await base().raw.identitePatient.findMany({
        select: { nom: true, prenom: true },
      })
      const noms = new Set(identites.map((i) => cleNom(i.prenom, i.nom)))
      expect(noms.size).toBe(identites.length)
      const marques = await base().raw.patient.findMany({
        where: { id: { startsWith: MARQUE_ID } },
        select: { numeroPatient: true, createdAt: true },
      })
      const parPrefixe = new Map<string, number[]>()
      for (const p of marques) {
        const m = /^PAT-([A-Z]{3})-(\d{5})$/.exec(p.numeroPatient)!
        parPrefixe.set(m[1], [...(parPrefixe.get(m[1]) ?? []), Number(m[2])])
      }
      for (const nums of parPrefixe.values()) {
        nums.sort((a, b) => a - b)
        // à la suite les uns des autres, sans trou ni doublon (les numéros déjà pris ailleurs sont avant)
        nums.forEach((n, i) => i > 0 && expect(n).toBe(nums[i - 1] + 1))
      }
      // Les maladies chroniques continuent d’être suivies après la reprise
      const suivis = await base().antecedentPatient.count({
        where: { id: { startsWith: MARQUE_ID }, pathologieId: { not: null } },
      })
      expect(suivis).toBeGreaterThan(0)
    })

    it('à la reprise, la patientèle est reconstruite avec ses allergies, ses alertes et ses suivis chroniques', async () => {
      await admin.delete('/systeme/donnees-test')
      expect((await generer(1, 12, 'population-e2e')).status).toBe(201)
      await lotFini()
      const service = app.get(DonneesTestService)
      const interne = service as unknown as {
        chargerReferentiels: () => Promise<unknown>
        chargerPopulation: (
          ref: unknown,
          graine: string,
        ) => Promise<{
          tous: {
            id: string
            allergies: string[]
            alertes: string[]
            suivisChroniques: string[]
          }[]
        }>
      }
      const population = await interne.chargerPopulation(
        await interne.chargerReferentiels(),
        'population-e2e',
      )
      const marque = { startsWith: MARQUE_ID }
      const allergies = await base().allergiePatient.count({
        where: { patientId: marque, statut: 'ACTIVE' },
      })
      const alertes = await base().alerteMedicale.count({
        where: { patientId: marque, statut: 'ACTIVE' },
      })
      const suivis = await base().suiviChronique.count({
        where: { patientId: marque, statut: 'ACTIF' },
      })
      expect(allergies).toBeGreaterThan(0)
      expect(alertes).toBeGreaterThan(0)
      expect(suivis).toBeGreaterThan(0)
      const somme = (cle: 'allergies' | 'alertes' | 'suivisChroniques') =>
        population.tous.reduce((n, p) => n + p[cle].length, 0)
      expect(somme('allergies')).toBe(allergies)
      expect(somme('alertes')).toBe(alertes)
      expect(somme('suivisChroniques')).toBe(suivis)
      await admin.delete('/systeme/donnees-test')
    })

    it('quitter le mode Test arrête la génération d’elle-même, et le message le dit', async () => {
      await admin.delete('/systeme/donnees-test')
      const g = await generer(2, 14, 'mode-e2e')
      expect(g.status).toBe(201)
      await attendre(
        async () => (await etat()).body.lot,
        (l) => !!l && l.progression.joursFaits >= 1,
      )
      expect((await changerMode('PRODUCTION')).status).toBe(200)
      const l = (await lotFini()) as Lot
      expect(l.statut).toBe('INTERROMPU')
      expect(l.message).toMatch(/mode Test/)
      expect(l.progression.joursFaits).toBeLessThan(l.progression.joursTotal)
      // en production on ne reprend pas, on ne supprime pas
      expect(
        (await admin.post('/systeme/donnees-test/generation/reprise', {}))
          .status,
      ).toBe(409)
      expect((await admin.delete('/systeme/donnees-test')).status).toBe(409)
      // de retour en mode Test : la reprise est permise
      expect((await changerMode('TEST')).status).toBe(200)
      expect(
        (await admin.post('/systeme/donnees-test/generation/reprise', {}))
          .status,
      ).toBe(201)
      expect(((await lotFini()) as Lot).statut).toBe('TERMINE')
    })

    it('un redémarrage du serveur au milieu d’une génération la marque « interrompue », reprenable', async () => {
      await admin.delete('/systeme/donnees-test')
      // État laissé par un processus mort en pleine génération
      const lot = {
        id: '11111111-2222-4333-8444-555555555555',
        creePar: admin.user.id,
        creeLe: new Date().toISOString(),
        statut: 'EN_COURS',
        parametres: {
          mois: 1,
          visitesParJour: 5,
          graine: 'x',
          debut: '2026-09-01',
          fin: '2026-09-30',
        },
        progression: {
          joursTotal: 25,
          joursFaits: 3,
          jourCourant: '2026-09-04',
          visites: 10,
          patients: 8,
          consultations: 9,
          visitesAnnulees: 1,
          consultationsAnnulees: 0,
          nonRecus: 0,
          lignes: {},
        },
        message: null,
        termineLe: null,
        derniereMaj: new Date().toISOString(),
      }
      await base().parametreSysteme.upsert({
        where: { cle: 'systeme.donnees_test' },
        update: { valeur: JSON.stringify({ lots: [lot] }) },
        create: {
          cle: 'systeme.donnees_test',
          valeur: JSON.stringify({ lots: [lot] }),
        },
      })
      await app.get(DonneesTestService).onApplicationBootstrap()
      const l = (await etat()).body.lot!
      expect(l.statut).toBe('INTERROMPU')
      expect(l.message).toMatch(/redémarré/)
      expect(l.progression.joursFaits).toBe(3)
      await admin.delete('/systeme/donnees-test')
    })

    it('une base qui se remplit pendant la génération l’arrête : la limite est vérifiée à chaque journée', async () => {
      await admin.delete('/systeme/donnees-test')
      const g = await generer(1, 14, 'taille-e2e')
      expect(g.status).toBe(201)
      await attendre(
        async () => (await etat()).body.lot,
        (l) => !!l && l.progression.joursFaits >= 1,
      )
      process.env['DONNEES_TEST_TAILLE_MAX_MO'] = '1'
      try {
        const l = (await lotFini()) as Lot
        expect(l.statut).toBe('INTERROMPU')
        expect(l.message).toMatch(/limite/)
      } finally {
        delete process.env['DONNEES_TEST_TAILLE_MAX_MO']
      }
    })

    it('la suppression est refusée pendant qu’une génération tourne', async () => {
      await admin.delete('/systeme/donnees-test')
      const g = await generer(1, 14, 'supp-e2e')
      expect(g.status).toBe(201)
      const refus = await admin.delete<Refus>('/systeme/donnees-test')
      expect(refus.status).toBe(409)
      expect(refus.body.code).toBe('GENERATION_EN_COURS')
      await lotFini()
    })
  })

  describe('Un dossier créé à la main n’est jamais touché', () => {
    it('la suppression ne retire que le marqué : un vrai patient, ses visites et son audit restent', async () => {
      await admin.delete('/systeme/donnees-test')
      const ref = await referentiels(infirmier)
      const vrai = await creerPatientCdi(infirmier, ref, 'Vrai')
      const avantSuppression = await base().patient.count()
      expect((await generer(1, 6, 'preserve-e2e')).status).toBe(201)
      await lotFini()
      expect(await base().patient.count()).toBeGreaterThan(avantSuppression)
      const r = await admin.delete<{ lignes: number }>('/systeme/donnees-test')
      expect(r.status).toBe(200)
      expect(await base().patient.count()).toBe(avantSuppression)
      expect(
        await base().patient.findUnique({ where: { id: vrai } }),
      ).not.toBeNull()
      expect((await infirmier.get(`/patients/${vrai}`)).status).toBe(200)
    })

    it('ce qu’un utilisateur ajoute à la main sur un dossier de test part avec lui, sans erreur de clé étrangère', async () => {
      await admin.delete('/systeme/donnees-test')
      const avantAjout = await instantane()
      expect((await generer(1, 6, 'ajout-e2e')).status).toBe(201)
      await lotFini()
      const dossier = await base().patient.findFirstOrThrow({
        where: { id: { startsWith: MARQUE_ID } },
        select: { id: true },
      })
      const ref = await referentiels(infirmier)
      // Visite et allergie ORDINAIRES (identifiants normaux) rattachées à un dossier de test
      const v = await infirmier.post<{ id: string }>('/triage/visites', {
        patientId: dossier.id,
        motifPrincipalId: ref.motifId,
      })
      expect(v.status).toBe(201)
      expect(estIdTest(v.body.id)).toBe(false)
      const al = await infirmier.post<{ id: string }>(
        `/patients/${dossier.id}/allergies`,
        {
          substance: 'Poussière e2e',
          gravite: 'FAIBLE',
        },
      )
      expect(al.status).toBe(201)
      expect(estIdTest(al.body.id)).toBe(false)

      const r = await admin.delete<{
        lignes: number
        tables: Record<string, number>
      }>('/systeme/donnees-test')
      expect(r.status).toBe(200)
      expect(r.body.tables['AllergiePatient']).toBeGreaterThanOrEqual(1)
      expect(
        await base().visite.findUnique({ where: { id: v.body.id } }),
      ).toBeNull()
      expect(
        await base().raw.allergiePatient.findUnique({
          where: { id: al.body.id },
        }),
      ).toBeNull()
      // Les tables métier sont revenues où elles étaient. Ne restent que des TRACES de gestes réels
      // sans lien avec le dossier (l'audit d’une création, la notification « nouvelle visite »).
      const apres = await instantane()
      const { audit: a1, notifications: n1, ...metier } = apres
      const { audit: a0, notifications: n0, ...metierAvant } = avantAjout
      expect(metier).toEqual(metierAvant)
      expect(a1 - a0).toBeLessThanOrEqual(2)
      expect(n1 - n0).toBeLessThanOrEqual(1)
    })

    it('ce qu’on ajoute à la main sur un document de test (bon, résultat, fiche, étape, administration) part avec lui', async () => {
      await admin.delete('/systeme/donnees-test')
      const avantAjout = await instantane()
      expect((await generer(1, 6, 'documents-e2e')).status).toBe(201)
      await lotFini()
      // Des consultations clôturées de test, sans évacuation ni suivi de traitement
      const consultations = await base().consultation.findMany({
        where: {
          id: { startsWith: MARQUE_ID },
          statut: 'CLOTUREE',
          evacuation: null,
          suiviTraitement: null,
        },
        select: {
          id: true,
          soignantId: true,
          visite: { select: { patientId: true } },
        },
        take: 3,
      })
      expect(consultations.length).toBe(3)
      const [c1, c2, c3] = consultations
      const type = await base().typeExamen.findFirstOrThrow()
      const medicament = await base().medicamentReference.findFirstOrThrow()
      const pathologie = await base().pathologieReference.findFirstOrThrow({
        where: { chronique: true },
      })
      const raw = base().raw
      // Tout est créé avec des identifiants ORDINAIRES, rattachés à des lignes marquées.
      const ordonnance = await raw.ordonnance.create({
        data: {
          consultationId: c1.id,
          prescripteurId: c1.soignantId,
          statut: 'VALIDEE',
          typeOrdonnance: 'PHARMACEUTIQUE',
        },
      })
      const ligne = await raw.ligneOrdonnance.create({
        data: { ordonnanceId: ordonnance.id, medicamentId: medicament.id },
      })
      const bonExamen = await raw.bonExamen.create({
        data: { consultationId: c1.id, indicationClinik: 'ajout à la main' },
      })
      const ligneExamen = await raw.ligneExamen.create({
        data: { bonId: bonExamen.id, typeExamenId: type.id },
      })
      const resultat = await raw.resultatExamen.create({
        data: {
          bonId: bonExamen.id,
          ligneExamenId: ligneExamen.id,
          contenu: 'ajout à la main',
          saisiePar: admin.user.id,
        },
      })
      const piece = await raw.pieceJointeResultat.create({
        data: {
          bonId: bonExamen.id,
          nomFichier: 'compte-rendu.pdf',
          mimeType: 'application/pdf',
          taille: 3,
          contenuChiffre: 'xxx',
        },
      })
      const bonPharmacie = await raw.bonPharmacie.create({
        data: { consultationId: c1.id, prescripteurId: c1.soignantId },
      })
      const ligneBon = await raw.ligneBonPharmacie.create({
        data: { bonId: bonPharmacie.id, libelle: 'ajout à la main' },
      })
      const evacuation = await raw.evacuation.create({
        data: { consultationId: c2.id, niveauUrgence: 'BASSE' },
      })
      const etape = await raw.suiviEvacuation.create({
        data: {
          evacuationId: evacuation.id,
          notes: 'ajout',
          statut: 'EN_COURS',
        },
      })
      const suivi = await raw.suiviTraitement.create({
        data: { consultationId: c3.id, motif: 'ajout à la main' },
      })
      const fiche = await raw.ficheSuiviTraitement.create({
        data: { suiviTraitementId: suivi.id, noteEvolution: 'ajout' },
      })
      const administration = await raw.administrationTraitement.create({
        data: { ligneOrdonnanceId: ligne.id, suiviTraitementId: suivi.id },
      })
      const suiviChroniqueDossier = await raw.suiviChronique.create({
        data: {
          patientId: c1.visite.patientId,
          pathologieId: pathologie.id,
          frequenceSuivi: 'Mensuel',
        },
      })
      const suiviChroniqueConsultation = await raw.suiviChronique.create({
        data: { consultationId: c2.id, pathologieId: pathologie.id },
      })
      for (const x of [
        ordonnance,
        ligne,
        bonExamen,
        ligneExamen,
        resultat,
        piece,
        bonPharmacie,
        ligneBon,
        evacuation,
        etape,
        suivi,
        fiche,
        administration,
        suiviChroniqueDossier,
        suiviChroniqueConsultation,
      ])
        expect(estIdTest(x.id)).toBe(false)

      const r = await admin.delete<{ tables: Record<string, number> }>(
        '/systeme/donnees-test',
      )
      expect(r.status).toBe(200)
      const restantes: string[] = []
      for (const [table, ligneCreee] of [
        ['Ordonnance', ordonnance],
        ['LigneOrdonnance', ligne],
        ['BonExamen', bonExamen],
        ['LigneExamen', ligneExamen],
        ['ResultatExamen', resultat],
        ['PieceJointeResultat', piece],
        ['BonPharmacie', bonPharmacie],
        ['LigneBonPharmacie', ligneBon],
        ['Evacuation', evacuation],
        ['SuiviEvacuation', etape],
        ['SuiviTraitement', suivi],
        ['FicheSuiviTraitement', fiche],
        ['AdministrationTraitement', administration],
        ['SuiviChronique', suiviChroniqueDossier],
        ['SuiviChronique', suiviChroniqueConsultation],
      ] as const) {
        const d = (
          raw as unknown as Record<
            string,
            { findUnique: (a: unknown) => Promise<unknown> }
          >
        )[table.charAt(0).toLowerCase() + table.slice(1)]
        if (await d.findUnique({ where: { id: ligneCreee.id } }))
          restantes.push(table)
      }
      expect(restantes).toEqual([])
      const { audit: a1, notifications: n1, ...metier } = await instantane()
      const { audit: a0, notifications: n0, ...metierAvant } = avantAjout
      expect(metier).toEqual(metierAvant)
      expect(a1).toBe(a0)
      expect(n1).toBe(n0)
    })

    it('une vraie connexion (identifiant ordinaire) survit à la suppression des connexions fabriquées', async () => {
      await admin.delete('/systeme/donnees-test')
      expect((await generer(1, 4, 'vraie-connexion-e2e')).status).toBe(201)
      await lotFini()
      const raw = base().raw
      const vraie = await raw.journalAuthentification.create({
        data: {
          utilisateurId: admin.user.id,
          login: 'vrai.login',
          resultat: 'SUCCES_LOGIN',
        },
      })
      const session = await raw.sessionUtilisateur.create({
        data: {
          utilisateurId: admin.user.id,
          refreshTokenHash: 'x',
          expiresAt: new Date(Date.now() + 1000),
          revokedAt: new Date(),
        },
      })
      try {
        expect(estIdTest(vraie.id) || estIdTest(session.id)).toBe(false)
        const r = await admin.delete<{ tables: Record<string, number> }>(
          '/systeme/donnees-test',
        )
        expect(r.status).toBe(200)
        expect(r.body.tables['SessionUtilisateur']).toBeGreaterThan(0)
        expect(r.body.tables['JournalAuthentification']).toBeGreaterThan(0)
        expect(
          await raw.journalAuthentification.findUnique({
            where: { id: vraie.id },
          }),
        ).not.toBeNull()
        expect(
          await raw.sessionUtilisateur.findUnique({
            where: { id: session.id },
          }),
        ).not.toBeNull()
        expect(
          await raw.sessionUtilisateur.count({
            where: { id: { startsWith: MARQUE_ID } },
          }),
        ).toBe(0)
      } finally {
        await raw.journalAuthentification.deleteMany({
          where: { id: vraie.id },
        })
        await raw.sessionUtilisateur.deleteMany({ where: { id: session.id } })
      }
    })

    it('quand rien n’est à supprimer, la suppression réussit sans rien faire', async () => {
      const r = await admin.delete<{ lignes: number }>('/systeme/donnees-test')
      expect(r.status).toBe(200)
      expect(r.body.lignes).toBe(0)
    })
  })

  describe('Le verrou de mise en service interdit aussi la génération', () => {
    it('MODE_TEST_AUTORISE=false : même après un passage en mode Test, plus rien ne se génère', async () => {
      process.env['MODE_TEST_AUTORISE'] = 'false'
      try {
        const e = (await etat()).body
        expect(e.mode).toBe('PRODUCTION')
        expect(e.disponible).toBe(false)
        const g = await generer(1, 5)
        expect(g.status).toBe(409)
        expect(g.body.code).toBe('MODE_PRODUCTION')
      } finally {
        delete process.env['MODE_TEST_AUTORISE']
      }
    })
  })
})
