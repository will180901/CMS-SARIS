/**
 * Génère le schéma Prisma cible SQLite (base locale embarquée) à partir du schéma
 * PostgreSQL source (source de vérité). Transformation idempotente :
 *  - datasource provider postgresql -> sqlite
 *  - generator : output dédié + binaryTargets (n'écrase pas le client PG)
 *  - enums (non supportés par SQLite via Prisma) -> retirés ; champs typés enum -> String ;
 *    valeurs par défaut d'enum -> chaînes quotées
 *
 * Sortie : prisma/sqlite/schema.prisma (+ migration_lock.toml).
 *   node packages/db/scripts/gen-sqlite-schema.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(here, '..', 'prisma', 'schema.prisma')
const OUTDIR = path.resolve(here, '..', 'prisma', 'sqlite')
let s = fs.readFileSync(SRC, 'utf8')

// 1. Collecter les enums (nom -> valeurs) avant suppression
const enums = {}
for (const m of s.matchAll(/enum\s+(\w+)\s*\{([\s\S]*?)\}/g)) {
  const name = m[1]
  const values = m[2]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//') && !l.startsWith('@'))
    .map((l) => l.split(/\s/)[0])
  enums[name] = values
}

// 2. Retirer les blocs enum
s = s.replace(/enum\s+\w+\s*\{[\s\S]*?\}\n?/g, '')

// 3. Remplacer le TYPE des champs enum par String (en conservant le « ? » optionnel)
for (const name of Object.keys(enums)) {
  const re = new RegExp('(\\n\\s+\\w+\\s+)' + name + '(\\??)(\\s)', 'g')
  s = s.replace(re, '$1String$2$3')
}

// 4. Quoter les @default(VALEUR_ENUM) -> @default("VALEUR_ENUM") (sans toucher now()/uuid()/true…)
const enumValues = new Set(Object.values(enums).flat())
s = s.replace(/@default\(([A-Za-z_][A-Za-z0-9_]*)\)/g, (full, val) =>
  enumValues.has(val) ? `@default("${val}")` : full,
)

// 5. datasource -> sqlite
s = s.replace(
  /datasource\s+db\s*\{[\s\S]*?\}/,
  'datasource db {\n  provider = "sqlite"\n  url      = env("DATABASE_URL")\n}',
)

// 6. generator : sortie dédiée + cibles binaires (n'écrase pas le client PostgreSQL)
s = s.replace(
  /generator\s+client\s*\{[\s\S]*?\}/,
  'generator client {\n  provider      = "prisma-client-js"\n  output        = "./generated"\n  binaryTargets = ["native", "windows"]\n}',
)

s = '// ⚠️ GÉNÉRÉ par scripts/gen-sqlite-schema.mjs — NE PAS ÉDITER. Source : ../schema.prisma\n\n' + s.trimStart()

fs.mkdirSync(OUTDIR, { recursive: true })
fs.writeFileSync(path.join(OUTDIR, 'schema.prisma'), s, 'utf8')
// Note : migrations/migration_lock.toml est géré par `prisma migrate` (ne pas l'écrire ici).
console.log('Schéma SQLite généré dans prisma/sqlite/. Enums convertis en String : ' + Object.keys(enums).join(', '))
