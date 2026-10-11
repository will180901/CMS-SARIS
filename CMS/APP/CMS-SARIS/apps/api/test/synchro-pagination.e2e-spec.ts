/**
 * Réception par pages (/sync/pull) : AUCUNE ligne ne se perd d'une page à l'autre.
 *
 * Le poste redemande « la suite » avec le curseur `nextSince` que lui rend le serveur, tant que
 * `hasMore` est vrai. Deux façons de perdre des lignes en route, toutes deux vues avec une base
 * qui grossit (premier chargement d'un poste, resynchronisation complète) :
 *  - un modèle a PLUS de lignes qu'une page n'en tient, un autre modèle a des lignes plus
 *    récentes : le curseur sautait à la plus récente des deux et les lignes du premier, restées
 *    entre-temps, n'étaient jamais envoyées ;
 *  - des lignes enregistrées au MÊME instant (un lot inséré d'un coup) coupées en deux par la
 *    limite de page : le curseur étant « strictement après », la seconde moitié disparaissait.
 *
 * Les lignes de test sont posées DANS LE FUTUR (années +3) : aucune autre ligne de la base ne
 * peut se mêler au relevé, et rien d'autre n'est envoyé qui fausserait le compte.
 */
import { randomUUID } from 'node:crypto'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { baseDe, demarrerApp } from './support/app-test'
import { COMPTES, connecter, type Client } from './support/client'

interface Enveloppe {
  model: string
  id: string
}
interface Page {
  changes: Enveloppe[]
  hasMore: boolean
  nextSince: string
}

const LIMITE = 5

describe('Synchronisation — réception par pages', () => {
  let app: NestExpressApplication
  let admin: Client
  const s = `${Date.now() % 100_000}`
  /** Instant de départ des lignes de test : loin dans le futur. */
  const t0 = Date.now() + 3 * 365 * 86_400_000
  const societes: string[] = []
  const types: string[] = []

  const base = () => baseDe(app)

  /** Ce que ferait un poste : suivre le curseur jusqu'à ce qu'il n'y ait plus de suite. */
  const toutRecevoir = async (depuis: number) => {
    const recus: Enveloppe[] = []
    let since = new Date(depuis).toISOString()
    let pages = 0
    for (;;) {
      const r = await admin.get<Page>(
        `/sync/pull?since=${encodeURIComponent(since)}&limit=${LIMITE}`,
      )
      expect(r.status).toBe(200)
      recus.push(...r.body.changes)
      pages++
      if (!r.body.hasMore) break
      // Le curseur doit AVANCER, sinon le poste tournerait sans fin.
      expect(r.body.nextSince > since).toBe(true)
      since = r.body.nextSince
      if (pages > 60)
        throw new Error('trop de pages : le curseur n’avance pas assez')
    }
    return { recus, pages }
  }
  const idsDe = (recus: Enveloppe[], modele: string) =>
    recus.filter((e) => e.model === modele).map((e) => e.id)

  beforeAll(async () => {
    app = await demarrerApp()
    admin = await connecter(app, COMPTES.admin)
  })
  afterEach(async () => {
    await base().raw.societeSousTraitante.deleteMany({
      where: { id: { in: societes } },
    })
    await base().raw.typeConsultation.deleteMany({
      where: { id: { in: types } },
    })
    societes.length = 0
    types.length = 0
  })
  afterAll(async () => {
    await app.close()
  })

  const poserSocietes = async (n: number, instant: (i: number) => number) => {
    const data = Array.from({ length: n }, (_, i) => ({
      id: randomUUID(),
      nom: `PAGES-${s}-${i}`,
      createdAt: new Date(t0),
      updatedAt: new Date(instant(i)),
    }))
    await base().raw.societeSousTraitante.createMany({ data })
    societes.push(...data.map((d) => d.id))
  }
  const poserTypes = async (n: number, instant: (i: number) => number) => {
    const data = Array.from({ length: n }, (_, i) => ({
      id: randomUUID(),
      code: `PAGES-${s}-T${i}`,
      libelle: `Type ${i}`,
      updatedAt: new Date(instant(i)),
    }))
    await base().raw.typeConsultation.createMany({ data })
    types.push(...data.map((d) => d.id))
  }

  it('un modèle plus volumineux qu’une page ne perd rien quand un autre modèle a des lignes plus récentes', async () => {
    // 12 sociétés (3 pages à elles seules) et 3 types de consultation PLUS TARD : avant la
    // correction, le curseur de la 1re page sautait aux types et les sociétés 6 à 12 étaient perdues.
    await poserSocietes(12, (i) => t0 + i)
    await poserTypes(3, (i) => t0 + 10_000 + i)
    const { recus, pages } = await toutRecevoir(t0 - 1_000)
    expect(new Set(idsDe(recus, 'SocieteSousTraitante'))).toEqual(
      new Set(societes),
    )
    expect(new Set(idsDe(recus, 'TypeConsultation'))).toEqual(new Set(types))
    expect(pages).toBeGreaterThan(1)
  })

  it('des lignes enregistrées au même instant, coupées par la limite de page, arrivent toutes', async () => {
    // Un lot inséré d'un coup porte le MÊME horodatage : 12 lignes, pages de 5.
    await poserSocietes(12, () => t0)
    const { recus } = await toutRecevoir(t0 - 1_000)
    const ids = idsDe(recus, 'SocieteSousTraitante')
    expect(new Set(ids)).toEqual(new Set(societes))
  })

  it('les deux ensemble : égalités ET modèles de rythmes différents', async () => {
    await poserSocietes(13, (i) => t0 + Math.floor(i / 4)) // paquets de 4 au même instant
    await poserTypes(9, (i) => t0 + 1 + Math.floor(i / 3))
    const { recus } = await toutRecevoir(t0 - 1_000)
    expect(new Set(idsDe(recus, 'SocieteSousTraitante'))).toEqual(
      new Set(societes),
    )
    expect(new Set(idsDe(recus, 'TypeConsultation'))).toEqual(new Set(types))
  })

  it('sans dépassement de page, tout arrive en une fois et le curseur est celui de la dernière ligne', async () => {
    await poserSocietes(3, (i) => t0 + i)
    const r = await admin.get<Page>(
      `/sync/pull?since=${encodeURIComponent(new Date(t0 - 1_000).toISOString())}&limit=${LIMITE}`,
    )
    expect(r.body.hasMore).toBe(false)
    expect(idsDe(r.body.changes, 'SocieteSousTraitante')).toHaveLength(3)
    expect(r.body.nextSince).toBe(new Date(t0 + 2).toISOString())
  })
})
