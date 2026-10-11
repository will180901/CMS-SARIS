/**
 * Contrôle du flux d'un poste, par ses vraies routes :
 *  - SUSPENSION : le serveur refuse (423, `POSTE_SUSPENDU`) ce qu'un poste suspendu envoie —
 *    avant tout traitement, donc rien du lot n'est appliqué —, et ce qu'il demande s'il se
 *    fait connaître ; les autres postes ne sont pas touchés ; la reprise rend tout ;
 *  - ORDRES AU POSTE : ils voyagent dans la réponse du battement de vie, qui annonce aussi la
 *    version et le niveau d'ordres que le poste comprend ;
 *  - RESYNCHRONISATION COMPLÈTE : demandée par l'administrateur, soldée par l'accusé du poste,
 *    refusée pour un poste ancien (elle resterait sans fin « en attente ») ;
 *  - tout cela est réservé au pilotage de la synchronisation et laisse sa trace d'audit.
 */
import { randomUUID } from 'node:crypto'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { baseDe, demarrerApp } from './support/app-test'
import { COMPTES, connecter, type Client } from './support/client'
import { creerPatientCdi, referentiels } from './support/donnees'
import { routesProtegees } from './support/routes'

interface Envelope {
  model: string
  id: string
  op: 'upsert' | 'delete'
  data: Record<string, unknown>
  updatedAt: string
}
interface Pull {
  changes: Envelope[]
}
interface Push {
  applied: string[]
  rejected: { id: string }[]
}
interface Controle {
  suspendu: boolean
  motif: string | null
  resyncDemandeeAt: string | null
}
interface Battement {
  ok: boolean
  controle?: Controle
}
interface Refus {
  statusCode: number
  code: string
  message: string
  motif: string | null
}
interface EtatControle {
  suspendu: boolean
  motif: string | null
  resyncDemandeeAt: string | null
  resyncFaiteAt: string | null
}
interface FichePoste {
  suspendu: boolean
  suspenduParNom: string | null
  suspensionMotif: string | null
  versionApp: string | null
  niveauControle: number | null
  resyncDemandeeAt: string | null
}

const iso = (ms: number) => new Date(ms).toISOString()
const INCONNU = '00000000-0000-4000-8000-000000000000'

describe('Contrôle du flux d’un poste', () => {
  let app: NestExpressApplication
  let admin: Client
  let infirmier: Client
  let medecin: Client
  const s = `${Date.now() % 100_000}`
  /** A : poste à jour (niveau 1) · B : un autre poste à jour · ANCIEN : poste sans niveau. */
  const A = `poste-ctl-a-${s}`
  const B = `poste-ctl-b-${s}`
  const ANCIEN = `poste-ctl-ancien-${s}`
  let modelePatient: Envelope
  let modeleIdentite: Envelope

  const base = () => baseDe(app)
  const battement = (posteLocalId: string, extra: object = {}) =>
    admin.post<Battement>('/sync/heartbeat', {
      posteLocalId,
      libelle: `Poste ${posteLocalId}`,
      ...extra,
    })
  const push = (posteLocalId: string, changes: Envelope[]) =>
    admin.post<Push>('/sync/push', { posteLocalId, changes })
  const suspendre = (id: string, corps: object = {}) =>
    admin.post<EtatControle>(`/sync/supervision/postes/${id}/suspension`, corps)
  const reprendre = (id: string) =>
    admin.delete<EtatControle>(`/sync/supervision/postes/${id}/suspension`)
  const demanderResync = (id: string) =>
    admin.post<EtatControle>(`/sync/supervision/postes/${id}/resynchronisation`)
  const annulerResync = (id: string) =>
    admin.delete<EtatControle>(`/sync/supervision/postes/${id}/resynchronisation`)
  const accuser = (id: string, demandeeAt: string) =>
    admin.post<{ ok: boolean; demandeSoldee: boolean }>(
      `/sync/poste/${id}/resync-terminee`,
      { demandeeAt },
    )
  const fiche = async (id: string) =>
    (await admin.get<FichePoste>(`/sync/supervision/postes/${id}`)).body
  const traces = (id: string) =>
    base().journalAudit.findMany({
      where: { module: 'synchronisation', entiteType: 'PosteLocal', entiteId: id },
      orderBy: { createdAt: 'asc' },
    })
  /** Un dossier saisi sur un poste : un patient et son identité (modèles réels du central). */
  const dossier = (nom: string, quand: number) => {
    const patientId = randomUUID()
    const patient: Envelope = {
      model: 'Patient',
      id: patientId,
      op: 'upsert',
      updatedAt: iso(quand),
      data: {
        ...modelePatient.data,
        id: patientId,
        numeroPatient: `PAT-CTL-${s}-${nom}`,
        matricule: null,
        createdAt: iso(quand),
        updatedAt: iso(quand),
      },
    }
    const identite: Envelope = {
      model: 'IdentitePatient',
      id: randomUUID(),
      op: 'upsert',
      updatedAt: iso(quand),
      data: {
        ...modeleIdentite.data,
        id: randomUUID(),
        patientId,
        nom,
        prenom: 'Controle',
        createdAt: iso(quand),
        updatedAt: iso(quand),
      },
    }
    identite.data['id'] = identite.id
    return { patient, identite }
  }
  const dossierExiste = async (patientId: string) =>
    (await admin.get(`/patients/${patientId}`)).status === 200

  beforeAll(async () => {
    app = await demarrerApp()
    admin = await connecter(app, COMPTES.admin)
    infirmier = await connecter(app, COMPTES.infirmier)
    medecin = await connecter(app, COMPTES.medecinChef)

    const debut = new Date(Date.now() - 1000).toISOString()
    const ref = await referentiels(infirmier)
    const id = await creerPatientCdi(infirmier, ref, 'Controle')
    const { changes } = (
      await admin.get<Pull>(`/sync/pull?since=${encodeURIComponent(debut)}`)
    ).body
    modelePatient = changes.find((c) => c.model === 'Patient' && c.id === id)!
    modeleIdentite = changes.find(
      (c) => c.model === 'IdentitePatient' && c.data['patientId'] === id,
    )!

    // A et B : postes à jour (ils annoncent version et niveau). ANCIEN : il n'annonce rien.
    for (const p of [A, B])
      expect(
        (await battement(p, { versionApp: '1.10.0', niveauControle: 1 })).status,
      ).toBe(201)
    expect((await battement(ANCIEN)).status).toBe(201)
  })
  afterAll(async () => {
    await app.close()
  })

  describe('Ce que le serveur dit au poste (battement de vie)', () => {
    it('un poste libre apprend qu’il n’y a rien à faire', async () => {
      const r = await battement(A, { versionApp: '1.10.0', niveauControle: 1 })
      expect(r.body.controle).toEqual({
        suspendu: false,
        motif: null,
        resyncDemandeeAt: null,
      })
    })

    it('la version et le niveau annoncés sont retenus, et un poste ancien ne les efface pas', async () => {
      const lu = () =>
        base().posteLocal.findUniqueOrThrow({
          where: { id: A },
          select: { versionApp: true, niveauControle: true },
        })
      expect(await lu()).toEqual({ versionApp: '1.10.0', niveauControle: 1 })
      // Un battement sans ces informations (poste ancien, ou réponse allégée) n'efface rien.
      await battement(A)
      expect(await lu()).toEqual({ versionApp: '1.10.0', niveauControle: 1 })
    })

    it('un poste ancien (aucun niveau annoncé) reste à 0 : le serveur ne lui demande rien', async () => {
      const p = await base().posteLocal.findUniqueOrThrow({
        where: { id: ANCIEN },
        select: { versionApp: true, niveauControle: true },
      })
      expect(p).toEqual({ versionApp: null, niveauControle: null })
    })

    it('refuse un niveau absurde', async () => {
      const r = await battement(A, { niveauControle: -3 })
      expect(r.status).toBe(400)
    })
  })

  describe('Suspension', () => {
    let d1: ReturnType<typeof dossier>
    let dateSuspension: Date

    it('un poste inconnu : 404', async () => {
      expect((await suspendre(INCONNU)).status).toBe(404)
      expect((await reprendre(INCONNU)).status).toBe(404)
    })

    it('refuse un motif trop long', async () => {
      const r = await suspendre(A, { motif: 'x'.repeat(201) })
      expect(r.status).toBe(400)
      expect((await fiche(A)).suspendu).toBe(false)
    })

    it('suspendre : le motif est gardé, le poste le sait par son battement de vie', async () => {
      const r = await suspendre(A, { motif: '  Poste à vérifier  ' })
      expect(r.status).toBe(201)
      expect(r.body).toMatchObject({ suspendu: true, motif: 'Poste à vérifier' })
      dateSuspension = (
        await base().posteLocal.findUniqueOrThrow({ where: { id: A } })
      ).suspenduAt!

      // Le battement d'un poste suspendu reste ACCEPTÉ (il prouve que le poste est là) et
      // lui dit qu'il est suspendu.
      const b = await battement(A)
      expect(b.status).toBe(201)
      expect(b.body.controle).toEqual({
        suspendu: true,
        motif: 'Poste à vérifier',
        resyncDemandeeAt: null,
      })
    })

    it('ce que le poste envoie est refusé (423), AVANT tout traitement : rien n’est appliqué', async () => {
      d1 = dossier(`SUSP${s}`, Date.now() - 30_000)
      const r = await admin.post<Refus>('/sync/push', {
        posteLocalId: A,
        changes: [d1.patient, d1.identite],
      })
      expect(r.status).toBe(423)
      expect(r.body).toMatchObject({
        statusCode: 423,
        code: 'POSTE_SUSPENDU',
        motif: 'Poste à vérifier',
      })
      expect(await dossierExiste(d1.patient.id)).toBe(false)
      // Même un lot vide est refusé : le contrôle précède tout.
      expect((await push(A, [])).status).toBe(423)
    })

    it('un poste qui se fait connaître ne reçoit rien non plus ; sans cela, la réception reste ouverte', async () => {
      const connu = await admin.get<Refus>(`/sync/pull?posteLocalId=${A}`)
      expect(connu.status).toBe(423)
      expect(connu.body.code).toBe('POSTE_SUSPENDU')
      // Limite assumée : un poste ancien ne dit pas qui il est à la réception — seul ce qu'il
      // ENVOIE est refusé. Couper totalement un appareil perdu = désactiver son compte.
      expect((await admin.get('/sync/pull')).status).toBe(200)
      // Un autre poste, lui, n'est pas concerné.
      expect((await admin.get(`/sync/pull?posteLocalId=${B}`)).status).toBe(200)
    })

    it('les autres postes ne sont pas touchés', async () => {
      const d = dossier(`AUTRE${s}`, Date.now() - 25_000)
      const r = await push(B, [d.patient, d.identite])
      expect(r.status).toBe(201)
      expect(r.body.applied).toEqual([d.patient.id, d.identite.id])
    })

    it('suspendre deux fois ne change rien : ni la date, ni le motif, ni la trace', async () => {
      const r = await suspendre(A, { motif: 'Un autre motif' })
      expect(r.status).toBe(201)
      expect(r.body.motif).toBe('Poste à vérifier')
      const p = await base().posteLocal.findUniqueOrThrow({ where: { id: A } })
      expect(+p.suspenduAt!).toBe(+dateSuspension)
      expect((await traces(A)).filter((t) => t.action === 'SUSPEND')).toHaveLength(1)
    })

    it('la fiche dit s’il est suspendu, par qui, pourquoi — et quelle version tourne', async () => {
      expect(await fiche(A)).toMatchObject({
        suspendu: true,
        suspenduParNom: expect.any(String),
        suspensionMotif: 'Poste à vérifier',
        versionApp: '1.10.0',
        niveauControle: 1,
      })
      expect((await fiche(A)).suspenduParNom).toBeTruthy()
    })

    it('la supervision du parc et l’activité regroupée portent la suspension', async () => {
      const sup = await admin.get<{ postes: { id: string; suspendu: boolean }[] }>(
        '/sync/supervision',
      )
      expect(sup.body.postes.find((p) => p.id === A)?.suspendu).toBe(true)
      expect(sup.body.postes.find((p) => p.id === B)?.suspendu).toBe(false)
    })

    it('la reprise rend les échanges : ce que le poste avait en attente arrive', async () => {
      const r = await reprendre(A)
      expect(r.status).toBe(200)
      expect(r.body.suspendu).toBe(false)
      expect((await battement(A)).body.controle?.suspendu).toBe(false)
      const envoi = await push(A, [d1.patient, d1.identite])
      expect(envoi.status).toBe(201)
      expect(envoi.body.applied).toEqual([d1.patient.id, d1.identite.id])
      expect(await dossierExiste(d1.patient.id)).toBe(true)
      expect((await admin.get(`/sync/pull?posteLocalId=${A}`)).status).toBe(200)
    })

    it('reprendre un poste qui n’est pas suspendu : sans effet, sans trace', async () => {
      expect((await reprendre(A)).status).toBe(200)
      expect((await traces(A)).filter((t) => t.action === 'RESUME')).toHaveLength(1)
    })

    it('chaque décision laisse sa trace : qui, d’où, pourquoi', async () => {
      const t = await traces(A)
      const susp = t.find((x) => x.action === 'SUSPEND')!
      expect(susp.utilisateurId).toBe(admin.user.id)
      expect(susp.ipAdresse).toBeTruthy()
      expect(susp.statut).toBe('SUCCES')
      expect(susp.apresJson).toEqual({ poste: `Poste ${A}`, motif: 'Poste à vérifier' })
      const rep = t.find((x) => x.action === 'RESUME')!
      expect(rep.utilisateurId).toBe(admin.user.id)
      expect(rep.apresJson).toMatchObject({ poste: `Poste ${A}` })
    })
  })

  describe('Resynchronisation complète', () => {
    let date1: string

    it('refusée pour un poste ancien : elle resterait sans fin « en attente »', async () => {
      const r = await admin.post<{ code: string }>(
        `/sync/supervision/postes/${ANCIEN}/resynchronisation`,
      )
      expect(r.status).toBe(409)
      expect(r.body.code).toBe('POSTE_NON_COMPATIBLE')
      expect(
        (await base().posteLocal.findUniqueOrThrow({ where: { id: ANCIEN } }))
          .resyncDemandeeAt,
      ).toBeNull()
    })

    it('un poste inconnu : 404', async () => {
      expect((await demanderResync(INCONNU)).status).toBe(404)
      expect((await annulerResync(INCONNU)).status).toBe(404)
      expect((await accuser(INCONNU, iso(Date.now()))).status).toBe(404)
    })

    it('demandée pour un poste à jour : son prochain battement la lui porte', async () => {
      const r = await demanderResync(A)
      expect(r.status).toBe(201)
      date1 = r.body.resyncDemandeeAt!
      expect(date1).toBeTruthy()
      expect((await battement(A)).body.controle?.resyncDemandeeAt).toBe(date1)
    })

    it('la redemander ne change rien (même date, une seule trace)', async () => {
      const r = await demanderResync(A)
      expect(r.body.resyncDemandeeAt).toBe(date1)
      expect((await traces(A)).filter((t) => t.action === 'RESYNC_REQUEST')).toHaveLength(1)
    })

    it('un poste suspendu garde sa demande : elle attend la levée', async () => {
      await suspendre(A, { motif: 'Pause' })
      expect((await battement(A)).body.controle).toMatchObject({
        suspendu: true,
        resyncDemandeeAt: date1,
      })
      await reprendre(A)
    })

    it('l’accusé du poste solde la demande et note la date de la dernière resynchronisation', async () => {
      const r = await accuser(A, date1)
      expect(r.status).toBe(201)
      expect(r.body).toEqual({ ok: true, demandeSoldee: true })
      expect((await battement(A)).body.controle?.resyncDemandeeAt).toBeNull()
      const p = await base().posteLocal.findUniqueOrThrow({ where: { id: A } })
      expect(p.resyncDemandeeAt).toBeNull()
      expect(p.resyncFaiteAt).not.toBeNull()
    })

    it('l’accusé d’une ANCIENNE demande ne solde pas une demande plus récente', async () => {
      const r2 = await demanderResync(A)
      const date2 = r2.body.resyncDemandeeAt!
      expect(date2 > date1).toBe(true)
      const a = await accuser(A, date1)
      expect(a.body).toEqual({ ok: true, demandeSoldee: false })
      expect((await battement(A)).body.controle?.resyncDemandeeAt).toBe(date2)
    })

    it('une demande pas encore prise peut être annulée', async () => {
      const r = await annulerResync(A)
      expect(r.status).toBe(200)
      expect(r.body.resyncDemandeeAt).toBeNull()
      expect((await battement(A)).body.controle?.resyncDemandeeAt).toBeNull()
      // Annuler quand rien n'est demandé : sans effet.
      expect((await annulerResync(A)).status).toBe(200)
    })

    it('refuse un accusé sans date valide', async () => {
      const r = await admin.post(`/sync/poste/${A}/resync-terminee`, {
        demandeeAt: 'hier',
      })
      expect(r.status).toBe(400)
    })

    it('la fiche dit où en est la resynchronisation', async () => {
      await demanderResync(A)
      expect((await fiche(A)).resyncDemandeeAt).toBeTruthy()
      await annulerResync(A)
      expect((await fiche(A)).resyncDemandeeAt).toBeNull()
    })

    it('chaque étape est tracée', async () => {
      const actions = (await traces(A)).map((t) => t.action)
      for (const attendu of ['RESYNC_REQUEST', 'RESYNC_DONE', 'RESYNC_CANCEL'])
        expect(actions).toContain(attendu)
      const fin = (await traces(A)).find((t) => t.action === 'RESYNC_DONE')!
      expect(fin.apresJson).toMatchObject({ demandeSoldee: true })
    })
  })

  describe('Droits', () => {
    const ROUTES: [string, string][] = [
      ['post', `/sync/supervision/postes/${A}/suspension`],
      ['delete', `/sync/supervision/postes/${A}/suspension`],
      ['post', `/sync/supervision/postes/${A}/resynchronisation`],
      ['delete', `/sync/supervision/postes/${A}/resynchronisation`],
      ['post', `/sync/poste/${A}/resync-terminee`],
    ]

    it.each([
      ['infirmier', () => infirmier],
      ['médecin chef', () => medecin],
    ])('%s : aucune de ces routes, et rien ne change', async (_nom, qui) => {
      const c = qui()
      for (const [methode, chemin] of ROUTES) {
        const r = await c.appel(
          methode as 'post' | 'delete',
          chemin,
          {},
          methode === 'post' ? { demandeeAt: iso(Date.now()) } : undefined,
        )
        expect(`${methode} ${chemin} → ${r.status}`).toBe(`${methode} ${chemin} → 403`)
      }
      const p = await base().posteLocal.findUniqueOrThrow({ where: { id: A } })
      expect(p.suspenduAt).toBeNull()
      expect(p.resyncDemandeeAt).toBeNull()
    })

    it('elles relèvent du pilotage de la synchronisation, pas de la simple lecture', () => {
      const routes = routesProtegees(app)
      for (const [methode, chemin] of ROUTES) {
        const modele = chemin.replace(A, INCONNU)
        const r = routes.find((x) => x.methode === methode && x.chemin === modele)
        expect({ chemin, permissions: r?.permissions }).toEqual({
          chemin,
          permissions: ['synchronisation.execute'],
        })
      }
    })
  })
})
