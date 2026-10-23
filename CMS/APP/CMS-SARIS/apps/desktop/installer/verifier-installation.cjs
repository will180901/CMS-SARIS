'use strict'
/**
 * Vérification d'une installation de CMS SARIS — lancée par l'INSTALLATEUR, avant de dire « terminé ».
 *
 *   ELECTRON_RUN_AS_NODE=1 "CMS SARIS.exe" verifier-installation.cjs <dossier d'installation> [<base locale du poste>]
 *
 * Ne touche à RIEN de ce poste : le service local est démarré sur des COPIES (le modèle `seed.db`, puis la base
 * réelle du poste si elle existe) rangées dans un dossier temporaire, supprimé à la fin. Ce que cela prouve :
 *  - les fichiers de l'application sont tous là (un fichier manquant fait échouer le démarrage) ;
 *  - le service local démarre et répond (moteur de base, dépendances, client SQLite) ;
 *  - la base de CE poste se met à niveau avec cette version, SANS que la vraie base ne soit modifiée — si la mise
 *    à niveau échoue, l'installateur remet l'ancienne version (une base déjà migrée ne revient pas en arrière).
 * Code de sortie : 0 = tout va bien, 1 = quelque chose ne va pas. Les lignes sont en ASCII (l'installateur les affiche).
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const net = require('node:net')
const os = require('node:os')
const path = require('node:path')

const [, , dossierArg, baseReelle] = process.argv
const dossier = dossierArg ? path.resolve(dossierArg) : ''
const ressources = path.join(dossier, 'resources')
const exe = process.execPath

const dit = (ok, texte) => console.log(`${ok === null ? '[INFO]' : ok ? '[OK]  ' : '[ECHEC]'} ${texte}`)
const attendre = (ms) => new Promise((r) => setTimeout(r, ms))

/** Les fichiers sans lesquels le service local ne peut pas démarrer. */
const ESSENTIELS = [
  'CMS SARIS.exe',
  path.join('resources', 'app.asar'),
  path.join('resources', 'seed.db'),
  path.join('resources', 'api', 'dist', 'main.js'),
  path.join('resources', 'api', 'node_modules', '@nestjs', 'core', 'index.js'),
  path.join('resources', 'sqlite-client'),
  path.join('resources', 'sqlite-migrations'),
  path.join('resources', 'app.asar.unpacked', 'dist-electron', 'backend-entry.js'),
]

function portLibre() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

/** Démarre le service local sur la base `db`, attend qu'il réponde, l'arrête. Résultat : { ok, secondes, sortie }. */
async function essayerService(db) {
  const port = await portLibre()
  const { HOST: _h, ...parent } = process.env
  const debut = Date.now()
  let sortie = ''
  const proc = spawn(
    exe,
    ['--experimental-require-module', path.join(ressources, 'app.asar.unpacked', 'dist-electron', 'backend-entry.js')],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: {
        ...parent,
        ELECTRON_RUN_AS_NODE: '1',
        NODE_ENV: 'production',
        DATABASE_PROVIDER: 'sqlite',
        DATABASE_URL: `file:${db.split(path.sep).join('/')}?connection_limit=1`,
        SQLITE_CLIENT_PATH: path.join(ressources, 'sqlite-client'),
        SQLITE_MIGRATIONS_DIR: path.join(ressources, 'sqlite-migrations'),
        PORT: String(port),
        HOST: '127.0.0.1',
        SARIS_API_MAIN: path.join(ressources, 'api', 'dist', 'main.js'),
        // Pas de serveur : la vérification ne synchronise rien et n'envoie rien.
        SERVER_URL: '',
        SITE_ID: '',
        POSTE_LOCAL_ID: '',
        SERVER_SYNC_TOKEN: '',
        SERVER_SYNC_TOKEN_FILE: '',
        APP_VERSION: 'verification',
        // Clés factices : elles servent seulement à démarrer, rien n'est chiffré ni déchiffré ici.
        JWT_SECRET: 'verification-installation-secret-local-0123456789',
        TOTP_ENC_KEY: 'a'.repeat(64),
        MESSAGE_ENC_KEY: 'b'.repeat(64),
      },
    },
  )
  proc.stdout.on('data', (d) => { sortie = (sortie + d).slice(-6000) })
  proc.stderr.on('data', (d) => { sortie = (sortie + d).slice(-6000) })
  let sorti = false
  proc.on('exit', () => { sorti = true })
  let ok = false
  try {
    for (let i = 0; i < 180 && !ok && !sorti; i++) {
      try {
        const ctrl = new AbortController()
        const minuteur = setTimeout(() => ctrl.abort(), 2000)
        ok = (await fetch(`http://127.0.0.1:${port}/health`, { signal: ctrl.signal })).ok
        clearTimeout(minuteur)
      } catch { /* pas encore prêt */ }
      if (!ok) await attendre(500)
    }
  } finally {
    try { proc.kill() } catch { /* déjà arrêté */ }
    await attendre(700)
  }
  return { ok, secondes: Math.round((Date.now() - debut) / 100) / 10, sortie }
}

/** Copie une base SQLite et ses annexes (journal) dans `dest`, sans toucher à l'originale. */
function copierBase(source, dest) {
  fs.copyFileSync(source, dest)
  for (const suffixe of ['-wal', '-shm', '-journal']) {
    if (fs.existsSync(source + suffixe)) fs.copyFileSync(source + suffixe, dest + suffixe)
  }
}

async function main() {
  if (!dossier || !fs.existsSync(dossier)) { dit(false, `dossier d'installation introuvable : ${dossierArg}`); return 1 }
  let echecs = 0
  const rapport = []

  const manquants = ESSENTIELS.filter((f) => !fs.existsSync(path.join(dossier, f)))
  if (manquants.length) {
    echecs++
    dit(false, `fichiers manquants : ${manquants.join(', ')}`)
    rapport.push(`Fichiers manquants : ${manquants.join(', ')}`)
  } else {
    dit(true, 'fichiers de l\'application presents')
  }

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-saris-verif-'))
  try {
    if (!manquants.length) {
      const modele = path.join(temp, 'modele.db')
      fs.copyFileSync(path.join(ressources, 'seed.db'), modele)
      const r1 = await essayerService(modele)
      if (r1.ok) dit(true, `service local demarre sur une base neuve (${r1.secondes} s)`)
      else { echecs++; dit(false, 'le service local ne demarre pas sur une base neuve'); rapport.push(`Base neuve :\n${r1.sortie}`) }

      if (baseReelle && fs.existsSync(baseReelle)) {
        const copie = path.join(temp, 'poste.db')
        copierBase(baseReelle, copie)
        const r2 = await essayerService(copie)
        if (r2.ok) dit(true, `base du poste : mise a niveau testee sur une copie (${r2.secondes} s), base intacte`)
        else { echecs++; dit(false, 'base du poste : la mise a niveau ECHOUE (testee sur une copie)'); rapport.push(`Copie de la base du poste :\n${r2.sortie}`) }
      } else {
        dit(null, 'pas encore de base locale sur ce poste : rien a mettre a niveau')
      }
    }

    // Information seulement (jamais bloquant) : le serveur central, tel que ce poste le connait.
    try {
      const config = JSON.parse(fs.readFileSync(path.join(process.env.APPDATA || '', 'CMS SARIS', 'config.json'), 'utf8'))
      const url = String(config.serverUrl || '').replace(/\/+$/, '')
      if (url) {
        try {
          const ctrl = new AbortController()
          const minuteur = setTimeout(() => ctrl.abort(), 4000)
          const res = await fetch(`${url}/health/ping`, { signal: ctrl.signal })
          clearTimeout(minuteur)
          dit(null, res.ok ? 'serveur central joignable' : `serveur central : reponse ${res.status}`)
        } catch { dit(null, 'serveur central injoignable (le poste travaille en local)') }
      } else dit(null, 'serveur central : pas encore configure (au premier lancement)')
    } catch { dit(null, 'serveur central : pas encore configure (au premier lancement)') }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }

  if (echecs) {
    const fichier = path.join(os.tmpdir(), 'cms-saris-verification.txt')
    try { fs.writeFileSync(fichier, rapport.join('\n\n'), 'utf8'); dit(null, `rapport detaille : ${fichier}`) } catch { /* sans importance */ }
  }
  return echecs ? 1 : 0
}

const garde = setTimeout(() => { dit(false, 'verification interrompue (plus de 4 minutes)'); process.exit(1) }, 240_000)
main().then((code) => { clearTimeout(garde); process.exit(code) }, (e) => { dit(false, `erreur inattendue : ${e && e.message}`); process.exit(1) })
