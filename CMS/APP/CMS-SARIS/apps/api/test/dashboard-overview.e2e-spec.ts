/**
 * Les chiffres du jour du tableau de bord (`GET /dashboard/overview`) — par la vraie route et la
 * vraie base de test :
 *  - CONTRAT : la réponse porte TOUS les champs que l'écran lit (le type `DashboardOverview` de
 *    l'application web). Un champ oublié ne fait pas d'erreur : la carte s'affiche, sans chiffre
 *    (c'était le cas des « Suivis chroniques » — l'écran lisait `suivisChroniquesActifs`, jamais envoyé) ;
 *  - « Patients en suivi » : un ÉTAT à ce jour — un patient compte UNE fois même suivi pour deux
 *    maladies ; un suivi clôturé, archivé (suppression logique) ou sans patient ne compte pas.
 *
 * La base de test est partagée avec d'autres fichiers : on compare AVANT / APRÈS, jamais un total absolu.
 */
import { randomUUID } from 'node:crypto'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { baseDe, demarrerApp } from './support/app-test'
import { appelAnonyme, COMPTES, connecter, type Client } from './support/client'
import { referentiels, type Referentiels } from './support/donnees'

/** Les champs lus par `apps/web/src/modules/dashboard/api/dashboard.api.ts` (`DashboardOverview`). */
const CHAMPS_NOMBRE = [
  'visitesAujourdhui',
  'visitesAttente',
  'visitesEnCours',
  'visitesCloturees',
  'visitesAnnulees',
  'visitesHier',
  'consultationsActives',
  'consultationsClotureesJour',
  'ordonnancesValideesJour',
  'bonsExamenAttente',
  'evacuationsEnCours',
  'suivisChroniquesActifs',
] as const
/** Ceux-là valent `null` quand il n'y a rien à moyenner / comparer. */
const CHAMPS_NULLABLES = ['tendanceVisitesPct', 'tempsAttenteMoyenMin'] as const

type Overview = Record<(typeof CHAMPS_NOMBRE)[number], number> &
  Record<(typeof CHAMPS_NULLABLES)[number], number | null>

describe("Chiffres du jour du tableau de bord", () => {
  let app: NestExpressApplication
  let admin: Client
  let ref: Referentiels
  const base = () => baseDe(app)

  const patientsCrees: string[] = []
  const suivisCrees: string[] = []

  const lire = async () => {
    const r = await admin.get<Overview>('/dashboard/overview')
    expect(r.status).toBe(200)
    return r.body
  }

  async function creerPatient(): Promise<string> {
    const id = randomUUID()
    await base().raw.patient.create({
      data: {
        id,
        numeroPatient: `PAT-DSH-${id.slice(0, 8)}`,
        siteCreationId: ref.siteId,
        categoriePatientId: Object.values(ref.categories)[0]!,
        statut: 'ACTIF',
      },
    })
    patientsCrees.push(id)
    return id
  }

  async function creerSuivi(
    patientId: string | null,
    extra: { statut?: string; closedAt?: Date; deletedAt?: Date } = {},
  ): Promise<string> {
    const id = randomUUID()
    await base().raw.suiviChronique.create({
      data: { id, patientId, pathologieId: ref.pathologieId, ...extra },
    })
    suivisCrees.push(id)
    return id
  }

  beforeAll(async () => {
    app = await demarrerApp()
    admin = await connecter(app, COMPTES.admin)
    ref = await referentiels(admin)
  })

  afterAll(async () => {
    const raw = base().raw
    await raw.suiviChronique.deleteMany({ where: { id: { in: suivisCrees } } })
    await raw.patient.deleteMany({ where: { id: { in: patientsCrees } } })
    await app.close()
  })

  describe('Le contrat avec l’écran', () => {
    it('tous les champs lus par l’écran sont envoyés, en nombres entiers', async () => {
      const o = await lire()
      for (const champ of CHAMPS_NOMBRE) {
        expect(typeof o[champ]).toBe('number')
        expect(Number.isInteger(o[champ])).toBe(true)
        expect(o[champ]).toBeGreaterThanOrEqual(0)
      }
      for (const champ of CHAMPS_NULLABLES) {
        expect(champ in o).toBe(true)
        const v = o[champ]
        expect(v === null || typeof v === 'number').toBe(true)
      }
    })

    it('les visites du jour sont la somme des quatre statuts du jour', async () => {
      const o = await lire()
      expect(o.visitesAujourdhui).toBe(
        o.visitesAttente + o.visitesEnCours + o.visitesCloturees + o.visitesAnnulees,
      )
    })

    it('sans être connecté, les chiffres du centre ne sont pas servis', async () => {
      const r = await appelAnonyme(app, 'get', '/dashboard/overview')
      expect(r.status).toBe(401)
    })
  })

  describe('Patients en suivi chronique', () => {
    it('un patient suivi de plus fait +1 ; suivi pour une 2e maladie, il compte toujours UNE fois', async () => {
      const avant = (await lire()).suivisChroniquesActifs
      const p = await creerPatient()
      await creerSuivi(p)
      expect((await lire()).suivisChroniquesActifs).toBe(avant + 1)
      await creerSuivi(p)
      expect((await lire()).suivisChroniquesActifs).toBe(avant + 1)
    })

    it('deux patients différents font +2', async () => {
      const avant = (await lire()).suivisChroniquesActifs
      await creerSuivi(await creerPatient())
      await creerSuivi(await creerPatient())
      expect((await lire()).suivisChroniquesActifs).toBe(avant + 2)
    })

    it('un suivi clôturé ne compte pas (ni par sa date de clôture, ni par son statut)', async () => {
      const avant = (await lire()).suivisChroniquesActifs
      await creerSuivi(await creerPatient(), { closedAt: new Date() })
      await creerSuivi(await creerPatient(), { statut: 'CLOTURE', closedAt: new Date() })
      expect((await lire()).suivisChroniquesActifs).toBe(avant)
    })

    it('un suivi annulé, sans date de clôture, ne compte pas non plus', async () => {
      const avant = (await lire()).suivisChroniquesActifs
      await creerSuivi(await creerPatient(), { statut: 'ANNULE' })
      expect((await lire()).suivisChroniquesActifs).toBe(avant)
    })

    it('un suivi supprimé (suppression logique) ne compte pas', async () => {
      const avant = (await lire()).suivisChroniquesActifs
      await creerSuivi(await creerPatient(), { deletedAt: new Date() })
      expect((await lire()).suivisChroniquesActifs).toBe(avant)
    })

    it('un suivi sans patient ne compte pas (la carte dit « patients »)', async () => {
      const avant = (await lire()).suivisChroniquesActifs
      await creerSuivi(null)
      expect((await lire()).suivisChroniquesActifs).toBe(avant)
    })

    it('clôturer le suivi d’un patient le retire du compte', async () => {
      const p = await creerPatient()
      const avant = (await lire()).suivisChroniquesActifs
      const suivi = await creerSuivi(p)
      expect((await lire()).suivisChroniquesActifs).toBe(avant + 1)
      await base().raw.suiviChronique.update({
        where: { id: suivi },
        data: { statut: 'CLOTURE', closedAt: new Date() },
      })
      expect((await lire()).suivisChroniquesActifs).toBe(avant)
    })
  })
})
