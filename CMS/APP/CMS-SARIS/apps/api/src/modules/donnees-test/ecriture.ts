/**
 * Écriture en base des lignes fabriquées, et leur suppression.
 *
 * Tout passe par le client BRUT (`prisma.raw`) : le client ordinaire transformerait une suppression
 * en simple « tombstone » (suppression logique propagée aux postes), ce qui laisserait les lignes
 * — et leur poids — en base ; ici, supprimer veut dire supprimer.
 *
 * Une journée s'écrit en UNE transaction : elle entre entière ou pas du tout, jamais à moitié (une
 * visite sans ses constantes, un dossier sans son identité).
 */
import { Prisma } from '@prisma/client'
import type { PrismaService } from '../../prisma/prisma.service'
import { FILTRE_MARQUE } from './marque-test'
import { MODELES_TEST, delegue, type LignesJour } from './registre'

/** PostgreSQL accepte au plus 32 767 paramètres par requête : on reste en dessous. */
const PARAMETRES_MAX = 30_000

const COLONNES = new Map(
  Prisma.dmmf.datamodel.models.map((m) => [
    m.name,
    m.fields.filter((f) => f.kind === 'scalar' || f.kind === 'enum').length,
  ]),
)

interface DelegueCreation {
  createMany: (a: {
    data: unknown[]
  }) => Prisma.PrismaPromise<{ count: number }>
}
interface DelegueSuppression {
  deleteMany: (a: { where: unknown }) => Prisma.PrismaPromise<{ count: number }>
  count: (a: { where: unknown }) => Promise<number>
}

function delegueDe<T>(prisma: PrismaService, modele: string): T {
  return (prisma.raw as unknown as Record<string, T>)[delegue(modele)]
}

/** Écrit les lignes d'une journée, parents avant enfants, et rend le nombre de lignes par table. */
export async function ecrireLignes(
  prisma: PrismaService,
  lignes: LignesJour,
): Promise<Record<string, number>> {
  const operations: Prisma.PrismaPromise<{ count: number }>[] = []
  const comptes: Record<string, number> = {}
  for (const m of MODELES_TEST) {
    const rows = (lignes as unknown as Record<string, unknown[] | undefined>)[
      m.modele
    ]
    if (!rows || rows.length === 0) continue
    const taille = Math.max(
      1,
      Math.floor(PARAMETRES_MAX / (COLONNES.get(m.modele) ?? 10)),
    )
    const d = delegueDe<DelegueCreation>(prisma, m.modele)
    for (let i = 0; i < rows.length; i += taille)
      operations.push(d.createMany({ data: rows.slice(i, i + taille) }))
    comptes[m.modele] = rows.length
  }
  if (operations.length > 0) await prisma.raw.$transaction(operations)
  return comptes
}

/** Combien de lignes portent la marque, table par table (hors dépendantes ajoutées à la main). */
export async function compterMarquees(
  prisma: PrismaService,
): Promise<Record<string, number>> {
  const comptes: Record<string, number> = {}
  for (const m of MODELES_TEST) {
    const n = await delegueDe<DelegueSuppression>(prisma, m.modele).count({
      where: { id: FILTRE_MARQUE },
    })
    if (n > 0) comptes[m.modele] = n
  }
  return comptes
}

/**
 * Supprime TOUTES les données de test : ce qui porte la marque, et ce qui en dépend. Une seule
 * transaction, enfants avant parents. Rend le nombre de lignes supprimées par table.
 */
export async function supprimerMarquees(
  prisma: PrismaService,
): Promise<Record<string, number>> {
  const ordre = [...MODELES_TEST].reverse()
  const resultats = await prisma.raw.$transaction(
    ordre.map((m) =>
      delegueDe<DelegueSuppression>(prisma, m.modele).deleteMany({
        where: m.perimetre,
      }),
    ),
  )
  const comptes: Record<string, number> = {}
  ordre.forEach((m, i) => {
    const n = (resultats[i] as { count: number }).count
    if (n > 0) comptes[m.modele] = n
  })
  return comptes
}
