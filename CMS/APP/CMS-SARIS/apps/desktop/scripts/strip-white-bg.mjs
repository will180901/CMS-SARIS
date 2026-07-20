/**
 * Détoure un fond blanc opaque en transparence réelle (alpha), en préservant un bord
 * anti-aliasé propre (alpha proportionnel à la distance à blanc, pas un seuil brut).
 * Usage : node scripts/strip-white-bg.mjs <source.png> <sortie.png>
 */
import sharp from 'sharp'

const [, , src, dst] = process.argv
if (!src || !dst) {
  console.error('Usage: node scripts/strip-white-bg.mjs <source.png> <sortie.png>')
  process.exit(1)
}

const img = sharp(src).ensureAlpha()
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
const out = Buffer.from(data)

for (let i = 0; i < data.length; i += info.channels) {
  const r = data[i], g = data[i + 1], b = data[i + 2]
  const distFromWhite = 255 - Math.min(r, g, b) // 0 = blanc pur, plus grand = plus saturé/loin du blanc
  const alpha = Math.min(255, Math.round(distFromWhite * 1.5))
  out[i + 3] = alpha
}

await sharp(out, { raw: info }).png().toFile(dst)
console.log(`[strip-white-bg] ${src} -> ${dst} (${info.width}x${info.height})`)
