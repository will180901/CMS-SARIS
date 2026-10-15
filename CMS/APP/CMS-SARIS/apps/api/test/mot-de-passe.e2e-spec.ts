/**
 * Mot de passe d'un compte — par les vraies routes et la vraie base de test :
 *  - l'administrateur ne CHOISIT jamais le mot de passe de quelqu'un : à la création comme à la
 *    réinitialisation, le serveur en fabrique un temporaire, rendu UNE seule fois, jamais écrit dans
 *    le journal d'audit ;
 *  - tant que ce mot de passe temporaire n'est pas remplacé, le compte ne peut RIEN faire d'autre que
 *    le remplacer, lire sa session ou se déconnecter (le serveur refuse tout le reste : 403
 *    `MOT_DE_PASSE_TEMPORAIRE`) — sauf la session de synchronisation d'un poste de bureau ;
 *  - changer son mot de passe : l'actuel est exigé (403 et non 401 s'il est faux), le même est refusé,
 *    la politique s'applique ; une fois changé, le compte est libre, TOUTES SES AUTRES connexions sont
 *    fermées (jamais la courante, jamais celle d'un poste), et la personne est prévenue ;
 *  - une réinitialisation ferme toutes les connexions et remet le compte sous contrainte.
 */
import type { NestExpressApplication } from '@nestjs/platform-express'
import { SecurityController } from '../src/modules/security/security.controller'
import { baseDe, demarrerApp } from './support/app-test'
import { COMPTES, connecter, type Client } from './support/client'

interface Cree {
  id: string
  login: string
  motDePasseTemp: boolean
  motDePasseTemporaire: string
  passwordHash?: string
}
interface Refus {
  statusCode: number
  code?: string
  message: string
}

/** Le `sid` (session) porté par un jeton d'accès. */
function sidDe(jeton: string): string {
  const charge = JSON.parse(
    Buffer.from(jeton.split('.')[1], 'base64url').toString('utf8'),
  ) as { sid: string }
  return charge.sid
}

describe('Mot de passe : temporaire, remplacement, réinitialisation', () => {
  let app: NestExpressApplication
  let admin: Client
  let infirmier: Client
  const s = `${Date.now() % 100_000}`
  const LOGIN = `tst.mdp${s}`
  const base = () => baseDe(app)
  let compte: Cree
  let temporaire: string
  let eleve: Client
  const NOUVEAU = 'Nouveau-Mdp-2026!'
  const encore = 'Autre-Mdp-2026!x'

  const creer = (extra: object = {}) =>
    admin.post<Cree & Refus>('/admin/utilisateurs', {
      login: LOGIN,
      email: `${LOGIN}@test.local`,
      roleIds: [] as string[],
      nom: 'Essai',
      prenom: 'Mdp',
      matricule: `MDP-${s}`,
      ...extra,
    })
  const seConnecter = (motDePasse: string) =>
    connecter(app, { login: LOGIN, motDePasse })
  const profil = (c: Client) => c.get<Refus>('/me/profil')
  const changer = (c: Client, actuel: string, nouveau: string) =>
    c.post<Refus>('/auth/change-password', {
      motDePasseActuel: actuel,
      nouveauMotDePasse: nouveau,
    })

  beforeAll(async () => {
    app = await demarrerApp()
    admin = await connecter(app, COMPTES.admin)
    infirmier = await connecter(app, COMPTES.infirmier)
  })

  afterAll(async () => {
    const u = await base().raw.utilisateur.findUnique({
      where: { login: LOGIN },
      select: { id: true, personnelMedicalId: true },
    })
    if (u) {
      await base().raw.notification.deleteMany({
        where: { OR: [{ destinataireId: u.id }, { entiteId: u.id }] },
      })
      await base().raw.sessionUtilisateur.deleteMany({
        where: { utilisateurId: u.id },
      })
      await base().raw.journalAuthentification.deleteMany({
        where: { OR: [{ utilisateurId: u.id }, { login: LOGIN }] },
      })
      await base().raw.journalAudit.deleteMany({
        where: { OR: [{ entiteId: u.id }, { utilisateurId: u.id }] },
      })
      await base().raw.utilisateurRole.deleteMany({
        where: { utilisateurId: u.id },
      })
      await base().raw.utilisateur.delete({ where: { id: u.id } })
      if (u.personnelMedicalId)
        await base().raw.personnelMedical.deleteMany({
          where: { id: u.personnelMedicalId },
        })
    }
    await app.close()
  })

  describe('Création d’un compte', () => {
    it('l’administrateur ne choisit pas le mot de passe : en proposer un est refusé (400)', async () => {
      const role = await base().role.findFirstOrThrow({
        where: { code: 'INFIRMIER' },
      })
      const r = await creer({
        roleIds: [role.id],
        motDePasseInitial: 'Choisi-Par-Admin-1!',
      })
      expect(r.status).toBe(400)
      expect(
        await base().raw.utilisateur.count({ where: { login: LOGIN } }),
      ).toBe(0)
    })

    it('le serveur en fabrique un temporaire, rendu une seule fois, à remplacer', async () => {
      const role = await base().role.findFirstOrThrow({
        where: { code: 'INFIRMIER' },
      })
      const r = await creer({ roleIds: [role.id] })
      expect(r.status).toBe(201)
      compte = r.body
      temporaire = compte.motDePasseTemporaire
      expect(temporaire).toMatch(/^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){2,}$/)
      expect(compte.motDePasseTemp).toBe(true)
      // jamais le hash, jamais relisible ensuite
      expect(compte.passwordHash).toBeUndefined()
      const relu = await admin.get<Record<string, unknown>>(
        `/admin/utilisateurs/${compte.id}`,
      )
      expect(JSON.stringify(relu.body)).not.toContain(temporaire)
      expect(
        (
          await base().raw.utilisateur.findUniqueOrThrow({
            where: { id: compte.id },
          })
        ).motDePasseTemp,
      ).toBe(true)
    })

    it('chaque mot de passe temporaire est différent : création puis deux réinitialisations, trois valeurs', async () => {
      const a = temporaire
      const r1 = await admin.post<{ motDePasseTemporaire: string }>(
        `/admin/utilisateurs/${compte.id}/reset-password`,
      )
      const r2 = await admin.post<{ motDePasseTemporaire: string }>(
        `/admin/utilisateurs/${compte.id}/reset-password`,
      )
      expect(
        new Set([a, r1.body.motDePasseTemporaire, r2.body.motDePasseTemporaire])
          .size,
      ).toBe(3)
      temporaire = r2.body.motDePasseTemporaire
    })

    it('le mot de passe temporaire n’est écrit dans aucune ligne du journal d’audit', async () => {
      const lignes = await base().raw.journalAudit.findMany({
        where: { OR: [{ entiteId: compte.id }] },
      })
      expect(lignes.length).toBeGreaterThanOrEqual(2)
      expect(JSON.stringify(lignes)).not.toContain(temporaire)
      expect(JSON.stringify(lignes)).not.toContain(compte.motDePasseTemporaire)
    })
  })

  describe('Tant que le mot de passe est temporaire', () => {
    it('la connexion réussit et dit qu’il faut choisir son mot de passe', async () => {
      eleve = await seConnecter(temporaire)
      expect(
        (eleve.user as unknown as { motDePasseTemp?: boolean }).motDePasseTemp,
      ).toBe(true)
      // un compte ordinaire, lui, n'est pas concerné
      expect(
        (infirmier.user as unknown as { motDePasseTemp?: boolean })
          .motDePasseTemp,
      ).toBe(false)
    })

    it('le serveur refuse TOUT le reste (403 MOT_DE_PASSE_TEMPORAIRE), l’interface n’y est pour rien', async () => {
      for (const chemin of [
        '/me/profil',
        '/me/preferences',
        '/patients',
        '/consultations',
        '/notifications',
        '/systeme/mode',
      ]) {
        const r = await eleve.get<Refus>(chemin)
        expect({ chemin, status: r.status, code: r.body.code }).toEqual({
          chemin,
          status: 403,
          code: 'MOT_DE_PASSE_TEMPORAIRE',
        })
      }
      expect(
        (await eleve.patch('/me/profil', { email: 'x@y.zz' })).status,
      ).toBe(403)
      expect((await eleve.post('/me/totp/setup')).status).toBe(403)
    })

    it('lire sa session et se déconnecter restent permis ; renouveler le jeton aussi', async () => {
      const moi = await eleve.get<{ motDePasseTemp?: boolean }>('/auth/me')
      expect(moi.status).toBe(200)
      expect(moi.body.motDePasseTemp).toBe(true)
      const r = await eleve.post<{
        user: { motDePasseTemp?: boolean }
      }>('/auth/refresh', { refreshToken: eleve.refreshToken })
      expect([200, 201]).toContain(r.status)
      expect(r.body.user.motDePasseTemp).toBe(true)
      // le refresh a fait tourner le jeton : on se reconnecte proprement pour la suite
      eleve = await seConnecter(temporaire)
    })

    it('la session de synchronisation d’un poste de bureau n’est pas une personne : elle passe', async () => {
      const sid = sidDe(eleve.jeton)
      await base().raw.sessionUtilisateur.update({
        where: { id: sid },
        data: { posteLocalId: `poste-mdp-${s}` },
      })
      try {
        expect((await eleve.get('/patients')).status).toBe(200)
      } finally {
        await base().raw.sessionUtilisateur.update({
          where: { id: sid },
          data: { posteLocalId: null },
        })
      }
      expect((await eleve.get<Refus>('/patients')).status).toBe(403)
    })

    it('un mauvais mot de passe actuel est refusé en 403 (pas 401), tracé, et ne change rien', async () => {
      const r = await changer(eleve, 'pas-le-bon-1A!', NOUVEAU)
      expect(r.status).toBe(403)
      expect(r.body.code).toBe('MOT_DE_PASSE_INCORRECT')
      expect(
        await base().raw.journalAuthentification.count({
          where: { utilisateurId: compte.id, resultat: 'ECHEC_CHANGEMENT_MDP' },
        }),
      ).toBe(1)
      expect((await profil(eleve)).status).toBe(403) // toujours sous contrainte
    })

    it('remettre le même mot de passe, ou un trop court, est refusé (400)', async () => {
      expect((await changer(eleve, temporaire, temporaire)).status).toBe(400)
      expect((await changer(eleve, temporaire, 'court')).status).toBe(400)
      expect((await changer(eleve, temporaire, '')).status).toBe(400)
    })

    it('un mot de passe qui ne respecte pas la politique en vigueur est refusé (400)', async () => {
      const r = await changer(eleve, temporaire, 'aaaaaaaa')
      expect(r.status).toBe(400)
      expect(r.body.message).toMatch(/doit contenir/)
    })
  })

  describe('Choisir son mot de passe', () => {
    let autreConnexion: string
    let connexionPoste: string
    let sidCourant: string

    beforeAll(async () => {
      sidCourant = sidDe(eleve.jeton)
      // Une AUTRE connexion de la personne (ailleurs), et la session de synchro d'un poste
      const autre = await base().raw.sessionUtilisateur.create({
        data: {
          utilisateurId: compte.id,
          refreshTokenHash: 'x',
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      })
      autreConnexion = autre.id
      const poste = await base().raw.sessionUtilisateur.create({
        data: {
          utilisateurId: compte.id,
          posteLocalId: `poste-mdp-${s}`,
          refreshTokenHash: 'x',
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      })
      connexionPoste = poste.id
    })

    it('le changement réussit (204) : le compte est libre tout de suite, avec le MÊME jeton', async () => {
      const r = await changer(eleve, temporaire, NOUVEAU)
      expect(r.status).toBe(204)
      expect(
        (
          await base().raw.utilisateur.findUniqueOrThrow({
            where: { id: compte.id },
          })
        ).motDePasseTemp,
      ).toBe(false)
      expect((await profil(eleve)).status).toBe(200)
      expect((await eleve.get('/patients')).status).toBe(200)
    })

    it('ses AUTRES connexions sont fermées ; la courante et celle d’un poste de bureau restent', async () => {
      const lire = (id: string) =>
        base().raw.sessionUtilisateur.findUniqueOrThrow({ where: { id } })
      expect((await lire(autreConnexion)).revokedAt).not.toBeNull()
      expect((await lire(connexionPoste)).revokedAt).toBeNull()
      // la session du premier jeton (avant la reconnexion ci-dessus) est la « courante » du changement
      expect((await lire(sidCourant)).revokedAt).toBeNull()
    })

    it('la personne est prévenue, et le changement est tracé', async () => {
      const n = await base().raw.notification.findMany({
        where: { destinataireId: compte.id, type: 'MOT_DE_PASSE_CHANGE' },
      })
      expect(n).toHaveLength(1)
      expect(n[0].message).toMatch(/Si ce n’est pas vous/)
      expect(n[0].message).toMatch(
        /1 autre\(s\) connexion\(s\) ont été fermées/,
      )
      expect(
        await base().raw.journalAuthentification.count({
          where: {
            utilisateurId: compte.id,
            resultat: 'SUCCES_CHANGEMENT_MDP',
          },
        }),
      ).toBe(1)
    })

    it('une fois les contrôles faits : l’ancien mot de passe ne marche plus, le nouveau si, et le compte n’est plus signalé temporaire', async () => {
      await expect(seConnecter(temporaire)).rejects.toThrow(/401/)
      const c = await seConnecter(NOUVEAU)
      expect(
        (c.user as unknown as { motDePasseTemp?: boolean }).motDePasseTemp,
      ).toBe(false)
      eleve = c
    })

    it('un compte libre peut encore changer son mot de passe, et ne ferme alors rien d’autre qu’il n’a', async () => {
      const r = await changer(eleve, NOUVEAU, encore)
      expect(r.status).toBe(204)
      expect((await profil(eleve)).status).toBe(200)
      // pas de « 0 autre(s) connexion(s) » : le message ne parle de fermeture que s'il y en a eu
      const n = await base().raw.notification.findMany({
        where: { destinataireId: compte.id, type: 'MOT_DE_PASSE_CHANGE' },
        orderBy: { createdAt: 'desc' },
      })
      expect(n[0].message).not.toMatch(/connexion\(s\) ont été fermées/)
    })

    it('c’est le mot de passe de la personne CONNECTÉE qui est vérifié, jamais celui d’un autre compte', async () => {
      const r = await infirmier.post<Refus>('/auth/change-password', {
        motDePasseActuel: 'pas-le-mien',
        nouveauMotDePasse: 'Autre-Chose-2026!',
      })
      expect(r.status).toBe(403) // c'est SON mot de passe qu'on vérifie, pas celui de la cible
      await seConnecter(encore)
    })
  })

  describe('Garde-fous de la route', () => {
    it('cinq essais par minute : le mot de passe actuel ne se devine pas à la chaîne', () => {
      // La limite de débit est neutralisée dans les tests (toutes les requêtes viennent de la même
      // adresse) : on vérifie donc qu'elle est bien DÉCLARÉE sur la route.
      const route = SecurityController.prototype.changePassword
      expect(Reflect.getMetadata('THROTTLER:LIMITdefault', route)).toBe(5)
      expect(Reflect.getMetadata('THROTTLER:TTLdefault', route)).toBe(60_000)
    })
  })

  describe('Réinitialisation par l’administrateur', () => {
    let apres: string

    it('réservée au droit de réinitialiser : un infirmier est refusé', async () => {
      expect(
        (
          await infirmier.post(
            `/admin/utilisateurs/${compte.id}/reset-password`,
          )
        ).status,
      ).toBe(403)
    })

    it('le serveur fabrique le mot de passe, même si l’administrateur en propose un', async () => {
      // Une connexion VIVANTE au moment de la réinitialisation (la précédente a été remplacée par
      // les reconnexions du test d'avant) : c'est elle que la réinitialisation doit couper.
      eleve = await seConnecter(encore)
      expect((await eleve.get('/auth/me')).status).toBe(200)
      const r = await admin.post<{
        success: boolean
        motDePasseTemporaire: string
      }>(`/admin/utilisateurs/${compte.id}/reset-password`, {
        nouveauMotDePasse: 'Propose-Par-Admin-1!',
      })
      expect(r.status).toBe(200)
      expect(r.body.success).toBe(true)
      apres = r.body.motDePasseTemporaire
      expect(apres).toMatch(/^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){2,}$/)
      await expect(seConnecter('Propose-Par-Admin-1!')).rejects.toThrow(/401/)
    })

    it('l’ancien mot de passe et les anciennes connexions sont coupés ; le compte est de nouveau sous contrainte', async () => {
      // le jeton d'avant la réinitialisation ne vaut plus rien
      expect((await eleve.get('/auth/me')).status).toBe(401)
      await expect(seConnecter(encore)).rejects.toThrow(/401/)
      const c = await seConnecter(apres)
      expect(
        (c.user as unknown as { motDePasseTemp?: boolean }).motDePasseTemp,
      ).toBe(true)
      const r = await c.get<Refus>('/patients')
      expect(r.status).toBe(403)
      expect(r.body.code).toBe('MOT_DE_PASSE_TEMPORAIRE')
    })

    it('le mot de passe rendu n’est écrit dans aucune ligne du journal d’audit', async () => {
      const lignes = await base().raw.journalAudit.findMany({
        where: { entiteId: compte.id, action: 'RESET_PASSWORD' },
      })
      expect(lignes.length).toBeGreaterThanOrEqual(3)
      expect(JSON.stringify(lignes)).not.toContain(apres)
      for (const l of lignes)
        expect(l.apresJson).toMatchObject({ forcerChangement: true })
    })

    it('réinitialiser un compte inconnu est un 404', async () => {
      expect(
        (
          await admin.post(
            '/admin/utilisateurs/00000000-0000-4000-8000-000000000000/reset-password',
          )
        ).status,
      ).toBe(404)
    })
  })
})
