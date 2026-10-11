/**
 * Contrôle du flux, côté POSTE — le VRAI client de synchronisation (SyncClientService) face
 * à un serveur central réel (l'API de test, ouverte sur un port local).
 *
 * Ce que ce test prouve et qu'aucun test du serveur seul ne peut prouver :
 *  - un poste suspendu CESSE d'insister (aucune requête), le sait par son battement de vie,
 *    et le sait aussi par un refus 423 — sans traiter cela comme une panne ;
 *  - à la reprise, il repart ; la réponse d'un serveur ancien ne le libère pas à tort ;
 *  - une resynchronisation complète retélécharge VRAIMENT tout (le curseur est remis à l'origine
 *    des temps — il n'est pas nullable en base), puis l'accuse ; un accusé réussi n'est jamais
 *    refait ; elle attend la levée d'une suspension ;
 *  - deux déclencheurs simultanés ne lancent pas deux cycles en parallèle.
 *
 * Le client est construit à la main, avec la vraie base de test pour son curseur (mêmes
 * contraintes de schéma qu'en production) et un moteur d'application local factice qui compte
 * ce qu'on lui demande d'appliquer. Ses réglages (adresse du serveur, jeton, identité du poste)
 * sont posés sur l'instance : `process.env` est partagé avec le serveur de test, qui lit
 * `DATABASE_PROVIDER` — y poser « sqlite » le rendrait inerte.
 */
import type { AddressInfo } from 'node:net'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { SyncClientService } from '../src/modules/sync/sync-client.service'
import type { SyncService } from '../src/modules/sync/sync.service'
import type { NotificationService } from '../src/modules/notification/notification.service'
import type { PrismaService } from '../src/prisma/prisma.service'
import { baseDe, demarrerApp } from './support/app-test'
import { COMPTES, connecter, type Client } from './support/client'

/** Les membres privés du client, que le test lit et pilote (jamais l'application). */
interface Interne {
  heartbeat(): Promise<void>
  suspendu: boolean
  verrou: boolean
}

describe('Contrôle du flux — le client du poste', () => {
  let app: NestExpressApplication
  let admin: Client
  let client: SyncClientService
  let interne: Interne
  let central: string
  const s = `${Date.now() % 100_000}`
  const POSTE = `poste-cli-${s}`
  /** Tout ce que le moteur local factice a été prié d'appliquer (ce que le poste a REÇU). */
  const recus: string[] = []
  let appels: jest.SpyInstance<Promise<Response>, Parameters<typeof fetch>>
  /** Le vrai `fetch`, pour ne simuler qu'UN appel (la réponse d'un serveur ancien, un serveur lent). */
  const fetchReel = globalThis.fetch
  /** Date de la dernière resynchronisation demandée, telle que le serveur l'a donnée. */
  let derniereDemande = ''

  const base = () => baseDe(app)
  const heartbeat = () => interne.heartbeat()
  const urlsAppelees = () => appels.mock.calls.map((c) => String(c[0]))
  const appelsPull = () => urlsAppelees().filter((u) => u.includes('/sync/pull'))
  const poste = () =>
    base().posteLocal.findUniqueOrThrow({ where: { id: POSTE } })
  const curseur = () =>
    base().syncState.findFirstOrThrow({ where: { posteLocalId: POSTE } })
  /** Les déclencheurs (battement de vie…) lancent des cycles en arrière-plan : on attend le calme. */
  const attendreCalme = async () => {
    for (let i = 0; i < 250; i++) {
      if (!interne.verrou && !client.enCours) return
      await new Promise((r) => setTimeout(r, 20))
    }
    throw new Error('Le client ne se calme pas')
  }
  const admin_ = {
    suspendre: (motif?: string) =>
      admin.post(`/sync/supervision/postes/${POSTE}/suspension`, motif ? { motif } : {}),
    reprendre: () => admin.delete(`/sync/supervision/postes/${POSTE}/suspension`),
    demanderResync: () =>
      admin.post<{ resyncDemandeeAt: string }>(
        `/sync/supervision/postes/${POSTE}/resynchronisation`,
      ),
    annulerResync: () => admin.delete(`/sync/supervision/postes/${POSTE}/resynchronisation`),
  }

  beforeAll(async () => {
    app = await demarrerApp()
    admin = await connecter(app, COMPTES.admin)
    await app.listen(0, '127.0.0.1')
    central = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`

    const moteurLocal = {
      ingest: (env: { id: string }) => {
        recus.push(env.id)
        return Promise.resolve({ applied: true })
      },
      // Aucun travail local à envoyer : le test porte sur la réception et les ordres.
      pull: () =>
        Promise.resolve({
          changes: [],
          nextSince: new Date().toISOString(),
          hasMore: false,
          serverTime: new Date().toISOString(),
        }),
    }
    const sonnerie = {
      rediffuserDepuisSynchro: () => undefined,
      broadcastLive: () => undefined,
    }
    client = new SyncClientService(
      base() as unknown as PrismaService,
      moteurLocal as unknown as SyncService,
      sonnerie as unknown as NotificationService,
    )
    interne = client as unknown as Interne
    const regler = (nom: string, valeur: unknown) =>
      Object.defineProperty(client, nom, { get: () => valeur, configurable: true })
    regler('enabled', true)
    regler('serverUrl', central)
    regler('token', admin.jeton)
    regler('posteLocalId', POSTE)
    regler('siteId', admin.user.siteId)
    regler('versionApp', '1.10.0-test')
    regler('libelle', `Poste ${POSTE}`)

    appels = jest.spyOn(globalThis, 'fetch')
  })
  afterAll(async () => {
    appels.mockRestore()
    await base().syncState.deleteMany({ where: { posteLocalId: POSTE } })
    await app.close()
  })

  it('son battement de vie annonce sa version et le niveau d’ordres qu’il comprend', async () => {
    await heartbeat()
    const p = await poste()
    expect(p.versionApp).toBe('1.10.0-test')
    expect(p.niveauControle).toBeGreaterThanOrEqual(1)
    expect(client.etatControle).toEqual({
      suspendu: false,
      motifSuspension: null,
      resyncEnCours: false,
    })
  })

  describe('Suspension', () => {
    it('suspendu par le serveur, il l’apprend au battement de vie et CESSE d’insister', async () => {
      await admin_.suspendre('Contrôle du parc')
      await heartbeat()
      expect(client.etatControle).toMatchObject({
        suspendu: true,
        motifSuspension: 'Contrôle du parc',
      })
      const avant = appels.mock.calls.length
      expect(await client.runCycle()).toBeNull()
      await client.triggerSync('test')
      // Pas une requête : ni vérification de joignabilité, ni réception, ni envoi.
      expect(appels.mock.calls.length).toBe(avant)
      expect((await client.clientStatus()).suspendu).toBe(true)
    })

    it('l’interface du poste apprend la suspension (bulle de synchronisation)', async () => {
      expect(client.etatControle.suspendu).toBe(true)
    })

    it('le refus 423 est reconnu comme une suspension — pas comme une panne', async () => {
      // Le poste n'a pas encore appris la suspension (battement pas encore passé) : il essaie.
      interne.suspendu = false
      appels.mockClear()
      expect(await client.runCycle()).toBeNull()
      const pulls = appelsPull()
      expect(pulls).toHaveLength(1)
      // Le poste dit qui il est à la réception : c'est ce qui permet au serveur de le refuser.
      expect(pulls[0]).toContain(`posteLocalId=${POSTE}`)
      expect(client.etatControle).toMatchObject({
        suspendu: true,
        motifSuspension: 'Contrôle du parc',
      })
    })

    it('une réponse sans ordres (serveur ancien) ne le libère pas', async () => {
      appels.mockImplementationOnce(() =>
        Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 201 })),
      )
      await heartbeat()
      expect(client.etatControle.suspendu).toBe(true)
    })

    it('à la reprise, il repart tout de suite', async () => {
      await admin_.reprendre()
      await heartbeat()
      await attendreCalme()
      expect(client.etatControle.suspendu).toBe(false)
      // Le battement a déclenché un cycle : le poste a bien reçu le contenu du serveur.
      expect(recus.length).toBeGreaterThan(0)
    })
  })

  describe('Resynchronisation complète', () => {
    it('retélécharge VRAIMENT tout : le curseur est remis à l’origine des temps', async () => {
      // Le poste est à jour : une réception incrémentale ne rapporte presque rien.
      await client.runCycle()
      const dejaRecus = recus.length
      await client.runCycle()
      const incrementale = recus.length - dejaRecus
      expect(incrementale).toBeLessThan(dejaRecus / 2)

      const avant = recus.length
      derniereDemande = (
        await admin_.demanderResync()
      ).body.resyncDemandeeAt
      await heartbeat()
      expect(client.etatControle.resyncEnCours).toBe(true)
      await attendreCalme()
      // Tout est revenu : autant que la première fois.
      expect(recus.length - avant).toBeGreaterThanOrEqual(Math.floor(dejaRecus * 0.9))
      // La réception est repartie du 1er janvier 1970.
      expect(
        appelsPull().some((u) => u.includes('since=1970-01-01T00%3A00%3A00.000Z')),
      ).toBe(true)
    })

    it('puis l’accuse : le serveur solde la demande et note la date', async () => {
      const p = await poste()
      expect(p.resyncDemandeeAt).toBeNull()
      expect(p.resyncFaiteAt).not.toBeNull()
      expect(client.etatControle.resyncEnCours).toBe(false)
      // Le curseur de réception est reparti de l'avant : il ne reste pas à 1970.
      expect(+(await curseur()).lastPulledAt).toBeGreaterThan(Date.now() - 60_000)
    })

    it('une demande accomplie n’est jamais refaite, même si le serveur tarde à l’effacer', async () => {
      appels.mockClear()
      // Le serveur montre ENCORE la demande déjà accomplie (accusé perdu, effacement tardif…).
      appels.mockImplementationOnce(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              controle: { suspendu: false, motif: null, resyncDemandeeAt: derniereDemande },
            }),
            { status: 201 },
          ),
        ),
      )
      await heartbeat()
      await attendreCalme()
      expect(client.etatControle.resyncEnCours).toBe(false)
      // Aucune réception : pas de cycle de resynchronisation relancé.
      expect(appelsPull()).toHaveLength(0)
    })

    it('suspendu, il garde la demande en attente — et la fait à la reprise', async () => {
      await admin_.suspendre()
      await admin_.demanderResync()
      await heartbeat()
      // Suspendu : la demande n'est pas engagée.
      expect(client.etatControle).toMatchObject({ suspendu: true, resyncEnCours: false })
      const avant = recus.length
      await admin_.reprendre()
      await heartbeat()
      expect(client.etatControle.resyncEnCours).toBe(true)
      await attendreCalme()
      expect(recus.length - avant).toBeGreaterThan(50)
      expect((await poste()).resyncDemandeeAt).toBeNull()
      expect(client.etatControle.resyncEnCours).toBe(false)
    })

    it('une demande annulée avant d’être prise ne déclenche rien', async () => {
      await admin_.demanderResync()
      await admin_.annulerResync()
      const avant = recus.length
      await heartbeat()
      await attendreCalme()
      expect(client.etatControle.resyncEnCours).toBe(false)
      expect(recus.length - avant).toBeLessThan(10)
    })
  })

  describe('Exclusion des cycles', () => {
    it('deux déclencheurs simultanés ne lancent PAS deux cycles en parallèle', async () => {
      await attendreCalme()
      appels.mockClear()
      const [a, b] = await Promise.all([client.runCycle(), client.runCycle()])
      // Un seul des deux travaille ; l'autre rend la main aussitôt.
      expect([a, b].filter((x) => x !== null)).toHaveLength(1)
      expect(appelsPull()).toHaveLength(1)
    })

    it('« synchronisation en cours » ne s’affiche pas pendant qu’il vérifie seulement si le serveur répond', async () => {
      await attendreCalme()
      // Le serveur met du temps à répondre à la vérification : le cycle est déjà verrouillé
      // (aucun autre ne peut démarrer), mais rien ne doit s'afficher « en cours ».
      appels.mockImplementation((entree, init) =>
        String(entree).includes('/health/ping')
          ? new Promise((r) => setTimeout(() => r(new Response('ok')), 100))
          : fetchReel(entree, init),
      )
      const essai = client.runCycle()
      await new Promise((r) => setTimeout(r, 30))
      expect(interne.verrou).toBe(true)
      expect(client.enCours).toBe(false)
      expect(await essai).not.toBeNull()
      expect(client.enCours).toBe(false)
      appels.mockRestore()
      appels = jest.spyOn(globalThis, 'fetch')
    })
  })
})
