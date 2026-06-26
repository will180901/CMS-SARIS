/**
 * Copie le frontend buildé (apps/web/dist) dans apps/desktop/app et place
 * l'écran de connexion (server-config.html) à côté du main compilé.
 * Lancé après le build du renderer et la compilation Electron.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const desktopRoot = path.resolve(here, '..')
const rendererSrc = path.resolve(desktopRoot, '..', 'web', 'dist')
const rendererDest = path.resolve(desktopRoot, 'app')

if (!fs.existsSync(rendererSrc)) {
  console.error(`[copy-renderer] Frontend introuvable : ${rendererSrc}`)
  console.error("[copy-renderer] Lancez d'abord : pnpm run build:renderer")
  process.exit(1)
}

fs.rmSync(rendererDest, { recursive: true, force: true })
fs.cpSync(rendererSrc, rendererDest, { recursive: true })
console.log(`[copy-renderer] Frontend copié → ${rendererDest}`)

// Écrans Electron (connexion serveur + configuration du poste) à côté de main.js
// (dist-electron) pour loadFile().
fs.mkdirSync(path.resolve(desktopRoot, 'dist-electron'), { recursive: true })
for (const html of ['server-config.html', 'sync-setup.html']) {
  fs.copyFileSync(
    path.resolve(desktopRoot, 'electron', html),
    path.resolve(desktopRoot, 'dist-electron', html),
  )
  console.log(`[copy-renderer] ${html} copié`)
}

// Logo de l'écran de configuration (vrai mark CMS SARIS, à côté du HTML pour <img src>).
fs.copyFileSync(
  path.resolve(desktopRoot, 'electron', 'setup-logo.png'),
  path.resolve(desktopRoot, 'dist-electron', 'setup-logo.png'),
)
console.log('[copy-renderer] setup-logo.png copié')

// URL serveur figée au build (SARIS_DEFAULT_API_URL) → defaults.json packagé.
const defaults = { apiUrl: (process.env.SARIS_DEFAULT_API_URL || '').trim() }
fs.writeFileSync(path.resolve(desktopRoot, 'dist-electron', 'defaults.json'), JSON.stringify(defaults, null, 2))
console.log(`[copy-renderer] URL serveur par défaut : ${defaults.apiUrl || '(vide → écran de connexion au 1er lancement)'}`)
