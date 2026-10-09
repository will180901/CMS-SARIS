/**
 * Mise à niveau du schéma de la base LOCALE d'un poste (SQLite, client de bureau).
 *
 * POURQUOI. La base d'un poste est copiée UNE fois depuis le modèle `seed.db` à
 * l'installation (apps/desktop/electron/db-init.ts), puis n'était plus jamais touchée :
 * un poste déjà installé qui recevait une nouvelle version gardait l'ancien schéma, et
 * le backend embarqué plantait dès la première colonne ajoutée depuis. Le poste peut
 * contenir des saisies pas encore envoyées au central : on ne l'efface donc jamais, on
 * le met à niveau en place.
 *
 * COMMENT. Au démarrage, chaque migration de `prisma/sqlite/migrations` (embarquées
 * dans l'installateur, dossier `SQLITE_MIGRATIONS_DIR`) non encore notée dans la table
 * `_MiseANiveauPoste` est :
 *  - CONSTATÉE si la base la reflète déjà (colonnes, tables et index qu'elle crée sont
 *    tous présents, et ce qu'elle supprime a disparu) — cas d'un poste installé depuis un
 *    `seed.db` récent, construit par
 *    `prisma db push`, ou d'une migration déjà passée. Elle n'est PAS rejouée : une
 *    migration qui recrée une table (SQLite n'a pas d'ALTER complet) remettrait sinon à
 *    zéro des colonnes déjà remplies.
 *  - APPLIQUÉE sinon, d'un bloc dans une transaction : en cas d'échec, rien n'est
 *    modifié et le backend refuse de démarrer (mieux qu'une base à moitié migrée).
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Logger } from '@nestjs/common'
import type { PrismaClient } from '@prisma/client'

/** Requêtes brutes seulement : le client SQLite est chargé dynamiquement (PrismaService). */
type ClientSql = Pick<PrismaClient, '$executeRawUnsafe' | '$queryRawUnsafe'>

type Attente =
  | { genre: 'colonne'; table: string; colonne: string }
  | { genre: 'index'; nom: string }
  /** Table supprimée par la migration : elle ne doit plus exister. */
  | { genre: 'tableAbsente'; table: string }
  /** Colonnes que la migration retire en recréant la table : elles ne doivent plus y être.
   *  Sans cette attente, une migration qui retire une colonne passait pour « déjà faite »
   *  sur un ancien poste — toutes les colonnes qu'elle recrée y étant déjà, plus la retirée. */
  | { genre: 'colonnesAbsentes'; table: string; colonnes: string[] }

const TABLE_SUIVI = '_MiseANiveauPoste'

/**
 * Ce que la migration laisse derrière elle : colonnes, tables (via leurs colonnes), index,
 * et ce qu'elle fait disparaître. `avant` = schéma au bout des migrations PRÉCÉDENTES : il
 * dit quelles colonnes une table recréée (« new_T ») perd — et seulement celles-là, pour
 * qu'une ancienne recréation ne soit jamais rejouée à cause d'une colonne retirée plus tard.
 */
export function attentesDeMigration(
  sql: string,
  avant?: { tables: Map<string, Set<string>> },
): Attente[] {
  const attentes: Attente[] = []
  for (const m of sql.matchAll(/ALTER TABLE "(\w+)" ADD COLUMN "(\w+)"/g))
    attentes.push({ genre: 'colonne', table: m[1], colonne: m[2] })
  // CREATE TABLE "T" (...) ou "new_T" (...) — table recréée puis renommée en "T".
  for (const m of sql.matchAll(/CREATE TABLE "(?:new_)?(\w+)" \(([\s\S]*?)\n\);/g)) {
    for (const col of m[2].matchAll(/^\s+"(\w+)"\s/gm))
      attentes.push({ genre: 'colonne', table: m[1], colonne: col[1] })
  }
  for (const m of sql.matchAll(/CREATE (?:UNIQUE )?INDEX "(\w+)"/g))
    attentes.push({ genre: 'index', nom: m[1] })
  for (const m of sql.matchAll(/DROP TABLE (?:IF EXISTS )?"(\w+)"/g))
    if (!m[1].startsWith('new_')) attentes.push({ genre: 'tableAbsente', table: m[1] })
  if (avant) {
    for (const m of sql.matchAll(/CREATE TABLE "new_(\w+)" \(([\s\S]*?)\n\);/g)) {
      const gardees = new Set([...m[2].matchAll(/^\s+"(\w+)"\s/gm)].map((c) => c[1]))
      const retirees = [...(avant.tables.get(m[1]) ?? [])].filter((c) => !gardees.has(c))
      if (retirees.length > 0)
        attentes.push({ genre: 'colonnesAbsentes', table: m[1], colonnes: retirees })
    }
  }
  return attentes
}

/**
 * Schéma au BOUT de la chaîne de migrations (tables → colonnes, index), en rejouant
 * créations, ajouts, renommages et suppressions. Une migration peut créer ce qu'une
 * suivante supprime (la table AccidentTravail de la migration initiale, retirée ensuite) :
 * on ne peut donc exiger d'une base que ce qui existe ENCORE à la fin.
 */
export function etatFinal(sqls: string[]): { tables: Map<string, Set<string>>; index: Set<string> } {
  const tables = new Map<string, Set<string>>()
  const indexTable = new Map<string, string>()
  for (const sql of sqls) {
    for (const instr of instructionsDeMigration(sql)) {
      let m: RegExpMatchArray | null
      if ((m = instr.match(/^CREATE TABLE "(\w+)" \(([\s\S]*)\)$/))) {
        tables.set(m[1], new Set([...m[2].matchAll(/^\s+"(\w+)"\s/gm)].map((c) => c[1])))
      } else if ((m = instr.match(/^ALTER TABLE "(\w+)" ADD COLUMN "(\w+)"/))) {
        tables.get(m[1])?.add(m[2])
      } else if ((m = instr.match(/^ALTER TABLE "(\w+)" RENAME TO "(\w+)"/))) {
        const cols = tables.get(m[1])
        tables.delete(m[1])
        if (cols) tables.set(m[2], cols)
      } else if ((m = instr.match(/^DROP TABLE (?:IF EXISTS )?"(\w+)"/))) {
        tables.delete(m[1])
        // SQLite supprime les index d'une table avec elle.
        for (const [nom, table] of indexTable) if (table === m[1]) indexTable.delete(nom)
      } else if ((m = instr.match(/^CREATE (?:UNIQUE )?INDEX "(\w+)" ON "(\w+)"/))) {
        indexTable.set(m[1], m[2])
      } else if ((m = instr.match(/^DROP INDEX (?:IF EXISTS )?"(\w+)"/))) {
        indexTable.delete(m[1])
      }
    }
  }
  return { tables, index: new Set(indexTable.keys()) }
}

/** Instructions exécutables une à une (commentaires retirés). `PRAGMA foreign_keys` est
 *  écarté : sans effet dans une transaction, et la base locale tourne déjà sans
 *  contrôle des clés étrangères (PrismaService). */
export function instructionsDeMigration(sql: string): string[] {
  return sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^PRAGMA\s+foreign_keys\s*=/i.test(s))
}

async function attentesSatisfaites(client: ClientSql, attentes: Attente[]): Promise<boolean> {
  const colonnesParTable = new Map<string, Set<string>>()
  const colonnesDe = async (table: string) => {
    let cols = colonnesParTable.get(table)
    if (!cols) {
      const lignes = await client.$queryRawUnsafe<{ name: string }[]>(
        `PRAGMA table_info("${table}")`,
      )
      cols = new Set(lignes.map((l) => l.name))
      colonnesParTable.set(table, cols)
    }
    return cols
  }
  for (const a of attentes) {
    if (a.genre === 'colonne') {
      if (!(await colonnesDe(a.table)).has(a.colonne)) return false
    } else if (a.genre === 'colonnesAbsentes') {
      const cols = await colonnesDe(a.table)
      if (a.colonnes.some((c) => cols.has(c))) return false
    } else if (a.genre === 'tableAbsente') {
      const t = await client.$queryRawUnsafe<{ name: string }[]>(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
        a.table,
      )
      if (t.length > 0) return false
    } else {
      const idx = await client.$queryRawUnsafe<{ name: string }[]>(
        `SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?`,
        a.nom,
      )
      if (idx.length === 0) return false
    }
  }
  return true
}

export async function mettreANiveauBaseLocale(
  client: ClientSql & Pick<PrismaClient, '$transaction'>,
  dossier: string | undefined,
  logger: Logger,
): Promise<void> {
  if (!dossier || !fs.existsSync(dossier)) {
    logger.warn(
      `Mise à niveau de la base locale impossible : dossier des migrations introuvable (${dossier ?? 'SQLITE_MIGRATIONS_DIR absent'}).`,
    )
    return
  }
  await client.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "${TABLE_SUIVI}" ("nom" TEXT NOT NULL PRIMARY KEY, "mode" TEXT NOT NULL, "le" TEXT NOT NULL)`,
  )
  const dejaNotees = new Set(
    (await client.$queryRawUnsafe<{ nom: string }[]>(`SELECT "nom" FROM "${TABLE_SUIVI}"`)).map(
      (l) => l.nom,
    ),
  )
  const migrations = fs
    .readdirSync(dossier, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{14}_/.test(d.name))
    .map((d) => d.name)
    .sort()

  const sqlDe = new Map<string, string>()
  for (const nom of migrations) {
    const fichier = path.join(dossier, nom, 'migration.sql')
    // Fins de ligne normalisées : une extraction git sous Windows peut les passer en CRLF.
    if (fs.existsSync(fichier)) sqlDe.set(nom, fs.readFileSync(fichier, 'utf8').replace(/\r\n/g, '\n'))
  }
  const final = etatFinal([...sqlDe.values()])

  let appliquees = 0
  for (const [rang, nom] of migrations.entries()) {
    if (dejaNotees.has(nom)) continue
    const sql = sqlDe.get(nom)
    if (sql === undefined) continue
    // Seul ce qui existe ENCORE au bout de la chaîne est exigé (cf. etatFinal) ; ce qu'elle
    // supprime ne doit plus exister, sauf si une migration suivante le recrée. Une migration
    // sans rien de vérifiable (que des données) est appliquée.
    const avant = etatFinal(
      migrations.slice(0, rang).map((n) => sqlDe.get(n)).filter((x): x is string => x !== undefined),
    )
    const attentes = attentesDeMigration(sql, avant)
      .map((a): Attente | null => {
        if (a.genre === 'colonne') return final.tables.get(a.table)?.has(a.colonne) ? a : null
        if (a.genre === 'index') return final.index.has(a.nom) ? a : null
        if (a.genre === 'tableAbsente') return final.tables.has(a.table) ? null : a
        const encoreAbsentes = a.colonnes.filter((c) => !final.tables.get(a.table)?.has(c))
        return encoreAbsentes.length > 0 ? { ...a, colonnes: encoreAbsentes } : null
      })
      .filter((a): a is Attente => a !== null)

    if (attentes.length > 0 && (await attentesSatisfaites(client, attentes))) {
      await client.$executeRawUnsafe(
        `INSERT INTO "${TABLE_SUIVI}" ("nom", "mode", "le") VALUES (?, 'CONSTATEE', ?)`,
        nom,
        new Date().toISOString(),
      )
      continue
    }

    const instructions = instructionsDeMigration(sql)
    try {
      await client.$transaction(async (tx) => {
        for (const instruction of instructions) await tx.$executeRawUnsafe(instruction)
        await tx.$executeRawUnsafe(
          `INSERT INTO "${TABLE_SUIVI}" ("nom", "mode", "le") VALUES (?, 'APPLIQUEE', ?)`,
          nom,
          new Date().toISOString(),
        )
      })
    } catch (e) {
      throw new Error(
        `Mise à niveau de la base locale : la migration ${nom} a échoué, rien n'a été modifié (${(e as Error).message}).`,
      )
    }
    logger.log(`Base locale mise à niveau : ${nom}`)
    appliquees++
  }

  // Une migration APPLIQUÉE rend souvent de nouvelles tables synchronisables. Leurs lignes
  // existantes ont reçu, sur le central, l'heure de SA migration — antérieure, le plus
  // souvent, au curseur de réception de ce poste (qui a continué de se synchroniser avec
  // l'ancienne version) : il ne les recevrait jamais. On ramène donc le curseur de
  // RÉCEPTION au début : le poste reprend tout en arrière-plan, sans risque (application
  // « le plus récent gagne »). Le curseur d'ENVOI n'est pas touché.
  if (appliquees > 0) {
    try {
      const n = await client.$executeRawUnsafe(`UPDATE "SyncState" SET "lastPulledAt" = ?`, new Date(0))
      if (n > 0) logger.log('Base locale mise à niveau : réception complète programmée (curseur remis au début).')
    } catch {
      /* table absente (poste jamais synchronisé) : rien à rattraper */
    }
  }
}
