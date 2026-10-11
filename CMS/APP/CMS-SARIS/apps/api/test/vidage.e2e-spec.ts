/**
 * Vidage des données métier, par ses vraies routes et la vraie base de test :
 *  - réservé à l'administrateur système, au serveur central et au mode Test (jamais en production,
 *    jamais verrouillé, jamais pendant une génération) ;
 *  - il faut la phrase, les deux accusés ET le mot de passe (un échec est refusé et tracé) ;
 *  - tout le dossier patient et le parcours de soins partent — notifications, conflits et rapports
 *    qui en parlent compris — et RIEN d'autre (comptes, personnel, référentiels, messagerie,
 *    paramètres, journaux, connexions) ; la numérotation des dossiers repart de 1 ;
 *  - les postes reçoivent l'ordre de vider leur copie par leur battement de vie, et leurs échanges
 *    sont REFUSÉS (423 `VIDAGE_EN_ATTENTE`) tant qu'ils n'ont pas accusé : leurs anciennes lignes ne
 *    peuvent pas ressusciter ce qui vient d'être effacé ;
 *  - le portier arrête les envois en route le temps du vidage, et renonce proprement s'ils ne
 *    finissent pas ;
 *  - l'opération est tracée (qui, d'où, combien, quels accusés) sans jamais écrire le mot de passe.
 *
 * Le vidage efface aussi les cinq dossiers de démonstration du seed, dont d'autres fichiers de test
 * ont besoin : la base de test est partagée, ce fichier la remet comme il l'a trouvée.
 */
import { randomUUID } from 'node:crypto'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { DonneesTestService } from '../src/modules/donnees-test/donnees-test.service'
import { supprimerMarquees } from '../src/modules/donnees-test/ecriture'
import { MARQUE_ID } from '../src/modules/donnees-test/marque-test'
import {
  PHRASE_VIDAGE,
  VidageService,
} from '../src/modules/donnees-test/vidage.service'
import { PortierVidage } from '../src/modules/sync/portier-vidage'
import { SyncService } from '../src/modules/sync/sync.service'
import { NotificationService } from '../src/modules/notification/notification.service'
import {
  ENTITES_NOTIFICATION_METIER,
  delegueMetier,
  TABLES_METIER,
} from '../src/modules/sync/vidage-metier'
import { baseDe, demarrerApp } from './support/app-test'
import { COMPTES, connecter, type Client } from './support/client'
import { creerPatientCdi, referentiels } from './support/donnees'
import {
  restaurerMetier,
  sauvegarderMetier,
  type SauvegardeMetier,
} from './support/metier'

interface Refus {
  statusCode: number
  code: string
  message: string
}
interface EtatVidage {
  mode: 'PRODUCTION' | 'TEST'
  disponible: boolean
  raison: string | null
  phrase: string
  lignes: {
    total: number
    tables: { modele: string; libelle: string; n: number }[]
    autres: { cle: string; libelle: string; n: number }[]
  }
  postes: {
    total: number
    enLigne: number
    anciens: number
    enAttente: number
    liste: {
      id: string
      libelle: string
      enLigne: boolean
      comprend: boolean
      enAttente: boolean
    }[]
  }
  dernier: { at: string; parNom: string | null; lignes: number } | null
}
interface Resultat {
  lignes: number
  tables: Record<string, number>
  autres: Record<string, number>
  journauxDeTest: number
  postes: number
}
interface Battement {
  ok: boolean
  controle?: {
    suspendu: boolean
    motif: string | null
    resyncDemandeeAt: string | null
    vidageDemandeAt: string | null
  }
}
interface Envelope {
  model: string
  id: string
  op: 'upsert' | 'delete'
  data: Record<string, unknown>
  updatedAt: string
}
interface Pull {
  changes: Envelope[]
}
interface Lot {
  statut: 'EN_COURS' | 'TERMINE' | 'INTERROMPU' | 'ANNULE' | 'ECHEC'
}
interface EtatDonneesTest {
  lot: Lot | null
}

const iso = (ms: number) => new Date(ms).toISOString()

describe('Vidage des données métier', () => {
  let app: NestExpressApplication
  let admin: Client
  let infirmier: Client
  let medecin: Client
  let sauvegarde: SauvegardeMetier
  const MDP = COMPTES.admin.motDePasse
  const s = `${Date.now() % 100_000}`
  /** PA : poste à jour (niveau 2) · PB : niveau 1 (avant le vidage) · PC : poste sans niveau. */
  const PA = `poste-vid-a-${s}`
  const PB = `poste-vid-b-${s}`
  const PC = `poste-vid-c-${s}`
  let modelePatient: Envelope
  let modeleIdentite: Envelope

  const base = () => baseDe(app)
  const etat = () => admin.get<EtatVidage>('/systeme/vidage')
  const corps = (extra: object = {}) => ({
    motDePasse: MDP,
    confirmation: PHRASE_VIDAGE,
    irreversible: true,
    restaurationVerifiee: true,
    ...extra,
  })
  const vider = (extra: object = {}) =>
    admin.post<Resultat & Refus>('/systeme/vidage', corps(extra))
  const changerMode = (mode: 'TEST' | 'PRODUCTION') =>
    admin.appel('put', '/systeme/mode', {}, { mode, motDePasse: MDP })
  const battement = (posteLocalId: string, extra: object = {}) =>
    admin.post<Battement>('/sync/heartbeat', {
      posteLocalId,
      libelle: `Poste ${posteLocalId}`,
      ...extra,
    })
  const accuser = (id: string, demandeeAt: string) =>
    admin.post<{ ok: boolean; demandeSoldee: boolean }>(
      `/sync/poste/${id}/vidage-termine`,
      { demandeeAt },
    )
  const push = (posteLocalId: string, changes: Envelope[]) =>
    admin.post<Refus & { applied: string[] }>('/sync/push', {
      posteLocalId,
      changes,
    })

  /** Un dossier saisi sur un poste : un patient et son identité (modèles réels du central). */
  const dossier = (nom: string) => {
    const quand = Date.now() - 20_000
    const patientId = randomUUID()
    const patient: Envelope = {
      model: 'Patient',
      id: patientId,
      op: 'upsert',
      updatedAt: iso(quand),
      data: {
        ...modelePatient.data,
        id: patientId,
        numeroPatient: `PAT-VID-${s}-${nom}`,
        matricule: null,
        createdAt: iso(quand),
        updatedAt: iso(quand),
      },
    }
    const identiteId = randomUUID()
    const identite: Envelope = {
      model: 'IdentitePatient',
      id: identiteId,
      op: 'upsert',
      updatedAt: iso(quand),
      data: {
        ...modeleIdentite.data,
        id: identiteId,
        patientId,
        nom,
        prenom: 'Vidage',
        createdAt: iso(quand),
        updatedAt: iso(quand),
      },
    }
    return { patient, identite }
  }
  const dossierExiste = async (patientId: string) =>
    (await admin.get(`/patients/${patientId}`)).status === 200

  /** Combien de lignes porte chaque table métier (tombstones compris). */
  const comptes = async () => {
    const out: Record<string, number> = {}
    for (const t of TABLES_METIER) {
      const d = (
        base().raw as unknown as Record<
          string,
          { count: () => Promise<number> }
        >
      )[delegueMetier(t)]
      out[t] = await d.count()
    }
    return out
  }
  const totalMetier = async () =>
    Object.values(await comptes()).reduce((a, b) => a + b, 0)
  const entitesMetier = [...ENTITES_NOTIFICATION_METIER]
  /** Tout ce que le vidage ne doit JAMAIS toucher. */
  const gardes = async () => ({
    utilisateurs: await base().utilisateur.count(),
    personnel: await base().personnelMedical.count(),
    sites: await base().site.count(),
    categories: await base().categoriePatient.count(),
    droits: await base().droitCategoriePatient.count(),
    motifs: await base().motifConsultation.count(),
    types: await base().typeConsultation.count(),
    pathologies: await base().pathologieReference.count(),
    medicaments: await base().medicamentReference.count(),
    examens: await base().typeExamen.count(),
    etablissements: await base().etablissementReference.count(),
    societes: await base().societeSousTraitante.count(),
    delegations: await base().delegationPrescription.count(),
    roles: await base().role.count(),
    permissions: await base().permission.count(),
    rolePermissions: await base().rolePermission.count(),
    conversations: await base().conversation.count(),
    messages: await base().message.count(),
    notificationsAutres: await base().notification.count({
      where: {
        OR: [{ entiteType: null }, { entiteType: { notIn: entitesMetier } }],
      },
    }),
    // Les fausses connexions du générateur partent avec le vidage : on ne compte que les vraies.
    sessions: await base().sessionUtilisateur.count({
      where: { NOT: { id: { startsWith: MARQUE_ID } } },
    }),
    connexions: await base().journalAuthentification.count({
      where: { NOT: { id: { startsWith: MARQUE_ID } } },
    }),
    postes: await base().posteLocal.count(),
    parametres: await base().parametreSysteme.count({
      where: {
        cle: {
          notIn: ['systeme.mode', 'systeme.donnees_test', 'systeme.vidage'],
        },
      },
    }),
  })

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

  beforeAll(async () => {
    app = await demarrerApp()
    admin = await connecter(app, COMPTES.admin)
    infirmier = await connecter(app, COMPTES.infirmier)
    medecin = await connecter(app, COMPTES.medecinChef)
    delete process.env['MODE_TEST_AUTORISE']
    delete process.env['VIDAGE_ATTENTE_ENVOIS_MS']
    // La base de test est partagée : on met de côté ce que le vidage va effacer.
    sauvegarde = await sauvegarderMetier(base().raw)
    await base().parametreSysteme.deleteMany({
      where: {
        cle: { in: ['systeme.mode', 'systeme.donnees_test', 'systeme.vidage'] },
      },
    })

    // Un dossier modèle, pour fabriquer ce qu'un poste enverrait.
    const debut = new Date(Date.now() - 1000).toISOString()
    const ref = await referentiels(infirmier)
    const id = await creerPatientCdi(infirmier, ref, 'Vidage')
    const { changes } = (
      await admin.get<Pull>(`/sync/pull?since=${encodeURIComponent(debut)}`)
    ).body
    modelePatient = changes.find((c) => c.model === 'Patient' && c.id === id)!
    modeleIdentite = changes.find(
      (c) => c.model === 'IdentitePatient' && c.data['patientId'] === id,
    )!

    expect(
      (await battement(PA, { versionApp: '1.10.0', niveauControle: 2 })).status,
    ).toBe(201)
    expect(
      (await battement(PB, { versionApp: '1.9.0', niveauControle: 1 })).status,
    ).toBe(201)
    expect((await battement(PC)).status).toBe(201)
  })

  afterAll(async () => {
    delete process.env['MODE_TEST_AUTORISE']
    delete process.env['VIDAGE_ATTENTE_ENVOIS_MS']
    const postes = [PA, PB, PC]
    await base().conflitSynchronisation.deleteMany({
      where: { journal: { posteLocalId: { in: postes } } },
    })
    await base().journalSynchronisation.deleteMany({
      where: { posteLocalId: { in: postes } },
    })
    await base().syncState.deleteMany({
      where: { posteLocalId: { in: postes } },
    })
    await base().posteLocal.deleteMany({ where: { id: { in: postes } } })
    // Le vidage a donné son ordre à TOUS les postes : on ne laisse aucune demande derrière nous.
    await base().posteLocal.updateMany({ data: { vidageDemandeAt: null } })
    await base().notification.deleteMany({
      where: { titre: { startsWith: `VID-${s}` } },
    })
    await supprimerMarquees(base())
    await restaurerMetier(base().raw, sauvegarde)
    await base().parametreSysteme.deleteMany({
      where: {
        cle: { in: ['systeme.mode', 'systeme.donnees_test', 'systeme.vidage'] },
      },
    })
    // Les traces d'audit sont de vraies lignes : la suite du mode du système compte les siennes
    // dans la même base.
    await base().journalAudit.deleteMany({
      where: {
        OR: [
          {
            module: 'systeme',
            entiteType: { in: ['ModeSysteme', 'DonneesTest', 'DonneesMetier'] },
          },
          {
            module: 'synchronisation',
            entiteType: 'PosteLocal',
            entiteId: { in: postes },
          },
        ],
      },
    })
    await app.close()
  })

  describe('Garde-fous', () => {
    it('réservé à l’administrateur système : infirmier et médecin chef sont refusés', async () => {
      for (const c of [infirmier, medecin]) {
        expect((await c.get('/systeme/vidage')).status).toBe(403)
        expect((await c.post('/systeme/vidage', corps())).status).toBe(403)
      }
    })

    it('en production : l’état dit pourquoi, et vider est refusé (409) sans rien effacer', async () => {
      const avant = await totalMetier()
      expect(avant).toBeGreaterThan(0)
      const e = await etat()
      expect(e.status).toBe(200)
      expect(e.body).toMatchObject({ mode: 'PRODUCTION', disponible: false })
      expect(e.body.raison).toMatch(/mode Test/)
      expect(e.body.phrase).toBe(PHRASE_VIDAGE)
      const r = await vider()
      expect(r.status).toBe(409)
      expect(r.body.code).toBe('MODE_PRODUCTION')
      expect(await totalMetier()).toBe(avant)
    })

    it('en mode Test : sans la phrase, sans les accusés ou avec des champs invalides, rien ne part', async () => {
      expect((await changerMode('TEST')).status).toBe(200)
      const avant = await totalMetier()
      const e = (await etat()).body
      expect(e).toMatchObject({ mode: 'TEST', disponible: true, raison: null })

      expect((await admin.post('/systeme/vidage', {})).status).toBe(400)
      expect((await vider({ irreversible: false })).status).toBe(400)
      expect((await vider({ restaurationVerifiee: false })).status).toBe(400)
      // Seul un vrai « true » vaut accord — pas le texte "false", que la conversion implicite
      // des types transformerait en true.
      for (const faux of ['oui', 'true', 'false', 1, null])
        expect((await vider({ irreversible: faux })).status).toBe(400)
      expect((await vider({ restaurationVerifiee: 'true' })).status).toBe(400)
      expect((await vider({ motDePasse: '' })).status).toBe(400)
      const mauvaise = await vider({ confirmation: 'vider les donnees' })
      expect(mauvaise.status).toBe(400)
      expect(mauvaise.body.code).toBe('PHRASE_INCORRECTE')
      expect((await vider({ confirmation: 'VIDER' })).status).toBe(400)
      expect(await totalMetier()).toBe(avant)
    })

    it('la phrase doit être exacte : un mot de plus, des espaces en trop, rien n’est toléré', async () => {
      const avant = await totalMetier()
      expect(
        (await vider({ confirmation: `${PHRASE_VIDAGE} extra` })).status,
      ).toBe(400)
      expect(
        (await vider({ confirmation: `VIDER  LES  DONNEES` })).status,
      ).toBe(400)
      expect(await totalMetier()).toBe(avant)
    })

    it('le service refuse lui-même sans les deux accusés : une seconde barrière derrière la validation de la requête', async () => {
      const avant = await totalMetier()
      const service = app.get(VidageService)
      for (const accuses of [
        { irreversible: false, restaurationVerifiee: true },
        { irreversible: true, restaurationVerifiee: false },
      ])
        await expect(
          service.vider(
            { motDePasse: MDP, confirmation: PHRASE_VIDAGE, ...accuses },
            admin.user.id,
            null,
          ),
        ).rejects.toMatchObject({ response: { code: 'ACCUSES_MANQUANTS' } })
      expect(await totalMetier()).toBe(avant)
    })

    it('un mauvais mot de passe est refusé (403, pas 401), tracé, et rien ne part', async () => {
      const avant = await totalMetier()
      const r = await vider({ motDePasse: 'pas-le-bon' })
      expect(r.status).toBe(403)
      expect(r.body.code).toBe('MOT_DE_PASSE_INCORRECT')
      expect(await totalMetier()).toBe(avant)
      const trace = await base().journalAudit.findFirst({
        where: {
          module: 'systeme',
          entiteType: 'DonneesMetier',
          action: 'VIDAGE_ECHEC',
        },
      })
      expect(trace).not.toBeNull()
      expect(trace!.statut).toBe('ERREUR')
      expect(JSON.stringify(trace!.apresJson)).not.toContain('pas-le-bon')
    })

    it('le verrou de mise en service (MODE_TEST_AUTORISE=false) interdit le vidage, même en base « TEST »', async () => {
      process.env['MODE_TEST_AUTORISE'] = 'false'
      try {
        const avant = await totalMetier()
        const e = await etat()
        expect(e.body).toMatchObject({ mode: 'PRODUCTION', disponible: false })
        const r = await vider()
        expect(r.status).toBe(409)
        expect(r.body.code).toBe('MODE_PRODUCTION')
        expect(await totalMetier()).toBe(avant)
      } finally {
        delete process.env['MODE_TEST_AUTORISE']
      }
    })

    it('pendant une génération de données de test : refusé (409), la génération n’est pas croisée', async () => {
      const g = await admin.post<Refus>('/systeme/donnees-test/generation', {
        mois: 1,
        visitesParJour: 6,
        graine: `vidage-${s}`,
      })
      expect(g.status).toBe(201)
      expect(app.get(DonneesTestService).generationEnCours).toBe(true)
      const e = await etat()
      expect(e.body.disponible).toBe(false)
      expect(e.body.raison).toMatch(/génération/)
      const r = await vider()
      expect(r.status).toBe(409)
      expect(r.body.code).toBe('GENERATION_EN_COURS')
      const lot = await attendre(
        async () =>
          (await admin.get<EtatDonneesTest>('/systeme/donnees-test')).body.lot,
        (l) => !!l && l.statut !== 'EN_COURS',
      )
      expect(lot!.statut).toBe('TERMINE')
    })
  })

  describe('Le vidage', () => {
    let avantEtat: EtatVidage
    let avantGardes: Awaited<ReturnType<typeof gardes>>
    let resultat: Resultat
    let idNotifMetier: string
    let patientAvant: string

    it('l’état annonce ce qui partirait, et les postes concernés', async () => {
      // Des restes que le vidage doit emporter, d'autres qu'il doit laisser.
      patientAvant = (
        await base().patient.findFirstOrThrow({ select: { id: true } })
      ).id
      const notifMetier = await base().notification.create({
        data: {
          type: 'PATIENT_CREE',
          titre: `VID-${s} dossier`,
          message: 'test',
          entiteType: 'patient',
          entiteId: patientAvant,
        },
      })
      idNotifMetier = notifMetier.id
      await base().notification.create({
        data: {
          type: 'MESSAGE',
          titre: `VID-${s} message`,
          message: 'test',
          entiteType: 'conversation',
          entiteId: randomUUID(),
        },
      })
      const journal = await base().journalSynchronisation.create({
        data: { posteLocalId: PA, statut: 'CONFLITS', nbConflits: 2 },
      })
      for (const entiteType of ['Patient', 'Message'])
        await base().conflitSynchronisation.create({
          data: {
            journalId: journal.id,
            mutationUuid: randomUUID(),
            entiteType,
            entiteId: randomUUID(),
            typeConflit: 'REJET_SERVEUR',
            valeurLocale: {},
            valeurServeur: { erreur: 'test' },
          },
        })
      await base().rapportGenere.create({
        data: {
          type: 'MENSUEL',
          periodeDebut: new Date(Date.now() - 86_400_000),
          periodeFin: new Date(),
          contenuJson: '{}',
        },
      })

      const e = await etat()
      expect(e.status).toBe(200)
      avantEtat = e.body
      expect(avantEtat.disponible).toBe(true)
      expect(avantEtat.lignes.total).toBeGreaterThan(100)
      const noms = avantEtat.lignes.tables.map((t) => t.modele)
      for (const t of [
        'Patient',
        'IdentitePatient',
        'Visite',
        'Consultation',
        'Ordonnance',
        'ConstanteVitale',
      ])
        expect(noms).toContain(t)
      // Un libellé lisible partout, jamais le nom technique de la table
      for (const t of avantEtat.lignes.tables) expect(t.libelle).not.toBe('')
      expect(
        avantEtat.lignes.tables.find((t) => t.modele === 'Patient')!.libelle,
      ).toBe('Dossiers patients')
      expect(avantEtat.lignes.autres.map((a) => a.cle).sort()).toEqual([
        'conflits',
        'journauxDeTest',
        'notifications',
        'rapports',
      ])
      const autre = (cle: string) =>
        avantEtat.lignes.autres.find((a) => a.cle === cle)!.n
      expect(autre('conflits')).toBe(
        await base().conflitSynchronisation.count({
          where: { entiteType: { in: [...TABLES_METIER] } },
        }),
      )
      expect(autre('notifications')).toBe(
        await base().notification.count({
          where: { entiteType: { in: entitesMetier } },
        }),
      )
      expect(autre('rapports')).toBe(await base().rapportGenere.count())
      expect(autre('journauxDeTest')).toBeGreaterThan(0)
      expect(autre('conflits')).toBeGreaterThanOrEqual(1)
      expect(autre('notifications')).toBeGreaterThanOrEqual(1)
      // Le total est bien la somme de ce qui est détaillé
      expect(avantEtat.lignes.total).toBe(
        [...avantEtat.lignes.tables, ...avantEtat.lignes.autres].reduce(
          (n, t) => n + t.n,
          0,
        ),
      )
      // Les postes : PA comprend l'ordre, PB et PC non (niveau trop ancien), aucun n'est en attente
      const poste = (id: string) =>
        avantEtat.postes.liste.find((p) => p.id === id)!
      expect(poste(PA)).toMatchObject({ comprend: true, enAttente: false })
      expect(poste(PB)).toMatchObject({ comprend: false, enAttente: false })
      expect(poste(PC)).toMatchObject({ comprend: false, enAttente: false })
      expect(avantEtat.postes.anciens).toBeGreaterThanOrEqual(2)
      expect(avantEtat.postes.enAttente).toBe(0)
      expect(avantEtat.dernier).toBeNull()
    })

    it('vider : tout le dossier patient et le parcours de soins partent, le centre est annoncé vide', async () => {
      avantGardes = await gardes()
      const diffusion = jest.spyOn(
        app.get(NotificationService),
        'broadcastLive',
      )
      let r: Awaited<ReturnType<typeof vider>>
      try {
        r = await vider()
        // Tous les écrans ouverts sont prévenus, sans cloche ni son : ce qu'ils affichent n'existe plus
        expect(diffusion).toHaveBeenCalledWith('SYSTEME_VIDAGE')
      } finally {
        diffusion.mockRestore()
      }
      expect(r.status).toBe(200)
      resultat = r.body
      expect(resultat.lignes).toBe(avantEtat.lignes.total)
      expect(resultat.postes).toBeGreaterThanOrEqual(3)
      expect(resultat.tables['Patient']).toBeGreaterThan(0)
      expect(resultat.tables['Visite']).toBeGreaterThan(0)
      expect(resultat.autres['notifications']).toBe(
        avantEtat.lignes.autres.find((a) => a.cle === 'notifications')!.n,
      )
      expect(resultat.autres['conflits']).toBe(
        avantEtat.lignes.autres.find((a) => a.cle === 'conflits')!.n,
      )
      expect(resultat.autres['rapports']).toBe(
        avantEtat.lignes.autres.find((a) => a.cle === 'rapports')!.n,
      )
      expect(resultat.journauxDeTest).toBe(
        avantEtat.lignes.autres.find((a) => a.cle === 'journauxDeTest')!.n,
      )
      // Plus aucune fausse connexion ni fausse trace du générateur
      for (const d of [
        'sessionUtilisateur',
        'journalAuthentification',
        'journalAudit',
      ] as const)
        expect(
          await (
            base() as unknown as Record<
              string,
              { count: (a: object) => Promise<number> }
            >
          )[d].count({ where: { id: { startsWith: MARQUE_ID } } }),
        ).toBe(0)

      const apres = await comptes()
      expect(Object.entries(apres).filter(([, n]) => n > 0)).toEqual([])
      // Ni tombstone ni ligne supprimée logiquement : les lignes sont parties pour de bon.
      expect(await base().raw.patient.count()).toBe(0)
      expect(
        await base().notification.count({ where: { id: idNotifMetier } }),
      ).toBe(0)
      expect(await base().rapportGenere.count()).toBe(0)
      expect(
        await base().conflitSynchronisation.count({
          where: { entiteType: 'Patient' },
        }),
      ).toBe(0)
      const e = (await etat()).body
      expect(e.lignes.total).toBe(0)
      expect(e.lignes.tables).toEqual([])
    })

    it('rien d’autre n’est touché : comptes, personnel, référentiels, messagerie, paramètres, connexions', async () => {
      const apres = await gardes()
      expect(apres).toEqual(avantGardes)
      // Les notifications qui ne parlent pas d'un dossier sont restées
      expect(apres.notificationsAutres).toBeGreaterThanOrEqual(1)
      expect(
        await base().notification.count({
          where: { titre: `VID-${s} message` },
        }),
      ).toBe(1)
      expect(
        await base().conflitSynchronisation.count({
          where: { entiteType: 'Message' },
        }),
      ).toBe(1)
      // Le centre reste utilisable : connexion, référentiels
      expect((await referentiels(infirmier)).siteId).toBeTruthy()
    })

    it('le vidage est tracé : qui, combien, quels accusés — jamais le mot de passe', async () => {
      const trace = await base().journalAudit.findFirst({
        where: {
          module: 'systeme',
          entiteType: 'DonneesMetier',
          action: 'DONNEES_VIDAGE',
        },
      })
      expect(trace).not.toBeNull()
      expect(trace!.statut).toBe('SUCCES')
      expect(trace!.utilisateurId).toBe(admin.user.id)
      expect(trace!.apresJson).toMatchObject({
        lignes: resultat.lignes,
        irreversible: true,
        restaurationVerifiee: true,
      })
      expect(JSON.stringify(trace!.apresJson)).not.toContain(MDP)
    })

    it('le dernier vidage est retenu, l’état des générations est remis à zéro, le mode reste Test', async () => {
      const e = (await etat()).body
      expect(e.dernier).not.toBeNull()
      expect(e.dernier!.lignes).toBe(resultat.lignes)
      expect(e.dernier!.parNom).toBeTruthy()
      expect(Math.abs(Date.now() - Date.parse(e.dernier!.at))).toBeLessThan(
        120_000,
      )
      const dt = await admin.get<
        EtatDonneesTest & { existantes: { total: number } }
      >('/systeme/donnees-test')
      expect(dt.body.lot).toBeNull()
      expect(dt.body.existantes.total).toBe(0)
      expect(
        (await admin.get<{ mode: string }>('/systeme/mode')).body.mode,
      ).toBe('TEST')
    })

    it('la numérotation des dossiers repart de 1', async () => {
      const ref = await referentiels(infirmier)
      const id = await creerPatientCdi(infirmier, ref, 'Premier')
      const p = await admin.get<{ numeroPatient: string }>(`/patients/${id}`)
      expect(p.body.numeroPatient).toMatch(/-00001$/)
    })

    it('le vidage s’inscrit dans l’état : un deuxième vidage immédiat est permis et efface le reste', async () => {
      const avant = await totalMetier()
      expect(avant).toBeGreaterThan(0)
      const r = await vider()
      expect(r.status).toBe(200)
      expect(r.body.lignes).toBeGreaterThanOrEqual(avant)
      expect(await totalMetier()).toBe(0)
    })
  })

  describe('Les postes', () => {
    let dateVidage: string

    it('chaque poste reçoit l’ordre de vider sa copie, par son battement de vie', async () => {
      dateVidage = (await etat()).body.dernier!.at
      for (const p of [PA, PB, PC]) {
        const b = await battement(p)
        expect(b.status).toBe(201)
        expect(b.body.controle?.vidageDemandeAt).toBe(dateVidage)
        expect(b.body.controle?.suspendu).toBe(false)
        const ligne = await base().posteLocal.findUniqueOrThrow({
          where: { id: p },
        })
        expect(ligne.vidageDemandeAt?.toISOString()).toBe(dateVidage)
        expect(ligne.vidageFaitAt).toBeNull()
      }
      const e = (await etat()).body
      expect(e.postes.enAttente).toBeGreaterThanOrEqual(3)
    })

    it('un poste qui n’a pas vidé sa copie ne peut ni envoyer ni recevoir (423) : ses anciennes lignes ne ressuscitent pas', async () => {
      const d = dossier(`ANCIEN${s}`)
      for (const p of [PA, PB, PC]) {
        const r = await push(p, [d.patient, d.identite])
        expect(r.status).toBe(423)
        expect(r.body.code).toBe('VIDAGE_EN_ATTENTE')
        // même un lot vide : le contrôle précède tout traitement
        expect((await push(p, [])).status).toBe(423)
        const pull = await admin.get<Refus>(`/sync/pull?posteLocalId=${p}`)
        expect(pull.status).toBe(423)
        expect(pull.body.code).toBe('VIDAGE_EN_ATTENTE')
      }
      expect(await dossierExiste(d.patient.id)).toBe(false)
      expect(await base().raw.patient.count()).toBe(0)
      // La réception d'un client qui ne dit pas qui il est (web, poste ancien) n'est pas concernée
      expect((await admin.get('/sync/pull')).status).toBe(200)
      // Le battement de vie, lui, reste ouvert : c'est par lui que l'ordre arrive
      expect((await battement(PA)).status).toBe(201)
    })

    it('un accusé qui ne porte pas la bonne date ne solde pas la demande', async () => {
      const r = await accuser(PA, iso(Date.parse(dateVidage) - 60_000))
      expect(r.status).toBe(201)
      expect(r.body.demandeSoldee).toBe(false)
      expect((await push(PA, [])).status).toBe(423)
      const ligne = await base().posteLocal.findUniqueOrThrow({
        where: { id: PA },
      })
      expect(ligne.vidageDemandeAt?.toISOString()).toBe(dateVidage)
    })

    it('un accusé illisible est refusé (400)', async () => {
      expect(
        (await admin.post(`/sync/poste/${PA}/vidage-termine`, {})).status,
      ).toBe(400)
      expect(
        (
          await admin.post(`/sync/poste/${PA}/vidage-termine`, {
            demandeeAt: 'hier',
          })
        ).status,
      ).toBe(400)
      expect((await accuser(randomUUID(), dateVidage)).status).toBe(404)
    })

    it('l’accusé du poste rouvre SES échanges, et seulement les siens', async () => {
      const r = await accuser(PA, dateVidage)
      expect(r.status).toBe(201)
      expect(r.body).toEqual({ ok: true, demandeSoldee: true })
      const ligne = await base().posteLocal.findUniqueOrThrow({
        where: { id: PA },
      })
      expect(ligne.vidageDemandeAt).toBeNull()
      expect(ligne.vidageFaitAt).not.toBeNull()
      // Il n'a plus d'ordre à recevoir
      expect((await battement(PA)).body.controle?.vidageDemandeAt).toBeNull()
      // Ses échanges reprennent : ce qu'il saisit APRÈS son vidage est accepté
      const d = dossier(`NOUVEAU${s}`)
      const p = await push(PA, [d.patient, d.identite])
      expect(p.status).toBe(201)
      expect(p.body.applied).toEqual(expect.arrayContaining([d.patient.id]))
      expect(await dossierExiste(d.patient.id)).toBe(true)
      expect((await admin.get(`/sync/pull?posteLocalId=${PA}`)).status).toBe(
        200,
      )
      // Les autres postes attendent toujours le leur
      expect((await push(PB, [])).status).toBe(423)
      expect((await push(PC, [])).status).toBe(423)
      const e = (await etat()).body
      const poste = (id: string) => e.postes.liste.find((x) => x.id === id)!
      expect(poste(PA).enAttente).toBe(false)
      expect(poste(PB).enAttente).toBe(true)
      expect(poste(PC).enAttente).toBe(true)
    })

    it('l’accusé est tracé, et la fiche du poste montre où il en est', async () => {
      const traces = await base().journalAudit.findMany({
        where: {
          module: 'synchronisation',
          entiteType: 'PosteLocal',
          entiteId: PA,
          action: 'VIDAGE_DONE',
        },
        orderBy: { createdAt: 'asc' },
      })
      // Deux accusés : le premier (mauvaise date) ne solde rien, le second solde la demande
      expect(
        traces.map(
          (t) => (t.apresJson as { demandeSoldee: boolean }).demandeSoldee,
        ),
      ).toEqual([false, true])
      const fiche = await admin.get<{
        vidageDemandeAt: string | null
        vidageFaitAt: string | null
      }>(`/sync/supervision/postes/${PB}`)
      expect(fiche.status).toBe(200)
      expect(fiche.body.vidageDemandeAt).toBe(dateVidage)
      expect(fiche.body.vidageFaitAt).toBeNull()
      const faite = await admin.get<{
        vidageDemandeAt: string | null
        vidageFaitAt: string | null
      }>(`/sync/supervision/postes/${PA}`)
      expect(faite.body.vidageDemandeAt).toBeNull()
      expect(faite.body.vidageFaitAt).not.toBeNull()
    })

    it('un poste suspendu garde sa suspension : la suspension prime sur le vidage en attente', async () => {
      const suspension = await admin.post<{ vidageDemandeAt: string | null }>(
        `/sync/supervision/postes/${PB}/suspension`,
        { motif: 'test' },
      )
      expect(suspension.status).toBe(201)
      // L'état renvoyé par les gestes de pilotage dit aussi où en est le vidage du poste
      expect(suspension.body.vidageDemandeAt).toBe(dateVidage)
      const r = await push(PB, [])
      expect(r.status).toBe(423)
      expect(r.body.code).toBe('POSTE_SUSPENDU')
      expect(
        (await admin.delete(`/sync/supervision/postes/${PB}/suspension`))
          .status,
      ).toBe(200)
      expect((await push(PB, [])).body.code).toBe('VIDAGE_EN_ATTENTE')
    })

    it('un nouveau vidage redonne l’ordre à tous les postes, même à celui qui avait accusé', async () => {
      const avant = dateVidage
      await new Promise((r) => setTimeout(r, 15))
      expect((await vider()).status).toBe(200)
      const nouveau = (await etat()).body.dernier!.at
      expect(Date.parse(nouveau)).toBeGreaterThan(Date.parse(avant))
      for (const p of [PA, PB, PC]) {
        const b = await battement(p)
        expect(b.body.controle?.vidageDemandeAt).toBe(nouveau)
      }
      expect((await push(PA, [])).status).toBe(423)
      // L'accusé de l'ancien vidage ne solde pas le nouveau
      const vieux = await accuser(PA, avant)
      expect(vieux.body.demandeSoldee).toBe(false)
      expect((await push(PA, [])).status).toBe(423)
      expect((await accuser(PA, nouveau)).body.demandeSoldee).toBe(true)
      expect((await push(PA, [])).status).toBe(201)
      dateVidage = nouveau
    })
  })

  describe('Le portier des envois', () => {
    it('deux vidages simultanés : un seul s’exécute, l’autre est refusé (409 « déjà en cours »)', async () => {
      const ref = await referentiels(infirmier)
      await creerPatientCdi(infirmier, ref, 'Simultane')
      const [a, b] = await Promise.all([vider(), vider()])
      expect([a.status, b.status].sort()).toEqual([200, 409])
      const refus = a.status === 409 ? a : b
      expect(refus.body.code).toBe('VIDAGE_EN_COURS')
      expect(await totalMetier()).toBe(0)
      expect(app.get(PortierVidage).estFerme).toBe(false)
      // Une fois le premier fini, un nouveau vidage est de nouveau permis
      expect((await vider()).status).toBe(200)
      // Ces vidages ont redonné l'ordre à tous les postes : PA l'accomplit, pour la suite
      const dernier = (await etat()).body.dernier!.at
      expect((await accuser(PA, dernier)).body.demandeSoldee).toBe(true)
    })

    it('des envois en route qui ne finissent pas : le vidage renonce (409), rien n’est effacé, la porte est rouverte', async () => {
      const portier = app.get(PortierVidage)
      const ref = await referentiels(infirmier)
      await creerPatientCdi(infirmier, ref, 'Portier')
      const avant = await totalMetier()
      expect(avant).toBeGreaterThan(0)
      const dernierAvant = (await etat()).body.dernier!.at
      process.env['VIDAGE_ATTENTE_ENVOIS_MS'] = '120'
      expect(portier.entrer()).toBe(true) // un envoi qui ne finit pas
      try {
        const r = await vider()
        expect(r.status).toBe(409)
        expect(r.body.code).toBe('ECHANGES_EN_COURS')
        expect(await totalMetier()).toBe(avant)
        expect(portier.estFerme).toBe(false)
        // Pas d'ordre donné aux postes : rien n'a été vidé
        expect((await etat()).body.dernier!.at).toBe(dernierAvant)
      } finally {
        portier.sortir()
        delete process.env['VIDAGE_ATTENTE_ENVOIS_MS']
      }
      expect(portier.envoisEnRoute).toBe(0)
    })

    it('porte fermée : même un poste en règle voit son envoi refusé, puis accepté à la réouverture', async () => {
      const portier = app.get(PortierVidage)
      expect((await push(PA, [])).status).toBe(201)
      expect(await portier.fermer(50)).toBe(true)
      try {
        const r = await push(PA, [])
        expect(r.status).toBe(423)
        expect(r.body.code).toBe('VIDAGE_EN_ATTENTE')
        // la réception n'est pas gardée par le portier : seul l'envoi écrit des lignes
        expect((await admin.get(`/sync/pull?posteLocalId=${PA}`)).status).toBe(
          200,
        )
      } finally {
        portier.rouvrir()
      }
      expect((await push(PA, [])).status).toBe(201)
      expect(portier.envoisEnRoute).toBe(0)
    })

    it('un envoi qui échoue libère quand même sa place (le portier ne reste pas bloqué)', async () => {
      const portier = app.get(PortierVidage)
      const espion = jest
        .spyOn(app.get(SyncService), 'push')
        .mockRejectedValueOnce(new Error('panne simulée'))
      try {
        const r = await push(PA, [])
        expect(r.status).toBe(500)
        expect(portier.envoisEnRoute).toBe(0)
        expect(portier.estFerme).toBe(false)
      } finally {
        espion.mockRestore()
      }
      expect((await push(PA, [])).status).toBe(201)
    })
  })
})
