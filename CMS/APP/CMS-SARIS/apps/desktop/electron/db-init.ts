/**
 * Initialisation de la base SQLite locale au 1er lancement (mode local).
 *
 * Stratégie retenue (robuste, sans moteur de migration à l'exécution) : copier un
 * modèle pré-migré (`seed.db`, généré au build via `db:sqlite:migrate`) vers le
 * répertoire de données utilisateur. Si le modèle est absent, on laisse Prisma créer
 * la base (suppose les migrations packagées) — ⚠️ à valider au packaging.
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
