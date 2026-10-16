/**
 * Rôles et permissions — par les vraies routes et la vraie base de test :
 *  - le catalogue (`/admin/permissions`) = celui du code, sans permission « fantôme » ;
 *  - les trois rôles système ont EXACTEMENT les droits du code, et ne se suppriment pas ;
 *  - un rôle personnalisé se crée / se modifie / se supprime ; « écrire implique consulter » est
 *    appliqué par le SERVEUR (pas seulement par l'écran) ;
 *  - modifier un rôle ou une dérogation prend effet IMMÉDIATEMENT pour la personne, sans reconnexion ;
 *  - les garde-fous : on ne se retire pas à soi-même un droit vital de gouvernance ;
 *  - les dérogations individuelles (accorder / retirer, une seule personne ou plusieurs) ;
 *  - la synchronisation lancée à chaque déploiement (`db:sync-permissions`) : retire les permissions
 *    disparues du code et rétablit les droits des rôles système.
 */
import * as bcrypt from 'bcrypt'
import { exec } from 'node:child_process'
import * as path from 'node:path'
import { promisify } from 'node:util'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from '../../../packages/types/src/permissions'
import { baseDe, demarrerApp } from './support/app-test'
import { COMPTES, connecter, type Client } from './support/client'

const execAsync = promisify(exec)

interface Role {
  id: string
  code: string
  libelle: string
  isSystem: boolean
  permissions: string[]
  nbUtilisateurs: number
}
interface Refus {
  statusCode: number
  message: string
}
interface Derogations {
  fromRoles: string[]
  grants: { code: string; motif: string | null }[]
  revokes: { code: string; motif: string | null }[]
  effective: string[]
}

const MDP = 'Test-Roles-2026!'

describe('Rôles et permissions', () => {
  let app: NestExpressApplication
  let admin: Client
  let infirmier: Client
  const s = `${Date.now() % 100_000}`
  const base = () => baseDe(app)

  const rolesCrees: string[] = []
  const comptesCrees: string[] = []
  const loginsVus = new Set<string>()
  const matricules: string[] = []
  let idRoleInfirmier: string
  let idRoleAdmin: string

  const roles = () => admin.get<Role[]>('/admin/roles')
  const creerRole = async (code: string, permissions: string[], libelle = 'Rôle d’essai') => {
    const r = await admin.post<Role & Refus>('/admin/roles', { code, libelle, permissions })
    if (r.status === 201) rolesCrees.push(r.body.id)
    return r
  }
  /** Un compte jeune, mot de passe connu, connecté. */
  const creerCompte = async (login: string, roleIds: string[]) => {
    loginsVus.add(login)
    const matricule = `RP-${login.slice(-9).toUpperCase()}`
    matricules.push(matricule)
    const r = await admin.post<{ id: string } & Refus>('/admin/utilisateurs', {
      login,
      email: `${login}@test.local`,
      roleIds,
      nom: 'Essai',
      prenom: 'Droits',
      matricule,
    })
    expect(r.status).toBe(201)
    comptesCrees.push(r.body.id)
    await base().raw.utilisateur.update({
      where: { id: r.body.id },
      data: { passwordHash: await bcrypt.hash(MDP, 4), motDePasseTemp: false },
    })
    return { id: r.body.id, client: await connecter(app, { login, motDePasse: MDP }) }
  }
  const lecturePatients = (c: Client) => c.get('/patients/liste?limite=1')
  const lectureConsultations = (c: Client) => c.get('/consultations/historique?statut=CLOTUREE&limite=1')

  beforeAll(async () => {
    app = await demarrerApp()
    admin = await connecter(app, COMPTES.admin)
    infirmier = await connecter(app, COMPTES.infirmier)
    const liste = await roles()
    idRoleInfirmier = liste.body.find((r) => r.code === 'INFIRMIER')!.id
    idRoleAdmin = liste.body.find((r) => r.code === 'ADMIN_SYSTEME')!.id
  })

  afterAll(async () => {
    const raw = base().raw
    const ids = [...comptesCrees]
    const lignes = await raw.utilisateur.findMany({
      where: { id: { in: ids } },
      select: { personnelMedicalId: true },
    })
    await raw.utilisateurPermission.deleteMany({ where: { utilisateurId: { in: ids } } })
    await raw.sessionUtilisateur.deleteMany({ where: { utilisateurId: { in: ids } } })
    await raw.utilisateurRole.deleteMany({ where: { utilisateurId: { in: ids } } })
    await raw.notification.deleteMany({
      where: { OR: [{ destinataireId: { in: ids } }, { entiteId: { in: [...ids, ...rolesCrees] } }] },
    })
    await raw.journalAuthentification.deleteMany({
      where: { OR: [{ utilisateurId: { in: ids } }, { login: { in: [...loginsVus] } }] },
    })
    await raw.journalAudit.deleteMany({
      where: { OR: [{ entiteId: { in: [...ids, ...rolesCrees] } }, { utilisateurId: { in: ids } }] },
    })
    await raw.utilisateur.deleteMany({ where: { id: { in: ids } } })
    await raw.personnelMedical.deleteMany({
      where: {
        OR: [
          { id: { in: lignes.map((l) => l.personnelMedicalId).filter((x): x is string => !!x) } },
          { matricule: { in: matricules } },
        ],
      },
    })
    await raw.rolePermission.deleteMany({ where: { roleId: { in: rolesCrees } } })
    await raw.utilisateurRole.deleteMany({ where: { roleId: { in: rolesCrees } } })
    await raw.role.deleteMany({ where: { id: { in: rolesCrees } } })
    await app.close()
  })

  describe('Le catalogue', () => {
    it('liste toutes les permissions du code, chacune dans le module de son préfixe, sans permission fantôme', async () => {
      const r = await admin.get<{ code: string; module: string }[]>('/admin/permissions')
      expect(r.status).toBe(200)
      const codes = r.body.map((p) => p.code)
      expect(codes).toEqual(expect.arrayContaining([...ALL_PERMISSIONS]))
      expect(codes.filter((c) => !ALL_PERMISSIONS.includes(c as never))).toEqual([])
      for (const p of r.body) expect({ code: p.code, module: p.module }).toEqual({ code: p.code, module: p.code.split('.')[0] })
    })

    it('refusé à qui n’a pas le droit de gérer les rôles (403)', async () => {
      expect((await infirmier.get('/admin/permissions')).status).toBe(403)
      expect((await infirmier.get('/admin/roles')).status).toBe(403)
      expect((await infirmier.post('/admin/roles', { code: `NOPE${s}`, libelle: 'Non', permissions: [] })).status).toBe(403)
      expect((await infirmier.patch(`/admin/roles/${idRoleInfirmier}`, { libelle: 'Non', permissions: [] })).status).toBe(403)
      expect((await infirmier.delete(`/admin/roles/${idRoleInfirmier}`)).status).toBe(403)
    })
  })

  describe('Les trois rôles système', () => {
    it('existent, sont protégés, et ont EXACTEMENT les droits du code', async () => {
      const r = await roles()
      expect(r.status).toBe(200)
      for (const code of ['ADMIN_SYSTEME', 'MEDECIN_CHEF', 'INFIRMIER']) {
        const role = r.body.find((x) => x.code === code)!
        expect({ code, isSystem: role.isSystem }).toEqual({ code, isSystem: true })
        expect([...role.permissions].sort()).toEqual([...DEFAULT_ROLE_PERMISSIONS[code]!].sort())
      }
    })

    it('ne se suppriment pas (409), même avec le droit de supprimer des rôles', async () => {
      const r = await admin.delete<Refus>(`/admin/roles/${idRoleInfirmier}`)
      expect(r.status).toBe(409)
      // le refus vient de la PROTECTION du rôle (et non de ses titulaires, qui lui en donneraient un autre)
      expect(r.body.message).toMatch(/protégé/)
      expect((await roles()).body.some((x) => x.code === 'INFIRMIER')).toBe(true)
    })

    it('garde-fou : l’administrateur ne peut pas se retirer à lui-même un droit vital via son rôle (409), le rôle reste intact', async () => {
      const avant = (await admin.get<Role>(`/admin/roles/${idRoleAdmin}`)).body
      const r = await admin.patch<Refus>(`/admin/roles/${idRoleAdmin}`, {
        libelle: avant.libelle,
        permissions: avant.permissions.filter((c) => c !== 'role.update'),
      })
      expect(r.status).toBe(409)
      expect(r.body.message).toMatch(/vitales/)
      const apres = (await admin.get<Role>(`/admin/roles/${idRoleAdmin}`)).body
      expect([...apres.permissions].sort()).toEqual([...avant.permissions].sort())
    })
  })

  describe('Un rôle personnalisé', () => {
    const code = `TSTROLE${s}`
    let id: string
    let titulaire: { id: string; client: Client }

    it('se crée ; « écrire implique consulter » complète la sélection côté SERVEUR', async () => {
      const r = await creerRole(code, ['patient.create'])
      expect(r.status).toBe(201)
      id = r.body.id
      expect(r.body.isSystem).toBe(false)
      expect(r.body.nbUtilisateurs).toBe(0)
      expect([...r.body.permissions].sort()).toEqual(['patient.create', 'patient.read'])
    })

    it('refuse : code déjà pris (409), code mal formé (400), permission inconnue (400), libellé trop court (400)', async () => {
      const doublon = await creerRole(code, [])
      expect(doublon.status).toBe(409)
      expect(doublon.body.message).toMatch(/code de rôle est déjà utilisé/)
      expect((await creerRole(`minuscules${s}`, [])).status).toBe(400)
      expect((await creerRole(`TSTBAD${s}`, ['patient.inexistante'])).status).toBe(400)
      expect((await creerRole(`TSTCOURT${s}`, [], 'X')).status).toBe(400)
      expect((await roles()).body.some((r) => r.code === `TSTBAD${s}` || r.code === `TSTCOURT${s}`)).toBe(false)
    })

    it('son titulaire a les droits du rôle, et SEULEMENT eux', async () => {
      titulaire = await creerCompte(`tst.rol${s}`, [id])
      expect(titulaire.client.user.permissions).toEqual(expect.arrayContaining(['patient.create', 'patient.read']))
      expect(titulaire.client.user.permissions).not.toContain('consultation.read')
      expect((await lecturePatients(titulaire.client)).status).toBe(200)
      expect((await lectureConsultations(titulaire.client)).status).toBe(403)
      expect((await titulaire.client.get('/admin/roles')).status).toBe(403)
    })

    it('modifier le rôle prend effet IMMÉDIATEMENT pour son titulaire, sans reconnexion', async () => {
      const ajout = await admin.patch<Role>(`/admin/roles/${id}`, {
        libelle: 'Rôle d’essai',
        permissions: ['patient.read', 'consultation.read'],
      })
      expect(ajout.status).toBe(200)
      expect((await lectureConsultations(titulaire.client)).status).toBe(200)

      const retrait = await admin.patch<Role>(`/admin/roles/${id}`, {
        libelle: 'Rôle d’essai',
        permissions: ['consultation.read'],
      })
      expect(retrait.status).toBe(200)
      expect((await lecturePatients(titulaire.client)).status).toBe(403)
      expect((await lectureConsultations(titulaire.client)).status).toBe(200)
    })

    it('la modification complète aussi les lectures (une écriture seule reçoit sa lecture) et le libellé change', async () => {
      const r = await admin.patch<Role>(`/admin/roles/${id}`, { libelle: 'Nouveau libellé', permissions: ['ordonnance.create'] })
      expect(r.status).toBe(200)
      expect(r.body.libelle).toBe('Nouveau libellé')
      expect(r.body.permissions).toEqual(expect.arrayContaining(['ordonnance.create', 'ordonnance.read']))
      expect(r.body.permissions).not.toContain('consultation.read')
    })

    it('refuse : permission inconnue (400), libellé trop court (400), rôle inexistant (404)', async () => {
      expect((await admin.patch(`/admin/roles/${id}`, { libelle: 'Bon', permissions: ['x.y'] })).status).toBe(400)
      expect((await admin.patch(`/admin/roles/${id}`, { libelle: 'X', permissions: [] })).status).toBe(400)
      expect((await admin.patch('/admin/roles/00000000-0000-4000-8000-000000000000', { libelle: 'Bon', permissions: [] })).status).toBe(404)
    })

    it('le détail et la liste des titulaires', async () => {
      const d = await admin.get<Role>(`/admin/roles/${id}`)
      expect(d.status).toBe(200)
      expect(d.body.nbUtilisateurs).toBe(1)
      const u = await admin.get<{ id: string }[]>(`/admin/roles/${id}/utilisateurs`)
      expect(u.status).toBe(200)
      expect(u.body.map((x) => x.id)).toEqual([titulaire.id])
    })

    it('un rôle attribué ne se supprime pas (409) ; libéré, il se supprime (200) et disparaît', async () => {
      const refus = await admin.delete<Refus>(`/admin/roles/${id}`)
      expect(refus.status).toBe(409)
      expect(refus.body.message).toMatch(/attribué/)
      expect((await admin.patch(`/admin/utilisateurs/${titulaire.id}/roles`, { roleIds: [idRoleInfirmier] })).status).toBe(200)
      expect((await admin.delete(`/admin/roles/${id}`)).status).toBe(200)
      expect((await admin.get(`/admin/roles/${id}`)).status).toBe(404)
    })
  })

  describe('Les dérogations individuelles', () => {
    let roleId: string
    let b: { id: string; client: Client }
    let c: { id: string; client: Client }
    const deroger = (userId: string, corps: object) => admin.appel('put', `/admin/utilisateurs/${userId}/permissions`, {}, corps)

    beforeAll(async () => {
      const r = await creerRole(`TSTDERO${s}`, ['patient.read'])
      roleId = r.body.id
      b = await creerCompte(`tst.dab${s}`, [roleId])
      c = await creerCompte(`tst.dac${s}`, [roleId])
    })

    it('accorder une permission EN PLUS du rôle prend effet immédiatement', async () => {
      expect((await lectureConsultations(b.client)).status).toBe(403)
      const r = await deroger(b.id, { grants: ['consultation.read'], motif: 'Essai' })
      expect(r.status).toBe(200)
      const corps = r.body as Derogations
      expect(corps.grants.map((g) => g.code)).toContain('consultation.read')
      expect(corps.grants[0]!.motif).toBe('Essai')
      expect(corps.effective).toEqual(expect.arrayContaining(['patient.read', 'consultation.read']))
      expect((await lectureConsultations(b.client)).status).toBe(200)
      // et la voisine, qui a le même rôle, n'a rien gagné
      expect((await lectureConsultations(c.client)).status).toBe(403)
    })

    it('retirer une permission du rôle prend effet immédiatement, pour cette personne seulement', async () => {
      const r = await deroger(b.id, { revokes: ['patient.read'] })
      expect(r.status).toBe(200)
      expect((r.body as Derogations).effective).not.toContain('patient.read')
      expect((await lecturePatients(b.client)).status).toBe(403)
      expect((await lecturePatients(c.client)).status).toBe(200)
    })

    it('la ventilation d’une personne : ce qui vient du rôle, ce qui est accordé, ce qui est retiré', async () => {
      const r = await admin.get<Derogations>(`/admin/utilisateurs/${b.id}/permissions`)
      expect(r.status).toBe(200)
      expect(r.body.fromRoles).toContain('patient.read')
      expect(r.body.revokes.map((x) => x.code)).toEqual(['patient.read'])
      expect(r.body.effective).not.toContain('patient.read')
    })

    it('« écrire implique consulter » : accorder une écriture accorde sa lecture', async () => {
      const r = await deroger(c.id, { grants: ['ordonnance.create'] })
      expect(r.status).toBe(200)
      expect((r.body as Derogations).grants.map((g) => g.code).sort()).toEqual(['ordonnance.create', 'ordonnance.read'])
    })

    it('« écrire implique consulter » : retirer une lecture retire les écritures qu’on détient', async () => {
      const r = await deroger(c.id, { revokes: ['ordonnance.read'], grants: ['ordonnance.create'] })
      // accorder l'écriture dont on retire la lecture est incohérent : refusé, et rien n'a changé
      expect(r.status).toBe(400)
      const sans = await deroger(c.id, { grants: ['ordonnance.create'] })
      expect(sans.status).toBe(200)
      const retrait = await deroger(c.id, { grants: [], revokes: ['ordonnance.read'] })
      expect(retrait.status).toBe(200)
      expect((retrait.body as Derogations).effective).not.toContain('ordonnance.create')
    })

    it('« écrire implique consulter » : retirer la lecture retire aussi les écritures DU RÔLE (elles seraient mortes)', async () => {
      const r = await creerRole(`TSTDEROW${s}`, ['patient.create'])
      const d = await creerCompte(`tst.dad${s}`, [r.body.id])
      expect((await lecturePatients(d.client)).status).toBe(200)
      const res = await deroger(d.id, { revokes: ['patient.read'] })
      expect(res.status).toBe(200)
      const corps = res.body as Derogations
      expect(corps.revokes.map((x) => x.code).sort()).toEqual(['patient.create', 'patient.read'])
      expect(corps.effective).not.toContain('patient.create')
      expect((await lecturePatients(d.client)).status).toBe(403)
    })

    it('refuse : accordée ET retirée (400), permission inconnue (400), personne inexistante (404)', async () => {
      expect((await deroger(c.id, { grants: ['patient.read'], revokes: ['patient.read'] })).status).toBe(400)
      expect((await deroger(c.id, { grants: ['patient.inexistante'] })).status).toBe(400)
      expect((await deroger('00000000-0000-4000-8000-000000000000', { grants: ['patient.read'] })).status).toBe(404)
    })

    it('un état vide remet la personne au comportement de son rôle', async () => {
      expect((await deroger(b.id, {})).status).toBe(200)
      const r = await admin.get<Derogations>(`/admin/utilisateurs/${b.id}/permissions`)
      expect(r.body.grants).toEqual([])
      expect(r.body.revokes).toEqual([])
      expect((await lecturePatients(b.client)).status).toBe(200)
      expect((await lectureConsultations(b.client)).status).toBe(403)
    })

    it('groupé : accorder à plusieurs personnes, puis tout remettre', async () => {
      const g = await admin.post('/admin/utilisateurs/permissions/bulk', {
        utilisateurIds: [b.id, c.id],
        code: 'consultation.read',
        mode: 'GRANT',
      })
      expect(g.status).toBe(200)
      expect((await lectureConsultations(b.client)).status).toBe(200)
      expect((await lectureConsultations(c.client)).status).toBe(200)
      const r = await admin.post('/admin/utilisateurs/permissions/bulk', {
        utilisateurIds: [b.id, c.id],
        code: 'consultation.read',
        mode: 'RESET',
      })
      expect(r.status).toBe(200)
      expect((await lectureConsultations(b.client)).status).toBe(403)
      expect((await lectureConsultations(c.client)).status).toBe(403)
      expect((await admin.post('/admin/utilisateurs/permissions/bulk', { utilisateurIds: [b.id], code: 'x.y', mode: 'GRANT' })).status).toBe(400)
    })

    it('garde-fou : on ne se retire pas à soi-même un droit vital (409), et rien ne change', async () => {
      const r = await deroger(admin.user.id, { revokes: ['role.update'] })
      expect(r.status).toBe(409)
      expect((await admin.get('/admin/roles')).status).toBe(200)
      expect((await admin.get<Derogations>(`/admin/utilisateurs/${admin.user.id}/permissions`)).body.revokes).toEqual([])
    })

    it('réservé au droit de gérer les dérogations (403 pour l’infirmier)', async () => {
      expect((await infirmier.appel('put', `/admin/utilisateurs/${b.id}/permissions`, {}, { grants: ['patient.read'] })).status).toBe(403)
      expect((await infirmier.get(`/admin/utilisateurs/${b.id}/permissions`)).status).toBe(403)
    })
  })

  describe('La synchronisation lancée à chaque déploiement', () => {
    const racine = path.resolve(__dirname, '../../..')
    const lancer = async () => {
      const { stdout } = await execAsync('pnpm --filter @cms-saris/db exec tsx prisma/sync-permissions.ts', {
        cwd: racine,
        env: process.env,
        timeout: 170_000,
        maxBuffer: 10 * 1024 * 1024,
      })
      return stdout
    }

    it('retire les permissions disparues du code et rétablit les droits des rôles système — puis ne change plus rien', async () => {
      const raw = base().raw
      const medecin = await raw.role.findUniqueOrThrow({ where: { code: 'MEDECIN_CHEF' } })
      const inf = await raw.role.findUniqueOrThrow({ where: { code: 'INFIRMIER' } })
      const perm = (code: string) => raw.permission.findUniqueOrThrow({ where: { code } })

      // Une permission « fantôme » (ex. l'ancien registre des employés), portée par un rôle perso et une dérogation.
      const fantome = await raw.permission.create({ data: { code: 'employe.read', module: 'employe' } })
      const perso = await creerRole(`TSTSYNC${s}`, ['patient.read'])
      await raw.rolePermission.create({ data: { roleId: perso.body.id, permissionId: fantome.id } })
      const porteur = await creerCompte(`tst.syn${s}`, [perso.body.id])
      await raw.utilisateurPermission.create({
        data: { utilisateurId: porteur.id, permissionId: fantome.id, mode: 'GRANT', motif: 'Essai' },
      })
      // Deux dérives des rôles système : un droit retiré au médecin chef, un droit en trop à l'infirmier.
      const audit = await perm('audit.read')
      const vidage = await perm('systeme.vidage')
      await raw.rolePermission.deleteMany({ where: { roleId: medecin.id, permissionId: audit.id } })
      await raw.rolePermission.create({ data: { roleId: inf.id, permissionId: vidage.id } })

      try {
        const sortie = await lancer()
        expect(sortie).toMatch(/employe\.read retirée/)
        expect(sortie).toMatch(/1 permission\(s\) obsolète\(s\) retirée\(s\)/)
        expect(sortie).toMatch(/MEDECIN_CHEF ← audit\.read/)
        expect(sortie).toMatch(/INFIRMIER ⊘ systeme\.vidage/)

        expect(await raw.permission.findUnique({ where: { code: 'employe.read' } })).toBeNull()
        expect(await raw.utilisateurPermission.count({ where: { utilisateurId: porteur.id } })).toBe(0)
        const apres = await roles()
        const code = (c: string) => apres.body.find((r) => r.code === c)!
        expect([...code('MEDECIN_CHEF').permissions].sort()).toEqual([...DEFAULT_ROLE_PERMISSIONS['MEDECIN_CHEF']!].sort())
        expect([...code('INFIRMIER').permissions].sort()).toEqual([...DEFAULT_ROLE_PERMISSIONS['INFIRMIER']!].sort())
        // le rôle perso garde ses vrais droits
        expect(code(`TSTSYNC${s}`).permissions).toEqual(['patient.read'])

        // idempotente : un second passage ne trouve plus rien à faire
        const encore = await lancer()
        expect(encore).toMatch(/0 permission\(s\) obsolète\(s\) retirée\(s\)/)
        expect(encore).toMatch(/0 ajout\(s\), 0 retrait\(s\)/)
      } finally {
        // Quoi qu'il arrive, on laisse les rôles système tels que le code les définit.
        await raw.rolePermission.deleteMany({ where: { roleId: inf.id, permissionId: vidage.id } })
        const present = await raw.rolePermission.findFirst({ where: { roleId: medecin.id, permissionId: audit.id } })
        if (!present) await raw.rolePermission.create({ data: { roleId: medecin.id, permissionId: audit.id } })
        await raw.rolePermission.deleteMany({ where: { permissionId: fantome.id } })
        await raw.utilisateurPermission.deleteMany({ where: { permissionId: fantome.id } })
        await raw.permission.deleteMany({ where: { code: 'employe.read' } })
      }
    }, 400_000)
  })
})
