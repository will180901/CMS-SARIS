/**
 * La sonnette du serveur central : ce qui réveille les postes de bureau, et ce qui ne les réveille PAS.
 *
 * Un poste abonné (`GET /sync/events`) lance une synchronisation à chaque sonnerie. Les événements
 * qui ne signalent aucune écriture — le rafraîchissement de la supervision, « en train d'écrire »,
 * le mode, le vidage — ne doivent pas sonner : `SYNC_ACTIVITY` part à CHAQUE battement de vie de
 * CHAQUE poste, et réveillait tout le parc pour une synchronisation à vide à chaque fois.
 * Tout ce qui est une vraie écriture — faite depuis le web, notification métier, messagerie,
 * référentiels — sonne toujours.
 */
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { Subscription } from 'rxjs'
import {
  EVENEMENTS_SANS_DONNEES,
  NotificationService,
} from '../src/modules/notification/notification.service'
import { SyncService } from '../src/modules/sync/sync.service'
import { baseDe, demarrerApp } from './support/app-test'
import { COMPTES, connecter, type Client } from './support/client'
import { creerPatientCdi, referentiels } from './support/donnees'

describe('Sonnette des postes', () => {
  let app: NestExpressApplication
  let admin: Client
  let infirmier: Client
  let notif: NotificationService
  const s = `${Date.now() % 100_000}`
  const ECOUTEUR = `poste-son-ecoute-${s}`
  const AUTRE = `poste-son-autre-${s}`
  /** Les sonneries reçues par le poste qui écoute (les battements « ping » du canal ne comptent pas). */
  let sonneries = 0
  let abonnement: Subscription

  const base = () => baseDe(app)
  const compter = async (action: () => unknown) => {
    const avant = sonneries
    await action()
    return sonneries - avant
  }
  const battement = (posteLocalId: string) =>
    admin.post('/sync/heartbeat', {
      posteLocalId,
      libelle: `Poste ${posteLocalId}`,
      niveauControle: 2,
    })

  beforeAll(async () => {
    app = await demarrerApp()
    admin = await connecter(app, COMPTES.admin)
    infirmier = await connecter(app, COMPTES.infirmier)
    notif = app.get(NotificationService)
    // Le poste ÉCOUTEUR est abonné comme le fait le client de synchronisation d'un poste
    abonnement = app
      .get(SyncService)
      .clochePour(ECOUTEUR)
      .subscribe((e) => {
        if ((e.data as { t?: string }).t === 'sync') sonneries++
      })
  })
  afterAll(async () => {
    abonnement.unsubscribe()
    await base().journalSynchronisation.deleteMany({
      where: { posteLocalId: { in: [ECOUTEUR, AUTRE] } },
    })
    await base().syncState.deleteMany({
      where: { posteLocalId: { in: [ECOUTEUR, AUTRE] } },
    })
    await base().posteLocal.deleteMany({
      where: { id: { in: [ECOUTEUR, AUTRE] } },
    })
    await app.close()
  })

  describe('Ce qui ne sonne PAS', () => {
    it('le battement de vie d’un poste ne réveille aucun poste', async () => {
      expect(await compter(() => battement(AUTRE))).toBe(0)
      expect(await compter(() => battement(ECOUTEUR))).toBe(0)
    })

    it('le rafraîchissement de l’écran de supervision ne sonne pas', async () => {
      expect(
        await compter(() =>
          notif.broadcastLive('SYNC_ACTIVITY', {
            requiredPermission: 'synchronisation.read',
          }),
        ),
      ).toBe(0)
      expect(await compter(() => notif.broadcastLive('LIVE_SYNC'))).toBe(0)
    })

    it('« en train d’écrire » ne sonne pas, pas plus que le mode ou le vidage', async () => {
      expect(
        await compter(() => notif.pushLive(admin.user.id, 'TYPING', 'conv')),
      ).toBe(0)
      expect(
        await compter(() =>
          notif.pushLive(admin.user.id, 'TYPING_AUDIO', 'conv'),
        ),
      ).toBe(0)
      expect(await compter(() => notif.broadcastLive('SYSTEME_MODE'))).toBe(0)
      expect(await compter(() => notif.broadcastLive('SYSTEME_VIDAGE'))).toBe(0)
    })

    it('la liste des événements muets est celle qu’on croit', () => {
      expect([...EVENEMENTS_SANS_DONNEES].sort()).toEqual([
        'LIVE_SYNC',
        'SYNC_ACTIVITY',
        'SYSTEME_MODE',
        'SYSTEME_VIDAGE',
        'TYPING',
        'TYPING_AUDIO',
      ])
    })
  })

  describe('Ce qui sonne toujours', () => {
    it('une écriture faite depuis le web (nouveau dossier) réveille les postes', async () => {
      const ref = await referentiels(infirmier)
      expect(
        await compter(() => creerPatientCdi(infirmier, ref, 'Sonnette')),
      ).toBeGreaterThan(0)
    })

    it('les événements qui portent des données sonnent : référentiels, messagerie, accusés, droits', async () => {
      expect(
        await compter(() => notif.broadcastLive('LIVE_REFERENTIELS')),
      ).toBe(1)
      expect(await compter(() => notif.broadcastLive('LIVE_MESSAGERIE'))).toBe(
        1,
      )
      expect(await compter(() => notif.broadcastLive('LIVE_TRIAGE'))).toBe(1)
      expect(
        await compter(() =>
          notif.pushLive(admin.user.id, 'MESSAGE_NEW', 'conv'),
        ),
      ).toBe(1)
      expect(
        await compter(() =>
          notif.pushLive(admin.user.id, 'MESSAGE_STATUS', 'conv'),
        ),
      ).toBe(1)
      expect(
        await compter(() =>
          notif.pushLive(admin.user.id, 'PERMISSIONS_CHANGED'),
        ),
      ).toBe(1)
    })

    it('une notification métier (persistée) sonne', async () => {
      expect(
        await compter(() =>
          notif.emit({
            type: 'VISITE_CREE',
            category: 'clinique',
            titre: `SON-${s}`,
            message: 'test',
          }),
        ),
      ).toBeGreaterThan(0)
      await base().notification.deleteMany({ where: { titre: `SON-${s}` } })
    })

    it('un envoi d’un AUTRE poste sonne pour celui qui écoute, jamais pour son auteur', () => {
      const avant = sonneries
      app.get(SyncService).sonner(AUTRE)
      expect(sonneries - avant).toBe(1)
      // le poste ÉCOUTEUR, lui, ne se réveille pas pour sa propre écriture
      const avant2 = sonneries
      app.get(SyncService).sonner(ECOUTEUR)
      expect(sonneries - avant2).toBe(0)
    })
  })
})
