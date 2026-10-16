/**
 * Identifiant de connexion (« login ») : sa forme, et ce qui le rend libre ou non.
 *
 * Les identifiants sont normalisés en MINUSCULES et comparés sans tenir compte de la casse :
 * « Moukanda » et « moukanda » ne sont pas deux personnes. La colonne de la base est `@unique` mais
 * SENSIBLE À LA CASSE (PostgreSQL comme SQLite) — la règle est donc tenue ici, à chaque écriture, par
 * `lower("login")`, qui s'écrit pareil dans les deux bases.
 */
import type { PrismaService } from '../../prisma/prisma.service'

export const IDENTIFIANT_LONGUEUR_MIN = 3
export const IDENTIFIANT_LONGUEUR_MAX = 32
const FORMAT = /^[a-z][a-z0-9._-]*$/

/** Combien de temps un identifiant LIBÉRÉ par un changement reste mis de côté. */
export const JOURS_RESERVATION = 90
const JOUR_MS = 24 * 3600 * 1000

/** Ce que la personne a tapé, ramené à la forme stockée : sans espaces autour, en minuscules. */
export function normaliserIdentifiant(brut: string): string {
  return (brut ?? '').trim().toLowerCase()
}

/** Pourquoi cette saisie (DÉJÀ normalisée) n'est pas un identifiant valable ; `null` si elle l'est. */
export function erreurIdentifiant(login: string): string | null {
  if (
    login.length < IDENTIFIANT_LONGUEUR_MIN ||
    login.length > IDENTIFIANT_LONGUEUR_MAX
  )
    return `Identifiant : ${IDENTIFIANT_LONGUEUR_MIN} à ${IDENTIFIANT_LONGUEUR_MAX} caractères.`
  if (!FORMAT.test(login))
    return 'Identifiant : lettres, chiffres et . _ - uniquement, en commençant par une lettre.'
  return null
}

/** Date jusqu'à laquelle un identifiant libéré à `quand` reste réservé. */
export function finDeReservation(quand: Date): Date {
  return new Date(quand.getTime() + JOURS_RESERVATION * JOUR_MS)
}

/** « 14 janvier 2027 » — pour le dire à la personne en toutes lettres. */
export function dateFrancaise(d: Date): string {
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Le compte (vivant ou non) dont l'identifiant correspond à cette saisie, SANS tenir compte de la casse
 * — y compris un compte ANCIEN dont l'identifiant a des majuscules. `null` s'il n'y en a pas. En cas
 * d'homonymes de casse (anciens comptes), le plus ancien l'emporte.
 */
export async function idParIdentifiant(
  prisma: PrismaService,
  saisi: string,
): Promise<string | null> {
  const bas = normaliserIdentifiant(saisi)
  const lignes = await prisma.raw.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Utilisateur" WHERE lower("login") = ${bas} ORDER BY "createdAt" ASC LIMIT 1`
  return lignes[0]?.id ?? null
}

export interface IdentifiantPris {
  id: string
  /** Le titulaire est un compte SUPPRIMÉ : il garde son identifiant à vie (trace d'audit). */
  supprime: boolean
}

/**
 * Cet identifiant est-il déjà celui de quelqu'un d'autre ? Sans tenir compte de la casse, et en
 * comptant les comptes SUPPRIMÉS (leur ligne reste, et son identifiant avec). `sauf` : le compte qui
 * fait la demande — son propre identifiant ne le gêne pas (changer seulement la casse est permis).
 */
export async function identifiantPris(
  prisma: PrismaService,
  login: string,
  sauf?: string,
): Promise<IdentifiantPris | null> {
  const lignes = await prisma.raw.$queryRaw<
    { id: string; deletedAt: Date | string | number | null }[]
  >`SELECT "id", "deletedAt" FROM "Utilisateur" WHERE lower("login") = ${login}`
  const autre = lignes.find((l) => l.id !== sauf)
  return autre ? { id: autre.id, supprime: !!autre.deletedAt } : null
}

/**
 * Cet identifiant vient-il d'être LIBÉRÉ par son ancien titulaire (changement d'identifiant récent) ?
 * Alors il est mis de côté quelques semaines : les anciennes lignes du journal portent ce nom, et le
 * donner tout de suite à quelqu'un d'autre ferait croire que c'est la même personne. Rend la date de
 * fin de réservation, ou `null`. L'ancien titulaire (`sauf`) peut toujours le reprendre.
 *
 * La mémoire de la réservation est le journal d'audit (action `CHANGE_LOGIN`, `avantJson.loginMin`) :
 * elle dure donc au plus la conservation du journal. Les filtres sur du JSON n'existent pas sous
 * SQLite (poste de bureau) : le changement d'identifiant y est de toute façon refusé.
 */
export async function identifiantReserve(
  prisma: PrismaService,
  login: string,
  sauf?: string,
): Promise<Date | null> {
  if (process.env['DATABASE_PROVIDER'] === 'sqlite') return null
  const depuis = new Date(Date.now() - JOURS_RESERVATION * JOUR_MS)
  const l = await prisma.raw.journalAudit.findFirst({
    where: {
      action: 'CHANGE_LOGIN',
      createdAt: { gte: depuis },
      avantJson: { path: ['loginMin'], equals: login },
      ...(sauf ? { NOT: { entiteId: sauf } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  return l ? finDeReservation(l.createdAt) : null
}
