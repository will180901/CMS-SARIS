/**
 * L'ENVOI d'un poste vers le central — le VRAI client de synchronisation (SyncClientService), avec
 * un moteur local factice dont on maîtrise les lignes et leur `updatedAt`.
 *
 * Ce que ce test prouve :
 *  - une écriture faite PENDANT l'échange d'envoi (après la collecte, avant la réponse du serveur)
 *    repart au cycle suivant. Elle était datée avant le curseur — placé à l'heure du serveur, relevée
 *    à la fin de l'échange — donc jugée « déjà partie », et perdue ;
 *  - le curseur se mesure sur l'horloge du POSTE : un curseur situé dans le futur (horloge reculée,
 *    ou ancienne version) ne fait pas ignorer ce qui s'écrit ensuite ;
 *  - une écriture locale part d'elle-même dans les secondes qui suivent, et une requête qui n'écrit
 *    rien ne dérange pas le serveur.
 *
 * L'échange d'envoi (`POST /sync/push`) est simulé : il permet de faire tomber une écriture à un instant
 * précis de l'échange, ce qu'un vrai serveur ne laisse pas faire.
 */
import type { AddressInfo } from 'node:net'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { SyncClientService } from '../src/modules/sync/sync-client.service'
import type { SyncService } from '../src/modules/sync/sync.service'
import type { NotificationService } from '../src/modules/notification/notification.service'
import type { PrismaService } from '../src/prisma/prisma.service'
import { baseDe, demarrerApp } from './support/app-test'
import { COMPTES, connecter, type Client } from './support/client'

interface Interne {
  delaiEnvoiMs: number
}
interface LigneLocale {
  id: string
  updatedAt: Date
}

describe('Envoi d’un poste vers le central', () => {
  let app: NestExpressApplication
  let admin: Client
  let client: SyncClientService
  let interne: Interne
  const s = `${Date.now() % 100_000}`
  const POSTE = `poste-env-${s}`

  /** Les lignes que le moteur local factice « a en base ». */
  let lignes: LigneLocale[] = []
  /** Le `since` avec lequel le client a demandé ses lignes au moteur local, à chaque collecte d'envoi. */
  const depuis: (string | undefined)[] = []
  /** Les identifiants envoyés à chaque échange d'envoi. */
  const envois: string[][] = []
  /** Ce qui se passe PENDANT l'échange d'envoi (une écriture, par exemple). */
  let pendantEchange: (() => void) | null = null
  let appels: jest.SpyInstance<Promise<Response>, Parameters<typeof fetch>>
  const fetchReel = globalThis.fetch

  const base = () => baseDe(app)
  const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms))
  const siteDuPoste = () => admin.user.siteId as string
  const poserCurseur = (lastPushedAt: Date) =>
    base().syncState.upsert({
      where: { posteLocalId_siteId: { posteLocalId: POSTE, siteId: siteDuPoste() } },
      update: { lastPushedAt },
      create: { posteLocalId: POSTE, siteId: siteDuPoste(), lastPushedAt },
    })
  const curseur = async (): Promise<number> =>
    (await base().syncState.findFirstOrThrow({ where: { posteLocalId: POSTE } })).lastPushedAt?.getTime() ?? 0

  beforeAll(async () => {
    app = await demarrerApp()
    admin = await connecter(app, COMPTES.admin)
    await app.listen(0, '127.0.0.1')
    const central = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`

    const moteurLocal = {
      ingest: () => Promise.resolve({ applied: true }),
      pull: (_site: string, since: string | undefined, limite: number) => {
        depuis.push(since)
        const debut = new Date()
        const seuil = since ? new Date(since) : new Date(0)
        const changes = lignes
          .filter((l) => l.updatedAt > seuil)
          .slice(0, limite)
          .map((l) => ({
            model: 'Fake', id: l.id, op: 'upsert' as const, data: { id: l.id },
            updatedAt: l.updatedAt.toISOString(), deletedAt: null,
          }))
        return Promise.resolve({
          changes, nextSince: debut.toISOString(), hasMore: false, serverTime: debut.toISOString(),
        })
      },
    }
    const sonnerie = { rediffuserDepuisSynchro: () => undefined, broadcastLive: () => undefined }
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

    appels = jest.spyOn(globalThis, 'fetch')
    appels.mockImplementation(async (url, init) => {
      if (!String(url).includes('/sync/push')) return fetchReel(url as RequestInfo, init)
      const corps = JSON.parse(String(init?.body)) as { changes: { id: string }[] }
      envois.push(corps.changes.map((c) => c.id))
      pendantEchange?.()
      // Le serveur travaille un instant, puis répond avec SON heure — postérieure à tout ce qui s'est écrit entre-temps.
      await attendre(40)
      return new Response(
        JSON.stringify({
          applied: corps.changes.map((c) => c.id), skipped: [], conflicts: [], rejected: [],
          serverTime: new Date().toISOString(),
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    })
  })
  afterAll(async () => {
    appels.mockRestore()
    await base().syncState.deleteMany({ where: { posteLocalId: POSTE } })
    await app.close()
  })
  beforeEach(() => {
    lignes = []
    depuis.length = 0
    envois.length = 0
    pendantEchange = null
  })

  it('une écriture faite PENDANT l’échange repart au cycle suivant (elle n’est plus perdue)', async () => {
    await poserCurseur(new Date(Date.now() - 60_000))
    lignes.push({ id: 'avant', updatedAt: new Date(Date.now() - 10_000) })
    // Pendant l'envoi, l'utilisateur écrit : la ligne est datée APRÈS le début de la collecte mais
    // AVANT la réponse du serveur — la fenêtre où elle se perdait.
    pendantEchange = () => {
      lignes.push({ id: 'pendant', updatedAt: new Date() })
    }
    await client.push()
    expect(envois[0]).toEqual(['avant'])

    pendantEchange = null
    await client.push()
    expect(envois[1]).toEqual(['pendant'])
  })

  it('le curseur est posé sur l’horloge du poste, au début de la collecte', async () => {
    await poserCurseur(new Date(Date.now() - 60_000))
    lignes.push({ id: 'x', updatedAt: new Date(Date.now() - 1_000) })
    const avant = Date.now()
    await client.push()
    const c = await curseur()
    // ≈ début de la collecte − 1 s de marge : jamais l'heure du serveur, relevée plus tard.
    expect(c).toBeGreaterThan(avant - 1_500)
    expect(c).toBeLessThanOrEqual(avant)
  })

  it('un curseur dans le FUTUR du poste (horloge reculée) ne fait pas ignorer ce qui s’écrit ensuite', async () => {
    await poserCurseur(new Date(Date.now() + 10 * 60_000))
    lignes.push({ id: 'recent', updatedAt: new Date(Date.now() - 2_000) })
    await client.push()
    expect(envois[0]).toEqual(['recent'])
    // Et le curseur est revenu à l'horloge du poste.
    expect(await curseur()).toBeLessThanOrEqual(Date.now())
  })

  describe('Envoi automatique après une écriture', () => {
    it('une écriture locale part d’elle-même, sans attendre le filet de 5 minutes', async () => {
      interne.delaiEnvoiMs = 30
      await poserCurseur(new Date(Date.now() - 60_000))
      lignes.push({ id: 'ecrite', updatedAt: new Date() })
      client.notifierEcritureLocale()
      for (let i = 0; i < 100 && envois.length === 0; i++) await attendre(30)
      expect(envois[0]).toEqual(['ecrite'])
    })

    it('une rafale d’écritures ne fait qu’UN envoi', async () => {
      interne.delaiEnvoiMs = 80
      await poserCurseur(new Date(Date.now() - 60_000))
      lignes.push({ id: 'r1', updatedAt: new Date() })
      client.notifierEcritureLocale()
      lignes.push({ id: 'r2', updatedAt: new Date() })
      client.notifierEcritureLocale()
      lignes.push({ id: 'r3', updatedAt: new Date() })
      client.notifierEcritureLocale()
      for (let i = 0; i < 100 && envois.length === 0; i++) await attendre(30)
      await attendre(300)
      expect(envois).toHaveLength(1)
      expect([...envois[0]!].sort()).toEqual(['r1', 'r2', 'r3'])
    })

    it('une requête qui n’écrit rien ne dérange pas le serveur', async () => {
      interne.delaiEnvoiMs = 30
      // Tout est déjà parti : le curseur est tout récent, aucune ligne après lui.
      await poserCurseur(new Date())
      client.notifierEcritureLocale()
      await attendre(400)
      expect(envois).toHaveLength(0)
    })
  })
})
