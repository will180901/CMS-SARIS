/**
 * Droits et sécurité :
 *   1. matrice des droits — CHAQUE route protégée de l'API, lue dans l'application :
 *      refusée sans connexion (401), refusée à tout rôle qui n'a pas la permission (403) ;
 *   2. la charte des 3 rôles sur les droits sensibles ;
 *   3. le site de travail, confirmé une seule fois par session, jamais un site inactif ;
 *   4. sécurité clinique — une allergie supprimée ne compte plus (affichage, prescription) ;
 *   5. confidentialité renforcée — un diagnostic VIH n'apparaît nulle part pour l'infirmier.
 */
import type { NestExpressApplication } from '@nestjs/platform-express'
import { demarrerApp } from './support/app-test'
import { appelAnonyme, COMPTES, connecter, type Client } from './support/client'
import {
  creerPatientCdi,
  referentiels,
  type Referentiels,
} from './support/donnees'
import { autorise, routesProtegees, type RouteProtegee } from './support/routes'

const MDP_DEMO = COMPTES.infirmier.motDePasse

describe('Droits et sécurité', () => {
  let app: NestExpressApplication
  let routes: RouteProtegee[]

  beforeAll(async () => {
    app = await demarrerApp()
    routes = routesProtegees(app)
  })
  afterAll(async () => {
    await app.close()
  })

  describe('Matrice des droits (toutes les routes protégées)', () => {
    const comptes: Record<string, Client> = {}

    beforeAll(async () => {
      for (const nom of [
        'admin',
        'medecinChef',
        'infirmier',
        'infirmierSansDelegation',
      ] as const)
        comptes[nom] = await connecter(app, COMPTES[nom])
    })

    it("inventorie les routes protégées dans l'application elle-même", () => {
      expect(routes.length).toBeGreaterThan(150)
    })

    it('refuse chaque route protégée sans connexion (401)', async () => {
      const fuites: string[] = []
      for (const r of routes) {
        const rep = await appelAnonyme(app, r.methode, r.chemin)
        if (rep.status !== 401)
          fuites.push(`${r.methode.toUpperCase()} ${r.chemin} → ${rep.status}`)
      }
      expect(fuites).toEqual([])
    })

    it.each(['infirmier', 'infirmierSansDelegation', 'medecinChef', 'admin'])(
      "refuse à « %s » chaque route dont il n'a pas la permission (403)",
      async (nom) => {
        const c = comptes[nom]
        const droits = new Set(c.user.permissions)
        const interdites = routes.filter((r) => !autorise(r, droits))
        const fuites: string[] = []
        for (const r of interdites) {
          const rep = await c.appel(r.methode, r.chemin)
          if (rep.status !== 403)
            fuites.push(
              `${r.methode.toUpperCase()} ${r.chemin} (requis : ${r.permissions.join(r.mode === 'ALL' ? ' ET ' : ' OU ')}) → ${rep.status}`,
            )
        }
        expect(fuites).toEqual([])
        // L'administrateur système a tout ; les rôles cliniques, non.
        if (nom === 'admin') expect(interdites).toHaveLength(0)
        else expect(interdites.length).toBeGreaterThan(0)
      },
    )
  })

  describe('Charte des rôles', () => {
    it('infirmier : ni rapports, ni validation des bons, ni dossier confidentiel, ni comptes', async () => {
      for (const compte of [
        COMPTES.infirmier,
        COMPTES.infirmierSansDelegation,
      ]) {
        const { permissions } = (await connecter(app, compte)).user
        for (const p of [
          'rapport.read',
          'bon_examen.validate',
          'patient.confidentiel.read',
        ])
          expect(permissions).not.toContain(p)
        expect(permissions.some((p) => p.startsWith('utilisateur.'))).toBe(
          false,
        )
      }
    })

    it('médecin chef : rapports, validation des bons, dossier confidentiel', async () => {
      const { permissions } = (await connecter(app, COMPTES.medecinChef)).user
      expect(permissions).toEqual(
        expect.arrayContaining([
          'rapport.read',
          'bon_examen.validate',
          'patient.confidentiel.read',
        ]),
      )
    })

    it('administrateur système : toutes les permissions demandées par les routes', async () => {
      const { permissions } = (await connecter(app, COMPTES.admin)).user
      const demandees = new Set(routes.flatMap((r) => r.permissions))
      expect([...demandees].filter((p) => !permissions.includes(p))).toEqual([])
    })
  })

  describe('Site de travail', () => {
    let admin: Client
    let sites: { id: string; statut: string }[]

    beforeAll(async () => {
      admin = await connecter(app, COMPTES.admin)
      const r = await admin.get<{ id: string; statut: string }[]>(
        '/referentiels/sites',
      )
      sites = r.body
    })

    it('se confirme une seule fois par session', async () => {
      const c = await connecter(app, { login: 'ndinga', motDePasse: MDP_DEMO })
      const site = sites.find((s) => s.statut === 'ACTIF')!
      const r1 = await c.post<{
        refreshToken: string
        user: { siteId: string }
      }>('/auth/site/confirmer', {
        refreshToken: c.refreshToken,
        siteId: site.id,
      })
      expect(r1.status).toBe(200)
      expect(r1.body.user.siteId).toBe(site.id)
      const r2 = await c.post<{ code?: string }>('/auth/site/confirmer', {
        refreshToken: r1.body.refreshToken,
        siteId: site.id,
      })
      expect(r2.status).toBe(409)
      expect(r2.body.code).toBe('SITE_DEJA_CONFIRME')
    })

    it('refuse un site inactif (la session reste à confirmer)', async () => {
      const cree = await admin.post<{ id: string }>('/referentiels/sites', {
        code: `E2E${Date.now() % 1_000_000}`,
        libelle: 'Site fermé (test)',
      })
      expect(cree.status).toBe(201)
      const ferme = await admin.patch(
        `/referentiels/sites/${cree.body.id}/statut`,
        {
          statut: 'INACTIF',
        },
      )
      expect(ferme.status).toBe(200)

      const c = await connecter(app, { login: 'loemba', motDePasse: MDP_DEMO })
      const refus = await c.post('/auth/site/confirmer', {
        refreshToken: c.refreshToken,
        siteId: cree.body.id,
      })
      expect(refus.status).toBe(400)
      const actif = sites.find((s) => s.statut === 'ACTIF')!
      const ok = await c.post('/auth/site/confirmer', {
        refreshToken: c.refreshToken,
        siteId: actif.id,
      })
      expect(ok.status).toBe(200)
    })
  })

  describe('Sécurité clinique et confidentialité (consultation réelle)', () => {
    interface Allergie {
      id: string
      substance: string
    }
    interface PatientVu {
      allergies?: Allergie[]
    }
    let inf: Client
    let med: Client
    let ref: Referentiels
    let patientId: string
    let visiteId: string
    let consultationId: string
    let ordonnanceId: string
    let allergieId: string
    const medicament = () => ref.medicaments[0]

    /** Allergies au médicament visibles au triage, en consultation, dans la liste. */
    const allergiesVisibles = async () => {
      const compte = (l?: Allergie[]) =>
        (l ?? []).filter((a) => a.substance === medicament().nomGenerique)
          .length
      const v = await med.get<{ patient: PatientVu }>(
        `/triage/visites/${visiteId}`,
      )
      const c = await med.get<{ visite: { patient: PatientVu } }>(
        `/consultations/${consultationId}`,
      )
      const l = await med.get<
        | (PatientVu & { id: string })[]
        | { data: (PatientVu & { id: string })[] }
      >('/patients?search=Securite')
      const liste = Array.isArray(l.body) ? l.body : l.body.data
      return {
        triage: compte(v.body.patient.allergies),
        consultation: compte(c.body.visite.patient.allergies),
        liste: compte(liste.find((p) => p.id === patientId)?.allergies),
      }
    }
    const prescrire = () =>
      med.post<{ code?: string }>(
        `/consultations/${consultationId}/ordonnances/${ordonnanceId}/lignes`,
        {
          medicamentId: medicament().id,
          posologie: '1 cp',
          duree: '5 jours',
          voieAdmin: 'Orale',
        },
      )

    beforeAll(async () => {
      inf = await connecter(app, COMPTES.infirmier)
      med = await connecter(app, COMPTES.autreMedecin)
      ref = await referentiels(inf)
      patientId = await creerPatientCdi(inf, ref, 'Securite')
      const v = await inf.post<{ id: string }>('/triage/visites', {
        patientId,
        motifPrincipalId: ref.motifId,
      })
      visiteId = v.body.id
      await inf.patch(`/triage/visites/${visiteId}/statut`, {
        statut: 'EN_COURS',
      })
      await inf.patch(`/triage/visites/${visiteId}/soignant`, {
        soignantId: med.user.personnelMedicalId,
      })
      const c = await med.post<{ id: string }>('/consultations', { visiteId })
      consultationId = c.body.id
      const o = await med.post<{ id: string }>(
        `/consultations/${consultationId}/ordonnances`,
        { typeOrdonnance: 'PHARMACEUTIQUE' },
      )
      ordonnanceId = o.body.id
    })

    it("une allergie sévère s'affiche partout et bloque la prescription", async () => {
      const a = await med.post<{ id: string }>(
        `/patients/${patientId}/allergies`,
        {
          substance: medicament().nomGenerique,
          gravite: 'SEVERE',
          confirme: true,
        },
      )
      expect(a.status).toBe(201)
      allergieId = a.body.id
      expect(await allergiesVisibles()).toEqual({
        triage: 1,
        consultation: 1,
        liste: 1,
      })
      const r = await prescrire()
      expect(r.status).toBe(409)
      expect(r.body.code).toBe('CONTRE_INDICATION_BLOCKING')
    })

    it("supprimée, elle ne s'affiche plus et ne bloque plus la prescription", async () => {
      const d = await med.delete(
        `/patients/${patientId}/allergies/${allergieId}`,
      )
      expect(d.status).toBe(200)
      expect(await allergiesVisibles()).toEqual({
        triage: 0,
        consultation: 0,
        liste: 0,
      })
      expect((await prescrire()).status).toBe(201)
    })

    it("un diagnostic à confidentialité renforcée (VIH) n'apparaît nulle part pour l'infirmier", async () => {
      const r = await med.get<
        | { id: string; code: string }[]
        | { data: { id: string; code: string }[] }
      >('/referentiels/pathologies')
      const vih = (Array.isArray(r.body) ? r.body : r.body.data).find(
        (p) => p.code === 'VIH_SIDA',
      )!
      const d = await med.post(`/consultations/${consultationId}/diagnostics`, {
        pathologieId: vih.id,
        type: 'PRINCIPAL',
        certitude: 'CONFIRME',
      })
      expect(d.status).toBe(201)

      // Le médecin le voit…
      const vuMedecin = await med.get(`/consultations/${consultationId}`)
      expect(JSON.stringify(vuMedecin.body)).toContain('VIH')
      // … l'infirmier nulle part : consultation, dossier, alertes calculées, visite.
      const fuites: string[] = []
      for (const chemin of [
        `/consultations/${consultationId}`,
        `/patients/${patientId}`,
        `/patients/${patientId}/alertes-cliniques`,
        `/triage/visites/${visiteId}`,
      ]) {
        const vuInfirmier = await inf.get(chemin)
        expect(vuInfirmier.status).toBe(200)
        if (JSON.stringify(vuInfirmier.body).includes('VIH'))
          fuites.push(chemin)
      }
      expect(fuites).toEqual([])

      // Le diagnostic reste une ligne, générique, que l'infirmier ne peut pas retirer.
      interface Diag {
        id: string
        masque?: boolean
        pathologieId: string
        pathologie: { libelle: string; code: string }
      }
      const c = await inf.get<{ diagnostics: Diag[] }>(
        `/consultations/${consultationId}`,
      )
      const masque = c.body.diagnostics.find((x) => x.masque)
      expect(masque).toBeDefined()
      expect(masque).toMatchObject({
        pathologieId: '',
        pathologie: { code: '' },
      })
      expect(masque?.pathologie.libelle).toMatch(/confidentiel/i)
      const retrait = await inf.delete(
        `/consultations/${consultationId}/diagnostics/${masque?.id}`,
      )
      expect(retrait.status).toBe(403)
      // La prise en main renvoie aussi le détail : même masque.
      const priseEnMain = await inf.post(
        `/consultations/${consultationId}/prise-en-charge`,
      )
      expect(priseEnMain.status).toBe(200)
      expect(JSON.stringify(priseEnMain.body)).not.toContain('VIH')
    })
  })
})
