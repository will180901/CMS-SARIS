/**
 * Historique des visites du triage par PAGES (`GET /triage/visites/historique`) — par les vraies
 * routes et la vraie base de test :
 *  - `limite` visites à la fois, de la plus récente à la plus ancienne, la page suivante commençant
 *    après `curseur` ; `total` seulement sur la 1re page ;
 *  - les pages mises bout à bout redonnent la liste entière, sans doublon ni trou, même quand deux
 *    visites du même instant tombent de part et d'autre d'une coupure ;
 *  - seul le statut demandé (clôturées OU annulées) ;
 *  - la recherche (patient, numéro, motif) et les filtres soignant / motif se font côté serveur, sur
 *    tout l'historique : mots dans n'importe quel ordre, casse ignorée ;
 *  - même règle de confidentialité que la liste complète : l'historique n'est visible que de son
 *    initiateur, sauf supervision ;
 *  - mêmes lignes, mêmes champs que `GET /triage/visites?statut=…` (la liste complète reste un tableau).
 */
import { randomUUID } from 'node:crypto'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { TriageController } from '../src/modules/triage/triage.controller'
import { REQUIRE_PERMISSIONS_KEY } from '../src/common/decorators/require-permissions.decorator'
import { baseDe, demarrerApp } from './support/app-test'
import { COMPTES, connecter, type Client } from './support/client'
import { referentiels, type Referentiels } from './support/donnees'

interface Ligne {
  id: string
  statut: string
  dateOuverture: string
  soignantId: string | null
  motifPrincipalId: string
  patient: { numeroPatient: string }
  soignant: { id: string } | null
}
interface Page {
  data: Ligne[]
  total: number | null
  curseurSuivant: string | null
}
interface Refus {
  statusCode: number
  code?: string
  message: string
}

describe('Historique des visites du triage par pages', () => {
  let app: NestExpressApplication
  let admin: Client
  let infirmier: Client
  let ref: Referentiels
  const base = () => baseDe(app)

  // Un jeton de LETTRES propre à ce passage (la base de test est partagée avec d'autres fichiers).
  const lettres = `${Date.now() % 100_000}`
    .split('')
    .map((c) => 'abcdefghij'[Number(c)])
    .join('')
  const prenomA = `Trha${lettres}`
  const prenomB = `Trhb${lettres}`
  const nomCommun = `Trhnom${lettres}`
  const numeroA = `PAT-TRH-A${lettres}`
  const numeroB = `PAT-TRH-B${lettres}`

  const patientIds: string[] = []
  const visiteIds: string[] = []
  let pMedecin: { id: string; nom: string }
  let pInfirmier: { id: string; nom: string }
  let motif1: { id: string; libelle: string }
  let motif2: { id: string; libelle: string }
  /** Les visites clôturées du patient A, dans l'ordre où elles ont été écrites. */
  const clotureesA: string[] = []
  const motifDeA: string[] = []

  const page = (qs: string, c: Client = admin) =>
    c.get<Page & Refus>(`/triage/visites/historique?${qs}`)
  const ids = (p: Page) => p.data.map((l) => l.id)

  /** Parcourt TOUTES les pages (limite donnée) et rend les identifiants dans l'ordre reçu. */
  async function toutParcourir(qs: string, limite: number) {
    const recus: string[] = []
    let curseur: string | null = null
    let totalPremierePage: number | null | undefined
    let pages = 0
    do {
      const r: { status: number; body: Page & Refus } = await page(
        `${qs}&limite=${limite}${curseur ? `&curseur=${curseur}` : ''}`,
      )
      expect(r.status).toBe(200)
      if (pages === 0) totalPremierePage = r.body.total
      else expect(r.body.total).toBeNull()
      expect(r.body.data.length).toBeLessThanOrEqual(limite)
      recus.push(...ids(r.body))
      curseur = r.body.curseurSuivant
      pages += 1
      expect(pages).toBeLessThan(50) // garde-fou : un curseur qui ne finit jamais
    } while (curseur)
    return { recus, totalPremierePage }
  }

  beforeAll(async () => {
    app = await demarrerApp()
    admin = await connecter(app, COMPTES.admin)
    infirmier = await connecter(app, COMPTES.infirmier)
    ref = await referentiels(admin)
    const raw = base().raw

    const pers = async (login: string) => {
      const u = await raw.utilisateur.findFirstOrThrow({
        where: { login },
        select: { personnelMedicalId: true },
      })
      return raw.personnelMedical.findUniqueOrThrow({
        where: { id: u.personnelMedicalId! },
        select: { id: true, nom: true },
      })
    }
    pMedecin = await pers(COMPTES.medecinChef.login)
    pInfirmier = await pers(COMPTES.infirmier.login)
    motif1 = await raw.motifConsultation.findUniqueOrThrow({
      where: { id: ref.motifId },
      select: { id: true, libelle: true },
    })
    motif2 = await raw.motifConsultation.findFirstOrThrow({
      where: { id: { not: ref.motifId } },
      select: { id: true, libelle: true },
    })

    // Deux patients
    const patients = [
      { prenom: prenomA, numero: numeroA },
      { prenom: prenomB, numero: numeroB },
    ].map((p) => ({ ...p, id: randomUUID() }))
    for (const p of patients) {
      patientIds.push(p.id)
      await raw.patient.create({
        data: {
          id: p.id,
          numeroPatient: p.numero,
          siteCreationId: ref.siteId,
          categoriePatientId: ref.categories['ASSURE_CDI']!,
          identite: { create: { nom: nomCommun, prenom: p.prenom } },
        },
      })
    }
    const [patientA, patientB] = patients as [(typeof patients)[0], (typeof patients)[0]]

    const t0 = Date.UTC(2026, 0, 10, 8, 0, 0)
    // Les deux visites du même instant sont insérées dans l'ordre INVERSE de leur identifiant
    // décroissant : sans le départage par identifiant, la base les rendrait dans l'ordre d'insertion.
    const [petitId, grandId] = [randomUUID(), randomUUID()].sort()
    const ecrire = async (
      patientId: string,
      soignantId: string,
      statut: 'CLOTUREE' | 'ANNULEE',
      dateOuverture: Date,
      motifId: string,
      id: string = randomUUID(),
    ) => {
      visiteIds.push(id)
      await raw.visite.create({
        data: { id, patientId, siteId: ref.siteId, motifPrincipalId: motifId, statut, soignantId, dateOuverture },
      })
      return id
    }

    // Patient A : 6 clôturées. Les n° 2 et 3 ont EXACTEMENT le même instant ; les 4 premières sont au
    // médecin, les 2 dernières à l'infirmier ; les n° pairs ont le motif 1, les impairs le motif 2.
    for (let i = 0; i < 6; i++) {
      const minutes = i === 3 ? 2 : i
      const motif = i % 2 === 0 ? motif1 : motif2
      motifDeA.push(motif.libelle)
      clotureesA.push(
        await ecrire(
          patientA.id,
          i < 4 ? pMedecin.id : pInfirmier.id,
          'CLOTUREE',
          new Date(t0 - minutes * 60_000),
          motif.id,
          i === 2 ? petitId : i === 3 ? grandId : undefined,
        ),
      )
    }
    // Patient B : 2 clôturées (médecin, motif 1), 2 annulées (une au médecin, une à l'infirmier).
    await ecrire(patientB.id, pMedecin.id, 'CLOTUREE', new Date(t0 - 10 * 60_000), motif1.id)
    await ecrire(patientB.id, pMedecin.id, 'CLOTUREE', new Date(t0 - 11 * 60_000), motif1.id)
    await ecrire(patientB.id, pMedecin.id, 'ANNULEE', new Date(t0 - 12 * 60_000), motif1.id)
    await ecrire(patientB.id, pInfirmier.id, 'ANNULEE', new Date(t0 - 13 * 60_000), motif1.id)
  })

  afterAll(async () => {
    const raw = base().raw
    await raw.visite.deleteMany({ where: { id: { in: visiteIds } } })
    await raw.identitePatient.deleteMany({ where: { patientId: { in: patientIds } } })
    await raw.patient.deleteMany({ where: { id: { in: patientIds } } })
    await app.close()
  })

  describe('Les pages', () => {
    it('chaque page respecte la limite ; le total n’est donné que sur la 1re ; la dernière n’a pas de suite', async () => {
      const r1 = await page(`statut=CLOTUREE&search=${nomCommun}&limite=3`)
      expect(r1.status).toBe(200)
      expect(r1.body.data).toHaveLength(3)
      expect(r1.body.total).toBe(8)
      expect(r1.body.curseurSuivant).toBe(r1.body.data[2]!.id)

      const r2 = await page(`statut=CLOTUREE&search=${nomCommun}&limite=3&curseur=${r1.body.curseurSuivant}`)
      expect(r2.body.data).toHaveLength(3)
      expect(r2.body.total).toBeNull()

      const r3 = await page(`statut=CLOTUREE&search=${nomCommun}&limite=3&curseur=${r2.body.curseurSuivant}`)
      expect(r3.body.data).toHaveLength(2)
      expect(r3.body.curseurSuivant).toBeNull()
    })

    it('une page qui tombe pile sur la fin n’annonce pas de page suivante vide', async () => {
      const r = await page(`statut=CLOTUREE&search=${nomCommun}&limite=8`)
      expect(r.body.data).toHaveLength(8)
      expect(r.body.curseurSuivant).toBeNull()
    })

    it('la limite par défaut est de 40 (tout tient ici sur une page)', async () => {
      const r = await page(`statut=CLOTUREE&search=${nomCommun}`)
      expect(r.body.data).toHaveLength(8)
      expect(r.body.curseurSuivant).toBeNull()
    })

    it('de la plus récente à la plus ancienne ; à égalité d’instant, l’identifiant le plus grand d’abord', async () => {
      const r = await page(`statut=CLOTUREE&search=${prenomA}&limite=100`)
      expect(r.body.data.map((l) => l.id)).toEqual([
        clotureesA[0], // le plus récent
        clotureesA[1],
        clotureesA[3], // même instant que le n° 2, mais inséré APRÈS et d'identifiant plus grand
        clotureesA[2],
        clotureesA[4],
        clotureesA[5],
      ])
    })

    it('les pages bout à bout redonnent la liste entière, sans doublon ni trou, quelle que soit la limite', async () => {
      const entiere = await page(`statut=CLOTUREE&search=${prenomA}&limite=100`)
      const attendu = ids(entiere.body)
      expect(attendu).toHaveLength(6)
      // limite 3 : la coupure tombe EN PLEIN milieu de l'égalité d'horaire
      for (const limite of [1, 2, 3, 4, 5]) {
        const { recus, totalPremierePage } = await toutParcourir(`statut=CLOTUREE&search=${prenomA}`, limite)
        expect({ limite, recus }).toEqual({ limite, recus: attendu })
        expect(totalPremierePage).toBe(6)
      }
    })

    it('seul le statut demandé : clôturées OU annulées', async () => {
      const cloturees = await page(`statut=CLOTUREE&search=${nomCommun}`)
      expect(cloturees.body.data.every((l) => l.statut === 'CLOTUREE')).toBe(true)
      expect(cloturees.body.total).toBe(8)
      const annulees = await page(`statut=ANNULEE&search=${nomCommun}`)
      expect(annulees.body.data.every((l) => l.statut === 'ANNULEE')).toBe(true)
      expect(annulees.body.total).toBe(2)
    })

    it('sans recherche, le total est celui de tout l’historique du statut', async () => {
      const r = await page('statut=CLOTUREE&limite=5')
      expect(r.body.data).toHaveLength(5)
      expect(r.body.total).toBeGreaterThanOrEqual(8)
    })

    it('un curseur qui n’existe pas est refusé (400 CURSEUR_INVALIDE), il ne rend pas une page vide', async () => {
      const r = await page(`statut=CLOTUREE&search=${nomCommun}&curseur=${randomUUID()}`)
      expect(r.status).toBe(400)
      expect(r.body.code).toBe('CURSEUR_INVALIDE')
    })
  })

  describe('La recherche et les filtres, faits par le serveur', () => {
    it('par le prénom du patient : seulement ses visites, sur tout l’historique', async () => {
      const r = await page(`statut=CLOTUREE&search=${prenomA}`)
      expect(r.body.total).toBe(6)
      expect(new Set(r.body.data.map((l) => l.patient.numeroPatient))).toEqual(new Set([numeroA]))
    })

    it('par plusieurs mots, dans n’importe quel ordre, sans tenir compte de la casse', async () => {
      for (const saisie of [`${prenomB} ${nomCommun}`, `${nomCommun} ${prenomB}`, `${nomCommun.toUpperCase()}   ${prenomB.toLowerCase()}`]) {
        const r = await page(`statut=CLOTUREE&search=${encodeURIComponent(saisie)}`)
        expect({ saisie, total: r.body.total }).toEqual({ saisie, total: 2 })
      }
    })

    it('par le numéro du patient', async () => {
      const r = await page(`statut=CLOTUREE&search=${numeroB}`)
      expect(r.body.total).toBe(2)
    })

    it('par le motif de la visite', async () => {
      const attendu = motifDeA.filter((l) => l.toLowerCase().includes(motif1.libelle.toLowerCase())).length
      const r = await page(`statut=CLOTUREE&search=${encodeURIComponent(`${prenomA} ${motif1.libelle}`)}`)
      expect(r.body.total).toBe(attendu)
      expect(attendu).toBeGreaterThanOrEqual(3)
    })

    it('rien de trouvé : une page vide, sans erreur', async () => {
      const r = await page(`statut=CLOTUREE&search=zzzintrouvable${lettres}`)
      expect(r.status).toBe(200)
      expect(r.body).toEqual({ data: [], total: 0, curseurSuivant: null })
    })

    it('les caractères spéciaux d’une saisie ne cassent rien', async () => {
      for (const saisie of ['%', '_', "'", '"; DROP TABLE', '\\']) {
        const r = await page(`statut=CLOTUREE&search=${encodeURIComponent(saisie)}`)
        expect({ saisie, status: r.status }).toEqual({ saisie, status: 200 })
      }
    })

    it('par soignant', async () => {
      const med = await page(`statut=CLOTUREE&search=${nomCommun}&soignantId=${pMedecin.id}`)
      expect(med.body.total).toBe(6)
      expect(med.body.data.every((l) => l.soignantId === pMedecin.id)).toBe(true)
      const inf = await page(`statut=CLOTUREE&search=${nomCommun}&soignantId=${pInfirmier.id}`)
      expect(inf.body.total).toBe(2)
    })

    it('par motif', async () => {
      const m1 = await page(`statut=CLOTUREE&search=${nomCommun}&motifId=${motif1.id}`)
      expect(m1.body.total).toBe(5)
      expect(m1.body.data.every((l) => l.motifPrincipalId === motif1.id)).toBe(true)
      const m2 = await page(`statut=CLOTUREE&search=${nomCommun}&motifId=${motif2.id}`)
      expect(m2.body.total).toBe(3)
    })

    it('recherche, soignant et motif ensemble', async () => {
      const r = await page(`statut=CLOTUREE&search=${prenomA}&soignantId=${pMedecin.id}&motifId=${motif1.id}`)
      // patient A, soignant = médecin (n° 0 à 3), motif 1 (n° pairs) : les n° 0 et 2
      expect(r.body.total).toBe(2)
      expect(new Set(ids(r.body))).toEqual(new Set([clotureesA[0], clotureesA[2]]))
    })
  })

  describe('Les mêmes règles que la liste complète', () => {
    it('un infirmier ne voit que SES visites (le médecin chef voit tout)', async () => {
      const inf = await page(`statut=CLOTUREE&search=${nomCommun}`, infirmier)
      expect(inf.status).toBe(200)
      expect(inf.body.total).toBe(2)
      expect(inf.body.data.every((l) => l.soignantId === pInfirmier.id)).toBe(true)
      const annulees = await page(`statut=ANNULEE&search=${nomCommun}`, infirmier)
      expect(annulees.body.total).toBe(1)
      const tout = await page(`statut=CLOTUREE&search=${nomCommun}`)
      expect(tout.body.total).toBe(8)
    })

    it('un infirmier ne contourne pas la règle en demandant le soignant d’un autre', async () => {
      const r = await page(`statut=CLOTUREE&search=${nomCommun}&soignantId=${pMedecin.id}`, infirmier)
      expect(r.status).toBe(200)
      expect(r.body.total).toBe(0)
    })

    it('mêmes lignes, mêmes champs que la liste complète (celle-ci reste un simple tableau)', async () => {
      const complete = await admin.get<Ligne[]>('/triage/visites?statut=CLOTUREE')
      expect(Array.isArray(complete.body)).toBe(true)
      const parId = new Map(complete.body.map((l) => [l.id, l]))
      const paginee = await page(`statut=CLOTUREE&search=${nomCommun}`)
      expect(paginee.body.data.length).toBeGreaterThan(0)
      for (const l of paginee.body.data) expect(l).toEqual(parId.get(l.id))
    })

    it('réservé au droit de LIRE les visites (déclaré sur la route)', () => {
      const route = TriageController.prototype.historique
      expect(Reflect.getMetadata(REQUIRE_PERMISSIONS_KEY, route)).toEqual({
        permissions: ['visite.read'],
        mode: 'ANY',
      })
    })
  })

  describe('Un compte sans fiche du personnel', () => {
    it('ne voit AUCUNE visite (et non toutes) : sans soignant rattaché, rien n’est à lui', async () => {
      const raw = base().raw
      const compte = await raw.utilisateur.findFirstOrThrow({
        where: { login: COMPTES.infirmier.login },
        select: { id: true, personnelMedicalId: true },
      })
      await raw.utilisateur.update({ where: { id: compte.id }, data: { personnelMedicalId: null } })
      try {
        const sansFiche = await connecter(app, COMPTES.infirmier)
        const r = await page(`statut=CLOTUREE&search=${nomCommun}`, sansFiche)
        expect(r.status).toBe(200)
        expect(r.body).toEqual({ data: [], total: 0, curseurSuivant: null })
      } finally {
        await raw.utilisateur.update({
          where: { id: compte.id },
          data: { personnelMedicalId: compte.personnelMedicalId },
        })
        infirmier = await connecter(app, COMPTES.infirmier)
      }
    })
  })

  describe('Les saisies refusées', () => {
    it('le statut est obligatoire et ne peut être que CLOTUREE ou ANNULEE', async () => {
      for (const qs of ['', 'statut=ACTIVES', 'statut=EN_ATTENTE', 'statut=EN_COURS', 'statut=x']) {
        const r = await page(qs)
        expect({ qs, status: r.status }).toEqual({ qs, status: 400 })
      }
    })

    it('la limite doit être un entier de 1 à 100', async () => {
      for (const limite of ['0', '-1', '101', '2.5', 'abc']) {
        const r = await page(`statut=CLOTUREE&limite=${limite}`)
        expect({ limite, status: r.status }).toEqual({ limite, status: 400 })
      }
      expect((await page('statut=CLOTUREE&limite=100')).status).toBe(200)
      expect((await page('statut=CLOTUREE&limite=1')).status).toBe(200)
    })

    it('curseur, soignant et motif doivent être des identifiants ; la recherche ne dépasse pas 100 caractères', async () => {
      expect((await page('statut=CLOTUREE&curseur=pas-un-uuid')).status).toBe(400)
      expect((await page('statut=CLOTUREE&soignantId=pas-un-uuid')).status).toBe(400)
      expect((await page('statut=CLOTUREE&motifId=pas-un-uuid')).status).toBe(400)
      expect((await page(`statut=CLOTUREE&search=${'x'.repeat(101)}`)).status).toBe(400)
      expect((await page(`statut=CLOTUREE&search=${'x'.repeat(100)}`)).status).toBe(200)
    })
  })
})
