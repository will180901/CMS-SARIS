/**
 * Parcours clinique de bout en bout, tel qu'il se déroule au centre :
 *   accueil (infirmier) → visite + constantes → orientation vers le médecin →
 *   consultation → diagnostic → ordonnances (examens → bon, médicaments) →
 *   résultats → décision « suivi de traitement » et clôture →
 *   séance de suivi → administrations → arrêt → remplacement → séance annulée.
 *
 * Les étapes s'enchaînent (chaque `it` part de l'état laissé par le précédent), comme
 * dans la réalité. Chaque refus attendu (règle métier) est vérifié au passage.
 */
import type { NestExpressApplication } from '@nestjs/platform-express'
import { demarrerApp } from './support/app-test'
import { COMPTES, connecter, type Client } from './support/client'
import {
  creerPatientCdi,
  referentiels,
  type Referentiels,
} from './support/donnees'

interface Visite {
  id: string
  statut: string
}
interface Ligne {
  id: string
  medicament?: { id: string; nomGenerique: string } | null
  arreteLe?: string | null
  motifArret?: string | null
  arreteParNom?: string | null
  remplaceParId?: string | null
  administrations: { id: string; dose?: string | null; auteurNom?: string }[]
}
interface Ordonnance {
  id: string
  statut: string
  typeOrdonnance?: string | null
  lignes: Ligne[]
}
interface Episode {
  consultationInitiale?: { id: string } | null
  ordonnances: Ordonnance[]
  bons: { id: string; resultats: unknown[] }[]
  seances: { id: string }[]
}
interface Bon {
  id: string
  statut: string
  lignes: { id: string; typeExamen: { libelle: string } }[]
  resultats: {
    id: string
    ligneExamenId?: string | null
    statut: string
    corrigeId?: string | null
    motifCorrection?: string | null
  }[]
}
interface SuiviPatient {
  resultatsEnAttente: {
    bonId: string
    recus: number
    total: number
    examens: string[]
  }[]
}

const MAINTENANT = () => new Date().toISOString()
const HIER = () => new Date(Date.now() - 86_400_000).toISOString()
const DEMAIN = () => new Date(Date.now() + 86_400_000).toISOString()

describe('Parcours clinique de bout en bout', () => {
  let app: NestExpressApplication
  let inf: Client
  let infSansDelegation: Client
  let med: Client
  let ref: Referentiels
  let patientId: string
  let visiteId: string
  let consultationId: string
  let bon: Bon
  let suiviId: string
  let seanceId: string

  /** Lignes de médicaments validées de l'épisode. */
  const traitements = async (): Promise<Ligne[]> => {
    const e = await med.get<Episode>(`/suivi-traitement/${suiviId}/episode`)
    return e.body.ordonnances
      .filter(
        (o) =>
          o.statut === 'VALIDEE' &&
          (o.typeOrdonnance ?? 'PHARMACEUTIQUE') === 'PHARMACEUTIQUE',
      )
      .flatMap((o) => o.lignes)
  }

  beforeAll(async () => {
    app = await demarrerApp()
    inf = await connecter(app, COMPTES.infirmier)
    med = await connecter(app, COMPTES.medecinChef)
    infSansDelegation = await connecter(app, COMPTES.infirmierSansDelegation)
    ref = await referentiels(inf)
    patientId = await creerPatientCdi(inf, ref, 'Parcours')
  })
  afterAll(async () => {
    await app.close()
  })

  describe('Accueil et triage (infirmier)', () => {
    it('ouvre une visite avec ses constantes, en attente', async () => {
      const r = await inf.post<Visite>('/triage/visites', {
        patientId,
        motifPrincipalId: ref.motifId,
        notesAccueil: 'Céphalées depuis 3 jours',
        constantes: {
          temperature: 37.2,
          tensionSystolique: 162,
          tensionDiastolique: 98,
          frequenceCardiaque: 84,
          saturationO2: 97,
        },
      })
      expect(r.status).toBe(201)
      expect(r.body.statut).toBe('EN_ATTENTE')
      visiteId = r.body.id
    })

    it('refuse une seconde visite tant que la première est ouverte', async () => {
      const r = await inf.post('/triage/visites', {
        patientId,
        motifPrincipalId: ref.motifId,
      })
      expect(r.status).toBe(409)
    })

    it("prend la visite en charge et l'oriente vers le médecin", async () => {
      const enCours = await inf.patch<Visite>(
        `/triage/visites/${visiteId}/statut`,
        { statut: 'EN_COURS' },
      )
      expect(enCours.status).toBe(200)
      const oriente = await inf.patch(`/triage/visites/${visiteId}/soignant`, {
        soignantId: med.user.personnelMedicalId,
      })
      expect(oriente.status).toBe(200)
    })

    it('interdit de remettre une visite prise en charge « en attente »', async () => {
      const r = await inf.patch(`/triage/visites/${visiteId}/statut`, {
        statut: 'EN_ATTENTE',
      })
      expect(r.status).toBe(400)
    })
  })

  describe('Consultation (médecin)', () => {
    it('ouvre la consultation de la visite orientée', async () => {
      const r = await med.post<{ id: string; statut: string }>(
        '/consultations',
        { visiteId },
      )
      expect(r.status).toBe(201)
      expect(r.body.statut).toBe('OUVERTE')
      consultationId = r.body.id
    })

    it("renseigne le type, l'examen et le diagnostic principal", async () => {
      const C = `/consultations/${consultationId}`
      expect(
        (
          await med.patch(`${C}/type`, {
            typeConsultationId: ref.typeConsultationId,
          })
        ).status,
      ).toBe(200)
      expect(
        (
          await med.patch(`${C}/examen`, {
            anamneseSymptomes: 'Céphalées, fatigue',
            examenClinique: 'TA élevée',
          })
        ).status,
      ).toBe(200)
      const d = await med.post(`${C}/diagnostics`, {
        pathologieId: ref.pathologieId,
        type: 'PRINCIPAL',
        certitude: 'CONFIRME',
      })
      expect(d.status).toBe(201)
    })

    it('prescrit des examens : ordonnance validée → bon validé directement', async () => {
      const C = `/consultations/${consultationId}`
      const o = await med.post<{ id: string }>(`${C}/ordonnances`, {
        typeOrdonnance: 'PRESCRIPTION_EXAMEN',
        indicationClinik: 'Bilan de départ',
      })
      expect(o.status).toBe(201)
      await med.post(`${C}/ordonnances/${o.body.id}/lignes`, {
        typesExamenIds: ref.typesExamen.map((t) => t.id),
      })
      expect(
        (await med.patch(`${C}/ordonnances/${o.body.id}/valider`)).status,
      ).toBe(200)
      const b = await med.post<Bon>(`${C}/ordonnances/${o.body.id}/generer-bon`)
      expect(b.status).toBe(201)
      expect(b.body.statut).toBe('VALIDE')
      expect(b.body.lignes).toHaveLength(ref.typesExamen.length)
      bon = b.body
    })

    it('prescrit deux médicaments', async () => {
      const C = `/consultations/${consultationId}`
      const o = await med.post<{ id: string }>(`${C}/ordonnances`, {
        typeOrdonnance: 'PHARMACEUTIQUE',
      })
      expect(o.status).toBe(201)
      for (const m of ref.medicaments.slice(0, 2)) {
        const l = await med.post(`${C}/ordonnances/${o.body.id}/lignes`, {
          medicamentId: m.id,
          posologie: '1 cp le matin',
          duree: '30 jours',
          voieAdmin: 'Orale',
          quantite: '30',
          acknowledgeWarnings: true,
        })
        expect(l.status).toBe(201)
      }
      expect(
        (await med.patch(`${C}/ordonnances/${o.body.id}/valider`)).status,
      ).toBe(200)
    })
  })

  describe("Résultats d'examens", () => {
    it("saisit 2 résultats sur 3 : le bon reste en attente, l'examen manquant est nommé", async () => {
      const [l1, l2, l3] = bon.lignes
      const r = await med.post<Bon>(`/bons-examen/${bon.id}/resultats`, {
        resultats: [
          { ligneExamenId: l1.id, contenu: 'Protéines ++', anormal: true },
          { ligneExamenId: l2.id, contenu: 'Normal', anormal: false },
        ],
        laboratoire: 'Labo Moutela',
        dateRealisation: MAINTENANT(),
      })
      expect(r.status).toBe(201)
      const s = await med.get<SuiviPatient>(`/patients/${patientId}/suivi`)
      const attente = s.body.resultatsEnAttente.find((x) => x.bonId === bon.id)
      expect(attente).toMatchObject({ recus: 2, total: 3 })
      expect(attente?.examens).toEqual([l3.typeExamen.libelle])
    })

    it('refuse une 2e saisie du même examen, un examen étranger au bon, une date future ou antérieure à la prescription', async () => {
      const [l1, , l3] = bon.lignes
      const url = `/bons-examen/${bon.id}/resultats`
      expect(
        (
          await med.post(url, {
            resultats: [{ ligneExamenId: l1.id, contenu: 'Doublon' }],
          })
        ).status,
      ).toBe(409)
      expect(
        (
          await med.post(url, {
            resultats: [
              {
                ligneExamenId: '00000000-0000-4000-8000-000000000000',
                contenu: 'X',
              },
            ],
          })
        ).status,
      ).toBe(400)
      expect(
        (
          await med.post(url, {
            resultats: [{ ligneExamenId: l3.id, contenu: 'X' }],
            dateRealisation: DEMAIN(),
          })
        ).status,
      ).toBe(400)
      expect(
        (
          await med.post(url, {
            resultats: [{ ligneExamenId: l3.id, contenu: 'X' }],
            dateRealisation: HIER(),
          })
        ).status,
      ).toBe(400)
    })

    it("complète le bon, puis corrige un résultat en gardant l'ancien et le motif", async () => {
      const l3 = bon.lignes[2]
      const r = await med.post<Bon>(`/bons-examen/${bon.id}/resultats`, {
        resultats: [
          { ligneExamenId: l3.id, contenu: 'Glycémie 1,32 g/L', anormal: true },
        ],
        dateRealisation: MAINTENANT(),
      })
      expect(r.status).toBe(201)
      const s = await med.get<SuiviPatient>(`/patients/${patientId}/suivi`)
      expect(s.body.resultatsEnAttente.some((x) => x.bonId === bon.id)).toBe(
        false,
      )

      const aCorriger = r.body.resultats.find(
        (x) => x.ligneExamenId === l3.id && x.statut === 'RECU',
      )!
      const url = `/bons-examen/${bon.id}/resultats/${aCorriger.id}`
      expect((await med.patch(url, { contenu: 'Sans motif' })).status).toBe(400)
      const c = await med.patch<Bon>(url, {
        contenu: 'Glycémie 1,23 g/L',
        motifCorrection: 'Faute de frappe',
      })
      expect(c.status).toBe(200)
      const ancien = c.body.resultats.find((x) => x.id === aCorriger.id)
      const nouveau = c.body.resultats.find((x) => x.corrigeId === aCorriger.id)
      expect(ancien?.statut).toBe('REMPLACE')
      expect(nouveau).toMatchObject({
        statut: 'RECU',
        motifCorrection: 'Faute de frappe',
      })
    })
  })

  describe('Décision et clôture', () => {
    it('ouvre un suivi de traitement et clôture la consultation : la visite est clôturée', async () => {
      const s = await med.post<{ id: string }>('/suivi-traitement', {
        consultationId,
        motif: 'Contrôle tensionnel et bilan',
      })
      expect(s.status).toBe(201)
      suiviId = s.body.id
      const c = await med.patch<{ statut: string }>(
        `/consultations/${consultationId}/cloturer`,
        {
          decisionMedicale: 'SUIVI_TRAITEMENT',
          conclusion: 'HTA à surveiller',
        },
      )
      expect(c.status).toBe(200)
      expect(c.body.statut).toBe('CLOTUREE')
      const v = await med.get<Visite>(`/triage/visites/${visiteId}`)
      expect(v.body.statut).toBe('CLOTUREE')
    })

    it("l'épisode réunit la consultation de départ, ses ordonnances et son bon", async () => {
      const e = await med.get<Episode>(`/suivi-traitement/${suiviId}/episode`)
      expect(e.status).toBe(200)
      expect(e.body.consultationInitiale?.id).toBe(consultationId)
      expect(e.body.ordonnances).toHaveLength(2)
      expect(e.body.bons).toHaveLength(1)
    })
  })

  describe('Suivi de traitement', () => {
    it('ouvre une séance de suivi sans repasser par le triage, sans doublon', async () => {
      const s = await med.post<{ consultationId: string }>(
        '/consultations/seances-suivi',
        {
          suiviTraitementId: suiviId,
          motifSeance: 'Suite au résultat de glycémie',
        },
      )
      expect(s.status).toBe(201)
      seanceId = s.body.consultationId
      const seance = await med.get<{ statut: string; episodeSuiviId: string }>(
        `/consultations/${seanceId}`,
      )
      expect(seance.body).toMatchObject({
        statut: 'OUVERTE',
        episodeSuiviId: suiviId,
      })
      const encore = await med.post<{
        consultationId: string
        existante?: boolean
      }>('/consultations/seances-suivi', {
        suiviTraitementId: suiviId,
        motifSeance: 'Contrôle tensionnel',
      })
      expect(encore.body).toMatchObject({
        consultationId: seanceId,
        existante: true,
      })
    })

    it('note des administrations (médecin et infirmier), refuse une date future', async () => {
      const [A, B] = await traitements()
      const url = `/suivi-traitement/${suiviId}/administrations`
      expect(
        (await med.post(url, { ligneOrdonnanceId: A.id, dose: '1 cp' })).status,
      ).toBe(201)
      expect(
        (
          await inf.post(url, {
            ligneOrdonnanceId: B.id,
            dose: '1 cp (infirmier)',
          })
        ).status,
      ).toBe(201)
      expect(
        (
          await med.post(url, {
            ligneOrdonnanceId: A.id,
            administreLe: DEMAIN(),
          })
        ).status,
      ).toBe(400)
      const A2 = (await traitements()).find((l) => l.id === A.id)!
      expect(A2.administrations.length).toBeGreaterThanOrEqual(1)
      expect(A2.administrations.every((a) => !!a.auteurNom)).toBe(true)
    })

    it('arrête un traitement : réservé aux prescripteurs, motif obligatoire, une seule fois', async () => {
      const [A] = await traitements()
      const url = `/suivi-traitement/${suiviId}/traitements/${A.id}/arret`
      // Infirmier sans délégation en cours : il n'est pas prescripteur.
      expect(
        (await infSansDelegation.patch(url, { motifArret: 'X' })).status,
      ).toBe(403)
      expect((await med.patch(url, {})).status).toBe(400)
      expect(
        (await med.patch(url, { motifArret: 'Toux sèche (effet indésirable)' }))
          .status,
      ).toBe(200)
      expect((await med.patch(url, { motifArret: 'Encore' })).status).toBe(409)
      const admin = await med.post(
        `/suivi-traitement/${suiviId}/administrations`,
        {
          ligneOrdonnanceId: A.id,
        },
      )
      expect(admin.status).toBe(409)
      const A2 = (await traitements()).find((l) => l.id === A.id)!
      expect(A2).toMatchObject({ motifArret: 'Toux sèche (effet indésirable)' })
      expect(A2.arreteLe).toBeTruthy()
      expect(A2.arreteParNom).toBeTruthy()
    })

    it('remplace le traitement arrêté dans la séance (et seulement lui)', async () => {
      const [A, B] = await traitements()
      const arrete = A.arreteLe ? A : B
      const enCours = A.arreteLe ? B : A
      const C = `/consultations/${seanceId}`
      const o = await med.post<{ id: string }>(`${C}/ordonnances`, {
        typeOrdonnance: 'PHARMACEUTIQUE',
      })
      const nouveau = ref.medicaments[2]
      const ligne = (remplaceLigneId: string) => ({
        medicamentId: nouveau.id,
        posologie: '1 cp le matin',
        duree: '30 jours',
        voieAdmin: 'Orale',
        remplaceLigneId,
        acknowledgeWarnings: true,
      })
      const url = `${C}/ordonnances/${o.body.id}/lignes`
      expect((await med.post(url, ligne(enCours.id))).status).toBe(409)
      const l = await med.post<{ id: string }>(url, ligne(arrete.id))
      expect(l.status).toBe(201)
      expect((await med.post(url, ligne(arrete.id))).status).toBe(409)
      expect(
        (await med.patch(`${C}/ordonnances/${o.body.id}/valider`)).status,
      ).toBe(200)
      expect(
        (
          await med.patch(`${C}/cloturer`, {
            conclusion: 'Traitement remplacé',
          })
        ).status,
      ).toBe(200)

      const apres = await traitements()
      expect(apres.find((x) => x.id === arrete.id)?.remplaceParId).toBe(
        l.body.id,
      )
      const remplacant = apres.find((x) => x.id === l.body.id)
      expect(remplacant?.medicament?.id).toBe(nouveau.id)
      expect(remplacant?.arreteLe ?? null).toBeNull()
      const e = await med.get<Episode>(`/suivi-traitement/${suiviId}/episode`)
      expect(e.body.seances.map((s) => s.id)).toContain(seanceId)
    })

    it('une séance annulée annule son passage (il ne revient pas dans la file)', async () => {
      const s = await med.post<{ consultationId: string }>(
        '/consultations/seances-suivi',
        {
          suiviTraitementId: suiviId,
          motifSeance: 'Ouverte par erreur',
        },
      )
      expect(s.status).toBe(201)
      const c = await med.get<{ visiteId: string }>(
        `/consultations/${s.body.consultationId}`,
      )
      const an = await med.patch(
        `/consultations/${s.body.consultationId}/annuler`,
        {
          motifAnnulation: 'Ouverte par erreur',
        },
      )
      expect(an.status).toBe(200)
      const v = await med.get<Visite>(`/triage/visites/${c.body.visiteId}`)
      expect(v.body.statut).toBe('ANNULEE')
    })
  })
})
