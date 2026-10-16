/**
 * Identifiant de connexion — par les vraies routes et la vraie base de test :
 *  - chacun change SON identifiant (mot de passe redemandé : 403 et non 401 s'il est faux), jamais
 *    depuis un poste de bureau, jamais avec un mot de passe temporaire encore en place ;
 *  - forme valide (3 à 32 caractères, lettres/chiffres/. _ -), jamais celui d'un autre compte —
 *    supprimé compris, SANS tenir compte de la casse ;
 *  - un identifiant LIBÉRÉ par un changement est mis de côté 90 jours (les anciennes lignes du
 *    journal portent ce nom), sauf pour son ancien titulaire ;
 *  - l'administrateur peut le corriger, avec les mêmes règles, sans connaître le mot de passe ;
 *  - le changement est tracé « ancien → nouveau » (audit + journal des connexions), la personne est
 *    prévenue, le compte (son `id`, sa session) ne change pas ;
 *  - à la création, l'identifiant est stocké en minuscules ; la connexion ne tient pas compte de la
 *    casse, y compris pour un compte ANCIEN dont l'identifiant a des majuscules.
 */
import * as bcrypt from 'bcrypt'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { MeController } from '../src/modules/security/me.controller'
import { UtilisateursController } from '../src/modules/admin/utilisateurs.controller'
import { REQUIRE_PERMISSIONS_KEY } from '../src/common/decorators/require-permissions.decorator'
import { baseDe, demarrerApp } from './support/app-test'
import { COMPTES, connecter, type Client } from './support/client'

interface Refus {
  statusCode: number
  code?: string
  message: string
}
interface Cree {
  id: string
  login: string
  motDePasseTemporaire: string
}

const MDP = 'Test-Identifiant-2026!'

describe('Identifiant de connexion', () => {
  let app: NestExpressApplication
  let admin: Client
  let infirmier: Client
  const s = `${Date.now() % 100_000}`
  const base = () => baseDe(app)
  const crees: string[] = []
  const loginsVus = new Set<string>()
  const matricules: string[] = []
  let a: Client
  let b: Client
  let idA: string
  let idB: string
  let loginA = `tst.ida${s}`
  const loginB = `tst.idb${s}`
  const loginC = `tst.idc${s}`
  const loginD = `tst.idd${s}`
  let temporaireD: string

  const creer = async (login: string, extra: object = {}) => {
    loginsVus.add(login.toLowerCase())
    const role = await base().role.findFirstOrThrow({ where: { code: 'INFIRMIER' } })
    const matricule = `ID-${login.slice(-9).toUpperCase()}`
    matricules.push(matricule)
    return admin.post<Cree & Refus>('/admin/utilisateurs', {
      login,
      email: `${login.toLowerCase()}@test.local`,
      roleIds: [role.id],
      nom: 'Essai',
      prenom: 'Identifiant',
      matricule,
      ...extra,
    })
  }
  /** Un compte libre (mot de passe connu, plus temporaire), connecté. */
  const compteLibre = async (login: string) => {
    const r = await creer(login)
    expect(r.status).toBe(201)
    crees.push(r.body.id)
    await base().raw.utilisateur.update({
      where: { id: r.body.id },
      data: { passwordHash: await bcrypt.hash(MDP, 4), motDePasseTemp: false },
    })
    return { id: r.body.id, client: await connecter(app, { login, motDePasse: MDP }) }
  }
  const changer = (c: Client, login: string, motDePasse = MDP) =>
    c.appel('patch', '/me/identifiant', {}, { login, motDePasse }) as Promise<{
      status: number
      body: Refus & { login?: string }
    }>
  const corriger = (c: Client, id: string, login: string) =>
    c.appel('patch', `/admin/utilisateurs/${id}/identifiant`, {}, { login }) as Promise<{
      status: number
      body: Refus & { login?: string; id?: string }
    }>
  const loginDe = async (id: string) =>
    (await base().raw.utilisateur.findUniqueOrThrow({ where: { id } })).login

  beforeAll(async () => {
    app = await demarrerApp()
    admin = await connecter(app, COMPTES.admin)
    infirmier = await connecter(app, COMPTES.infirmier)
    ;({ id: idA, client: a } = await compteLibre(loginA))
    ;({ id: idB, client: b } = await compteLibre(loginB))
  })

  afterAll(async () => {
    const lignes = await base().raw.utilisateur.findMany({
      where: { id: { in: crees } },
      select: { id: true, personnelMedicalId: true },
    })
    const ids = lignes.map((l) => l.id)
    await base().raw.notification.deleteMany({
      where: { OR: [{ destinataireId: { in: ids } }, { entiteId: { in: ids } }] },
    })
    await base().raw.sessionUtilisateur.deleteMany({ where: { utilisateurId: { in: ids } } })
    await base().raw.journalAuthentification.deleteMany({
      where: { OR: [{ utilisateurId: { in: ids } }, { login: { in: [...loginsVus] } }] },
    })
    await base().raw.journalAudit.deleteMany({
      where: { OR: [{ entiteId: { in: ids } }, { utilisateurId: { in: ids } }] },
    })
    await base().raw.utilisateurRole.deleteMany({ where: { utilisateurId: { in: ids } } })
    await base().raw.utilisateur.deleteMany({ where: { id: { in: ids } } })
    await base().raw.personnelMedical.deleteMany({
      where: {
        OR: [
          { id: { in: lignes.map((l) => l.personnelMedicalId).filter((x): x is string => !!x) } },
          { matricule: { in: matricules } },
        ],
      },
    })
    await app.close()
  })

  describe('Changer SON identifiant', () => {
    it('un mot de passe faux est refusé (403, pas 401), tracé, et ne change rien', async () => {
      const r = await changer(a, `${loginA}.x`, 'pas-le-bon-1A!')
      expect(r.status).toBe(403)
      expect(r.body.code).toBe('MOT_DE_PASSE_INCORRECT')
      expect(await loginDe(idA)).toBe(loginA)
      expect(
        await base().raw.journalAuthentification.count({
          where: { utilisateurId: idA, resultat: 'ECHEC_CHANGEMENT_IDENTIFIANT' },
        }),
      ).toBe(1)
    })

    it('une forme invalide est refusée (400 IDENTIFIANT_INVALIDE) : trop court, trop long, symboles, accents, espace', async () => {
      for (const mauvais of ['ab', '1abc', 'a b c', 'élodie', 'a@b.c', 'x'.repeat(33), '.abc', '  ']) {
        const r = await changer(a, mauvais)
        expect({ mauvais, status: r.status, code: r.body.code }).toEqual({
          mauvais,
          status: 400,
          code: 'IDENTIFIANT_INVALIDE',
        })
      }
      expect(await loginDe(idA)).toBe(loginA)
    })

    it('un champ absent ou vide est refusé (400)', async () => {
      expect((await a.appel('patch', '/me/identifiant', {}, { motDePasse: MDP })).status).toBe(400)
      expect((await a.appel('patch', '/me/identifiant', {}, { login: 'abcdef' })).status).toBe(400)
      expect((await changer(a, '')).status).toBe(400)
    })

    it('c’est déjà son identifiant : refusé (400), même tapé en majuscules', async () => {
      for (const meme of [loginA, loginA.toUpperCase(), `  ${loginA}  `]) {
        const r = await changer(a, meme)
        expect({ meme, status: r.status, code: r.body.code }).toEqual({
          meme,
          status: 400,
          code: 'IDENTIFIANT_INCHANGE',
        })
      }
    })

    it('celui d’un autre compte est refusé (409), sans tenir compte de la casse', async () => {
      for (const pris of [loginB, loginB.toUpperCase(), 'admin', 'ADMIN', 'moukanda']) {
        const r = await changer(a, pris)
        expect({ pris, status: r.status, code: r.body.code }).toEqual({
          pris,
          status: 409,
          code: 'IDENTIFIANT_PRIS',
        })
      }
      expect(await loginDe(idA)).toBe(loginA)
    })

    it('celui d’un compte SUPPRIMÉ reste occupé : refusé (409) en le disant', async () => {
      const c = await creer(loginC)
      expect(c.status).toBe(201)
      crees.push(c.body.id)
      expect((await admin.delete(`/admin/utilisateurs/${c.body.id}`)).status).toBe(200)
      const r = await changer(a, loginC)
      expect(r.status).toBe(409)
      expect(r.body.code).toBe('IDENTIFIANT_PRIS')
      expect(r.body.message).toMatch(/supprimé/)
    })

    it('avec un mot de passe encore TEMPORAIRE, on ne change pas d’identifiant (403)', async () => {
      const d = await creer(loginD)
      expect(d.status).toBe(201)
      crees.push(d.body.id)
      temporaireD = d.body.motDePasseTemporaire
      const temp = await connecter(app, { login: loginD, motDePasse: temporaireD })
      const r = await temp.appel('patch', '/me/identifiant', {}, { login: `${loginD}.x`, motDePasse: temporaireD })
      expect(r.status).toBe(403)
      expect((r.body as Refus).code).toBe('MOT_DE_PASSE_TEMPORAIRE')
      expect(await loginDe(d.body.id)).toBe(loginD)
    })

    it('depuis un poste de bureau (base locale), c’est refusé (409 MODE_CENTRAL), même avec le bon mot de passe', async () => {
      const avant = process.env['DATABASE_PROVIDER']
      process.env['DATABASE_PROVIDER'] = 'sqlite'
      try {
        const r = await changer(a, `${loginA}.bureau`)
        expect(r.status).toBe(409)
        expect(r.body.code).toBe('MODE_CENTRAL')
      } finally {
        if (avant === undefined) delete process.env['DATABASE_PROVIDER']
        else process.env['DATABASE_PROVIDER'] = avant
      }
      expect(await loginDe(idA)).toBe(loginA)
    })

    it('cinq essais par minute : la limite est bien DÉCLARÉE sur la route', () => {
      const route = MeController.prototype.changerIdentifiant
      expect(Reflect.getMetadata('THROTTLER:LIMITdefault', route)).toBe(5)
      expect(Reflect.getMetadata('THROTTLER:TTLdefault', route)).toBe(60_000)
    })

    it('le changement réussit : rendu en MINUSCULES, même compte, même session', async () => {
      const ancien = loginA
      const nouveau = `${ancien}.v2`
      const r = await changer(a, nouveau.toUpperCase())
      expect(r.status).toBe(200)
      expect(r.body.login).toBe(nouveau)
      expect(await loginDe(idA)).toBe(nouveau)
      expect((await base().raw.utilisateur.findUniqueOrThrow({ where: { id: idA } })).updatedBy).toBe(idA)
      loginA = nouveau
      loginsVus.add(ancien)
      loginsVus.add(nouveau)
      // la session en cours continue : le compte est le même (son id ne change pas)
      const p = await a.get<{ login: string }>('/me/profil')
      expect(p.status).toBe(200)
      expect(p.body.login).toBe(nouveau)
    })

    it('l’ancien identifiant ne marche plus ; le nouveau marche, quelle que soit la casse', async () => {
      const ancien = loginA.slice(0, -3)
      await expect(connecter(app, { login: ancien, motDePasse: MDP })).rejects.toThrow(/401/)
      for (const saisie of [loginA, loginA.toUpperCase(), `  ${loginA}  `]) {
        const c = await connecter(app, { login: saisie, motDePasse: MDP })
        expect(c.user.id).toBe(idA)
        expect(c.user.login).toBe(loginA)
      }
      a = await connecter(app, { login: loginA, motDePasse: MDP })
    })

    it('le changement est tracé « ancien → nouveau » (audit et journal des connexions), la personne est prévenue', async () => {
      const ancien = loginA.slice(0, -3)
      const audit = await base().raw.journalAudit.findMany({
        where: { entiteId: idA, action: 'CHANGE_LOGIN' },
      })
      expect(audit).toHaveLength(1)
      expect(audit[0]!.utilisateurId).toBe(idA)
      expect(audit[0]!.avantJson).toEqual({ login: ancien, loginMin: ancien })
      expect(audit[0]!.apresJson).toEqual({ login: loginA, parAdmin: false })
      expect(
        await base().raw.journalAuthentification.count({
          where: { utilisateurId: idA, resultat: 'SUCCES_CHANGEMENT_IDENTIFIANT', login: loginA },
        }),
      ).toBe(1)
      const n = await base().raw.notification.findMany({
        where: { destinataireId: idA, type: 'IDENTIFIANT_CHANGE' },
      })
      expect(n).toHaveLength(1)
      expect(n[0]!.message).toContain(loginA)
      expect(n[0]!.message).toContain(ancien)
      expect(n[0]!.message).toMatch(/Si ce n’est pas vous/)
    })

    it('l’ancien identifiant est mis de côté 90 jours : un autre compte ne le prend pas, son ancien titulaire si', async () => {
      const ancien = loginA.slice(0, -3)
      const r = await changer(b, ancien)
      expect(r.status).toBe(409)
      expect(r.body.code).toBe('IDENTIFIANT_RESERVE')
      expect(r.body.message).toMatch(/mis de côté jusqu’au \d{1,2} \p{L}+ \d{4}/u)
      expect(await loginDe(idB)).toBe(loginB)
      // l'ancien titulaire peut le reprendre
      const retour = await changer(a, ancien)
      expect(retour.status).toBe(200)
      expect(await loginDe(idA)).toBe(ancien)
      loginA = ancien
      a = await connecter(app, { login: loginA, motDePasse: MDP })
    })

    it('la réservation s’éteint après 90 jours', async () => {
      // l'identifiant libéré en dernier (« …v2 ») : on vieillit la ligne d'audit de 91 jours
      const libere = `${loginA}.v2`
      expect((await changer(b, libere)).status).toBe(409)
      await base().raw.journalAudit.updateMany({
        where: { action: 'CHANGE_LOGIN', entiteId: idA, avantJson: { path: ['loginMin'], equals: libere } },
        data: { createdAt: new Date(Date.now() - 91 * 86_400_000) },
      })
      const r = await changer(b, libere)
      expect(r.status).toBe(200)
      expect(await loginDe(idB)).toBe(libere)
    })
  })

  describe('Création d’un compte', () => {
    it('un identifiant à majuscules est stocké en minuscules', async () => {
      const r = await creer(`TST.IDE${s}`)
      expect(r.status).toBe(201)
      crees.push(r.body.id)
      expect(r.body.login).toBe(`tst.ide${s}`)
      expect(await loginDe(r.body.id)).toBe(`tst.ide${s}`)
    })

    it('un identifiant qui ne diffère d’un autre que par la casse est refusé (409)', async () => {
      const r = await creer(`Tst.IdE${s}`)
      expect(r.status).toBe(409)
      const r2 = await creer(loginA.toUpperCase())
      expect(r2.status).toBe(409)
    })

    it('un identifiant libéré depuis moins de 90 jours est refusé (409), le temps de la réservation', async () => {
      // « loginB » a été libéré quand B a pris « …v2 » (test d'avant) : il est mis de côté
      const refus = await creer(loginB)
      expect(refus.status).toBe(409)
      expect(refus.body.message).toMatch(/mis de côté/)
    })
  })

  describe('Corrigé par l’administrateur', () => {
    it('réservé au droit de modifier un compte : l’infirmier est refusé', async () => {
      const r = await corriger(infirmier, idA, `${loginA}.adm`)
      expect(r.status).toBe(403)
      expect(await loginDe(idA)).toBe(loginA)
    })

    it('l’administrateur corrige l’identifiant sans connaître le mot de passe ; la personne est prévenue', async () => {
      const ancien = await loginDe(idA)
      const nouveau = `${ancien}.adm`
      const r = await corriger(admin, idA, nouveau.toUpperCase())
      expect(r.status).toBe(200)
      expect(r.body.login).toBe(nouveau)
      expect(r.body.id).toBe(idA)
      expect(await loginDe(idA)).toBe(nouveau)
      expect((await base().raw.utilisateur.findUniqueOrThrow({ where: { id: idA } })).updatedBy).toBe(admin.user.id)
      loginsVus.add(nouveau)
      // sa session en cours continue (le compte est le même)
      expect((await a.get('/me/profil')).status).toBe(200)
      const audit = await base().raw.journalAudit.findFirstOrThrow({
        where: { entiteId: idA, action: 'CHANGE_LOGIN', apresJson: { path: ['login'], equals: nouveau } },
      })
      expect(audit.utilisateurId).toBe(admin.user.id)
      expect(audit.apresJson).toEqual({ login: nouveau, parAdmin: true })
      const n = await base().raw.notification.findFirstOrThrow({
        where: { destinataireId: idA, type: 'IDENTIFIANT_CHANGE', message: { contains: 'modifié par un administrateur' } },
      })
      expect(n.message).not.toMatch(/Si ce n’est pas vous/)
      loginA = nouveau
    })

    it('mêmes règles que pour la personne : forme, déjà pris, déjà le sien, réservé ; compte inconnu = 404', async () => {
      expect((await corriger(admin, idA, 'ab')).body.code).toBe('IDENTIFIANT_INVALIDE')
      expect((await corriger(admin, idA, loginA)).body.code).toBe('IDENTIFIANT_INCHANGE')
      const pris = await corriger(admin, idA, 'MOUKANDA')
      expect(pris.status).toBe(409)
      expect(pris.body.code).toBe('IDENTIFIANT_PRIS')
      const ancien = loginA.slice(0, -4) // celui d'avant la correction : libéré à l'instant
      const reserve = await corriger(admin, idB, ancien)
      expect(reserve.status).toBe(409)
      expect(reserve.body.code).toBe('IDENTIFIANT_RESERVE')
      expect((await corriger(admin, '00000000-0000-4000-8000-000000000000', 'abcdef')).status).toBe(404)
    })

    it('un champ absent est refusé (400)', async () => {
      expect((await admin.appel('patch', `/admin/utilisateurs/${idA}/identifiant`, {}, {})).status).toBe(400)
    })

    it('le droit exigé est bien celui de MODIFIER un compte (et non de seulement le consulter)', () => {
      const route = UtilisateursController.prototype.changerIdentifiant
      expect(Reflect.getMetadata(REQUIRE_PERMISSIONS_KEY, route)).toEqual({
        permissions: ['utilisateur.update'],
        mode: 'ANY',
      })
    })
  })

  describe('Anciens comptes à identifiant avec majuscules', () => {
    it('passer à la même chose en minuscules est permis : son propre identifiant ne le gêne pas', async () => {
      const e = await compteLibre(`tst.ide2${s}`)
      const ancien = `Casse.Seule${s}`
      loginsVus.add(ancien.toLowerCase())
      await base().raw.utilisateur.update({ where: { id: e.id }, data: { login: ancien } })
      const r = await changer(e.client, ancien.toLowerCase())
      expect(r.status).toBe(200)
      expect(await loginDe(e.id)).toBe(ancien.toLowerCase())
    })

    it('l’ancien identifiant libéré est mis de côté sous sa forme en minuscules, quelle que soit la saisie', async () => {
      const f = await compteLibre(`tst.idf${s}`)
      const autre = await compteLibre(`tst.idg${s}`)
      const ancien = `Reserve.Casse${s}`
      loginsVus.add(ancien.toLowerCase())
      await base().raw.utilisateur.update({ where: { id: f.id }, data: { login: ancien } })
      expect((await changer(f.client, `tst.idf${s}.n`)).status).toBe(200)
      loginsVus.add(`tst.idf${s}.n`)
      for (const saisie of [ancien, ancien.toLowerCase(), ancien.toUpperCase()]) {
        const r = await changer(autre.client, saisie)
        expect({ saisie, status: r.status, code: r.body.code }).toEqual({
          saisie,
          status: 409,
          code: 'IDENTIFIANT_RESERVE',
        })
      }
      expect(await loginDe(autre.id)).toBe(`tst.idg${s}`)
    })
  })

  describe('Plusieurs demandes en même temps pour le même identifiant', () => {
    it('une seule l’obtient ; les autres reçoivent un refus propre (409), jamais une erreur serveur', async () => {
      const visé = `tst.idr${s}`
      loginsVus.add(visé)
      const concurrents = await Promise.all(
        Array.from({ length: 6 }, (_, i) => compteLibre(`tst.idr${i}${s}`)),
      )
      const reponses = await Promise.all(concurrents.map((c) => changer(c.client, visé)))
      const statuts = reponses.map((r) => r.status).sort()
      expect(statuts).toEqual([200, 409, 409, 409, 409, 409])
      for (const r of reponses.filter((x) => x.status === 409)) expect(r.body.code).toBe('IDENTIFIANT_PRIS')
      const titulaires = await base().raw.utilisateur.count({ where: { login: visé } })
      expect(titulaires).toBe(1)
    })
  })

  describe('Connexion', () => {
    it('un compte ANCIEN dont l’identifiant a des majuscules se connecte avec n’importe quelle casse', async () => {
      const legacy = `Legacy.Mixte${s}`
      await base().raw.utilisateur.update({ where: { id: idB }, data: { login: legacy } })
      loginsVus.add(legacy.toLowerCase())
      for (const saisie of [legacy, legacy.toLowerCase(), legacy.toUpperCase()]) {
        const c = await connecter(app, { login: saisie, motDePasse: MDP })
        expect(c.user.id).toBe(idB)
      }
      // et son identifiant occupe bien la place : on ne peut pas créer « le même en minuscules »
      expect((await creer(legacy.toLowerCase())).status).toBe(409)
    })

    it('deux anciens comptes qui ne diffèrent que par la casse : la saisie sans majuscules va au plus ancien', async () => {
      const x = await compteLibre(`tst.idh${s}`)
      const y = await compteLibre(`tst.idi${s}`)
      const nom = `Homonyme${s}`
      loginsVus.add(nom.toLowerCase())
      await base().raw.utilisateur.update({
        where: { id: x.id },
        data: { login: nom, createdAt: new Date(Date.now() - 10 * 86_400_000) },
      })
      await base().raw.utilisateur.update({
        where: { id: y.id },
        data: { login: nom.toUpperCase(), passwordHash: await bcrypt.hash('Autre-Mot-2026!', 4) },
      })
      const c = await connecter(app, { login: nom.toLowerCase(), motDePasse: MDP })
      expect(c.user.id).toBe(x.id)
      // la saisie EXACTE, elle, désigne bien le second
      const c2 = await connecter(app, { login: nom.toUpperCase(), motDePasse: 'Autre-Mot-2026!' })
      expect(c2.user.id).toBe(y.id)
    })

    it('un identifiant inconnu reste une erreur générique (401), jamais une indication', async () => {
      await expect(connecter(app, { login: `inconnu${s}`, motDePasse: MDP })).rejects.toThrow(/401/)
      await expect(connecter(app, { login: loginD.toUpperCase(), motDePasse: 'pas-le-bon' })).rejects.toThrow(/401/)
    })
  })
})
