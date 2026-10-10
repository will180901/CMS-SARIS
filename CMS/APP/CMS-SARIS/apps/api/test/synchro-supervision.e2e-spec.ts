/**
 * Supervision de la synchronisation, par ses vraies routes :
 *  - l'activité REGROUPÉE PAR POSTE : une ligne par machine, quel que soit le nombre
 *    d'échanges qu'elle a eus ;
 *  - la fiche d'un poste : bilan, conflits et refus — la RAISON d'un refus sort, jamais le
 *    contenu de la fiche refusée (un dossier patient entier) ;
 *  - le vidage de l'historique : un droit à part (administrateur), qui CONSERVE par défaut
 *    la quarantaine (seule copie, côté serveur, d'un changement refusé) et laisse toujours
 *    sa propre trace.
 *
 * Les échanges sont posés directement en base : ce qu'on vérifie ici, c'est la lecture et
 * le vidage de l'historique, pas la façon dont un lot de changements le produit (voir
 * synchronisation.e2e-spec.ts).
 */
import { randomUUID } from 'node:crypto'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { baseDe, demarrerApp } from './support/app-test'
import { COMPTES, connecter, type Client } from './support/client'
import { routesProtegees } from './support/routes'

interface LignePoste {
  id: string
  libelle: string
  retire: boolean
  nbEchanges: number
  nbReussis: number
  nbAvecConflits: number
  nbMutations: number
  nbConflits: number
  premierEchangeAt: string | null
  dernierEchangeAt: string | null
}
interface PageActivite {
  items: LignePoste[]
  total: number
  page: number
  pageSize: number
  totaux: {
    echanges: number
    quarantaine: number
    conflitsAuto: number
    echangesAvecRefus: number
  }
}
interface Bilan {
  poste: { id: string; libelle: string }
  bilan: {
    nbEchanges: number
    nbReussis: number
    nbAvecConflits: number
    nbMutations: number
    quarantaine: number
    conflitsAuto: number
    dernieres24h: { echanges: number; mutations: number }
  }
}
interface PageConflits {
  items: {
    id: string
    entiteType: string
    typeConflit: string
    raison: string | null
  }[]
  total: number
}
interface Cycles {
  items: { poste: string; statut: string }[]
  total: number
}
interface Purge {
  echanges: number
  conflits: number
  quarantaineConservee: number
}

const ilYa = (minutes: number) => new Date(Date.now() - minutes * 60_000)
const JOUR = 24 * 60

describe('Supervision de la synchronisation', () => {
  let app: NestExpressApplication
  let admin: Client
  let infirmier: Client
  let medecin: Client
  const s = `${Date.now() % 100_000}`
  const marque = `Supervision${s}`
  const ids: { A: string; B: string; C: string; D: string } = {
    A: '',
    B: '',
    C: '',
    D: '',
  }
  let debutA: Date
  let finA: Date

  const activite = async (requete = '') => {
    const r = await admin.get<PageActivite>(
      `/sync/supervision/activite/postes?recherche=${encodeURIComponent(marque)}&pageSize=50${requete}`,
    )
    expect(r.status).toBe(200)
    return r.body
  }
  const base = () => baseDe(app)

  beforeAll(async () => {
    app = await demarrerApp()
    admin = await connecter(app, COMPTES.admin)
    infirmier = await connecter(app, COMPTES.infirmier)
    medecin = await connecter(app, COMPTES.medecinChef)

    const db = base()
    const site = await db.site.findFirstOrThrow({ select: { id: true } })
    const poste = (suffixe: string, extra: { masque?: boolean } = {}) =>
      db.posteLocal.create({
        data: {
          siteId: site.id,
          libelle: `Poste ${marque} ${suffixe}`,
          derniereSyncAt: new Date(),
          ...extra,
        },
      })
    const echange = (
      posteLocalId: string,
      depuisMinutes: number,
      statut: 'REUSSIE' | 'CONFLITS',
      nbMutations: number,
      nbConflits = 0,
    ) =>
      db.journalSynchronisation.create({
        data: {
          posteLocalId,
          startedAt: ilYa(depuisMinutes),
          finishedAt: ilYa(depuisMinutes - 1),
          statut,
          nbMutations,
          nbConflits,
        },
      })

    // A : trois échanges, dont un avec un conflit tranché ET un refus mis en quarantaine.
    // B : un seul échange, il y a cinq jours. C : un battement de vie, aucun échange.
    // D : retiré du parc, un échange il y a dix jours.
    const [A, B, C, D] = [
      await poste('A'),
      await poste('B'),
      await poste('C'),
      await poste('D', { masque: true }),
    ]
    ids.A = A.id
    ids.B = B.id
    ids.C = C.id
    ids.D = D.id

    const a1 = await echange(A.id, 180, 'REUSSIE', 4)
    const a2 = await echange(A.id, 120, 'CONFLITS', 2, 2)
    const a3 = await echange(A.id, 30, 'REUSSIE', 1)
    debutA = a1.startedAt
    finA = a3.startedAt
    await echange(B.id, 5 * JOUR, 'REUSSIE', 5)
    await echange(D.id, 10 * JOUR, 'REUSSIE', 1)

    await db.conflitSynchronisation.create({
      data: {
        journalId: a2.id,
        mutationUuid: randomUUID(),
        entiteType: 'Patient',
        entiteId: randomUUID(),
        typeConflit: 'LOCAL_GAGNE',
        valeurLocale: { nom: 'CONFIDENTIEL-LOCAL' },
        valeurServeur: { nom: 'CONFIDENTIEL-SERVEUR' },
      },
    })
    await db.conflitSynchronisation.create({
      data: {
        journalId: a2.id,
        mutationUuid: randomUUID(),
        entiteType: 'Visite',
        entiteId: randomUUID(),
        typeConflit: 'REJET_SERVEUR',
        valeurLocale: { nom: 'CONFIDENTIEL-REFUSE' },
        valeurServeur: { erreur: 'Matricule déjà utilisé' },
      },
    })
  })
  afterAll(async () => {
    await app.close()
  })

  describe('Activité regroupée par poste', () => {
    it('une seule ligne par poste, avec le bilan de TOUS ses échanges', async () => {
      const p = await activite()
      const lignes = p.items.map((l) => l.id)
      // Trois postes ont échangé (A, B, D) : trois lignes, pas cinq échanges à plat.
      expect(p.total).toBe(3)
      expect(lignes).toHaveLength(3)
      expect(new Set(lignes).size).toBe(3)
      // Un poste qui n'a jamais rien échangé n'a pas de ligne d'activité.
      expect(lignes).not.toContain(ids.C)

      const a = p.items.find((l) => l.id === ids.A)!
      expect(a).toMatchObject({
        nbEchanges: 3,
        nbReussis: 2,
        nbAvecConflits: 1,
        nbMutations: 7,
        nbConflits: 2,
        retire: false,
      })
      expect(new Date(a.premierEchangeAt!).getTime()).toBe(debutA.getTime())
      expect(new Date(a.dernierEchangeAt!).getTime()).toBe(finA.getTime())

      const b = p.items.find((l) => l.id === ids.B)!
      expect(b).toMatchObject({ nbEchanges: 1, nbMutations: 5 })
    })

    it('un poste retiré du parc garde sa ligne, signalée', async () => {
      const d = (await activite()).items.find((l) => l.id === ids.D)!
      expect(d.retire).toBe(true)
    })

    it('le poste actif le plus récemment vient en premier', async () => {
      const p = await activite()
      expect(p.items.map((l) => l.id)).toEqual([ids.A, ids.B, ids.D])
    })

    it('les mots du nom retrouvent le poste, dans n’importe quel ordre', async () => {
      const q = async (mots: string) =>
        (
          await admin.get<PageActivite>(
            `/sync/supervision/activite/postes?recherche=${encodeURIComponent(mots)}`,
          )
        ).body
      expect((await q(`Poste ${marque}`)).total).toBe(3)
      expect((await q(`${marque} Poste`)).total).toBe(3)
      expect((await q(`${marque} inconnu`)).total).toBe(0)
    })

    it('ne garde, sur demande, que les postes avec un conflit ou un refus', async () => {
      const p = await activite('&statut=CONFLITS')
      expect(p.items.map((l) => l.id)).toEqual([ids.A])
    })

    it('pagine côté serveur', async () => {
      const page = async (n: number) =>
        (
          await admin.get<PageActivite>(
            `/sync/supervision/activite/postes?recherche=${encodeURIComponent(marque)}&pageSize=1&page=${n}`,
          )
        ).body
      const [p1, p2, p3] = [await page(1), await page(2), await page(3)]
      expect([p1.total, p2.total, p3.total]).toEqual([3, 3, 3])
      expect([p1.items[0]!.id, p2.items[0]!.id, p3.items[0]!.id]).toEqual([
        ids.A,
        ids.B,
        ids.D,
      ])
    })

    it('refuse un filtre inconnu', async () => {
      const r = await admin.get(
        '/sync/supervision/activite/postes?statut=NIMPORTEQUOI',
      )
      expect(r.status).toBe(400)
    })

    it('annonce ce qu’un vidage effacerait', async () => {
      const { totaux } = await activite()
      expect(totaux.echanges).toBeGreaterThanOrEqual(5)
      expect(totaux.quarantaine).toBeGreaterThanOrEqual(1)
      expect(totaux.conflitsAuto).toBeGreaterThanOrEqual(1)
      // L'échange de A qui porte le refus : le vidage par défaut le conserve.
      expect(totaux.echangesAvecRefus).toBeGreaterThanOrEqual(1)
      expect(totaux.echangesAvecRefus).toBeLessThan(totaux.echanges)
    })

    it('le détail cycle par cycle d’un poste reste lisible, filtré sur lui', async () => {
      const tous = await admin.get<Cycles>(
        `/sync/supervision/activite?posteId=${ids.A}`,
      )
      expect(tous.body.total).toBe(3)
      expect(tous.body.items.every((c) => c.poste === `Poste ${marque} A`)).toBe(
        true,
      )
      const avecConflits = await admin.get<Cycles>(
        `/sync/supervision/activite?posteId=${ids.A}&statut=CONFLITS`,
      )
      expect(avecConflits.body.total).toBe(1)
    })
  })

  describe('Fiche d’un poste', () => {
    it('bilan : réussites, échanges avec conflits, refus et flux des dernières 24 h', async () => {
      const r = await admin.get<Bilan>(`/sync/supervision/postes/${ids.A}/bilan`)
      expect(r.status).toBe(200)
      expect(r.body.poste.libelle).toBe(`Poste ${marque} A`)
      expect(r.body.bilan).toMatchObject({
        nbEchanges: 3,
        nbReussis: 2,
        nbAvecConflits: 1,
        nbMutations: 7,
        quarantaine: 1,
        conflitsAuto: 1,
        dernieres24h: { echanges: 3, mutations: 7 },
      })
    })

    it('le flux des dernières 24 h ne compte pas les échanges plus anciens', async () => {
      const r = await admin.get<Bilan>(`/sync/supervision/postes/${ids.B}/bilan`)
      expect(r.body.bilan.nbEchanges).toBe(1)
      expect(r.body.bilan.dernieres24h).toEqual({ echanges: 0, mutations: 0 })
    })

    it('un poste inconnu : 404', async () => {
      const inconnu = '00000000-0000-4000-8000-000000000000'
      for (const chemin of ['bilan', 'conflits']) {
        const r = await admin.get(`/sync/supervision/postes/${inconnu}/${chemin}`)
        expect(r.status).toBe(404)
      }
    })

    it('conflits et refus : la raison du refus sort, jamais le contenu des fiches', async () => {
      const tous = await admin.get<PageConflits>(
        `/sync/supervision/postes/${ids.A}/conflits`,
      )
      expect(tous.status).toBe(200)
      expect(tous.body.total).toBe(2)

      const refus = await admin.get<PageConflits>(
        `/sync/supervision/postes/${ids.A}/conflits?type=QUARANTAINE`,
      )
      expect(refus.body.items).toHaveLength(1)
      expect(refus.body.items[0]).toMatchObject({
        entiteType: 'Visite',
        typeConflit: 'REJET_SERVEUR',
        raison: 'Matricule déjà utilisé',
      })

      const tranches = await admin.get<PageConflits>(
        `/sync/supervision/postes/${ids.A}/conflits?type=CONFLITS`,
      )
      expect(tranches.body.items).toHaveLength(1)
      expect(tranches.body.items[0]).toMatchObject({
        entiteType: 'Patient',
        typeConflit: 'LOCAL_GAGNE',
        raison: null,
      })

      // Ni la fiche du poste ni celle du serveur, sous aucune forme.
      for (const r of [tous, refus, tranches]) {
        const texte = JSON.stringify(r.body)
        expect(texte).not.toContain('CONFIDENTIEL')
        expect(texte).not.toContain('valeurLocale')
        expect(texte).not.toContain('valeurServeur')
      }
    })

    it('pagine les conflits et refuse un type inconnu', async () => {
      const p1 = await admin.get<PageConflits>(
        `/sync/supervision/postes/${ids.A}/conflits?pageSize=1`,
      )
      expect(p1.body.items).toHaveLength(1)
      expect(p1.body.total).toBe(2)
      const mauvais = await admin.get(
        `/sync/supervision/postes/${ids.A}/conflits?type=AUTRE`,
      )
      expect(mauvais.status).toBe(400)
    })
  })

  describe('Droits', () => {
    it('vider l’historique exige son propre droit, que seul l’administrateur système a', async () => {
      const route = routesProtegees(app).find(
        (r) => r.methode === 'delete' && r.chemin === '/sync/supervision/activite',
      )
      // Ni la lecture, ni le pilotage de la synchronisation ne suffisent à effacer.
      expect(route?.permissions).toEqual(['synchronisation.purge'])
      expect(admin.user.permissions).toContain('synchronisation.purge')
      for (const c of [infirmier, medecin])
        expect(c.user.permissions).not.toContain('synchronisation.purge')
    })

    it.each([
      ['infirmier', () => infirmier],
      ['médecin chef', () => medecin],
    ])('%s : ni lecture ni vidage, et rien n’est effacé', async (_nom, qui) => {
      const c = qui()
      const lectures = [
        '/sync/supervision/activite/postes',
        `/sync/supervision/postes/${ids.A}/bilan`,
        `/sync/supervision/postes/${ids.A}/conflits`,
      ]
      for (const chemin of lectures)
        expect((await c.get(chemin)).status).toBe(403)
      expect((await c.delete('/sync/supervision/activite')).status).toBe(403)
      expect(
        await base().journalSynchronisation.count({
          where: { posteLocalId: ids.A },
        }),
      ).toBe(3)
    })
  })

  describe('Vider l’historique', () => {
    const derniereTrace = () =>
      base().journalAudit.findFirst({
        where: {
          module: 'synchronisation',
          action: 'PURGE',
          utilisateurId: admin.user.id,
        },
        orderBy: { createdAt: 'desc' },
      })
    let purgeEchanges: Purge

    it('refuse une portée inconnue, sans rien effacer', async () => {
      const r = await admin.delete('/sync/supervision/activite?portee=nimporte')
      expect(r.status).toBe(400)
      expect(
        await base().journalSynchronisation.count({
          where: { posteLocalId: ids.A },
        }),
      ).toBe(3)
    })

    it('par défaut : efface les échanges et les conflits tranchés, GARDE la quarantaine et l’échange qui la porte', async () => {
      // Ce que l'écran annonce avant de vider doit être EXACTEMENT ce qui part.
      const { totaux } = await activite()
      const r = await admin.delete<Purge>('/sync/supervision/activite')
      expect(r.status).toBe(200)
      purgeEchanges = r.body
      expect(purgeEchanges.echanges).toBeGreaterThanOrEqual(4)
      expect(purgeEchanges.conflits).toBeGreaterThanOrEqual(1)
      expect(purgeEchanges.quarantaineConservee).toBeGreaterThanOrEqual(1)
      expect(purgeEchanges).toEqual({
        echanges: totaux.echanges - totaux.echangesAvecRefus,
        conflits: totaux.conflitsAuto,
        quarantaineConservee: totaux.quarantaine,
      })

      const p = await activite()
      // B et D n'ont plus rien : leurs lignes disparaissent. A garde l'échange du refus.
      expect(p.items.map((l) => l.id)).toEqual([ids.A])
      expect(p.items[0]).toMatchObject({ nbEchanges: 1, nbAvecConflits: 1 })

      const conflits = (type: string) =>
        admin.get<PageConflits>(
          `/sync/supervision/postes/${ids.A}/conflits?type=${type}`,
        )
      expect((await conflits('QUARANTAINE')).body.total).toBe(1)
      expect((await conflits('CONFLITS')).body.total).toBe(0)
    })

    it('se trace elle-même : qui, quand, de quelle adresse, et combien', async () => {
      const t = await derniereTrace()
      expect(t).not.toBeNull()
      expect(t!.statut).toBe('SUCCES')
      expect(t!.entiteType).toBe('JournalSynchronisation')
      expect(t!.ipAdresse).toBeTruthy()
      expect(t!.apresJson).toEqual({ portee: 'echanges', ...purgeEchanges })
    })

    it('ne touche pas aux postes eux-mêmes', async () => {
      expect(
        await base().posteLocal.count({
          where: { id: { in: [ids.A, ids.B, ids.C, ids.D] } },
        }),
      ).toBe(4)
      // D reste retiré du parc, A et B restent dans la liste de supervision.
      const sup = await admin.get<{ postes: { id: string }[] }>('/sync/supervision')
      const visibles = sup.body.postes.map((p) => p.id)
      expect(visibles).toEqual(expect.arrayContaining([ids.A, ids.B, ids.C]))
      expect(visibles).not.toContain(ids.D)
    })

    it('« tout » efface aussi la quarantaine', async () => {
      const r = await admin.delete<Purge>('/sync/supervision/activite?portee=tout')
      expect(r.status).toBe(200)
      expect(r.body.quarantaineConservee).toBe(0)

      const p = await activite()
      expect(p.items).toEqual([])
      expect(p.totaux).toEqual({
        echanges: 0,
        quarantaine: 0,
        conflitsAuto: 0,
        echangesAvecRefus: 0,
      })
      const conflits = await admin.get<PageConflits>(
        `/sync/supervision/postes/${ids.A}/conflits`,
      )
      expect(conflits.body.total).toBe(0)

      const t = await derniereTrace()
      expect(t!.apresJson).toEqual({ portee: 'tout', ...r.body })
    })

    it('vider un historique déjà vide ne casse rien', async () => {
      const r = await admin.delete<Purge>('/sync/supervision/activite')
      expect(r.status).toBe(200)
      expect(r.body).toEqual({ echanges: 0, conflits: 0, quarantaineConservee: 0 })
    })
  })
})
