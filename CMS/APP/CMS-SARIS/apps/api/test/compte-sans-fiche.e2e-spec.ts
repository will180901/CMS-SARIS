/**
 * Un compte sans fiche du personnel (l'administrateur créé à l'installation) est
 * introuvable à l'accueil : la recherche lit les FICHES, et lui n'en a pas.
 *
 * Le bouton « Créer sa fiche du personnel » de l'écran des comptes fait exactement ceci :
 * créer la fiche (fonction Administrateur Système), puis la relier au compte. Une fois
 * reliée, la personne se retrouve à l'accueil comme n'importe quel employé — sans pour
 * autant devenir un soignant que l'on pourrait choisir pour une visite.
 */
import type { NestExpressApplication } from '@nestjs/platform-express'
import { baseDe, demarrerApp } from './support/app-test'
import { COMPTES, connecter, type Client } from './support/client'

interface SansDossier {
  id: string
  nom: string
  fonction: string
  manquants: string[]
}

describe('Compte sans fiche du personnel : sa fiche le rend trouvable à l’accueil', () => {
  let app: NestExpressApplication
  let admin: Client
  let inf: Client
  const s = `${Date.now() % 100_000}`
  const login = `tst.adm${s}`
  const matricule = `AD-${s}`
  const nom = `SYSADMIN${s}`
  let compteId = ''
  let ficheId = ''
  const base = () => baseDe(app)

  const chercher = async (q: string) => {
    const r = await inf.get<SansDossier[]>(
      `/patients/personnel-sans-dossier?search=${encodeURIComponent(q)}`,
    )
    expect(r.status).toBe(200)
    return r.body
  }

  beforeAll(async () => {
    app = await demarrerApp()
    admin = await connecter(app, COMPTES.admin)
    inf = await connecter(app, COMPTES.infirmier)
  })

  afterAll(async () => {
    const ids = [compteId].filter(Boolean)
    await base().raw.notification.deleteMany({
      where: { OR: [{ destinataireId: { in: ids } }, { entiteId: { in: ids } }] },
    })
    await base().raw.sessionUtilisateur.deleteMany({ where: { utilisateurId: { in: ids } } })
    await base().raw.journalAudit.deleteMany({
      where: { OR: [{ entiteId: { in: [...ids, ficheId].filter(Boolean) } }, { utilisateurId: { in: ids } }] },
    })
    await base().raw.utilisateurRole.deleteMany({ where: { utilisateurId: { in: ids } } })
    await base().raw.utilisateur.deleteMany({ where: { id: { in: ids } } })
    await base().raw.personnelMedical.deleteMany({ where: { matricule } })
    await app.close()
  })

  it('un compte administrateur créé sans fiche reste introuvable, même sous son identifiant', async () => {
    const roles = await admin.get<{ id: string; code: string }[]>('/admin/roles')
    const role = roles.body.find((r) => r.code === 'ADMIN_SYSTEME')!
    const c = await admin.post<{ id: string; personnelMedicalId: string | null }>('/admin/utilisateurs', {
      login,
      email: `${login}@test.local`,
      roleIds: [role.id],
    })
    expect(c.status).toBe(201)
    compteId = c.body.id
    expect(c.body.personnelMedicalId ?? null).toBeNull()
    expect(await chercher(login)).toEqual([])
    expect(await chercher(nom)).toEqual([])
  })

  it('créer sa fiche puis la relier au compte le rend trouvable, avec sa fonction', async () => {
    const f = await admin.post<{ id: string }>('/personnel', {
      matricule,
      nom,
      prenom: 'Systeme',
      role: 'ADMINISTRATIF',
    })
    expect(f.status).toBe(201)
    ficheId = f.body.id
    const lien = await admin.patch(`/admin/utilisateurs/${compteId}`, { personnelMedicalId: ficheId })
    expect(lien.status).toBe(200)

    const trouves = await chercher(nom.toLowerCase())
    expect(trouves).toEqual([
      expect.objectContaining({ id: ficheId, fonction: 'Administrateur Système' }),
    ])
    // ce qui manque (naissance, sexe, section de paie, département) est demandé à l'accueil
    expect(trouves[0]!.manquants.length).toBeGreaterThan(0)
  })

  it('il n’est pas pour autant proposé comme soignant pour une visite', async () => {
    const r = await inf.get<{ id: string }[]>('/personnel/soignants')
    expect(r.status).toBe(200)
    expect(r.body.map((p) => p.id)).not.toContain(ficheId)
  })

  it('une fiche ne se relie qu’à un seul compte', async () => {
    const roles = await admin.get<{ id: string; code: string }[]>('/admin/roles')
    const role = roles.body.find((r) => r.code === 'ADMIN_SYSTEME')!
    const autre = `${login}b`
    const c = await admin.post<{ id: string }>('/admin/utilisateurs', {
      login: autre,
      email: `${autre}@test.local`,
      roleIds: [role.id],
    })
    expect(c.status).toBe(201)
    try {
      const lien = await admin.patch(`/admin/utilisateurs/${c.body.id}`, { personnelMedicalId: ficheId })
      expect(lien.status).toBe(409)
    } finally {
      await base().raw.journalAudit.deleteMany({
        where: { OR: [{ entiteId: c.body.id }, { utilisateurId: c.body.id }] },
      })
      await base().raw.utilisateurRole.deleteMany({ where: { utilisateurId: c.body.id } })
      await base().raw.utilisateur.deleteMany({ where: { id: c.body.id } })
    }
  })
})
