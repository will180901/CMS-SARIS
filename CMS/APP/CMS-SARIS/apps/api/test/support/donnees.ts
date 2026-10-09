/**
 * Données de départ des tests, prises dans les référentiels du seed (base de test) et
 * créées par l'API comme le ferait l'accueil — jamais insérées en douce dans la base.
 */
import type { Client } from './client'

type Liste<T> = T[] | { data: T[] }
const elements = <T>(corps: Liste<T>): T[] =>
  Array.isArray(corps) ? corps : corps.data

interface Ref {
  id: string
  code?: string
  libelle?: string
  statut?: string
  deletedAt?: string | null
}

export interface Referentiels {
  siteId: string
  motifId: string
  /** Pathologie chronique ordinaire (sans confidentialité renforcée). */
  pathologieId: string
  typeConsultationId: string
  categories: Record<string, string>
  typesExamen: { id: string; libelle: string }[]
  medicaments: { id: string; nomGenerique: string }[]
}

async function lire<T>(c: Client, chemin: string): Promise<T[]> {
  const r = await c.get<Liste<T>>(chemin)
  if (r.status !== 200) throw new Error(`${chemin} : HTTP ${r.status}`)
  return elements(r.body)
}

const actif = (x: Ref) =>
  !x.deletedAt && (!x.statut || x.statut.startsWith('ACTI'))

export async function referentiels(c: Client): Promise<Referentiels> {
  const sites = await lire<Ref>(c, '/referentiels/sites')
  const motifs = await lire<Ref>(c, '/referentiels/motifs')
  const pathologies = await lire<
    Ref & { chronique?: boolean; confidentialiteRenforcee?: boolean }
  >(c, '/referentiels/pathologies')
  const types = await lire<Ref>(c, '/referentiels/types-consultation')
  const cats = await lire<Ref>(c, '/referentiels/categories-patient')
  const examens = await lire<Ref>(c, '/referentiels/types-examen')
  const meds = await lire<Ref & { nomGenerique: string }>(
    c,
    '/referentiels/medicaments',
  )
  const pathologie = pathologies.find(
    (p) => actif(p) && p.chronique && !p.confidentialiteRenforcee,
  )
  const typeConsultation = types.find((t) => t.code === 'MEDECINE_GENERALE')
  if (!pathologie || !typeConsultation)
    throw new Error(
      'Seed incomplet : pathologie chronique ou type de consultation',
    )
  return {
    siteId: sites.find(actif)!.id,
    motifId: motifs.find(actif)!.id,
    pathologieId: pathologie.id,
    typeConsultationId: typeConsultation.id,
    categories: Object.fromEntries(
      cats.map((x): [string, string] => [x.code ?? '', x.id]),
    ),
    typesExamen: examens
      .filter(actif)
      .slice(0, 3)
      .map((x) => ({ id: x.id, libelle: x.libelle ?? '' })),
    medicaments: meds
      .filter(actif)
      .slice(0, 3)
      .map((x) => ({ id: x.id, nomGenerique: x.nomGenerique })),
  }
}

let compteur = 0

/** Patient CDI complet (données administratives obligatoires de la catégorie). */
export async function creerPatientCdi(
  c: Client,
  ref: Referentiels,
  prenom: string,
): Promise<string> {
  compteur += 1
  const r = await c.post<{ id: string }>('/patients', {
    nom: 'TEST',
    prenom,
    dateNaissance: '1980-03-14',
    sexe: 'M',
    categoriePatientId: ref.categories['ASSURE_CDI'],
    siteCreationId: ref.siteId,
    matricule: `E2E-${Date.now()}-${compteur}`,
    fonction: 'Opérateur',
    sectionPaie: 'S1',
    service: 'Production',
    departement: 'Usine',
  })
  if (r.status !== 201)
    throw new Error(
      `Création patient : HTTP ${r.status} ${JSON.stringify(r.body)}`,
    )
  return r.body.id
}
