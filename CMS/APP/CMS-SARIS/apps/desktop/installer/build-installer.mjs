/**
 * Compile l'installateur NSIS SUR-MESURE (cms-saris.nsi) — affichage temps réel des
 * fichiers + 2 barres de progression, ce qu'electron-builder interdit.
 *
 * Pré-requis : `win-unpacked` doit exister (produit par build-local.mjs, ou
 *   `pnpm --filter @cms-saris/desktop exec electron-builder --dir --config electron-builder.local.yml`).
 * Usage : node installer/build-installer.mjs   (depuis apps/desktop)
 */
import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const desktop = path.resolve(here, '..')
const version = JSON.parse(fs.readFileSync(path.join(desktop, 'package.json'), 'utf8')).version

const NSIS = path.join(process.env.LOCALAPPDATA, 'electron-builder', 'Cache', 'nsis', 'nsis-3.0.4.1')
const makensis = path.join(NSIS, 'Bin', 'makensis.exe')
const srcdir = path.join(desktop, 'release', 'win-unpacked')
const assets = path.join(desktop, 'build')
const outfile = path.join(desktop, 'release', `CMS SARIS-Setup-${version}.exe`)
const nsi = path.join(here, 'cms-saris.nsi')

// Localise signtool.exe (SDK Windows), en préférant x64 puis x86.
function findSigntool() {
  if (process.env.SARIS_SIGNTOOL && fs.existsSync(process.env.SARIS_SIGNTOOL)) return process.env.SARIS_SIGNTOOL
  const root = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin'
  if (!fs.existsSync(root)) return null
  for (const v of fs.readdirSync(root).filter((d) => /^10\./.test(d)).sort().reverse()) {
    for (const arch of ['x64', 'x86']) {
      const p = path.join(root, v, arch, 'signtool.exe')
      if (fs.existsSync(p)) return p
    }
  }
  return null
}

// Signe l'installeur SI un certificat est fourni (sinon : exe NON signé → SmartScreen
// « éditeur inconnu »). Fournir AU CHOIX :
//   SARIS_CERT_PFX (+ SARIS_CERT_PASSWORD)  — chemin d'un fichier .pfx
//   SARIS_CERT_THUMBPRINT                    — empreinte d'un certificat du magasin Windows
// Optionnel : SARIS_CERT_TSA (URL d'horodatage), SARIS_SIGNTOOL (chemin signtool).
function signInstaller() {
  const pfx = process.env.SARIS_CERT_PFX
  const thumb = process.env.SARIS_CERT_THUMBPRINT
  if (!pfx && !thumb) {
    console.log('\nℹ️  Aucun certificat (SARIS_CERT_PFX / SARIS_CERT_THUMBPRINT) → installeur NON signé.')
    return
  }
  const signtool = findSigntool()
  if (!signtool) { console.warn('⚠️  signtool.exe introuvable (SDK Windows) — signature ignorée.'); return }
  const tsa = process.env.SARIS_CERT_TSA || 'http://timestamp.digicert.com'
  const args = ['sign']
  if (pfx) { args.push('/f', pfx); if (process.env.SARIS_CERT_PASSWORD) args.push('/p', process.env.SARIS_CERT_PASSWORD) }
  else { args.push('/sha1', thumb) }
  args.push('/fd', 'sha256', '/tr', tsa, '/td', 'sha256', outfile)
  execFileSync(signtool, args, { stdio: 'inherit' })
  console.log('✓ Installeur SIGNÉ.')
}

if (!fs.existsSync(makensis)) { console.error('makensis introuvable : ' + makensis); process.exit(1) }
if (!fs.existsSync(srcdir)) { console.error("win-unpacked introuvable — lance build-local.mjs d'abord."); process.exit(1) }

// Icône : réutilise celle générée par electron-builder.
const icoSrc = path.join(desktop, 'release', '.icon-ico', 'icon.ico')
const icoDst = path.join(assets, 'icon.ico')
if (fs.existsSync(icoSrc)) fs.copyFileSync(icoSrc, icoDst)
if (!fs.existsSync(icoDst)) { console.error('icon.ico introuvable (attendu : ' + icoDst + ')'); process.exit(1) }

// Ressources qu'electron-builder ne génère QU'AVEC la cible NSIS (absentes en mode `--dir`).
// On les assure ici pour que le .nsi (qui les empaquette) compile dans les deux cas.
const resDir = path.join(srcdir, 'resources')
const appUpdateYml = path.join(resDir, 'app-update.yml')
if (!fs.existsSync(appUpdateYml)) {
  fs.writeFileSync(appUpdateYml, 'owner: will180901\nrepo: CMS-SARIS\nprovider: github\nupdaterCacheDirName: cms-saris-updater\n')
  console.log('app-update.yml généré (auto-update)')
}
const elevateExe = path.join(resDir, 'elevate.exe')
if (!fs.existsSync(elevateExe)) {
  const nsisElevate = path.join(NSIS, 'elevate.exe')
  if (fs.existsSync(nsisElevate)) { fs.copyFileSync(nsisElevate, elevateExe); console.log('elevate.exe copié depuis NSIS') }
}

console.log(`Compilation de l'installateur CMS SARIS ${version}...\n`)
// execFileSync (sans shell) → chaque /D reste UN seul argv : les espaces du chemin sont préservés.
execFileSync(makensis, [
  '/V3',
  `/DVERSION=${version}`,
  `/DSRCDIR=${srcdir}`,
  `/DASSETS=${assets}`,
  `/DOUTFILE=${outfile}`,
  nsi,
], { stdio: 'inherit' })

const mo = fs.existsSync(outfile) ? Math.round(fs.statSync(outfile).size / 1048576) : '?'
console.log(`\nOK -> ${outfile} (${mo} Mo)`)

// Signature de code (si certificat fourni) — AVANT le hash pour que latest.yml corresponde.
signInstaller()

// latest.yml pour electron-updater (détection + téléchargement de la MAJ).
const buf = fs.readFileSync(outfile)
const sha512 = crypto.createHash('sha512').update(buf).digest('base64')
const base = path.basename(outfile)
fs.writeFileSync(path.join(desktop, 'release', 'latest.yml'), [
  `version: ${version}`,
  `files:`,
  `  - url: ${base}`,
  `    sha512: ${sha512}`,
  `    size: ${buf.length}`,
  `path: ${base}`,
  `sha512: ${sha512}`,
  `releaseDate: '${new Date().toISOString()}'`,
  ``,
].join('\n'))
console.log('latest.yml genere (auto-update)')
