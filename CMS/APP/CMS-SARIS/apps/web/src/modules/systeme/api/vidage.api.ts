/**
 * API du vidage des données métier : vider d'un geste tout le dossier patient et le parcours de soins
 * du centre (mise en service). Réservé à l'administrateur système, au mode Test et au serveur central
 * (le serveur le fait respecter) ; mot de passe redemandé.
 */
import { api } from '@/lib/api'

export interface PosteVidage {
  id: string
  libelle: string
  siteLibelle: string | null
  enLigne: boolean
  versionApp: string | null
  /** Sait vider sa copie tout seul (version récente). */
  comprend: boolean
  /** A reçu un vidage qu'il n'a pas encore accompli. */
  enAttente: boolean
}

export interface EtatVidage {
  mode: 'PRODUCTION' | 'TEST'
  /** Peut-on vider maintenant ? Sinon, `raison` dit pourquoi. */
  disponible: boolean
  raison: string | null
  /** La phrase à recopier pour confirmer. */
  phrase: string
  /** Ce qui partirait si l'on videait maintenant. */
  lignes: {
    total: number
    tables: { modele: string; libelle: string; n: number }[]
    autres: { cle: string; libelle: string; n: number }[]
  }
  postes: {
    total: number
    enLigne: number
    anciens: number
    enAttente: number
    liste: PosteVidage[]
  }
  dernier: { at: string; parNom: string | null; lignes: number } | null
}

export interface DemandeVidage {
  motDePasse: string
  confirmation: string
  irreversible: boolean
  restaurationVerifiee: boolean
}

export interface ResultatVidage {
  lignes: number
  tables: Record<string, number>
  autres: Record<string, number>
  journauxDeTest: number
  postes: number
}

export const vidageApi = {
  etat: () => api.get<EtatVidage>('/systeme/vidage'),
  vider: (d: DemandeVidage) => api.post<ResultatVidage>('/systeme/vidage', d),
}
