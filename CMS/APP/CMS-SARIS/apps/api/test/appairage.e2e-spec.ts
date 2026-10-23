/**
 * Appairage d'un poste de bureau avec un CODE (au lieu d'un compte) — le serveur central réel.
 *
 * Ce que ce test prouve :
 *  - un administrateur prépare un code ; il n'est montré qu'une fois, et la base n'en garde que l'empreinte ;
 *  - un poste le présente, reçoit son secret, l'échange contre un jeton, et ce jeton ne donne accès QU'À la
 *    synchronisation : partout ailleurs (patients, comptes, supervision, flux des notifications) il est refusé ;
 *  - il ne vaut que pour SON poste ; la suspension d'un poste, elle, s'applique toujours ;
 *  - un code est limité (nombre de postes, durée, annulation), ne se devine pas (refus identique pour toute cause, essais
 *    limités par origine) et deux postes simultanés ne dépassent pas le maximum ;
 *  - réinstaller un poste ne consomme pas un second usage, et remplace son secret (l'ancien jeton cesse de valoir) ;
 *  - couper l'accès d'un poste coupe aussi son jeton déjà émis.
 */
import type { NestExpressApplication } from '@nestjs/platform-express'
import { baseDe, demarrerApp } from './support/app-test'
import { appelAnonyme, COMPTES, connecter, type Client } from './support/client'

interface CodeCree {
  id: string
  code: string
  siteId: string
  usagesMax: number
  expireAt: string
}
interface Appairage {
  posteSecret: string
  posteLocalId: string
  siteId: string
  libelle: string
}

describe('Appairage des postes', () => {
  let app: NestExpressApplication
  let admin: Client
  let infirmier: Client
  let siteId: string
  const s = `${Date.now() % 100_000}`
  const poste = (n: number | string) => `poste-app-${s}-${n}`
  const codesCrees: string[] = []

  const base = () => baseDe(app)
  const appairer = (code: string, posteLocalId: string, libelle?: string) =>
    appelAnonyme(app, 'post', '/sync/appairage', {}, { code, posteLocalId, libelle })
  const jeton = (posteLocalId: string, secret: string) =>
    appelAnonyme(app, 'post', '/sync/appairage/jeton', {}, { posteLocalId, secret })
  const avecJeton = (jetonPoste: string, methode: 'get' | 'post' | 'delete', chemin: string, corps?: object) =>
    appelAnonyme(app, methode, chemin, { Authorization: `Bearer ${jetonPoste}` }, corps)
  const creerCode = async (corps: object = {}) => {
    const r = await admin.post<CodeCree>('/sync/appairage/codes', { siteId, ...corps })
    expect(r.status).toBe(201)
    codesCrees.push(r.body.id)
    return r.body
  }
  /** Un poste complet : appairé, avec un jeton d'accès. */
  async function posteAppaire(code: string, id: string) {
    const a = await appairer(code, id, `Poste ${id.slice(-4)}`)
    expect(a.status).toBe(200)
    const corps = a.body as Appairage
    const j = await jeton(id, corps.posteSecret)
    expect(j.status).toBe(200)
    return { secret: corps.posteSecret, jeton: (j.body as { accessToken: string }).accessToken }
  }

  beforeAll(async () => {
    app = await demarrerApp()
    admin = await connecter(app, COMPTES.admin)
    infirmier = await connecter(app, COMPTES.infirmier)
    siteId = admin.user.siteId as string
  })

  afterAll(async () => {
    // Suites à base PARTAGÉE : on retire ses traces — et on ferme l'application MÊME si un nettoyage échoue
    // (sinon le processus de test ne se termine pas).
    try {
      const postes = { startsWith: `poste-app-${s}` }
      await base().journalAudit.deleteMany({ where: { action: { startsWith: 'APPAIRAGE_' } } })
      await base().conflitSynchronisation.deleteMany({ where: { journal: { posteLocalId: postes } } })
      await base().journalSynchronisation.deleteMany({ where: { posteLocalId: postes } })
      await base().syncState.deleteMany({ where: { posteLocalId: postes } })
      await base().posteLocal.deleteMany({ where: { id: postes } })
      await base().codeAppairage.deleteMany({ where: { id: { in: codesCrees } } })
    } finally {
      await app.close()
    }
  })

  describe('Les codes', () => {
    it('un administrateur crée un code, montré une seule fois ; la base n’en garde que l’empreinte', async () => {
      const c = await creerCode({ note: 'essai' })
      expect(c.code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
      expect(c.usagesMax).toBe(1)
      const ligne = await base().codeAppairage.findUniqueOrThrow({ where: { id: c.id } })
      expect(ligne.codeHash).not.toContain(c.code.replace('-', ''))
      expect(JSON.stringify(ligne)).not.toContain(c.code.replace('-', ''))
      // La liste ne le ré-affiche jamais.
      const liste = await admin.get<{ id: string; etat: string; code?: string }[]>('/sync/appairage/codes')
      expect(liste.status).toBe(200)
      const vu = liste.body.find((x) => x.id === c.id)
      expect(vu?.etat).toBe('ACTIF')
      expect(JSON.stringify(liste.body)).not.toContain(c.code.replace('-', ''))
    })

    it('un infirmier ne peut ni créer ni annuler un code', async () => {
      expect((await infirmier.post('/sync/appairage/codes', { siteId })).status).toBe(403)
      expect((await infirmier.delete('/sync/appairage/codes/x')).status).toBe(403)
    })

    it('refuse un site inexistant et des valeurs hors limites', async () => {
      expect((await admin.post('/sync/appairage/codes', { siteId: 'site-inconnu' })).status).toBe(404)
      expect((await admin.post('/sync/appairage/codes', { siteId, usagesMax: 0 })).status).toBe(400)
      expect((await admin.post('/sync/appairage/codes', { siteId, usagesMax: 500 })).status).toBe(400)
      expect((await admin.post('/sync/appairage/codes', { siteId, validiteHeures: 1000 })).status).toBe(400)
    })
  })

  describe('Appairer un poste et obtenir un jeton', () => {
    it('le poste reçoit son site, son nom et son secret ; la base garde l’empreinte du secret', async () => {
      const c = await creerCode()
      const a = await appairer(c.code, poste(1), 'Accueil essai')
      expect(a.status).toBe(200)
      const corps = a.body as Appairage
      expect(corps.siteId).toBe(siteId)
      expect(corps.libelle).toBe('Accueil essai')
      expect(corps.posteSecret.length).toBeGreaterThanOrEqual(40)
      const p = await base().posteLocal.findUniqueOrThrow({ where: { id: poste(1) } })
      expect(p.siteId).toBe(siteId)
      expect(p.secretHash).toBeTruthy()
      expect(p.secretHash).not.toContain(corps.posteSecret)
      expect(p.appaireCodeId).toBe(c.id)
    })

    it('le code se saisit comme on le lit : minuscules, espaces et tirets sont acceptés', async () => {
      const c = await creerCode()
      const saisie = c.code.toLowerCase().replace('-', '  ')
      expect((await appairer(saisie, poste(2))).status).toBe(200)
    })

    it('le secret s’échange contre un jeton ; un mauvais secret est refusé', async () => {
      const c = await creerCode()
      const a = (await appairer(c.code, poste(3))).body as Appairage
      const bon = await jeton(poste(3), a.posteSecret)
      expect(bon.status).toBe(200)
      expect((bon.body as { accessToken: string }).accessToken).toBeTruthy()
      expect((bon.body as { siteId: string }).siteId).toBe(siteId)
      expect((await jeton(poste(3), 'pas-le-bon-secret')).status).toBe(401)
      expect((await jeton('poste-inconnu', a.posteSecret)).status).toBe(401)
    })

    it('un nom de poste déjà pris sur le site reçoit un numéro, sans faire échouer l’installation', async () => {
      const c = await creerCode({ usagesMax: 2 })
      const premier = (await appairer(c.code, poste(4), 'Salle X')).body as Appairage
      const second = (await appairer(c.code, poste(5), 'Salle X')).body as Appairage
      expect(premier.libelle).toBe('Salle X')
      expect(second.libelle).toBe('Salle X (2)')
    })
  })

  describe('Ce que le jeton d’un poste permet… et ne permet pas', () => {
    let p: { secret: string; jeton: string }
    const id = () => poste('jeton')
    beforeAll(async () => {
      p = await posteAppaire((await creerCode()).code, id())
    })

    it('donne accès à la synchronisation : pull, push, battement de vie', async () => {
      expect((await avecJeton(p.jeton, 'get', `/sync/pull?posteLocalId=${id()}&limit=5`)).status).toBe(200)
      expect((await avecJeton(p.jeton, 'post', '/sync/push', { posteLocalId: id(), changes: [] })).status).toBeLessThan(300)
      const hb = await avecJeton(p.jeton, 'post', '/sync/heartbeat', { posteLocalId: id(), libelle: 'x' })
      expect(hb.status).toBeLessThan(300)
      expect((hb.body as { ok?: boolean }).ok).toBe(true)
    })

    it('ne donne accès à RIEN d’autre : données de santé, comptes, supervision, appairage, flux des notifications', async () => {
      for (const chemin of ['/patients', '/admin/utilisateurs', '/me/profil', '/auth/me', '/sync/supervision', '/sync/appairage/codes', '/referentiels/sites']) {
        const r = await avecJeton(p.jeton, 'get', chemin)
        expect({ chemin, status: r.status }).toEqual({ chemin, status: 403 })
      }
      expect((await avecJeton(p.jeton, 'post', '/sync/appairage/codes', { siteId })).status).toBe(403)
      expect((await avecJeton(p.jeton, 'delete', `/sync/appairage/postes/${id()}`)).status).toBe(403)
      expect((await appelAnonyme(app, 'get', `/notifications/stream?token=${p.jeton}`)).status).toBe(401)
    })

    it('ne vaut que pour SON poste : ni pull, ni push, ni battement au nom d’un autre', async () => {
      expect((await avecJeton(p.jeton, 'get', `/sync/pull?posteLocalId=${poste('autre')}`)).status).toBe(403)
      expect((await avecJeton(p.jeton, 'post', '/sync/push', { posteLocalId: poste('autre'), changes: [] })).status).toBe(403)
      expect((await avecJeton(p.jeton, 'post', '/sync/heartbeat', { posteLocalId: poste('autre') })).status).toBe(403)
    })

    it('le poste peut accuser une resynchronisation ou un vidage, mais seulement pour LUI', async () => {
      const demande = { demandeeAt: new Date().toISOString() }
      for (const route of ['resync-terminee', 'vidage-termine']) {
        const sien = await avecJeton(p.jeton, 'post', `/sync/poste/${id()}/${route}`, demande)
        expect({ route, refuse: sien.status === 401 || sien.status === 403 }).toEqual({ route, refuse: false })
        const autre = await avecJeton(p.jeton, 'post', `/sync/poste/${poste('autre')}/${route}`, demande)
        expect({ route, status: autre.status }).toEqual({ route, status: 403 })
      }
    })

    it('le jeton d’un poste ne remplace jamais « le dernier utilisateur » de la supervision', async () => {
      await base().posteLocal.update({ where: { id: id() }, data: { dernierUtilisateurId: admin.user.id } })
      expect((await avecJeton(p.jeton, 'post', '/sync/push', { posteLocalId: id(), changes: [] })).status).toBeLessThan(300)
      const ligne = await base().posteLocal.findUniqueOrThrow({ where: { id: id() } })
      expect(ligne.dernierUtilisateurId).toBe(admin.user.id)
    })

    it('un poste SUSPENDU reste suspendu, même avec un jeton valide (423)', async () => {
      expect((await admin.post(`/sync/supervision/postes/${id()}/suspension`, { motif: 'essai' })).status).toBeLessThan(300)
      const r = await avecJeton(p.jeton, 'post', '/sync/push', { posteLocalId: id(), changes: [] })
      expect(r.status).toBe(423)
      expect((r.body as { code?: string }).code).toBe('POSTE_SUSPENDU')
      await admin.delete(`/sync/supervision/postes/${id()}/suspension`)
    })

    it('un compte de personne n’est pas touché : il garde son accès habituel', async () => {
      expect((await admin.get('/sync/pull?limit=1')).status).toBe(200)
    })
  })

  describe('Limites d’un code', () => {
    it('un code à usage unique ne sert qu’à un poste ; le refus ne dit pas pourquoi', async () => {
      const c = await creerCode()
      expect((await appairer(c.code, poste('u1'))).status).toBe(200)
      const refus = await appairer(c.code, poste('u2'))
      expect(refus.status).toBe(403)
      const faux = await appairer('AAAA-BBBB', poste('u3'))
      expect(faux.status).toBe(403)
      expect((refus.body as { message: string }).message).toBe((faux.body as { message: string }).message)
    })

    it('un lot de N postes en appaire N, jamais N+1', async () => {
      const c = await creerCode({ usagesMax: 2 })
      expect((await appairer(c.code, poste('l1'))).status).toBe(200)
      expect((await appairer(c.code, poste('l2'))).status).toBe(200)
      expect((await appairer(c.code, poste('l3'))).status).toBe(403)
      const liste = await admin.get<{ id: string; usagesFaits: number; etat: string; postes: unknown[] }[]>('/sync/appairage/codes')
      const vu = liste.body.find((x) => x.id === c.id)
      expect(vu?.usagesFaits).toBe(2)
      expect(vu?.etat).toBe('EPUISE')
      expect(vu?.postes).toHaveLength(2)
    })

    it('deux postes simultanés ne dépassent pas le maximum (une seule place restante)', async () => {
      const c = await creerCode({ usagesMax: 1 })
      const [a, b, d] = await Promise.all([
        appairer(c.code, poste('c1')),
        appairer(c.code, poste('c2')),
        appairer(c.code, poste('c3')),
      ])
      const reussis = [a, b, d].filter((r) => r.status === 200)
      expect(reussis).toHaveLength(1)
      expect((await base().codeAppairage.findUniqueOrThrow({ where: { id: c.id } })).usagesFaits).toBe(1)
    })

    it('un code expiré ou annulé ne sert plus', async () => {
      const expire = await creerCode()
      await base().codeAppairage.update({ where: { id: expire.id }, data: { expireAt: new Date(Date.now() - 60_000) } })
      expect((await appairer(expire.code, poste('e1'))).status).toBe(403)

      const annule = await creerCode()
      expect((await admin.delete(`/sync/appairage/codes/${annule.id}`)).status).toBe(204)
      expect((await appairer(annule.code, poste('e2'))).status).toBe(403)
      const liste = await admin.get<{ id: string; etat: string }[]>('/sync/appairage/codes')
      expect(liste.body.find((x) => x.id === annule.id)?.etat).toBe('ANNULE')
      expect(liste.body.find((x) => x.id === expire.id)?.etat).toBe('EXPIRE')
    })

    it('réinstaller un poste déjà appairé ne consomme pas un second usage, et remplace son secret', async () => {
      const c = await creerCode()
      const premier = await posteAppaire(c.code, poste('r1'))
      // Le code est épuisé (1/1) mais le MÊME poste peut le présenter de nouveau (réinstallation).
      const encore = await appairer(c.code, poste('r1'))
      expect(encore.status).toBe(200)
      expect((await base().codeAppairage.findUniqueOrThrow({ where: { id: c.id } })).usagesFaits).toBe(1)
      const nouveauSecret = (encore.body as Appairage).posteSecret
      expect(nouveauSecret).not.toBe(premier.secret)
      // L'ancien secret et l'ancien jeton ne valent plus ; le nouveau fonctionne.
      expect((await jeton(poste('r1'), premier.secret)).status).toBe(401)
      expect((await avecJeton(premier.jeton, 'get', '/sync/pull?limit=1')).status).toBe(401)
      const j = await jeton(poste('r1'), nouveauSecret)
      expect(j.status).toBe(200)
      expect((await avecJeton((j.body as { accessToken: string }).accessToken, 'get', '/sync/pull?limit=1')).status).toBe(200)
    })
  })

  describe('Couper l’accès d’un poste', () => {
    it('révoquer coupe aussi le jeton déjà émis ; un nouvel appairage rétablit l’accès', async () => {
      const p = await posteAppaire((await creerCode()).code, poste('rev'))
      expect((await avecJeton(p.jeton, 'get', '/sync/pull?limit=1')).status).toBe(200)

      expect((await infirmier.delete(`/sync/appairage/postes/${poste('rev')}`)).status).toBe(403)
      expect((await admin.delete(`/sync/appairage/postes/${poste('rev')}`)).status).toBe(204)
      expect((await avecJeton(p.jeton, 'get', '/sync/pull?limit=1')).status).toBe(401)
      expect((await jeton(poste('rev'), p.secret)).status).toBe(401)
      const ligne = await base().posteLocal.findUniqueOrThrow({ where: { id: poste('rev') } })
      expect(ligne.secretHash).toBeNull()
      expect(ligne.accesRevoqueAt).not.toBeNull()

      const retabli = await posteAppaire((await creerCode()).code, poste('rev'))
      expect((await avecJeton(retabli.jeton, 'get', '/sync/pull?limit=1')).status).toBe(200)
      expect((await base().posteLocal.findUniqueOrThrow({ where: { id: poste('rev') } })).accesRevoqueAt).toBeNull()
    })

    it('la supervision dit quels postes sont appairés et lesquels ont l’accès coupé', async () => {
      const r = await admin.get<{ postes: { id: string; appaireAt: string | null; accesRevoqueAt: string | null }[] }>('/sync/supervision')
      expect(r.status).toBe(200)
      const jeton1 = r.body.postes.find((x) => x.id === poste('jeton'))
      expect(jeton1?.appaireAt).toBeTruthy()
    })
  })

  describe('Les gestes sont tracés, sans jamais écrire le code ni le secret', () => {
    it('création, appairage et révocation figurent au journal d’audit', async () => {
      const actions = new Set(
        (await base().journalAudit.findMany({ where: { action: { startsWith: 'APPAIRAGE_' } }, select: { action: true } })).map((l) => l.action),
      )
      expect(actions.has('APPAIRAGE_CODE_CREE')).toBe(true)
      expect(actions.has('APPAIRAGE_POSTE')).toBe(true)
      expect(actions.has('APPAIRAGE_ACCES_REVOQUE')).toBe(true)
      expect(actions.has('APPAIRAGE_CODE_ANNULE')).toBe(true)
      const tout = JSON.stringify(await base().journalAudit.findMany({ where: { action: { startsWith: 'APPAIRAGE_' } } }))
      const codes = await base().codeAppairage.findMany({ select: { codeHash: true } })
      for (const c of codes) expect(tout).not.toContain(c.codeHash) // même l'empreinte n'y figure pas
    })
  })

  describe('Les essais de code sont limités', () => {
    it('au-delà de quelques refus depuis une même origine, le serveur répond 429', async () => {
      let derniere = 0
      for (let i = 0; i < 25; i++) {
        derniere = (await appairer('ZZZZ-ZZZZ', poste(`b${i}`))).status
        if (derniere === 429) break
      }
      expect(derniere).toBe(429)
      // Même un code valide est refusé pendant le blocage : l'origine n'a plus aucun essai.
      expect((await appairer((await creerCode()).code, poste('bloque'))).status).toBe(429)
    })
  })
})
