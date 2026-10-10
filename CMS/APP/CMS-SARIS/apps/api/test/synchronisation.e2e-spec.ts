/**
 * Synchronisation poste ↔ serveur central (chantier 7, étape 5), par ses vraies routes :
 *  - /sync/pull : ce qui a changé depuis un curseur, suppressions comprises, par pages ;
 *  - /sync/push : ce qu'un poste a saisi (hors ligne compris), avec la règle « le plus
 *    récent gagne », la détection des vrais conflits, et la QUARANTAINE d'un changement
 *    refusé qui ne doit jamais bloquer le reste du lot ;
 *  - un poste resté sur une version antérieure (colonne disparue) n'est pas rejeté ;
 *  - le battement de vie fait apparaître le poste dans la supervision.
 *
 * Le côté poste applique les changements reçus avec le même moteur (SyncService.ingest).
 */
import { randomUUID } from 'node:crypto'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { demarrerApp } from './support/app-test'
import { COMPTES, connecter, type Client } from './support/client'
import { creerPatientCdi, referentiels } from './support/donnees'

interface Envelope {
  model: string
  id: string
  op: 'upsert' | 'delete'
  data: Record<string, unknown>
  updatedAt: string
  deletedAt?: string | null
  baseUpdatedAt?: string | null
}
interface Pull {
  changes: Envelope[]
  hasMore: boolean
  nextSince: string
  serverTime: string
}
interface Push {
  applied: string[]
  skipped: string[]
  conflicts: { id: string; model: string; winner: 'incoming' | 'existing' }[]
  rejected: { id: string; model: string; raison: string }[]
}
interface Identite {
  identite: { nom: string; prenom: string; telephone: string | null } | null
}

const iso = (ms: number) => new Date(ms).toISOString()

describe('Synchronisation poste ↔ serveur central', () => {
  let app: NestExpressApplication
  let admin: Client
  let inf: Client
  const s = `${Date.now() % 100_000}`
  const poste = `poste-test-${s}`
  let debut: string
  /** Lignes Patient + IdentitePatient d'un dossier créé sur le central : modèles réels. */
  let modelePatient: Envelope
  let modeleIdentite: Envelope

  const pull = async (since: string, limit?: number) => {
    const r = await admin.get<Pull>(
      `/sync/pull?since=${encodeURIComponent(since)}${limit ? `&limit=${limit}` : ''}`,
    )
    expect(r.status).toBe(200)
    return r.body
  }
  const push = async (changes: Envelope[]) => {
    const r = await admin.post<Push>('/sync/push', {
      posteLocalId: poste,
      changes,
    })
    expect(r.status).toBe(201)
    return r.body
  }
  /** Un dossier saisi HORS LIGNE sur le poste : un patient et son identité. */
  const dossierHorsLigne = (nom: string, quand: number) => {
    const patientId = randomUUID()
    const identiteId = randomUUID()
    const patient: Envelope = {
      model: 'Patient',
      id: patientId,
      op: 'upsert',
      updatedAt: iso(quand),
      data: {
        ...modelePatient.data,
        id: patientId,
        numeroPatient: `PAT-OFF-${s}-${nom}`,
        matricule: null,
        createdAt: iso(quand),
        updatedAt: iso(quand),
      },
    }
    const identite: Envelope = {
      model: 'IdentitePatient',
      id: identiteId,
      op: 'upsert',
      updatedAt: iso(quand),
      data: {
        ...modeleIdentite.data,
        id: identiteId,
        patientId,
        nom,
        prenom: 'HorsLigne',
        createdAt: iso(quand),
        updatedAt: iso(quand),
      },
    }
    return { patient, identite }
  }
  const lireIdentite = async (patientId: string) =>
    (await admin.get<Identite>(`/patients/${patientId}`)).body.identite

  beforeAll(async () => {
    app = await demarrerApp()
    admin = await connecter(app, COMPTES.admin)
    inf = await connecter(app, COMPTES.infirmier)
    debut = new Date(Date.now() - 1000).toISOString()
    const ref = await referentiels(inf)
    const id = await creerPatientCdi(inf, ref, 'Synchro')
    await creerPatientCdi(inf, ref, 'Synchro2')
    const { changes } = await pull(debut)
    modelePatient = changes.find((c) => c.model === 'Patient' && c.id === id)!
    modeleIdentite = changes.find(
      (c) => c.model === 'IdentitePatient' && c.data['patientId'] === id,
    )!
  })
  afterAll(async () => {
    await app.close()
  })

  describe('réception (pull)', () => {
    it('un dossier créé sur le central part vers les postes, avec un curseur pour la suite', async () => {
      expect(modelePatient).toMatchObject({ op: 'upsert', deletedAt: null })
      expect(modeleIdentite.data['prenom']).toBe('Synchro')
      const p = await pull(debut)
      expect(p.nextSince >= modelePatient.updatedAt).toBe(true)
      // Plus rien de neuf après le curseur (pour ces dossiers-là).
      const apres = await pull(p.nextSince)
      expect(apres.changes.map((c) => c.id)).not.toContain(modelePatient.id)
    })

    it('les pages : au-delà de la limite, le serveur dit qu’il en reste', async () => {
      const p = await pull(debut, 1)
      expect(p.hasMore).toBe(true)
    })
  })

  describe('envoi (push)', () => {
    it('un dossier saisi hors ligne arrive sur le central, avec son heure d’origine', async () => {
      const quand = Date.now() - 60_000
      const { patient, identite } = dossierHorsLigne(`OFF${s}`, quand)
      const r = await push([patient, identite])
      expect(r.applied).toEqual([patient.id, identite.id])
      expect(r.rejected).toEqual([])
      expect(await lireIdentite(patient.id)).toMatchObject({
        nom: `OFF${s}`,
        prenom: 'HorsLigne',
      })
      // L'heure de la saisie est gardée (sinon « le plus récent gagne » serait faussé).
      const { changes } = await pull(iso(quand - 1))
      expect(changes.find((c) => c.id === patient.id)?.updatedAt).toBe(
        iso(quand),
      )
    })

    it('le plus récent gagne : une version plus ancienne est ignorée, une plus récente appliquée', async () => {
      const t0 = Date.now() - 50_000
      const { patient, identite } = dossierHorsLigne(`LWW${s}`, t0)
      await push([patient, identite])

      const ancienne = {
        ...identite,
        updatedAt: iso(t0 - 10_000),
        data: {
          ...identite.data,
          telephone: '+242 06 000 00 01',
          updatedAt: iso(t0 - 10_000),
        },
      }
      const r1 = await push([ancienne])
      expect(r1.skipped).toEqual([identite.id])
      expect((await lireIdentite(patient.id))?.telephone ?? null).toBeNull()

      const recente = {
        ...identite,
        updatedAt: iso(t0 + 10_000),
        data: {
          ...identite.data,
          telephone: '+242 06 000 00 02',
          updatedAt: iso(t0 + 10_000),
        },
      }
      const r2 = await push([recente])
      expect(r2.applied).toEqual([identite.id])
      expect((await lireIdentite(patient.id))?.telephone).toBe(
        '+242 06 000 00 02',
      )
    })

    it('modifié des deux côtés : le conflit est signalé, et le plus récent gagne', async () => {
      const t0 = Date.now() - 40_000
      const { patient, identite } = dossierHorsLigne(`CONF${s}`, t0)
      await push([patient, identite])
      // Le central bouge (t0 + 20 s) après la version que le poste connaissait (t0).
      await push([
        {
          ...identite,
          updatedAt: iso(t0 + 20_000),
          data: {
            ...identite.data,
            telephone: '+242 06 111 11 11',
            updatedAt: iso(t0 + 20_000),
          },
        },
      ])

      // Le poste avait modifié AVANT (t0 + 10 s) : le central garde sa version.
      const perdante = await push([
        {
          ...identite,
          baseUpdatedAt: iso(t0),
          updatedAt: iso(t0 + 10_000),
          data: {
            ...identite.data,
            telephone: '+242 06 222 22 22',
            updatedAt: iso(t0 + 10_000),
          },
        },
      ])
      expect(perdante.conflicts).toEqual([
        expect.objectContaining({ id: identite.id, winner: 'existing' }),
      ])
      expect(perdante.skipped).toEqual([identite.id])
      expect((await lireIdentite(patient.id))?.telephone).toBe(
        '+242 06 111 11 11',
      )

      // Le poste avait modifié APRÈS (t0 + 30 s) : sa version l'emporte.
      const gagnante = await push([
        {
          ...identite,
          baseUpdatedAt: iso(t0),
          updatedAt: iso(t0 + 30_000),
          data: {
            ...identite.data,
            telephone: '+242 06 333 33 33',
            updatedAt: iso(t0 + 30_000),
          },
        },
      ])
      expect(gagnante.conflicts).toEqual([
        expect.objectContaining({ id: identite.id, winner: 'incoming' }),
      ])
      expect((await lireIdentite(patient.id))?.telephone).toBe(
        '+242 06 333 33 33',
      )
    })

    it('une suppression faite sur un poste se propage, et repart vers les autres postes', async () => {
      const t0 = Date.now() - 30_000
      const { patient, identite } = dossierHorsLigne(`SUPP${s}`, t0)
      await push([patient, identite])
      const quand = iso(t0 + 5_000)
      const r = await push([
        {
          ...patient,
          op: 'delete',
          updatedAt: quand,
          deletedAt: quand,
          data: { ...patient.data, updatedAt: quand, deletedAt: quand },
        },
      ])
      expect(r.applied).toEqual([patient.id])
      expect((await admin.get(`/patients/${patient.id}`)).status).toBe(404)
      const { changes } = await pull(iso(t0))
      expect(changes.find((c) => c.id === patient.id)).toMatchObject({
        op: 'delete',
        deletedAt: quand,
      })
    })

    it('un changement refusé part en quarantaine sans bloquer le reste du lot', async () => {
      const t0 = Date.now() - 20_000
      const bon = dossierHorsLigne(`QUAR${s}`, t0)
      const orphelin = dossierHorsLigne(`ORPH${s}`, t0).identite // son patient n'existe pas
      const doublon = dossierHorsLigne(`DBL${s}`, t0).patient
      doublon.data['numeroPatient'] = bon.patient.data['numeroPatient'] // numéro déjà pris
      const r = await push([bon.patient, orphelin, doublon, bon.identite])
      expect(r.applied).toEqual([bon.patient.id, bon.identite.id])
      expect(r.rejected.map((x) => x.id)).toEqual([orphelin.id, doublon.id])
      expect(r.rejected[0].raison).toMatch(/lié absent/)
      expect(r.rejected[1].raison).toMatch(/déjà utilisée/)
      const sup = await admin.get<{ conflits: { entiteId: string }[] }>(
        '/sync/supervision',
      )
      expect(sup.body.conflits.map((c) => c.entiteId)).toEqual(
        expect.arrayContaining([orphelin.id, doublon.id]),
      )
    })

    it("un poste resté sur une ancienne version (colonne disparue) n'est pas rejeté", async () => {
      const { patient, identite } = dossierHorsLigne(
        `VIEUX${s}`,
        Date.now() - 10_000,
      )
      patient.data['employeId'] = 'colonne-retiree-depuis'
      const r = await push([patient, identite])
      expect(r.applied).toEqual([patient.id, identite.id])
      expect(r.rejected).toEqual([])
    })
  })

  it('le battement de vie fait apparaître le poste dans la supervision', async () => {
    const r = await admin.post('/sync/heartbeat', {
      posteLocalId: `${poste}-hb`,
      libelle: `Poste accueil ${s}`,
    })
    expect(r.status).toBe(201)
    const sup = await admin.get<{ postes: { id: string; libelle: string }[] }>(
      '/sync/supervision',
    )
    expect(sup.body.postes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `${poste}-hb`,
          libelle: `Poste accueil ${s}`,
        }),
      ]),
    )
  })
})
