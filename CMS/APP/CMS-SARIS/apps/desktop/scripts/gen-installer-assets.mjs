/**
 * Génère les images de l'installateur NSIS (charte SARIS, 0 dégradé) :
 *  - build/installerSidebar.bmp  (164×314) : zone GAUCHE (branding + illustration), pages Bienvenue/Fin
 *  - build/installerHeader.bmp   (150×57)  : en-tête des pages internes
 *  - build/uninstallerSidebar.bmp (164×314)
 *
 * Compose via sharp (fond uni + texte SVG + logo), puis encode un BMP 24 bits.
 *   node scripts/gen-installer-assets.mjs
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
let sharp
try {
  sharp = require('sharp')
} catch {
  console.error("sharp introuvable. Lancer via: pnpm --filter web exec node scripts/gen-installer-assets.mjs (depuis apps/desktop)")
  process.exit(1)
}

const here = path.dirname(fileURLToPath(import.meta.url))
const BUILD = path.resolve(here, '..', 'build')
const LOGO = path.join(BUILD, 'icon.png')

// Charte SARIS (teal). 0 dégradé : couleurs unies.
const TEAL_DEEP = '#0C3B47'
const TEAL = '#15596B'
const ACCENT = '#4E8BA4'
const LIGHT = '#F4F7F8'

/** Encode une image RGBA (Buffer) en BMP 24 bits (bottom-up, BGR, lignes alignées sur 4). */
function encodeBMP(rgba, w, h) {
  const rowSize = Math.floor((24 * w + 31) / 32) * 4
  const pixels = rowSize * h
  const buf = Buffer.alloc(54 + pixels)
  buf.write('BM', 0)
  buf.writeUInt32LE(54 + pixels, 2)
  buf.writeUInt32LE(54, 10)
  buf.writeUInt32LE(40, 14)
  buf.writeInt32LE(w, 18)
  buf.writeInt32LE(h, 22)
  buf.writeUInt16LE(1, 26)
  buf.writeUInt16LE(24, 28)
  buf.writeUInt32LE(0, 30)
  buf.writeUInt32LE(pixels, 34)
  buf.writeInt32LE(2835, 38)
  buf.writeInt32LE(2835, 42)
  for (let y = 0; y < h; y++) {
    const src = (h - 1 - y) * w * 4
    let dst = 54 + y * rowSize
    for (let x = 0; x < w; x++) {
      const s = src + x * 4
      buf[dst++] = rgba[s + 2]
      buf[dst++] = rgba[s + 1]
      buf[dst++] = rgba[s]
    }
  }
  return buf
}

async function svgToBmp(svg, w, h, outFile) {
  const { data } = await sharp(Buffer.from(svg)).resize(w, h).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  fs.writeFileSync(outFile, encodeBMP(data, w, h))
  console.log('écrit', path.basename(outFile))
}

async function composedSidebar(outFile, footer) {
  const W = 164, H = 314
  // Fond uni teal profond + bande accent en bas (aucun dégradé).
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="${TEAL_DEEP}"/>
    <rect x="0" y="${H - 56}" width="${W}" height="56" fill="${TEAL}"/>
    <rect x="0" y="${H - 56}" width="${W}" height="3" fill="${ACCENT}"/>
    <text x="${W / 2}" y="150" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="700" fill="#FFFFFF">CMS SARIS</text>
    <text x="${W / 2}" y="172" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="10" fill="#BFD8E0">Centre Médico-Social</text>
    <text x="${W / 2}" y="${H - 32}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="10" font-weight="600" fill="#EAF3F6">${footer}</text>
    <text x="${W / 2}" y="${H - 16}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="8" fill="#9FC0CA">SARIS-CONGO</text>
  </svg>`
  // Logo (cercle blanc) centré en haut.
  const W2 = W, H2 = H
  const base = sharp(Buffer.from(svg)).resize(W2, H2)
  const logo = await sharp(LOGO).resize(72, 72, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
  const { data } = await base.composite([{ input: logo, top: 56, left: Math.round((W2 - 72) / 2) }]).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  fs.writeFileSync(outFile, encodeBMP(data, W2, H2))
  console.log('écrit', path.basename(outFile))
}

async function composedHeader(outFile) {
  const W = 150, H = 57
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="${LIGHT}"/>
    <rect x="0" y="${H - 3}" width="${W}" height="3" fill="${ACCENT}"/>
    <text x="46" y="33" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="700" fill="${TEAL_DEEP}">CMS SARIS</text>
  </svg>`
  const logo = await sharp(LOGO).resize(34, 34, { fit: 'contain', background: { r: 244, g: 247, b: 248, alpha: 1 } }).png().toBuffer()
  const { data } = await sharp(Buffer.from(svg)).resize(W, H).composite([{ input: logo, top: 11, left: 8 }]).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  fs.writeFileSync(outFile, encodeBMP(data, W, H))
  console.log('écrit', path.basename(outFile))
}

await composedSidebar(path.join(BUILD, 'installerSidebar.bmp'), 'INSTALLATION')
await composedSidebar(path.join(BUILD, 'uninstallerSidebar.bmp'), 'DÉSINSTALLATION')
await composedHeader(path.join(BUILD, 'installerHeader.bmp'))
console.log('Assets installateur générés dans build/.')
