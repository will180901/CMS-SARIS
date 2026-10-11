/**
 * Mettre de côté, puis remettre, les données métier de la base de test.
 *
 * Les tests du vidage effacent TOUT le dossier patient — y compris les cinq dossiers de démonstration
 * du seed, dont d'autres fichiers de test ont besoin (ils en prennent un modèle). La base de test est
 * partagée entre tous les fichiers : celui qui vide doit la rendre telle qu'il l'a trouvée.
 *
 * Copie exacte, ligne pour ligne, par PostgreSQL lui-même (`to_jsonb` puis `jsonb_populate_recordset`) :
 * aucune colonne, aucun type (tableaux, JSON, énumérations) n'est réinterprété en route.
 */
import type { PrismaClient } from '@prisma/client'
import {
  ENTITES_NOTIFICATION_METIER,
  TABLES_METIER,
  viderDonneesMetier,
} from '../../src/modules/sync/vidage-metier'

interface Copie {
  table: string
  lignes: string
}

export interface SauvegardeMetier {
  tables: Copie[]
  notifications: string
  conflits: string
  rapports: string
}

const ENTITES = ENTITES_NOTIFICATION_METIER.map((e) => `'${e}'`).join(',')
const MODELES = TABLES_METIER.map((m) => `'${m}'`).join(',')

async function copier(
  raw: PrismaClient,
  table: string,
  ou = '',
): Promise<string> {
  const r = await raw.$queryRawUnsafe<{ j: unknown }[]>(
    `SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS j FROM "${table}" t ${ou}`,
  )
  return JSON.stringify(r[0]?.j ?? [])
}

async function recopier(
  raw: PrismaClient,
  table: string,
  lignes: string,
): Promise<void> {
  if (lignes === '[]') return
  await raw.$executeRawUnsafe(
    `INSERT INTO "${table}" SELECT * FROM jsonb_populate_recordset(NULL::"${table}", $1::jsonb)`,
    lignes,
  )
}

export async function sauvegarderMetier(
  raw: PrismaClient,
): Promise<SauvegardeMetier> {
  const tables: Copie[] = []
  for (const table of TABLES_METIER)
    tables.push({ table, lignes: await copier(raw, table) })
  return {
    tables,
    notifications: await copier(
      raw,
      'Notification',
      `WHERE "entiteType" IN (${ENTITES})`,
    ),
    conflits: await copier(
      raw,
      'ConflitSynchronisation',
      `WHERE "entiteType" IN (${MODELES})`,
    ),
    rapports: await copier(raw, 'RapportGenere'),
  }
}

/** Remet la base de test comme elle était à la sauvegarde (ce que le test a laissé est effacé d'abord). */
export async function restaurerMetier(
  raw: PrismaClient,
  s: SauvegardeMetier,
): Promise<void> {
  await viderDonneesMetier(raw)
  for (const { table, lignes } of s.tables) await recopier(raw, table, lignes)
  await recopier(raw, 'Notification', s.notifications)
  await recopier(raw, 'ConflitSynchronisation', s.conflits)
  await recopier(raw, 'RapportGenere', s.rapports)
}
