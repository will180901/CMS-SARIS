/**
 * Les journaux d'audit PAR PAGES (`GET /admin/audit/actions` et `/authentifications`) — par les vraies
 * routes et la vraie base de test :
 *  - `limit` lignes par page, de la plus récente à la plus ancienne, `page` à partir de 1 ; `total` =
 *    ce qui correspond aux filtres (il numérote les pages) ; `page` et `limit` rendus ;
 *  - les pages mises bout à bout redonnent le journal entier, sans doublon ni trou, même quand des lignes
 *    du même instant tombent de part et d'autre d'une coupure ;
 *  - sans `page`, la requête se comporte comme avant (les `limit` plus récentes : tiroir d'un compte,
 *    tableau de bord) ;
 *  - les filtres (compte, module, résultat, période) et la recherche par mots (casse ignorée) se font côté
 *    serveur, sur TOUT le journal ;
 *  - `GET /admin/audit/utilisateurs` : les comptes qui figurent au journal (filtre « Utilisateur »), pour
 *    qui détient `audit.read` sans `utilisateur.read`.
 */
import { randomUUID } from 'node:crypto'
import { variantes } from '../src/common/prisma/search'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { baseDe, demarrerApp } from './support/app-test'
import { appelAnonyme, COMPTES, connecter, type Client } from './support/client'
import { referentiels, type Referentiels } from './support/donnees'

interface LigneAction {
  id: string
  action: string
  module: string
  utilisateur: { id: string; login: string; email: string } | null
}
interface LigneAuth {
  id: string
  login: string
  resultat: string
  ipAdresse: string | null
  utilisateur: { id: string } | null
  localisation?: unknown
  connexion?: unknown
  poste?: unknown
}
interface Page<L> {
  data: L[]
  total: number
  page: number
  limit: number
}
interface Refus {
  statusCode: number
  message: string | string[]
}

describe('Journaux d’audit par pages', () => {
  let app: NestExpressApplication
  let admin: Client
  let medecin: Client
  let infirmier: Client
  let ref: Referentiels
  const base = () => baseDe(app)

  // Un jeton de LETTRES propre à ce passage : la base de test est partagée avec d'autres fichiers.
  const lettres = `${Date.now() % 100_000}`
    .split('')
    .map((c) => 'abcdefghij'[Number(c)])
    .join('')
  const moduleTest = `mod${lettres}`
  const entiteTest = `Ent${lettres}`
  const loginAuth = `auth${lettres}`

  /** Identifiants sans ponctuation (l'ordre ne dépend d'aucune collation) : ex. « abcde07 ». */
  const idAction = (i: number) => `${lettres}a${String(i).padStart(2, '0')}`
  const idAuth = (i: number) => `${lettres}h${String(i).padStart(2, '0')}`

  let idAdmin: string
  let idMedecin: string
  const comptesCrees: string[] = []
  const idsActions: string[] = []
  const idsAuth: string[] = []

  /**
   * 12 actions : 3 JOURS × 4 lignes ; dans chaque jour, 2 instants de 2 lignes IDENTIQUES (égalités à
   * départager). Écrites dans l'ordre CROISSANT des identifiants, donc l'inverse de l'ordre attendu :
   * sans départage par identifiant, la base les rendrait dans l'ordre d'écriture — le test le voit.
   */
  const dateAction = (i: number) => {
    const jour = Math.floor(i / 4) // 0, 1, 2 → 10, 11, 12 janvier
    const instant = Math.floor((i % 4) / 2) // 2 instants par jour
    return new Date(2026, 0, 10 + jour, 12, 0, instant)
  }
  const attenduActions = () =>
    [...Array(12).keys()]
      .map((i) => ({ id: idAction(i), t: dateAction(i).getTime() }))
      .sort((a, b) => b.t - a.t || (a.id < b.id ? 1 : -1))
      .map((x) => x.id)

  /** 9 authentifications, mêmes égalités, une IP et un résultat par ligne. */
  const dateAuth = (i: number) => new Date(2026, 0, 10 + Math.floor(i / 3), 9, 0, Math.floor((i % 3) / 2))
  const RESULTATS = ['SUCCES_LOGIN', 'ECHEC_MOT_DE_PASSE', 'SUCCES_LOGOUT']
  const attenduAuth = () =>
    [...Array(9).keys()]
      .map((i) => ({ id: idAuth(i), t: dateAuth(i).getTime() }))
      .sort((a, b) => b.t - a.t || (a.id < b.id ? 1 : -1))
      .map((x) => x.id)

  const actions = (qs: string) => admin.get<Page<LigneAction> & Refus>(`/admin/audit/actions?${qs}`)
  const auths = (qs: string) => admin.get<Page<LigneAuth> & Refus>(`/admin/audit/authentifications?${qs}`)
  const ids = <L extends { id: string }>(p: { data: L[] }) => p.data.map((l) => l.id)

  async function toutParcourir<L extends { id: string }>(
    route: (qs: string) => Promise<{ status: number; body: Page<L> & Refus }>,
    filtres: string,
    limit: number,
  ) {
    const recus: string[] = []
    let page = 1
    let total: number | null = null
    for (;;) {
      const r = await route(`${filtres}&page=${page}&limit=${limit}`)
      expect(r.status).toBe(200)
      expect(r.body.page).toBe(page)
      expect(r.body.limit).toBe(limit)
      if (total === null) total = r.body.total
      else expect(r.body.total).toBe(total)
      if (r.body.data.length === 0) break
      expect(r.body.data.length).toBeLessThanOrEqual(limit)
      recus.push(...ids(r.body))
      page += 1
      expect(page).toBeLessThan(40) // garde-fou
    }
    return { recus, total }
  }

  beforeAll(async () => {
    app = await demarrerApp()
    admin = await connecter(app, COMPTES.admin)
    medecin = await connecter(app, COMPTES.medecinChef)
    infirmier = await connecter(app, COMPTES.infirmier)
    ref = await referentiels(admin)
    const raw = base().raw
    idAdmin = (await raw.utilisateur.findFirstOrThrow({ where: { login: COMPTES.admin.login }, select: { id: true } })).id
    idMedecin = (await raw.utilisateur.findFirstOrThrow({ where: { login: COMPTES.medecinChef.login }, select: { id: true } })).id

    for (let i = 0; i < 12; i++) {
      idsActions.push(idAction(i))
      await raw.journalAudit.create({
        data: {
          id: idAction(i),
          utilisateurId: i % 2 === 0 ? idAdmin : idMedecin,
          action: i % 2 === 0 ? 'CREATE' : 'UPDATE',
          module: moduleTest,
          entiteType: entiteTest,
          entiteId: `eid-${lettres}-${i}`,
          statut: 'SUCCES',
          createdAt: dateAction(i),
        },
      })
    }
    for (let i = 0; i < 9; i++) {
      idsAuth.push(idAuth(i))
      await raw.journalAuthentification.create({
        data: {
          id: idAuth(i),
          utilisateurId: i % 3 === 0 ? idAdmin : null,
          login: loginAuth,
          resultat: RESULTATS[i % 3]!,
          ipAdresse: `10.${i}.0.${i + 1}`,
          createdAt: dateAuth(i),
        },
      })
    }
  })

  afterAll(async () => {
    const raw = base().raw
    await raw.journalAudit.deleteMany({ where: { id: { in: idsActions } } })
    await raw.journalAuthentification.deleteMany({ where: { id: { in: idsAuth } } })
    await raw.journalAudit.deleteMany({ where: { utilisateurId: { in: comptesCrees } } })
    await raw.journalAuthentification.deleteMany({ where: { utilisateurId: { in: comptesCrees } } })
    await raw.utilisateur.deleteMany({ where: { id: { in: comptesCrees } } })
    await app.close()
  })

  describe('Les pages (actions)', () => {
    it('chaque page respecte la limite ; le total est celui des filtres ; page et limite sont rendues', async () => {
      const p1 = await actions(`module=${moduleTest}&page=1&limit=5`)
      expect(p1.status).toBe(200)
      expect(p1.body).toMatchObject({ total: 12, page: 1, limit: 5 })
      expect(p1.body.data).toHaveLength(5)
      const p2 = await actions(`module=${moduleTest}&page=2&limit=5`)
      expect(p2.body.data).toHaveLength(5)
      expect(p2.body.total).toBe(12)
      const p3 = await actions(`module=${moduleTest}&page=3&limit=5`)
      expect(p3.body.data).toHaveLength(2)
    })

    it('une page au-delà de la dernière est vide (le total, lui, reste juste)', async () => {
      const r = await actions(`module=${moduleTest}&page=9&limit=5`)
      expect(r.status).toBe(200)
      expect(r.body.data).toEqual([])
      expect(r.body.total).toBe(12)
      expect(r.body.page).toBe(9)
    })

    it('les pages mises bout à bout redonnent le journal entier, dans l’ordre, sans doublon ni trou — quelle que soit la taille', async () => {
      const attendu = attenduActions()
      for (const limit of [1, 2, 3, 5, 7, 12, 50]) {
        const { recus, total } = await toutParcourir(actions, `module=${moduleTest}`, limit)
        expect(total).toBe(12)
        expect(recus).toEqual(attendu)
      }
    })

    it('des lignes du MÊME instant, de part et d’autre d’une coupure, ne sont ni perdues ni répétées', async () => {
      // Les instants se répètent par paires : la limite de 3 coupe au milieu d'une paire.
      const { recus } = await toutParcourir(actions, `module=${moduleTest}`, 3)
      expect(new Set(recus).size).toBe(12)
      const p2 = await actions(`module=${moduleTest}&page=2&limit=3`)
      const p1 = await actions(`module=${moduleTest}&page=1&limit=3`)
      expect(ids(p1.body).concat(ids(p2.body))).toEqual(attenduActions().slice(0, 6))
    })

    it('sans « page » : comme avant, les `limit` plus récentes (tiroir d’un compte, tableau de bord)', async () => {
      const r = await actions(`module=${moduleTest}&limit=4`)
      expect(r.status).toBe(200)
      expect(ids(r.body)).toEqual(attenduActions().slice(0, 4))
      expect(r.body).toMatchObject({ total: 12, page: 1, limit: 4 })
    })

    it('sans « limit » : 100 par défaut, tout tient', async () => {
      const r = await actions(`module=${moduleTest}`)
      expect(r.body.limit).toBe(100)
      expect(r.body.data).toHaveLength(12)
    })

    it('la taille de page est ramenée entre 1 et 500', async () => {
      expect((await actions(`module=${moduleTest}&limit=0`)).body.limit).toBe(1)
      expect((await actions(`module=${moduleTest}&limit=-5`)).body.limit).toBe(1)
      expect((await actions(`module=${moduleTest}&limit=9999`)).body.limit).toBe(500)
      expect((await actions(`module=${moduleTest}&limit=2.7`)).body.limit).toBe(2)
    })

    it('un numéro de page illisible est refusé (400), pas corrigé en silence', async () => {
      for (const page of ['0', '-1', 'abc', '1.5', '1e3', '100001', ' 2']) {
        const r = await actions(`module=${moduleTest}&page=${encodeURIComponent(page)}`)
        expect(r.status).toBe(400)
      }
      for (const page of ['0', '-1', 'abc', '100001']) {
        const r = await auths(`search=${loginAuth}&page=${page}`)
        expect(r.status).toBe(400)
      }
    })

    it('un « page » vide est ignoré (page 1)', async () => {
      const r = await actions(`module=${moduleTest}&page=&limit=5`)
      expect(r.status).toBe(200)
      expect(r.body.page).toBe(1)
    })

    it('chaque ligne porte le compte (identifiant, login, courriel)', async () => {
      const r = await actions(`module=${moduleTest}&limit=12`)
      for (const l of r.body.data) {
        expect(l.utilisateur).toMatchObject({ id: expect.any(String), login: expect.any(String), email: expect.any(String) })
      }
    })
  })

  describe('Les filtres, faits par le serveur', () => {
    it('compte : le total et les pages ne portent que sur ses lignes', async () => {
      const r = await actions(`module=${moduleTest}&utilisateurId=${idAdmin}&limit=4&page=1`)
      expect(r.body.total).toBe(6)
      expect(r.body.data.every((l) => l.utilisateur?.id === idAdmin)).toBe(true)
      const { recus } = await toutParcourir(actions, `module=${moduleTest}&utilisateurId=${idMedecin}`, 4)
      expect(recus).toHaveLength(6)
    })

    it('module : un autre module ne trouve rien', async () => {
      const r = await actions(`module=autre${lettres}&limit=5`)
      expect(r.body).toMatchObject({ total: 0, data: [] })
    })

    it('période : la borne « au » inclut TOUTE la journée, et chaque jour a ses 4 lignes', async () => {
      const unJour = await actions(`module=${moduleTest}&dateMin=2026-01-11&dateMax=2026-01-11&limit=10`)
      expect(unJour.body.total).toBe(4)
      expect(ids(unJour.body).every((id) => [4, 5, 6, 7].map(idAction).includes(id))).toBe(true)
      const deuxJours = await actions(`module=${moduleTest}&dateMin=2026-01-11&dateMax=2026-01-12&limit=3&page=2`)
      expect(deuxJours.body.total).toBe(8)
      expect(deuxJours.body.data).toHaveLength(3)
    })

    it('le total ne dépend pas de la page demandée', async () => {
      const totaux = new Set<number>()
      for (const page of [1, 2, 3, 6]) totaux.add((await actions(`module=${moduleTest}&limit=2&page=${page}`)).body.total)
      expect([...totaux]).toEqual([12])
    })
  })

  describe('La recherche, faite par le serveur sur tout le journal', () => {
    const cherche = (mots: string) =>
      actions(`module=${moduleTest}&search=${encodeURIComponent(mots)}&limit=20`)

    it('par code d’action, casse ignorée', async () => {
      const r = await cherche('creat')
      expect(r.body.total).toBe(6)
      expect(r.body.data.every((l) => l.action === 'CREATE')).toBe(true)
      expect((await cherche('CrEaTe')).body.total).toBe(6)
      expect((await cherche('update')).body.total).toBe(6)
    })

    it('par type d’entité et par identifiant d’entité', async () => {
      expect((await cherche(entiteTest.toLowerCase())).body.total).toBe(12)
      const r = await cherche(`eid-${lettres}-7`)
      expect(r.body.total).toBe(1)
      expect(r.body.data[0]!.id).toBe(idAction(7))
    })

    it('par login du compte', async () => {
      const r = await cherche(COMPTES.admin.login)
      expect(r.body.total).toBe(6)
      expect(r.body.data.every((l) => l.utilisateur?.id === idAdmin)).toBe(true)
    })

    it('par module', async () => {
      expect((await cherche(moduleTest.toUpperCase())).body.total).toBe(12)
    })

    it('plusieurs mots : chacun doit se retrouver (dans n’importe quel champ), dans n’importe quel ordre', async () => {
      const ab = await cherche(`create ${COMPTES.admin.login}`)
      const ba = await cherche(`${COMPTES.admin.login} create`)
      expect(ab.body.total).toBe(6) // CREATE ET admin : les 6 lignes paires
      expect(new Set(ids(ab.body))).toEqual(new Set(ids(ba.body)))
      expect((await cherche(`update ${COMPTES.admin.login}`)).body.total).toBe(0) // UPDATE n'est jamais de l'admin
    })

    it('un mot absent : aucun résultat, total à 0', async () => {
      const r = await cherche('zzzabsent')
      expect(r.body).toMatchObject({ total: 0, data: [] })
    })

    it('une saisie vide ou faite d’espaces ne filtre rien', async () => {
      expect((await cherche('')).body.total).toBe(12)
      expect((await cherche('   ')).body.total).toBe(12)
    })

    it('la recherche se pagine : le total est celui des résultats, les pages les redonnent tous', async () => {
      const p = await actions(`module=${moduleTest}&search=update&limit=4&page=2`)
      expect(p.body.total).toBe(6)
      expect(p.body.data).toHaveLength(2)
      const { recus } = await toutParcourir(
        actions,
        `module=${moduleTest}&search=update`,
        4,
      )
      expect(recus).toHaveLength(6)
      expect(new Set(recus).size).toBe(6)
    })

    it('la recherche se combine aux filtres', async () => {
      const r = await actions(`module=${moduleTest}&utilisateurId=${idMedecin}&search=creat`)
      expect(r.body.total).toBe(0) // les CREATE sont tous de l'admin
    })

    it('la saisie est bornée à 400 caractères (ce qui dépasse est ignoré, comme une saisie qu’on aurait coupée)', async () => {
      // Le premier mot trouve une ligne ; le second, au-delà du 400e caractère, ne trouverait rien.
      const longue = `eid-${lettres}-7${' '.repeat(420)}zzzabsent`
      const r = await cherche(longue)
      expect(r.status).toBe(200)
      expect(r.body.total).toBe(1)
      // Le même second mot, placé dans les 400 premiers caractères, élimine bien la ligne.
      expect((await cherche(`eid-${lettres}-7 zzzabsent`)).body.total).toBe(0)
    })

    it('variantes d’un mot : « création|=CREATE » trouve ce que trouve l’un OU l’autre (le client y met les codes du libellé tapé)', async () => {
      // « création » n'est dans aucun code : seul le code ajouté par le client trouve les lignes.
      expect((await cherche('création')).body.total).toBe(0)
      const r = await cherche('création|=CREATE')
      expect(r.body.total).toBe(6)
      expect(r.body.data.every((l) => l.action === 'CREATE')).toBe(true)
      expect((await cherche('zzzabsent|creat')).body.total).toBe(6)
      expect((await cherche('création|=CREATE|update')).body.total).toBe(12)
      expect((await cherche('création|=CREATE|=UPDATE')).body.total).toBe(12)
      // un code EXACT : « creat » n'est pas le code CREATE, « CREATE » l'est (casse comprise)
      expect((await cherche('zzzabsent|=creat')).body.total).toBe(0)
      expect((await cherche('=CREATE')).body.total).toBe(0) // le premier mot est toujours « contient »
      expect((await cherche('zzzabsent|yyyabsent')).body.total).toBe(0)
    })

    it('les variantes d’un mot restent liées par ET avec les autres mots, et se paginent comme le reste', async () => {
      // une ligne ne peut pas être à la fois CREATE et UPDATE
      expect((await cherche('création|=CREATE modification|=UPDATE')).body.total).toBe(0)
      expect((await cherche(`création|=CREATE ${COMPTES.admin.login}`)).body.total).toBe(6)
      const p = await actions(`module=${moduleTest}&search=${encodeURIComponent('création|=CREATE|=UPDATE')}&limit=5&page=3`)
      expect(p.body.total).toBe(12)
      expect(p.body.data).toHaveLength(2)
    })

    it('une saisie élargie par le client dépasse 100 caractères et reste entière (jusqu’à 400)', async () => {
      const remplissage = Array.from({ length: 12 }, (_, i) => `absent${i}xxxx`).join('|') // ≈ 150 caractères
      expect(remplissage.length).toBeGreaterThan(100)
      const r = await cherche(`${remplissage}|=CREATE`)
      expect(r.body.total).toBe(6) // la variante utile est après le 100e caractère
    })

    it('« | » seule se cherche comme un caractère (aucune variante vide : pas de filtre qui exclut tout par erreur)', async () => {
      const r = await cherche('|')
      expect(r.status).toBe(200)
      expect(r.body.total).toBe(0)
      expect((await cherche('||creat|')).body.total).toBe(6)
    })

    it('variantes : le premier mot contient, « = » donne un code exact, espace insécable = espace du code, au plus 25, vides ignorées', () => {
      expect(variantes('création|=CREATE')).toEqual({ contient: ['création'], exacts: ['CREATE'] })
      expect(variantes('a|b|=C|=D e')).toEqual({ contient: ['a', 'b'], exacts: ['C', 'D e'] })
      expect(variantes('Bon\u00a0d\'examen')).toEqual({ contient: ["Bon d'examen"], exacts: [] })
      expect(variantes('bon|=Bon\u00a0d\'examen')).toEqual({ contient: ['bon'], exacts: ["Bon d'examen"] })
      expect(variantes('=X')).toEqual({ contient: ['=X'], exacts: [] }) // le mot tapé n'est jamais « exact »
      expect(variantes('a|b|c|')).toEqual({ contient: ['a', 'b', 'c'], exacts: [] })
      expect(variantes('|=|')).toEqual({ contient: ['|=|'], exacts: [] })
      const tout = variantes(Array.from({ length: 40 }, (_, i) => 'v' + i).join('|'))
      expect(tout.contient).toHaveLength(25)
    })

    it('un caractère spécial de la recherche est un caractère, pas un motif', async () => {
      for (const s of ['%', '_', "'", '"', '\\', '[', '*']) {
        const r = await cherche(s)
        expect(r.status).toBe(200)
        expect(r.body.total).toBeLessThanOrEqual(12)
      }
    })
  })

  describe('Les authentifications', () => {
    it('pages : taille, total, ordre, égalités départagées, aucun doublon', async () => {
      const attendu = attenduAuth()
      for (const limit of [1, 2, 4, 9, 50]) {
        const { recus, total } = await toutParcourir(auths, `search=${loginAuth}`, limit)
        expect(total).toBe(9)
        expect(recus).toEqual(attendu)
      }
      const r = await auths(`search=${loginAuth}&page=3&limit=4`)
      expect(r.body.data).toHaveLength(1)
      expect((await auths(`search=${loginAuth}&page=9&limit=4`)).body.data).toEqual([])
    })

    it('sans « page » : les `limit` plus récentes (tiroir d’un compte)', async () => {
      const r = await auths(`search=${loginAuth}&limit=3`)
      expect(ids(r.body)).toEqual(attenduAuth().slice(0, 3))
      expect(r.body).toMatchObject({ total: 9, page: 1, limit: 3 })
    })

    it('filtres : résultat, compte', async () => {
      const echecs = await auths(`search=${loginAuth}&resultat=ECHEC_MOT_DE_PASSE&limit=10`)
      expect(echecs.body.total).toBe(3)
      expect(echecs.body.data.every((l) => l.resultat === 'ECHEC_MOT_DE_PASSE')).toBe(true)
      const duCompte = await auths(`search=${loginAuth}&utilisateurId=${idAdmin}&limit=10`)
      expect(duCompte.body.total).toBe(3)
      expect(duCompte.body.data.every((l) => l.utilisateur?.id === idAdmin)).toBe(true)
    })

    it('période : une journée, toute la journée', async () => {
      const r = await auths(`search=${loginAuth}&dateMin=2026-01-11&dateMax=2026-01-11&limit=10`)
      expect(r.body.total).toBe(3)
    })

    it('recherche : login, adresse IP, résultat — casse ignorée, plusieurs mots', async () => {
      expect((await auths(`search=${loginAuth.toUpperCase()}`)).body.total).toBe(9)
      const ip = await auths(`search=${encodeURIComponent(`10.4.0.5`)}&limit=10`)
      expect(ip.body.total).toBeGreaterThanOrEqual(1)
      expect(ip.body.data.some((l) => l.id === idAuth(4))).toBe(true)
      const echec = await auths(`search=${loginAuth}%20echec_mot&limit=10`)
      expect(echec.body.total).toBe(3)
      expect((await auths(`search=${loginAuth}%20zzzabsent`)).body.total).toBe(0)
    })

    it('recherche : variantes d’un mot (« échec|=ECHEC_MOT_DE_PASSE ») sur les authentifications', async () => {
      const echec = await auths(`search=${encodeURIComponent(`${loginAuth} échec|=ECHEC_MOT_DE_PASSE`)}&limit=10`)
      expect(echec.body.total).toBe(3)
      expect((await auths(`search=${encodeURIComponent(`${loginAuth} échec`)}&limit=10`)).body.total).toBe(0)
    })

    it('chaque ligne garde la localisation, la durée de connexion et le poste (en lecture)', async () => {
      const r = await auths(`search=${loginAuth}&limit=9`)
      for (const l of r.body.data) {
        expect('localisation' in l).toBe(true)
        expect('connexion' in l).toBe(true)
        expect('poste' in l).toBe(true)
        expect('position' in l).toBe(true)
      }
    })
  })

  describe('Les comptes qui figurent au journal', () => {
    it('rend les comptes qui ont une ligne à l’un OU l’autre journal, triés par login, avec la fiche du personnel', async () => {
      const raw = base().raw
      const siteId = ref.siteId
      const creer = async (login: string) => {
        const id = randomUUID()
        comptesCrees.push(id)
        await raw.utilisateur.create({
          data: { id, login, email: `${login}@test.local`, passwordHash: 'x', siteId },
        })
        return id
      }
      const seulementAuth = await creer(`zz${lettres}auth`)
      const seulementAction = await creer(`zz${lettres}act`)
      const jamais = await creer(`zz${lettres}rien`)
      await raw.journalAuthentification.create({
        data: { utilisateurId: seulementAuth, login: `zz${lettres}auth`, resultat: 'SUCCES_LOGIN' },
      })
      await raw.journalAudit.create({
        data: { utilisateurId: seulementAction, action: 'CREATE', module: moduleTest, statut: 'SUCCES' },
      })

      const r = await admin.get<
        { id: string; login: string; personnelMedical: { nom: string; prenom: string } | null }[]
      >('/admin/audit/utilisateurs')
      expect(r.status).toBe(200)
      const logins = r.body.map((u) => u.login)
      expect(logins).toContain(COMPTES.admin.login)
      expect(logins).toContain(COMPTES.medecinChef.login)
      expect(logins).toContain(`zz${lettres}auth`) // une seule ligne, au journal des connexions
      expect(logins).toContain(`zz${lettres}act`) // une seule ligne, au journal des actions
      expect(r.body.map((u) => u.id)).not.toContain(jamais) // jamais rien fait : rien à filtrer
      expect(logins).toEqual([...logins].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)))
      expect(new Set(r.body.map((u) => u.id)).size).toBe(r.body.length) // pas de doublon
      const med = r.body.find((u) => u.id === idMedecin)!
      expect(med.personnelMedical).toMatchObject({ nom: expect.any(String), prenom: expect.any(String) })
    })

    it('n’est pas servi sans « audit.read » ni sans connexion ; le médecin chef (audit.read seul) le lit', async () => {
      expect((await infirmier.get('/admin/audit/utilisateurs')).status).toBe(403)
      expect((await appelAnonyme(app, 'get', '/admin/audit/utilisateurs')).status).toBe(401)
      expect((await medecin.get('/admin/audit/utilisateurs')).status).toBe(200)
    })
  })

  describe('Les droits', () => {
    it('les deux journaux exigent « audit.read » : l’infirmier est refusé, le médecin chef lit', async () => {
      expect((await infirmier.get(`/admin/audit/actions?module=${moduleTest}`)).status).toBe(403)
      expect((await infirmier.get(`/admin/audit/authentifications?search=${loginAuth}`)).status).toBe(403)
      expect((await medecin.get(`/admin/audit/actions?module=${moduleTest}&limit=2&page=2`)).status).toBe(200)
      expect((await medecin.get(`/admin/audit/authentifications?search=${loginAuth}&limit=2&page=2`)).status).toBe(200)
      expect((await appelAnonyme(app, 'get', `/admin/audit/actions?module=${moduleTest}`)).status).toBe(401)
    })
  })
})
