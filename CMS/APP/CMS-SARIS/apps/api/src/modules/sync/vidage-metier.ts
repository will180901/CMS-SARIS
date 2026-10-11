/**
 * Vidage des DONNÉES MÉTIER : le dossier patient et tout le parcours de soins, rien d'autre.
 *
 * Ce module dit CE QUI PART et DANS QUEL ORDRE ; il est partagé par le serveur central (qui
 * vide sa base) et par le client de synchronisation d'un poste (qui vide sa copie locale quand le
 * serveur le lui ordonne) — les deux doivent vider exactement la même chose.
 *
 * Part : dossiers patients et tout ce qui s'y rattache (identité, allergies, rattachements…), visites,
 * constantes, consultations, ordonnances, bons d'examen et de pharmacie, résultats, évacuations,
 * suivis ; les notifications qui en parlent ; les conflits de synchronisation qui en contiennent des
 * copies ; les rapports statistiques générés (des instantanés de ces données).
 *
 * Reste : comptes, rôles, personnel, référentiels (catégories, sites, médicaments, pathologies…),
 * messagerie, paramètres, journaux d'audit et de connexion, postes et leur historique d'échanges.
 *
 * Tout passe par le client BRUT (non étendu) : une suppression ordinaire ne ferait qu'un
 * « tombstone » propagé aux postes, alors qu'ici supprimer veut dire supprimer.
 */
import type { Prisma, PrismaClient } from '@prisma/client'

/**
 * Les tables métier, dans l'ordre d'INSERTION (parents avant enfants, à cause des clés étrangères).
 * L'ordre de suppression est l'inverse. Un test vérifie cet ordre ET qu'aucune autre table du schéma
 * ne pointe vers l'une d'elles (cf. test/vidage-metier.test.ts) : une table ajoutée demain au
 * dossier patient ne peut pas être oubliée sans que la suite de tests le dise.
 */
export const TABLES_METIER: readonly string[] = [
  'Patient',
  'FusionDossierPatient',
  'IdentitePatient',
  'ContactUrgence',
  'DonneesEmploi',
  'ModeViePatient',
  'AllergiePatient',
  'AntecedentPatient',
  'AlerteMedicale',
  'HistoriqueCategoriePatient',
  'RattachementAyantDroitCdi',
  'HistoriqueRattachementAyantDroit',
  'RattachementSousTraitant',
  'HistoriqueRattachementSousTraitant',
  'Visite',
  'VisiteEvenement',
  'ConstanteVitale',
  'Consultation',
  'DiagnosticConsultation',
  'Ordonnance',
  'LigneOrdonnance',
  'BonExamen',
  'LigneExamen',
  'ResultatExamen',
  'PieceJointeResultat',
  'BonPharmacie',
  'LigneBonPharmacie',
  'SuiviChronique',
  'Evacuation',
  'SuiviEvacuation',
  'SuiviTraitement',
  'FicheSuiviTraitement',
  'AdministrationTraitement',
]

/**
 * Types d'entité des notifications qui parlent d'un dossier, d'une visite, d'une consultation…
 * (ceux que l'application écrit dans `Notification.entiteType`). Les notifications de messagerie,
 * de session ou de gestion des comptes restent.
 */
export const ENTITES_NOTIFICATION_METIER: readonly string[] = [
  'patient',
  'visite',
  'consultation',
  'ordonnance',
  'evacuation',
  'suivi_traitement',
]

/** Ce qui s'efface EN PLUS des tables métier, et ne vient pas d'un modèle de dossier. */
export const AUTRES_DONNEES_METIER = {
  notifications: 'Notifications sur des dossiers et des visites',
  conflits: 'Conflits et refus de synchronisation sur des données métier',
  rapports: 'Rapports statistiques générés',
} as const

export type AutreDonneeMetier = keyof typeof AUTRES_DONNEES_METIER

/** « IdentitePatient » → « identitePatient » : le délégué du client Prisma. */
export function delegueMetier(modele: string): string {
  return modele.charAt(0).toLowerCase() + modele.slice(1)
}

interface DelegueSuppression {
  deleteMany: (a: {
    where?: unknown
  }) => Prisma.PrismaPromise<{ count: number }>
  count: (a?: { where?: unknown }) => Promise<number>
}

function delegue(raw: PrismaClient, modele: string): DelegueSuppression {
  return (raw as unknown as Record<string, DelegueSuppression>)[
    delegueMetier(modele)
  ]
}

/** Combien de lignes porte chaque table métier (tombstones compris : le client est brut). */
export async function compterDonneesMetier(
  raw: PrismaClient,
): Promise<{ tables: Record<string, number>; autres: Record<string, number> }> {
  const tables: Record<string, number> = {}
  for (const m of TABLES_METIER) {
    const n = await delegue(raw, m).count()
    if (n > 0) tables[m] = n
  }
  const autres: Record<string, number> = {}
  const notifications = await raw.notification.count({
    where: { entiteType: { in: [...ENTITES_NOTIFICATION_METIER] } },
  })
  if (notifications > 0) autres['notifications'] = notifications
  const conflits = await raw.conflitSynchronisation.count({
    where: { entiteType: { in: [...TABLES_METIER] } },
  })
  if (conflits > 0) autres['conflits'] = conflits
  const rapports = await raw.rapportGenere.count()
  if (rapports > 0) autres['rapports'] = rapports
  return { tables, autres }
}

export interface ResultatVidage {
  tables: Record<string, number>
  autres: Record<string, number>
  total: number
}

/**
 * Vide les données métier, EN UNE SEULE TRANSACTION : tout part ou rien ne part (une clé étrangère
 * oubliée fait échouer l'ensemble et laisse la base intacte).
 *
 * `avec` : opérations à joindre à la MÊME transaction (état du vidage, demandes aux postes) — leur
 * résultat est rendu à la suite, dans l'ordre.
 */
export async function viderDonneesMetier(
  raw: PrismaClient,
  avec: Prisma.PrismaPromise<unknown>[] = [],
): Promise<ResultatVidage & { avec: unknown[] }> {
  const ordre = [...TABLES_METIER].reverse()
  const resultats = await raw.$transaction([
    ...ordre.map((m) => delegue(raw, m).deleteMany({})),
    raw.notification.deleteMany({
      where: { entiteType: { in: [...ENTITES_NOTIFICATION_METIER] } },
    }),
    raw.conflitSynchronisation.deleteMany({
      where: { entiteType: { in: [...TABLES_METIER] } },
    }),
    raw.rapportGenere.deleteMany({}),
    ...avec,
  ])
  const tables: Record<string, number> = {}
  ordre.forEach((m, i) => {
    const n = (resultats[i] as { count: number }).count
    if (n > 0) tables[m] = n
  })
  const autres: Record<string, number> = {}
  const base = ordre.length
  const extras: AutreDonneeMetier[] = ['notifications', 'conflits', 'rapports']
  extras.forEach((cle, i) => {
    const n = (resultats[base + i] as { count: number }).count
    if (n > 0) autres[cle] = n
  })
  const total =
    Object.values(tables).reduce((s, n) => s + n, 0) +
    Object.values(autres).reduce((s, n) => s + n, 0)
  return { tables, autres, total, avec: resultats.slice(base + extras.length) }
}
