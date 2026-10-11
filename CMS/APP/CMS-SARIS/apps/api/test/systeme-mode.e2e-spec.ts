/**
 * Mode du système (production / test), par ses vraies routes :
 *  - tout utilisateur connecté le lit (c'est ce qui fait le bandeau « MODE TEST » chez tout le monde) ;
 *  - seul l'administrateur système le change, ET son mot de passe est redemandé : un mot de passe
 *    faux est refusé (403 — pas 401, qui ferait renouveler la session) et laissé dans l'audit ;
 *  - chaque bascule laisse sa trace (qui, d'où, avant, après) ; changer vers le mode déjà en place
 *    n'écrit ni ne trace rien ;
 *  - le VERROU de mise en service (MODE_TEST_AUTORISE) interdit d'entrer en mode test, force le mode
 *    effectif à « production » même si la base dit « test », et se trompe du bon côté (une faute de
 *    frappe verrouille) ;
 *  - chaque bascule réelle est annoncée EN DIRECT à tous les écrans ouverts (même sans aucun droit) ;
 *    un changement sans effet ou refusé n’annonce rien ;
 *  - la ligne du mode est intouchable depuis les paramètres système ;
 *  - le serveur annonce le mode aux postes dans la réponse de leur battement de vie ; un poste ne
 *    peut pas changer de mode.
 */
import type { NestExpressApplication } from '@nestjs/platform-express'
import { NotificationService } from '../src/modules/notification/notification.service'
import { baseDe, demarrerApp } from './support/app-test'
import { COMPTES, connecter, type Client } from './support/client'
import { routesProtegees } from './support/routes'

interface Etat {
  mode: 'PRODUCTION' | 'TEST'
  verrouille: boolean
  modifiable: boolean
  depuis: string | null
  parNom: string | null
}
interface Refus {
  code: string
  message: string
}

describe('Mode du système (production / test)', () => {
  let app: NestExpressApplication
  let admin: Client
  let infirmier: Client
  let medecin: Client
  const MDP = COMPTES.admin.motDePasse

  const base = () => baseDe(app)
  const lire = (c: Client) => c.get<Etat>('/systeme/mode')
  const changer = (c: Client, mode: string, motDePasse?: string) =>
    c.appel(
      'put',
      '/systeme/mode',
      {},
      motDePasse === undefined ? { mode } : { mode, motDePasse },
    )
  const traces = (action: string) =>
    base().journalAudit.findMany({
      where: { module: 'systeme', entiteType: 'ModeSysteme', action },
      orderBy: { createdAt: 'asc' },
    })
  /** Pose (ou retire) la variable de verrou le temps d'un test — lue à chaque appel par le serveur. */
  const avecVerrou = async (valeur: string, action: () => Promise<void>) => {
    process.env['MODE_TEST_AUTORISE'] = valeur
    try {
      await action()
    } finally {
      delete process.env['MODE_TEST_AUTORISE']
    }
  }

  beforeAll(async () => {
    app = await demarrerApp()
    admin = await connecter(app, COMPTES.admin)
    infirmier = await connecter(app, COMPTES.infirmier)
    medecin = await connecter(app, COMPTES.medecinChef)
    // Départ propre, quoi que les autres fichiers aient laissé — la ligne du mode, mais aussi les
    // traces de bascule : ce fichier compte les siennes.
    await base().parametreSysteme.deleteMany({ where: { cle: 'systeme.mode' } })
    await base().journalAudit.deleteMany({
      where: { module: 'systeme', entiteType: 'ModeSysteme' },
    })
    delete process.env['MODE_TEST_AUTORISE']
  })
  afterAll(async () => {
    await base().parametreSysteme.deleteMany({ where: { cle: 'systeme.mode' } })
    await app.close()
  })

  describe('Lecture', () => {
    it.each([
      ['administrateur', () => admin],
      ['médecin chef', () => medecin],
      ['infirmier', () => infirmier],
    ])(
      '%s : par défaut, PRODUCTION — non verrouillé, modifiable',
      async (_nom, qui) => {
        const r = await lire(qui())
        expect(r.status).toBe(200)
        expect(r.body).toEqual({
          mode: 'PRODUCTION',
          verrouille: false,
          modifiable: true,
          depuis: null,
          parNom: null,
        })
      },
    )
  })

  describe('Qui peut changer, et à quelles conditions', () => {
    it.each([
      ['infirmier', () => infirmier],
      ['médecin chef', () => medecin],
    ])(
      '%s : refusé (403), même avec le bon mot de passe — rien ne change',
      async (_nom, qui) => {
        const r = await changer(qui(), 'TEST', MDP)
        expect(r.status).toBe(403)
        expect((await lire(admin)).body.mode).toBe('PRODUCTION')
        expect(await traces('MODE_TEST_ON')).toHaveLength(0)
      },
    )

    it('l’administrateur sans mot de passe : 400 ; un mode inconnu : 400', async () => {
      expect((await changer(admin, 'TEST')).status).toBe(400)
      expect((await changer(admin, 'AUTRE', MDP)).status).toBe(400)
      expect((await changer(admin, 'TEST', '')).status).toBe(400)
      expect((await lire(admin)).body.mode).toBe('PRODUCTION')
    })

    it('mot de passe FAUX : refusé en 403 (pas 401), rien ne change, et l’échec est tracé', async () => {
      const r = await changer(admin, 'TEST', 'pas-le-bon-mot-de-passe')
      // 403 et pas 401 : un 401 ferait renouveler la session côté application.
      expect(r.status).toBe(403)
      expect((r.body as Refus).code).toBe('MOT_DE_PASSE_INCORRECT')
      expect((await lire(admin)).body.mode).toBe('PRODUCTION')

      const echecs = await traces('MODE_ECHEC')
      expect(echecs).toHaveLength(1)
      expect(echecs[0]).toMatchObject({
        utilisateurId: admin.user.id,
        statut: 'ERREUR',
        apresJson: { demande: 'TEST', raison: 'mot de passe incorrect' },
      })
      expect(echecs[0].ipAdresse).toBeTruthy()
    })
  })

  describe('Passer en mode test, puis revenir', () => {
    let depuis: string

    it('avec le bon mot de passe : TEST, et tout le monde le voit', async () => {
      const r = await changer(admin, 'TEST', MDP)
      expect(r.status).toBe(200)
      const etat = r.body as Etat
      expect(etat).toMatchObject({
        mode: 'TEST',
        verrouille: false,
        modifiable: true,
      })
      expect(etat.depuis).toBeTruthy()
      expect(etat.parNom).toBeTruthy()
      depuis = etat.depuis!

      for (const c of [infirmier, medecin, admin])
        expect((await lire(c)).body).toMatchObject({
          mode: 'TEST',
          parNom: etat.parNom,
        })
    })

    it('la bascule est tracée : qui, d’où, avant et après', async () => {
      const t = await traces('MODE_TEST_ON')
      expect(t).toHaveLength(1)
      expect(t[0]).toMatchObject({
        utilisateurId: admin.user.id,
        statut: 'SUCCES',
        avantJson: { mode: 'PRODUCTION' },
        apresJson: { mode: 'TEST' },
      })
      expect(t[0].ipAdresse).toBeTruthy()
      // L'auteur et la date viennent de la ligne du paramètre elle-même.
      const ligne = await base().parametreSysteme.findUniqueOrThrow({
        where: { cle: 'systeme.mode' },
      })
      expect(ligne).toMatchObject({ valeur: 'TEST', updatedBy: admin.user.id })
    })

    it('changer vers le mode déjà en place : sans effet, sans nouvelle trace', async () => {
      const r = await changer(admin, 'TEST', MDP)
      expect(r.status).toBe(200)
      expect((r.body as Etat).depuis).toBe(depuis)
      expect(await traces('MODE_TEST_ON')).toHaveLength(1)
    })

    it('le mot de passe est redemandé À CHAQUE bascule, y compris pour revenir', async () => {
      expect((await changer(admin, 'PRODUCTION', 'faux')).status).toBe(403)
      expect((await lire(admin)).body.mode).toBe('TEST')
    })

    it('revenir en PRODUCTION : le bandeau disparaît pour tout le monde, la bascule est tracée', async () => {
      const r = await changer(admin, 'PRODUCTION', MDP)
      expect(r.status).toBe(200)
      expect(r.body).toMatchObject({
        mode: 'PRODUCTION',
        depuis: null,
        parNom: null,
      })
      for (const c of [infirmier, medecin])
        expect((await lire(c)).body.mode).toBe('PRODUCTION')
      const t = await traces('MODE_TEST_OFF')
      expect(t).toHaveLength(1)
      expect(t[0]).toMatchObject({
        avantJson: { mode: 'TEST' },
        apresJson: { mode: 'PRODUCTION' },
      })
    })
  })

  describe('Diffusion aux écrans ouverts', () => {
    // Quoi qu'il arrive dans un test (même un échec en cours de route), le suivant repart de la production.
    afterEach(async () => {
      await base().parametreSysteme.deleteMany({
        where: { cle: 'systeme.mode' },
      })
    })

    /**
     * Les annonces « SYSTEME_MODE » que recevrait l'écran d'un infirmier : aucun droit
     * d'administration, un site qui n'est celui de personne — si l'annonce lui parvient, elle
     * parvient à tout le monde.
     */
    const ecouter = () => {
      const recus: string[] = []
      const abonnement = app
        .get(NotificationService, { strict: false })
        .streamFor({
          userId: infirmier.user.id,
          siteId: 'un-autre-site',
          permissions: [],
        })
        .subscribe((e) => recus.push((e.data as { type: string }).type))
      return {
        annonces: () => recus.filter((t) => t === 'SYSTEME_MODE').length,
        arreter: () => abonnement.unsubscribe(),
      }
    }

    it('chaque bascule est annoncée en direct, à tous ; un changement sans effet ne l’est pas', async () => {
      const ecoute = ecouter()
      try {
        expect((await changer(admin, 'TEST', MDP)).status).toBe(200)
        expect(ecoute.annonces()).toBe(1)
        // Déjà en mode test : rien ne change, donc rien à annoncer.
        expect((await changer(admin, 'TEST', MDP)).status).toBe(200)
        expect(ecoute.annonces()).toBe(1)
        expect((await changer(admin, 'PRODUCTION', MDP)).status).toBe(200)
        expect(ecoute.annonces()).toBe(2)
      } finally {
        ecoute.arreter()
      }
    })

    it('un changement refusé (mot de passe faux, verrou) n’annonce rien', async () => {
      const ecoute = ecouter()
      try {
        expect((await changer(admin, 'TEST', 'faux')).status).toBe(403)
        await avecVerrou('false', async () => {
          expect((await changer(admin, 'TEST', MDP)).status).toBe(403)
        })
        expect(ecoute.annonces()).toBe(0)
      } finally {
        ecoute.arreter()
      }
    })
  })

  describe('La ligne du mode est intouchable depuis les paramètres système', () => {
    it('elle n’y figure pas, et ne s’y modifie pas (pas de mot de passe ni de verrou là-bas)', async () => {
      const liste = await admin.get<{ cle: string }[]>('/admin/parametres')
      expect(liste.body.map((p) => p.cle)).not.toContain('systeme.mode')
      const r = await admin.appel(
        'patch',
        '/admin/parametres/systeme.mode',
        {},
        { valeur: 'TEST' },
      )
      expect(r.status).toBe(400)
      expect((await lire(admin)).body.mode).toBe('PRODUCTION')
    })
  })

  describe('Verrou de mise en service (MODE_TEST_AUTORISE)', () => {
    it('verrouillé : l’état le dit, entrer en mode test est refusé (403), même avec le bon mot de passe', async () => {
      await avecVerrou('false', async () => {
        expect((await lire(infirmier)).body).toMatchObject({
          mode: 'PRODUCTION',
          verrouille: true,
        })
        const r = await changer(admin, 'TEST', MDP)
        expect(r.status).toBe(403)
        expect((r.body as Refus).code).toBe('MODE_TEST_VERROUILLE')
      })
      // Le refus n'a rien écrit : le verrou levé, on est toujours en production.
      expect((await lire(admin)).body.mode).toBe('PRODUCTION')
    })

    it('un verrou ne se contourne pas en écrivant « TEST » en base : le mode effectif reste PRODUCTION', async () => {
      // La ligne existe déjà (la bascule précédente l'a laissée à « PRODUCTION ») : on la force à « TEST ».
      await base().parametreSysteme.upsert({
        where: { cle: 'systeme.mode' },
        update: { valeur: 'TEST', updatedBy: admin.user.id },
        create: {
          cle: 'systeme.mode',
          valeur: 'TEST',
          updatedBy: admin.user.id,
        },
      })
      await avecVerrou('false', async () => {
        const etat = (await lire(medecin)).body
        expect(etat).toMatchObject({
          mode: 'PRODUCTION',
          verrouille: true,
          depuis: null,
        })
      })
      // Verrou levé : la base disait bien « TEST », on retombe en test — c'est précisément pourquoi
      // revenir en production, verrouillé, doit CORRIGER la base (test suivant).
      expect((await lire(medecin)).body.mode).toBe('TEST')
    })

    it('verrouillé, revenir en production reste permis — et corrige la base, pour que la levée du verrou ne ramène pas en test', async () => {
      await avecVerrou('false', async () => {
        const r = await changer(admin, 'PRODUCTION', MDP)
        expect(r.status).toBe(200)
        expect((r.body as Etat).mode).toBe('PRODUCTION')
      })
      const ligne = await base().parametreSysteme.findUniqueOrThrow({
        where: { cle: 'systeme.mode' },
      })
      expect(ligne.valeur).toBe('PRODUCTION')
      expect((await lire(admin)).body.mode).toBe('PRODUCTION')
    })

    it('une faute de frappe verrouille (« flase ») ; « true » ne verrouille pas', async () => {
      await avecVerrou('flase', async () => {
        expect((await lire(admin)).body.verrouille).toBe(true)
      })
      await avecVerrou('true', async () => {
        expect((await lire(admin)).body.verrouille).toBe(false)
      })
    })
  })

  describe('Annonce aux postes (battement de vie)', () => {
    const battement = () =>
      admin.post<{ ok: boolean; mode?: string }>('/sync/heartbeat', {
        posteLocalId: 'poste-mode-test',
        libelle: 'Poste du test du mode',
      })

    afterAll(async () => {
      await base().posteLocal.deleteMany({ where: { id: 'poste-mode-test' } })
    })

    it('le serveur annonce le mode : production, puis test', async () => {
      expect((await battement()).body.mode).toBe('PRODUCTION')
      await changer(admin, 'TEST', MDP)
      expect((await battement()).body.mode).toBe('TEST')
    })

    it('verrouillé, le serveur annonce « production » même si la base dit « test »', async () => {
      await avecVerrou('false', async () => {
        expect((await battement()).body.mode).toBe('PRODUCTION')
      })
      await changer(admin, 'PRODUCTION', MDP)
    })
  })

  describe('Un poste ne change pas de mode', () => {
    it('sur une base locale (SQLite) : lecture non modifiable, changement refusé (409)', async () => {
      const avant = process.env['DATABASE_PROVIDER']
      process.env['DATABASE_PROVIDER'] = 'sqlite'
      try {
        const etat = (await lire(admin)).body
        expect(etat.modifiable).toBe(false)
        const r = await changer(admin, 'TEST', MDP)
        expect(r.status).toBe(409)
        expect((r.body as Refus).code).toBe('MODE_CENTRAL')
      } finally {
        if (avant === undefined) delete process.env['DATABASE_PROVIDER']
        else process.env['DATABASE_PROVIDER'] = avant
      }
      expect((await lire(admin)).body.mode).toBe('PRODUCTION')
    })
  })

  describe('Droits', () => {
    it('basculer relève du droit `systeme.mode`, que seul l’administrateur système a', () => {
      const route = routesProtegees(app).find(
        (r) => r.methode === 'put' && r.chemin === '/systeme/mode',
      )
      expect(route?.permissions).toEqual(['systeme.mode'])
      expect(admin.user.permissions).toContain('systeme.mode')
      for (const c of [infirmier, medecin])
        expect(c.user.permissions).not.toContain('systeme.mode')
    })
  })
})
