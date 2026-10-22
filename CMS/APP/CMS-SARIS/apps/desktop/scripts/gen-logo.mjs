/**
 * Produit le logo du poste de bureau à partir des symboles OFFICIELS du web
 * (apps/web/public/symbole_saris_clair.png / symbole_saris_sombre.png, 192×192 transparents) :
 *  - electron/setup-logo.png         512×512, pour les fonds CLAIRS (écrans de configuration, en-tête
 *                                     de l'installateur) ET icône de l'application (exe, raccourcis)
 *  - electron/setup-logo-sombre.png  512×512, pour les fonds SOMBRES (panneau animé de l'installateur)
 *
 * Le symbole est un aplat de deux couleurs (jaune en haut, bleu-vert en bas) : on l'agrandit, on durcit
 * le bord de la transparence (sinon il flotte en flou), puis on le recolore à plat. Résultat : un disque
 * complet, centré, net, sans fond blanc — l'ancienne icône était un recadrage décentré aux bords coupés.
 *
 * Usage : node scripts/gen-logo.mjs   (depuis apps/desktop) — à relancer seulement si le symbole change.
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const sharp = require('sharp')

const here = path.dirname(fileURLToPath(import.meta.url))
const WEB = path.resolve(here, '..', '..', 'web', 'public')
const OUT = path.resolve(here, '..', 'electron')
const TAILLE = 512
/** Travail à haute définition, puis réduction : le bord reste net. */
const TRAVAIL = 1024
/** Part de la toile occupée par le disque (le reste est une marge transparente). */
const REMPLISSAGE = 0.92

// Couleurs lues sur les symboles officiels (jaune commun, bleu-vert propre à chaque thème).
const JAUNE = [227, 178, 18]
const BLEUS = { clair: [89, 146, 152], sombre: [109, 182, 190] }

/** Courbe qui rend le bord net : en dessous de 0,35 transparent, au-dessus de 0,65 plein. */
function durcir(a) {
  const t = Math.min(1, Math.max(0, (a / 255 - 0.35) / 0.3))
  return Math.round(t * t * (3 - 2 * t) * 255)
}

async function produire(variante) {
  const source = path.join(WEB, `symbole_saris_${variante}.png`)
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .resize(TRAVAIL, TRAVAIL, { kernel: 'lanczos3' })
    .raw()
    .toBuffer({ resolveWithObject: true })
  const sortie = Buffer.alloc(data.length)
  const bleu = BLEUS[variante]
  for (let y = 0; y < info.height; y++) {
    const couleur = y < info.height / 2 ? JAUNE : bleu
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels
      sortie[i] = couleur[0]
      sortie[i + 1] = couleur[1]
      sortie[i + 2] = couleur[2]
      sortie[i + 3] = durcir(data[i + 3])
    }
  }
  // Recadre au plus près du disque, puis le recentre dans une toile carrée avec une marge régulière.
  const png = await sharp(sortie, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()
  let gauche = info.width, haut = info.height, droite = 0, bas = 0
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++)
      if (sortie[(y * info.width + x) * 4 + 3] > 8) {
        if (x < gauche) gauche = x
        if (x > droite) droite = x
        if (y < haut) haut = y
        if (y > bas) bas = y
      }
  const largeur = droite - gauche + 1, hauteur = bas - haut + 1
  const cote = Math.round(TAILLE * REMPLISSAGE)
  const disque = await sharp(png)
    .extract({ left: gauche, top: haut, width: largeur, height: hauteur })
    .resize(cote, cote, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' })
    .png()
    .toBuffer()
  const fichier = path.join(OUT, variante === 'clair' ? 'setup-logo.png' : 'setup-logo-sombre.png')
  await sharp({ create: { width: TAILLE, height: TAILLE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: disque, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toFile(fichier)
  console.log('écrit', path.relative(path.resolve(here, '..'), fichier))
}

await produire('clair')
await produire('sombre')
