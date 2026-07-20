/**
 * Génère la séquence d'images (fumée en boucle derrière un panneau "verre dépoli")
 * du panneau gauche animé du nouvel installateur (pages Bienvenue/Fin).
 *
 * Rendu réel via sharp/librsvg, exporté en .bmp 24 bits (pas de PNG) : le contrôle
 * bitmap natif Win32 (STM_SETIMAGE / LoadImageW) charge nativement du .bmp sans
 * dépendance GDI+ supplémentaire — cohérent avec la décision du 2026-07-20 de ne
 * pas embarquer de plugin NSIS tiers non vérifié (WebView2).
 *
 * Taille 164x314 = dimension standard du bitmap de bienvenue/fin NSIS ModernUI2.
 * Boucle parfaitement continue : la frame 0 raccorde la dernière frame.
 *
 * Usage : node scripts/gen-installer-anim.mjs   (depuis apps/desktop)
 */
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(here, '..', 'build', 'anim')
fs.mkdirSync(outDir, { recursive: true })
for (const f of fs.readdirSync(outDir)) fs.rmSync(path.join(outDir, f))

const W = 164
const H = 314
const FRAMES = 48 // boucle continue ; avancée toutes les ~150ms côté NSIS -> cycle ~7,2s

// Un blob = un cercle radial flou qui dérive en boucle fermée sur une ellipse.
// période = FRAMES pour tous (boucle parfaite), phase/amplitude/rayon distincts
// par blob pour éviter un mouvement trop synchronisé (cf. dérive CSS d'origine).
const BLOBS = [
  { cx: 36,  cy: 78,  r: 96,  color: '255,255,255', ax: 40, ay: 30, phase: 0.00, opacity: 0.55 },
  { cx: 136, cy: 166, r: 80,  color: '93,202,165',   ax: 30, ay: 24, phase: 0.33, opacity: 0.48 },
  { cx: 54,  cy: 262, r: 112, color: '255,255,255', ax: 24, ay: 36, phase: 0.62, opacity: 0.42 },
]

function frameSvg(i) {
  const t = i / FRAMES
  const blobs = BLOBS.map((b) => {
    const angle = 2 * Math.PI * (t + b.phase)
    const cx = b.cx + Math.cos(angle) * b.ax
    const cy = b.cy + Math.sin(angle) * b.ay
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${b.r}" fill="rgba(${b.color},${b.opacity})" filter="url(#blur)" />`
  }).join('')

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="blur" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="20" />
      </filter>
    </defs>
    <rect width="${W}" height="${H}" fill="#12313b" />
    <g>${blobs}</g>
    <rect x="12" y="${H / 2 - 54}" width="${W - 24}" height="108" rx="9"
      fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.22)" stroke-width="1" />
    <rect x="${W / 2 - 20}" y="${H / 2 - 38}" width="40" height="40" rx="10" fill="rgba(255,255,255,0.94)" />
    <text x="${W / 2}" y="${H / 2 - 13}" text-anchor="middle" font-family="Segoe UI, sans-serif"
      font-size="12" font-weight="700" fill="#3D7A92">CS</text>
    <text x="${W / 2}" y="${H / 2 + 22}" text-anchor="middle" font-family="Segoe UI, sans-serif"
      font-size="13" font-weight="700" fill="#ffffff">CMS SARIS</text>
  </svg>`
}

/** Encode un buffer RGB brut (top-down, sharp .raw()) en .bmp 24 bits (bottom-up, BGR, lignes paddées à 4 octets). */
function rgbToBmp(rgb, width, height) {
  const rowSize = Math.ceil((width * 3) / 4) * 4
  const pixelBytes = rowSize * height
  const fileSize = 14 + 40 + pixelBytes
  const buf = Buffer.alloc(fileSize)

  buf.write('BM', 0, 'ascii')
  buf.writeUInt32LE(fileSize, 2)
  buf.writeUInt32LE(0, 6)
  buf.writeUInt32LE(54, 10)

  buf.writeUInt32LE(40, 14)
  buf.writeInt32LE(width, 18)
  buf.writeInt32LE(height, 22) // positif = bottom-up
  buf.writeUInt16LE(1, 26)
  buf.writeUInt16LE(24, 28)
  buf.writeUInt32LE(0, 30)
  buf.writeUInt32LE(pixelBytes, 34)
  buf.writeInt32LE(2835, 38)
  buf.writeInt32LE(2835, 42)
  buf.writeUInt32LE(0, 46)
  buf.writeUInt32LE(0, 50)

  for (let y = 0; y < height; y++) {
    const srcRow = height - 1 - y // bottom-up : dernière ligne source écrite en premier
    const rowStart = 54 + y * rowSize
    for (let x = 0; x < width; x++) {
      const srcIdx = (srcRow * width + x) * 3
      const dstIdx = rowStart + x * 3
      buf[dstIdx] = rgb[srcIdx + 2]     // B
      buf[dstIdx + 1] = rgb[srcIdx + 1] // G
      buf[dstIdx + 2] = rgb[srcIdx]     // R
    }
  }
  return buf
}

const pad = (n) => String(n).padStart(2, '0')

for (let i = 0; i < FRAMES; i++) {
  const svg = frameSvg(i)
  const { data } = await sharp(Buffer.from(svg)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const bmp = rgbToBmp(data, W, H)
  fs.writeFileSync(path.join(outDir, `frame_${pad(i)}.bmp`), bmp)
}

const totalBytes = fs.readdirSync(outDir).reduce((sum, f) => sum + fs.statSync(path.join(outDir, f)).size, 0)
console.log(`[gen-installer-anim] ${FRAMES} frames ${W}x${H} .bmp -> ${outDir}`)
console.log(`[gen-installer-anim] poids total : ${(totalBytes / 1024).toFixed(0)} Ko`)
