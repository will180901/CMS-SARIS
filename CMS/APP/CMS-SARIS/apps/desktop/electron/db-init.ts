/**
 * Initialisation de la base SQLite locale au 1er lancement (mode local).
 *
 * Stratégie retenue : copier un modèle pré-migré (`seed.db`, généré au build par
 * `prisma db push`, cf. scripts/build-local.mjs) vers le répertoire de données
 * utilisateur — UNE fois. Les versions suivantes ne recopient rien : c'est le backend
 * embarqué qui met la base existante à niveau au démarrage, sans rien effacer
 * (apps/api/src/prisma/mise-a-niveau-locale.ts, migrations dans resources/sqlite-migrations).
 */
import fs from 'node:fs'
import path from 'node:path'

export function ensureDb(dbPath: string, templatePath: string): void {
  if (fs.existsSync(dbPath)) return
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  if (fs.existsSync(templatePath)) {
    fs.copyFileSync(templatePath, dbPath)
  }
}
