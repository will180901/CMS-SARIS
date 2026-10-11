/**
 * API des données de test : fabriquer plusieurs mois d'activité fictive du centre, puis les
 * supprimer. Réservé à l'administrateur système et au mode Test (le serveur le fait respecter).
 */
import { api } from '@/lib/api'

export type StatutLot = 'EN_COURS' | 'TERMINE' | 'INTERROMPU' | 'ANNULE' | 'ECHEC'

/** Ce qui a été fabriqué, établi à la fin d'une génération menée à son terme. */
export interface BilanDonneesTest {
  tailleOctets: number | null
  sites: { code: string; visites: number; patients: number }[]
  categories: { code: string; patients: number }[]
  connexions: { reussies: number; echecs: number; deconnexions: number; questions: number; appareils: number }
  documents: {
    ordonnances: number
    bonsExamen: number
    bonsPharmacie: number
    resultats: number
    evacuations: number
    suivisTraitement: number
    suivisChroniques: number
  }
}

export interface LotDonneesTest {
  id: string
  statut: StatutLot
  creeLe: string
  termineLe: string | null
  /** Dernière écriture de l'état : la fin apparente d'une génération arrêtée ou interrompue. */
  derniereMaj: string
  message: string | null
  parametres: {
    mois: number
    visitesParJour: number
    graine: string
    debut: string
    fin: string
  }
  progression: {
    joursTotal: number
    joursFaits: number
    jourCourant: string | null
    visites: number
    patients: number
    consultations: number
    visitesAnnulees: number
    consultationsAnnulees: number
    nonRecus: number
    lignes: Record<string, number>
  }
  bilan?: BilanDonneesTest | null
}

export interface EtatDonneesTest {
  mode: 'PRODUCTION' | 'TEST'
  /** Peut-on générer / supprimer maintenant ? Sinon, `raison` dit pourquoi. */
  disponible: boolean
  raison: string | null
  lot: LotDonneesTest | null
  enCours: boolean
  existantes: { total: number; tables: { modele: string; libelle: string; n: number }[] }
  base: { tailleMo: number | null; limiteMo: number }
  equipe: { sites: number; medecins: number; infirmiers: number }
}

export interface PrevisionsDonneesTest {
  debut: string
  fin: string
  joursOuverts: number
  capaciteParJour: number
  visites: number
  patients: number
  lignes: number
  octets: number
  depassementParJour: number
  avertissements: string[]
  baseMo: number | null
  limiteMo: number
}

export const donneesTestApi = {
  etat: () => api.get<EtatDonneesTest>('/systeme/donnees-test'),
  previsions: (mois: number, visitesParJour: number) =>
    api.get<PrevisionsDonneesTest>('/systeme/donnees-test/previsions', { mois, visitesParJour }),
  generer: (mois: number, visitesParJour: number) =>
    api.post<LotDonneesTest>('/systeme/donnees-test/generation', { mois, visitesParJour }),
  reprendre: () => api.post<LotDonneesTest>('/systeme/donnees-test/generation/reprise', {}),
  arreter: () => api.post<LotDonneesTest>('/systeme/donnees-test/generation/arret', {}),
  supprimer: () =>
    api.delete<{ lignes: number; tables: Record<string, number> }>('/systeme/donnees-test'),
}
