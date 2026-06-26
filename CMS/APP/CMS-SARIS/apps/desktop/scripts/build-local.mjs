/**
 * Build de l'INSTALLEUR « MODE LOCAL » (offline-first : backend NestJS + SQLite embarqués).
 *
 * Le mode REMOTE par défaut se build avec `pnpm --filter @cms-saris/desktop dist`
 * (config `electron-builder.yml`). Le mode LOCAL exige des artefacts supplémentaires
 * (API compilée + node_modules à plat, client Prisma SQLite, base pré-migrée) que ce
 * script prépare AVANT d'appeler electron-builder avec `electron-builder.local.yml`.
 *
 * Étapes (toutes validées manuellement) :
 *   1. build renderer (web, mode desktop) + copie dans app/
 *   2. build main Electron (tsc)            → dist-electron/ (dont le fix execArgv)
 *   3. build API (nest build)               → ../api/dist/main.js (bootstrap)
 *   4. client Prisma SQLite                 → packages/db/prisma/sqlite/generated
 *   5. seed.db pré-migrée (db push)         → build/seed.db (toutes les tables)
 *   6. client SQLite copié                  → build/sqlite-client
 *   7. deploy API à plat + binaires natifs  → build/api-runtime (node_modules complet)
 *   8. electron-builder (config locale)     → release/CMS SARIS-Local-Setup-*.exe
 *
 * Usage :  node scripts/build-local.mjs            (depuis apps/desktop)
 *          node scripts/build-local.mjs --dir      (dossier non empaqueté, sans NSIS)
 *
 * ⚠️ À lancer de préférence SANS serveur de dev en cours (les watchers verrouillent
 *    les moteurs natifs Prisma → EPERM possible sur `prisma generate`).
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const desktopDir = path.resolve(__dirname, '..')
const repoRoot = path.resolve(desktopDir, '..', '..')
const buildDir = path.join(desktopDir, 'build')
const dirOnly = process.argv.includes('--dir')

const toUrl = (p) => 'file:' + p.split(path.sep).join('/')
function run(cmd, opts = {}) {
  console.log('\n$ ' + cmd)
  execSync(cmd, { stdio: 'inherit', cwd: repoRoot, ...opts })
}
function copyDir(src, dst) {
  fs.rmSync(dst, { recursive: true, force: true })
  fs.cpSync(src, dst, { recursive: true })
}

// 1-3 — builds  (le paquet web s'appelle « web », PAS « @cms-saris/web » : un mauvais
// filtre fait sortir pnpm en code 0 SANS rien construire -> renderer perime dans l'app.)
run('pnpm --filter web build:desktop')
run('node scripts/copy-renderer.mjs', { cwd: desktopDir })
run('pnpm --filter @cms-saris/desktop build:main')
run('pnpm --filter api build')

// 4 — client Prisma SQLite (régénère le schéma puis le client ; tolère l'EPERM si verrou)
run('pnpm --filter @cms-saris/db db:sqlite:gen')
try {
  run('pnpm --filter @cms-saris/db db:sqlite:generate')
} catch {
  console.warn('⚠️  prisma generate (sqlite) a échoué (moteur verrouillé ?) — on réutilise le client existant.')
}

// 5 — modèle de base SQLite : SCHÉMA SEUL (toutes les tables, dont SyncState), AUCUNE
// donnée. La base locale démarre VIDE et se remplit par la SYNCHRO depuis le serveur
// central (offline-first). PAS de seed : le système est destiné à la production réelle
// (les vraies données viennent du central, pas de données de démo).
fs.mkdirSync(buildDir, { recursive: true })
const seedDb = path.join(buildDir, 'seed.db')
for (const ext of ['', '-journal', '-wal', '-shm']) fs.rmSync(seedDb + ext, { force: true })
run('pnpm --filter @cms-saris/db exec prisma db push --schema prisma/sqlite/schema.prisma --skip-generate', {
  env: { ...process.env, DATABASE_URL: toUrl(seedDb) },
})

// 6 — client SQLite généré → build/sqlite-client (extraResource)
copyDir(path.join(repoRoot, 'packages', 'db', 'prisma', 'sqlite', 'generated'), path.join(buildDir, 'sqlite-client'))

// 7 — deploy API à plat (node_modules sans symlink) + binaires natifs non inclus par le deploy
const apiRuntime = path.join(buildDir, 'api-runtime')
fs.rmSync(apiRuntime, { recursive: true, force: true })
run(`pnpm --filter api deploy --prod --ignore-scripts --config.node-linker=hoisted "apps/desktop/build/api-runtime"`)
const tnm = path.join(apiRuntime, 'node_modules')
// .prisma (client + moteur PostgreSQL — requis par `super()` même en mode SQLite) : généré, jamais dans le store.
const pnpmDir = path.join(repoRoot, 'node_modules', '.pnpm')
const prismaPkg = fs.readdirSync(pnpmDir).find((d) => d.startsWith('@prisma+client@'))
if (prismaPkg) {
  const dotPrisma = path.join(pnpmDir, prismaPkg, 'node_modules', '.prisma')
  if (fs.existsSync(dotPrisma) && !fs.existsSync(path.join(tnm, '.prisma'))) copyDir(dotPrisma, path.join(tnm, '.prisma'))
}
// Binaire de plateforme de sharp (optionnel, parfois omis par le deploy).
const imgDst = path.join(tnm, '@img', 'sharp-win32-x64')
if (!fs.existsSync(imgDst)) {
  const imgSrc = path.join(pnpmDir, '@img+sharp-win32-x64@0.34.5', 'node_modules', '@img', 'sharp-win32-x64')
  if (fs.existsSync(imgSrc)) copyDir(imgSrc, imgDst)
}

// 7b — défauts figés au build : MODE LOCAL + SECRETS du backend embarqué.
// Le backend embarqué (resources/api) n'a PAS de .env → on bake ici, depuis le .env du
// central, les secrets qu'il EXIGE : JWT_SECRET (sinon CRASH « Configuration key JWT_SECRET
// does not exist » au démarrage) + TOTP_ENC_KEY et MESSAGE_ENC_KEY qui DOIVENT correspondre
// au central pour déchiffrer les données chiffrées synchronisées (secrets 2FA, messages).
// ⚠️ Ces secrets finissent dans l'asar (extractibles) — acceptable pour un déploiement
// maîtrisé ; en prod, baker les clés DU déploiement cible. MERGE (copy-renderer a écrit apiUrl).
const defaultsPath = path.join(desktopDir, 'dist-electron', 'defaults.json')
let curDefaults = {}
try { curDefaults = JSON.parse(fs.readFileSync(defaultsPath, 'utf8')) } catch { /* absent */ }

const envVars = {}
try {
  for (const line of fs.readFileSync(path.join(repoRoot, 'apps', 'api', '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (m) envVars[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch { console.warn('⚠️  apps/api/.env introuvable — secrets NON bakés (backend embarqué inopérant).') }

const secrets = {
  jwtSecret:           envVars.JWT_SECRET,
  jwtExpiresIn:        envVars.JWT_EXPIRES_IN,
  jwtRefreshExpiresIn: envVars.JWT_REFRESH_EXPIRES_IN,
  totpEncKey:          envVars.TOTP_ENC_KEY,
  messageEncKey:       envVars.MESSAGE_ENC_KEY ?? envVars.TOTP_ENC_KEY,
}
if (!secrets.jwtSecret) console.warn('⚠️  JWT_SECRET absent du .env → le backend embarqué crashera au démarrage.')
fs.writeFileSync(defaultsPath, JSON.stringify({ ...curDefaults, ...secrets, mode: 'local' }, null, 2))
console.log('[build-local] mode local + secrets backend (JWT/TOTP/MESSAGE) bakés dans defaults.json')

// 8 — packaging
const ebMode = dirOnly ? '--dir' : ''
run(`pnpm --filter @cms-saris/desktop exec electron-builder --win ${ebMode} --config electron-builder.local.yml`, {
  env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
})

console.log('\n✅ Build local terminé. Sortie : apps/desktop/release/')
