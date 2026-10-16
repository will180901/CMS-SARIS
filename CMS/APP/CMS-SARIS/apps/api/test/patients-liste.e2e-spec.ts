/**
 * La liste des patients PAR PAGES (`GET /patients/liste`) — par les vraies routes et la vraie base
 * de test :
 *  - `limite` dossiers par page, de la plus récente à la plus ancienne, `page` à partir de 1 ;
 *    `total` = ce qui correspond aux filtres (il numérote les pages), `page` et `limite` rendus ;
 *  - les pages mises bout à bout redonnent la liste entière, sans doublon ni trou, même quand deux
 *    dossiers du même instant tombent de part et d'autre d'une coupure ;
 *  - les filtres (statut, catégorie, recherche par mots : prénom, nom, numéro, matricule, casse
 *    ignorée) se font côté serveur, sur tous les dossiers ;
 *  - `id` retrouve UN dossier selon les mêmes filtres (la sélection mémorisée de la page) ;
 *  - mêmes lignes, mêmes champs que `GET /patients` (la liste complète reste un tableau : l'extraction
 *    papier/Excel en a besoin).
 */
import { randomUUID } from 'node:crypto'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { PatientController } from '../src/modules/patient/patient.controller'
import { REQUIRE_PERMISSIONS_KEY } from '../src/common/decorators/require-permissions.decorator'
import { baseDe, demarrerApp } from './support/app-test'
import { COMPTES, connecter, type Client } from './support/client'
import { referentiels, type Referentiels } from './support/donnees'

interface Ligne {
  id: string
  numeroPatient: string
  statut: string
  categoriePatient: { id: string }
  identite: { nom: string; prenom: string } | null
}
interface Page {
  data: Ligne[]
  total: number
  page: number
  limite: number
}
interface Refus {
  statusCode: number
  message: string | string[]
}

describe('Liste des patients par pages', () => {
  let app: NestExpressApplication
  let admin: Client
  let ref: Referentiels
  const base = () => baseDe(app)

  // Un jeton de LETTRES propre à ce passage (la base de test est partagée avec d'autres fichiers).
  const lettres = `${Date.now() % 100_000}`
    .split('')
    .map((c) => 'abcdefghij'[Number(c)])
    .join('')
  const nomCommun = `Listenom${lettres}`
  const prenom = (i: number) => `Prenom${'abcdefg'[i]}${lettres}`
  const numero = (i: number) => `PAT-HSTP-${i}${lettres}`
  const matriculeP0 = `HST-MAT-${lettres}`

  const ids: string[] = []
  let cat1: string
  let cat2: string

  const liste = (qs: string) => admin.get<Page & Refus>(`/patients/liste?${qs}`)
  const idsDe = (p: Page) => p.data.map((l) => l.id)

  async function toutParcourir(qs: string, limite: number) {
    const recus: string[] = []
    let page = 1
    let total: number | null = null
    for (;;) {
      const r = await liste(`${qs}&page=${page}&limite=${limite}`)
      expect(r.status).toBe(200)
      expect(r.body.page).toBe(page)
      expect(r.body.limite).toBe(limite)
      if (total === null) total = r.body.total
      else expect(r.body.total).toBe(total)
      if (r.body.data.length === 0) break
      expect(r.body.data.length).toBeLessThanOrEqual(limite)
      recus.push(...idsDe(r.body))
      page += 1
      expect(page).toBeLessThan(60) // garde-fou
    }
    return { recus, total }
  }

  beforeAll(async () => {
    app = await demarrerApp()
    admin = await connecter(app, COMPTES.admin)
    ref = await referentiels(admin)
    const categories = Object.values(ref.categories)
    cat1 = categories[0]!
    cat2 = categories.find((c) => c !== cat1)!
    const raw = base().raw

    // 7 dossiers : les n° 2 et 3 ont EXACTEMENT le même instant (égalité à départager) ; les n° 5 et 6
    // sont archivés ; les n° 0 à 3 sont dans la 1re catégorie, les n° 4 à 6 dans la 2e.
    const t0 = Date.UTC(2026, 0, 10, 8, 0, 0)
    // Les deux dossiers du même instant sont insérés dans l'ordre INVERSE de leur identifiant décroissant :
    // sans le départage par identifiant, la base les rendrait dans l'ordre d'insertion — le test le voit.
    const [petitId, grandId] = [randomUUID(), randomUUID()].sort()
    for (let i = 0; i < 7; i++) {
      const id = i === 2 ? petitId! : i === 3 ? grandId! : randomUUID()
      ids.push(id)
      const minutes = i === 3 ? 2 : i
      await raw.patient.create({
        data: {
          id,
          numeroPatient: numero(i),
          ...(i === 0 ? { matricule: matriculeP0 } : {}),
          siteCreationId: ref.siteId,
          categoriePatientId: i < 4 ? cat1 : cat2,
          statut: i >= 5 ? 'ARCHIVE' : 'ACTIF',
          createdAt: new Date(t0 - minutes * 60_000),
          identite: { create: { nom: nomCommun, prenom: prenom(i) } },
        },
      })
    }
  })

  afterAll(async () => {
    const raw = base().raw
    await raw.identitePatient.deleteMany({ where: { patientId: { in: ids } } })
    await raw.patient.deleteMany({ where: { id: { in: ids } } })
    await app.close()
  })

  describe('Les pages', () => {
    it('chaque page respecte la limite ; le total est celui des filtres, pas celui de la page', async () => {
      const p1 = await liste(`search=${nomCommun}&page=1&limite=3`)
      expect(p1.status).toBe(200)
      expect(p1.body).toMatchObject({ total: 7, page: 1, limite: 3 })
      expect(p1.body.data).toHaveLength(3)
      const p2 = await liste(`search=${nomCommun}&page=2&limite=3`)
      expect(p2.body.data).toHaveLength(3)
      expect(p2.body.total).toBe(7)
      const p3 = await liste(`search=${nomCommun}&page=3&limite=3`)
      expect(p3.body.data).toHaveLength(1)
    })

    it('une page au-delà de la dernière est vide (le total, lui, reste juste)', async () => {
      const r = await liste(`search=${nomCommun}&page=9&limite=3`)
      expect(r.status).toBe(200)
      expect(r.body.data).toEqual([])
      expect(r.body.total).toBe(7)
      expect(r.body.page).toBe(9)
    })

    it('par défaut : page 1, 25 par page', async () => {
      const r = await liste(`search=${nomCommun}`)
      expect(r.body).toMatchObject({ total: 7, page: 1, limite: 25 })
      expect(r.body.data).toHaveLength(7)
    })

    it('de la plus récente à la plus ancienne', async () => {
      const r = await liste(`search=${nomCommun}&limite=100`)
      expect(r.body.data.map((l) => l.numeroPatient)).toEqual(
        // dossiers 0, 1, puis les deux du même instant (3 puis 2, par identifiant décroissant), 4, 5, 6
        expect.arrayContaining([0, 1, 2, 3, 4, 5, 6].map(numero)),
      )
      expect(r.body.data[0]!.numeroPatient).toBe(numero(0))
      expect(r.body.data[1]!.numeroPatient).toBe(numero(1))
      // à égalité d'instant : l'identifiant le plus grand d'abord (ici le n° 3, inséré APRÈS le n° 2)
      expect(r.body.data.slice(2, 4).map((l) => l.numeroPatient)).toEqual([numero(3), numero(2)])
      expect(r.body.data.slice(4).map((l) => l.numeroPatient)).toEqual([numero(4), numero(5), numero(6)])
    })

    it('les pages bout à bout redonnent la liste entière, sans doublon ni trou, quelle que soit la limite', async () => {
      const entiere = await liste(`search=${nomCommun}&limite=100`)
      const attendu = idsDe(entiere.body)
      expect(attendu).toHaveLength(7)
      // limite 3 : la coupure tombe EN PLEIN milieu de l'égalité d'horaire (3e et 4e dossiers)
      for (const limite of [1, 2, 3, 4, 5, 6, 7]) {
        const { recus, total } = await toutParcourir(`search=${nomCommun}`, limite)
        expect({ limite, recus }).toEqual({ limite, recus: attendu })
        expect(total).toBe(7)
      }
    })
  })

  describe('Les filtres, faits par le serveur', () => {
    it('par statut', async () => {
      const archives = await liste(`search=${nomCommun}&statut=ARCHIVE`)
      expect(archives.body.total).toBe(2)
      expect(archives.body.data.every((l) => l.statut === 'ARCHIVE')).toBe(true)
      const actifs = await liste(`search=${nomCommun}&statut=ACTIF`)
      expect(actifs.body.total).toBe(5)
    })

    it('par catégorie', async () => {
      const c1 = await liste(`search=${nomCommun}&categorieId=${cat1}`)
      expect(c1.body.total).toBe(4)
      expect(c1.body.data.every((l) => l.categoriePatient.id === cat1)).toBe(true)
      const c2 = await liste(`search=${nomCommun}&categorieId=${cat2}`)
      expect(c2.body.total).toBe(3)
    })

    it('statut et catégorie ensemble', async () => {
      const r = await liste(`search=${nomCommun}&categorieId=${cat2}&statut=ARCHIVE`)
      expect(r.body.total).toBe(2)
    })

    it('par site de création', async () => {
      const autreSite = await base().raw.site.findFirstOrThrow({ where: { id: { not: ref.siteId } } })
      expect((await liste(`search=${nomCommun}&siteId=${ref.siteId}`)).body.total).toBe(7)
      expect((await liste(`search=${nomCommun}&siteId=${autreSite.id}`)).body.total).toBe(0)
    })

    it('par prénom, nom, numéro de dossier ou matricule', async () => {
      expect((await liste(`search=${prenom(2)}`)).body.total).toBe(1)
      expect((await liste(`search=${numero(4)}`)).body.total).toBe(1)
      expect((await liste(`search=${matriculeP0}`)).body.total).toBe(1)
      expect((await liste(`search=${nomCommun}`)).body.total).toBe(7)
    })

    it('par plusieurs mots, dans n’importe quel ordre, sans tenir compte de la casse', async () => {
      for (const saisie of [`${prenom(1)} ${nomCommun}`, `${nomCommun} ${prenom(1)}`, `${nomCommun.toUpperCase()}   ${prenom(1).toLowerCase()}`]) {
        const r = await liste(`search=${encodeURIComponent(saisie)}`)
        expect({ saisie, total: r.body.total }).toEqual({ saisie, total: 1 })
      }
    })

    it('rien de trouvé : une page vide, sans erreur', async () => {
      const r = await liste(`search=zzzintrouvable${lettres}`)
      expect(r.status).toBe(200)
      expect(r.body).toMatchObject({ data: [], total: 0 })
    })

    it('les caractères spéciaux d’une saisie ne cassent rien', async () => {
      for (const saisie of ['%', '_', "'", '"; DROP TABLE', '\\']) {
        const r = await liste(`search=${encodeURIComponent(saisie)}`)
        expect({ saisie, status: r.status }).toEqual({ saisie, status: 200 })
      }
    })
  })

  describe('Retrouver UN dossier', () => {
    it('par son identifiant, selon les mêmes filtres', async () => {
      const r = await liste(`id=${ids[2]}&limite=1`)
      expect(r.body.total).toBe(1)
      expect(r.body.data[0]!.id).toBe(ids[2])
    })

    it('…mais pas s’il ne correspond pas aux filtres (archivé, autre catégorie, autre recherche)', async () => {
      expect((await liste(`id=${ids[2]}&statut=ARCHIVE`)).body.total).toBe(0)
      expect((await liste(`id=${ids[2]}&categorieId=${cat2}`)).body.total).toBe(0)
      expect((await liste(`id=${ids[2]}&search=${prenom(3)}`)).body.total).toBe(0)
      expect((await liste(`id=${ids[2]}&search=${prenom(2)}&statut=ACTIF&categorieId=${cat1}`)).body.total).toBe(1)
    })
  })

  describe('Les mêmes lignes que la liste complète', () => {
    it('mêmes champs, ligne pour ligne ; la liste complète reste un simple tableau', async () => {
      const complete = await admin.get<Ligne[]>(`/patients?search=${nomCommun}`)
      expect(Array.isArray(complete.body)).toBe(true)
      expect(complete.body).toHaveLength(7)
      const parId = new Map(complete.body.map((l) => [l.id, l]))
      const paginee = await liste(`search=${nomCommun}&limite=100`)
      expect(paginee.body.data).toHaveLength(7)
      for (const l of paginee.body.data) expect(l).toEqual(parId.get(l.id))
    })

    it('réservée au droit de LIRE les patients (déclaré sur la route)', () => {
      const route = PatientController.prototype.liste
      expect(Reflect.getMetadata(REQUIRE_PERMISSIONS_KEY, route)).toEqual({
        permissions: ['patient.read'],
        mode: 'ANY',
      })
    })
  })

  describe('Les saisies refusées', () => {
    it('la page doit être un entier à partir de 1', async () => {
      for (const page of ['0', '-1', '1.5', 'abc', '1000001']) {
        const r = await liste(`page=${page}`)
        expect({ page, status: r.status }).toEqual({ page, status: 400 })
      }
      expect((await liste('page=1')).status).toBe(200)
    })

    it('la limite doit être un entier de 1 à 100', async () => {
      for (const limite of ['0', '-1', '101', '2.5', 'abc']) {
        const r = await liste(`limite=${limite}`)
        expect({ limite, status: r.status }).toEqual({ limite, status: 400 })
      }
      expect((await liste('limite=100')).status).toBe(200)
      expect((await liste('limite=1')).status).toBe(200)
    })

    it('un identifiant qui n’en est pas un, un statut ou une catégorie inconnus sont refusés', async () => {
      expect((await liste('id=pas-un-uuid')).status).toBe(400)
      expect((await liste('statut=PAS_UN_STATUT')).status).toBe(400)
      expect((await liste('categorieId=pas-un-uuid')).status).toBe(400)
    })
  })
})
