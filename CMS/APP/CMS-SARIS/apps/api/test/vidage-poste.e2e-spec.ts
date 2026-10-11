/**
 * Vidage des données métier, côté POSTE — le VRAI client de synchronisation (SyncClientService) face à
 * un serveur central réel (l'API de test, ouverte sur un port local).
 *
 * Ce que ce test prouve et qu'aucun test du serveur seul ne peut prouver :
 *  - le poste apprend l'ordre par son battement de vie, vide SA copie des données métier AVANT toute
 *    réception ou tout envoi, l'accuse, puis repart de zéro pour la réception ;
 *  - il ne refait JAMAIS le même vidage — ni parce que le serveur tarde à effacer la demande, ni après
 *    un redémarrage entre son vidage et son accusé (le travail saisi depuis serait perdu) ;
 *  - un refus 423 « vidage en attente » n'est pas une panne ; une suspension passe avant ;
 *  - ce qui doit rester sur le poste (comptes, référentiels) reste.
 *
 * Le « poste » partage la base de test avec le central : on y pose, APRÈS le vidage du central, un
 * dossier qui joue la copie périmée que le poste avait gardée — c'est elle que le poste doit effacer.
 * Comme le fichier du serveur, celui-ci remet la base partagée comme il l'a trouvée.
 */
import type { AddressInfo } from 'node:net'
import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { PHRASE_VIDAGE } from '../src/modules/donnees-test/vidage.service'
import { SyncClientService } from '../src/modules/sync/sync-client.service'
import type { SyncService } from '../src/modules/sync/sync.service'
import { CLE_VIDAGE_APPLIQUE } from '../src/modules/sync/sync-controle'
import type { NotificationService } from '../src/modules/notification/notification.service'
import type { PrismaService } from '../src/prisma/prisma.service'
import { baseDe, demarrerApp } from './support/app-test'
import { COMPTES, connecter, type Client } from './support/client'
import { creerPatientCdi, referentiels } from './support/donnees'
import {
  restaurerMetier,
  sauvegarderMetier,
  type SauvegardeMetier,
} from './support/metier'

/** Les membres privés du client, que le test lit et pilote (jamais l'application). */
interface Interne {
  heartbeat(): Promise<void>
  suspendu: boolean
  verrou: boolean
}

describe('Vidage des données métier — le client du poste', () => {
  let app: NestExpressApplication
  let admin: Client
  let infirmier: Client
  let client: SyncClientService
  let interne: Interne
  let central: string
  let sauvegarde: SauvegardeMetier
  let moteurLocal: SyncService
  /** Ce que le poste garde, compté AVANT tout vidage : la base de test est partagée, ses effectifs varient. */
  let gardeAvant: Record<string, number>
  const MDP = COMPTES.admin.motDePasse
  const s = `${Date.now() % 100_000}`
  const POSTE = `poste-vidcli-${s}`
  const recus: string[] = []
  const diffusions: string[] = []
  let appels: jest.SpyInstance<Promise<Response>, Parameters<typeof fetch>>
  /** L'adresse d'un appel de `fetch`, quelle que soit la forme sous laquelle il l'a reçue. */
  const urlDe = (entree: Parameters<typeof fetch>[0]): string =>
    typeof entree === 'string'
      ? entree
      : entree instanceof URL
        ? entree.href
        : entree.url

  const base = () => baseDe(app)
  const heartbeat = () => interne.heartbeat()
  const urlsAppelees = () => appels.mock.calls.map((c) => urlDe(c[0]))
  const appelsPull = () =>
    urlsAppelees().filter((u) => u.includes('/sync/pull'))
  const poste = () =>
    base().posteLocal.findUniqueOrThrow({ where: { id: POSTE } })
  const curseur = () =>
    base().syncState.findFirstOrThrow({ where: { posteLocalId: POSTE } })
  const patients = () => base().raw.patient.count()
  const appliqueLocalement = async () =>
    (
      await base().parametreSysteme.findUnique({
        where: { cle: CLE_VIDAGE_APPLIQUE },
      })
    )?.valeur ?? null
  /** Les déclencheurs (battement de vie…) lancent des cycles en arrière-plan : on attend le calme. */
  const attendreCalme = async () => {
    for (let i = 0; i < 250; i++) {
      if (!interne.verrou && !client.enCours) return
      await new Promise((r) => setTimeout(r, 20))
    }
    throw new Error('Le client ne se calme pas')
  }
  const viderLeCentre = async () => {
    const r = await admin.post('/systeme/vidage', {
      motDePasse: MDP,
      confirmation: PHRASE_VIDAGE,
      irreversible: true,
      restaurationVerifiee: true,
    })
    if (r.status !== 200)
      throw new Error(`Vidage refusé : ${JSON.stringify(r.body)}`)
    return (await admin.get<{ dernier: { at: string } }>('/systeme/vidage'))
      .body.dernier.at
  }
  const gardes = async () => ({
    utilisateurs: await base().utilisateur.count(),
    personnel: await base().personnelMedical.count(),
    categories: await base().categoriePatient.count(),
    sites: await base().site.count(),
    medicaments: await base().medicamentReference.count(),
  })
  /** Un dossier ordinaire, créé par l'application : la copie que le poste tenait de l'ancien état. */
  const copiePerimee = async (prenom: string) =>
    creerPatientCdi(infirmier, await referentiels(infirmier), prenom)

  beforeAll(async () => {
    app = await demarrerApp()
    admin = await connecter(app, COMPTES.admin)
    infirmier = await connecter(app, COMPTES.infirmier)
    delete process.env['MODE_TEST_AUTORISE']
    sauvegarde = await sauvegarderMetier(base().raw)
    gardeAvant = await gardes()
    await base().parametreSysteme.deleteMany({
      where: {
        cle: {
          in: [
            'systeme.mode',
            'systeme.donnees_test',
            'systeme.vidage',
            CLE_VIDAGE_APPLIQUE,
          ],
        },
      },
    })
    expect(
      (
        await admin.appel(
          'put',
          '/systeme/mode',
          {},
          { mode: 'TEST', motDePasse: MDP },
        )
      ).status,
    ).toBe(200)
    await app.listen(0, '127.0.0.1')
    central = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`

    moteurLocal = {
      ingest: (env: { id: string }) => {
        recus.push(env.id)
        return Promise.resolve({ applied: true })
      },
      pull: () =>
        Promise.resolve({
          changes: [],
          nextSince: new Date().toISOString(),
          hasMore: false,
          serverTime: new Date().toISOString(),
        }),
    } as unknown as SyncService
    const sonnerie = {
      rediffuserDepuisSynchro: () => undefined,
      broadcastLive: (type: string) => {
        diffusions.push(type)
      },
    }
    client = new SyncClientService(
      base() as unknown as PrismaService,
      moteurLocal,
      sonnerie as unknown as NotificationService,
    )
    interne = client as unknown as Interne
    const regler = (nom: string, valeur: unknown) =>
      Object.defineProperty(client, nom, {
        get: () => valeur,
        configurable: true,
      })
    regler('enabled', true)
    regler('serverUrl', central)
    regler('token', admin.jeton)
    regler('posteLocalId', POSTE)
    regler('siteId', admin.user.siteId)
    regler('versionApp', '1.10.0-test')
    regler('libelle', `Poste ${POSTE}`)

    appels = jest.spyOn(globalThis, 'fetch')
    await heartbeat()
    await attendreCalme()
  })
  afterAll(async () => {
    appels.mockRestore()
    await base().syncState.deleteMany({ where: { posteLocalId: POSTE } })
    await base().journalSynchronisation.deleteMany({
      where: { posteLocalId: POSTE },
    })
    await base().posteLocal.deleteMany({ where: { id: POSTE } })
    await base().posteLocal.updateMany({ data: { vidageDemandeAt: null } })
    await restaurerMetier(base().raw, sauvegarde)
    await base().parametreSysteme.deleteMany({
      where: {
        cle: {
          in: [
            'systeme.mode',
            'systeme.donnees_test',
            'systeme.vidage',
            CLE_VIDAGE_APPLIQUE,
          ],
        },
      },
    })
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
            entiteId: POSTE,
          },
        ],
      },
    })
    await app.close()
  })

  it('il annonce le niveau d’ordres qui comprend le vidage', async () => {
    expect((await poste()).niveauControle).toBeGreaterThanOrEqual(2)
  })

  it('aucun vidage demandé : rien n’est vidé, le battement n’a rien à lui dire', async () => {
    const avant = await patients()
    expect(avant).toBeGreaterThan(0)
    await heartbeat()
    await attendreCalme()
    expect(await patients()).toBe(avant)
    expect(await appliqueLocalement()).toBeNull()
    expect(diffusions).not.toContain('SYSTEME_VIDAGE')
  })

  describe('Le centre est vidé', () => {
    let demande: string
    let copie: string

    it('le poste apprend l’ordre, vide SA copie avant toute réception, l’accuse, puis repart de zéro', async () => {
      demande = await viderLeCentre()
      copie = await copiePerimee('Copie')
      expect(await patients()).toBe(1)
      recus.length = 0
      appels.mockClear()

      await heartbeat()
      await attendreCalme()

      // La copie périmée est partie
      expect(await patients()).toBe(0)
      // Le poste a retenu CE vidage-là, pour ne jamais le refaire
      expect(await appliqueLocalement()).toBe(demande)
      // Accusé au serveur : la demande est soldée, les échanges ne sont plus refusés
      const p = await poste()
      expect(p.vidageDemandeAt).toBeNull()
      expect(p.vidageFaitAt).not.toBeNull()
      // L'accusé précède toute réception : le serveur refuserait la réception d'un poste non accusé
      const urls = urlsAppelees()
      const iAccuse = urls.findIndex((u) => u.includes('/vidage-termine'))
      const iPull = urls.findIndex((u) => u.includes('/sync/pull'))
      expect(iAccuse).toBeGreaterThanOrEqual(0)
      expect(iPull).toBeGreaterThan(iAccuse)
      // La réception est repartie de l'origine des temps : tout ce que le serveur a, maintenant, est redemandé
      expect(
        appelsPull().some((u) =>
          u.includes('since=1970-01-01T00%3A00%3A00.000Z'),
        ),
      ).toBe(true)
      expect(recus.length).toBeGreaterThan(50)
      expect(+(await curseur()).lastPulledAt).toBeGreaterThan(
        Date.now() - 60_000,
      )
      // Les écrans ouverts sur ce poste se rechargent
      expect(diffusions).toContain('SYSTEME_VIDAGE')
      expect(
        await base().raw.patient.findUnique({ where: { id: copie } }),
      ).toBeNull()
    })

    it('ce qui doit rester sur le poste reste : comptes, personnel, référentiels', async () => {
      expect(gardeAvant['utilisateurs']).toBeGreaterThan(3)
      expect(await gardes()).toEqual(gardeAvant)
    })

    it('il ne refait JAMAIS le même vidage, même si le serveur montre encore la demande', async () => {
      const travail = await copiePerimee('Travail apres vidage')
      appels.mockClear()
      // Le serveur montre ENCORE la demande déjà accomplie (accusé perdu, effacement tardif…).
      appels.mockImplementationOnce(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              controle: {
                suspendu: false,
                motif: null,
                resyncDemandeeAt: null,
                vidageDemandeAt: demande,
              },
            }),
            { status: 201 },
          ),
        ),
      )
      await heartbeat()
      await attendreCalme()
      expect(await base().raw.patient.count({ where: { id: travail } })).toBe(1)
      expect(urlsAppelees().some((u) => u.includes('/vidage-termine'))).toBe(
        false,
      )
    })

    it('redémarré entre son vidage et son accusé, il n’efface pas le travail fait depuis : il accuse seulement', async () => {
      const travail = await copiePerimee('Travail avant redemarrage')
      // Le serveur n'a pas reçu l'accusé : sa demande est toujours là
      await base().posteLocal.update({
        where: { id: POSTE },
        data: { vidageDemandeAt: new Date(demande) },
      })
      // Un client NEUF (le poste vient de redémarrer) : rien en mémoire, mais la base locale se souvient
      const neuf = new SyncClientService(
        base() as unknown as PrismaService,
        moteurLocal,
        {
          rediffuserDepuisSynchro: () => undefined,
          broadcastLive: () => undefined,
        } as unknown as NotificationService,
      )
      const reglerNeuf = (nom: string, valeur: unknown) =>
        Object.defineProperty(neuf, nom, {
          get: () => valeur,
          configurable: true,
        })
      reglerNeuf('enabled', true)
      reglerNeuf('serverUrl', central)
      reglerNeuf('token', admin.jeton)
      reglerNeuf('posteLocalId', POSTE)
      reglerNeuf('siteId', admin.user.siteId)
      reglerNeuf('versionApp', '1.10.0-test')
      reglerNeuf('libelle', `Poste ${POSTE}`)
      const interneNeuf = neuf as unknown as Interne
      appels.mockClear()
      await interneNeuf.heartbeat()
      for (let i = 0; i < 250 && (interneNeuf.verrou || neuf.enCours); i++)
        await new Promise((r) => setTimeout(r, 20))
      expect(await base().raw.patient.count({ where: { id: travail } })).toBe(1)
      expect(urlsAppelees().some((u) => u.includes('/vidage-termine'))).toBe(
        true,
      )
      expect((await poste()).vidageDemandeAt).toBeNull()
    })
  })

  describe('Un nouveau vidage', () => {
    it('refus « vidage en attente » : ce n’est pas une panne, rien n’est signalé comme erreur', async () => {
      await viderLeCentre()
      // Le poste n'a pas encore reçu l'ordre (le battement n'est pas passé) : il essaie de recevoir.
      const erreurs = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined)
      try {
        appels.mockClear()
        expect(await client.runCycle()).toBeNull()
        const pulls = appelsPull()
        expect(pulls).toHaveLength(1)
        expect(erreurs).not.toHaveBeenCalled()
        // Il n'a pas non plus conclu à une suspension
        expect(client.etatControle.suspendu).toBe(false)
      } finally {
        erreurs.mockRestore()
      }
    })

    it('puis le battement lui donne l’ordre : il vide, accuse, et ses échanges reprennent', async () => {
      const travail = await copiePerimee('Encore du travail')
      expect(await patients()).toBeGreaterThan(0)
      await heartbeat()
      await attendreCalme()
      expect(await base().raw.patient.count({ where: { id: travail } })).toBe(0)
      expect((await poste()).vidageDemandeAt).toBeNull()
      expect(await client.runCycle()).not.toBeNull()
    })

    it('suspendu : le vidage attend la levée de la suspension, puis est accompli', async () => {
      expect(
        (
          await admin.post(`/sync/supervision/postes/${POSTE}/suspension`, {
            motif: 'test',
          })
        ).status,
      ).toBe(201)
      await viderLeCentre()
      const travail = await copiePerimee('Pendant la suspension')
      await heartbeat()
      await attendreCalme()
      expect(client.etatControle.suspendu).toBe(true)
      // La suspension prime : la copie n'est pas vidée, rien n'est accusé
      expect(await base().raw.patient.count({ where: { id: travail } })).toBe(1)
      expect((await poste()).vidageDemandeAt).not.toBeNull()
      // À la levée, le vidage s'accomplit
      expect(
        (await admin.delete(`/sync/supervision/postes/${POSTE}/suspension`))
          .status,
      ).toBe(200)
      await heartbeat()
      await attendreCalme()
      expect(client.etatControle.suspendu).toBe(false)
      expect(await base().raw.patient.count({ where: { id: travail } })).toBe(0)
      expect((await poste()).vidageDemandeAt).toBeNull()
    })
  })
})
