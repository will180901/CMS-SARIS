/**
 * fondAnime — le décor animé de la page de connexion (canvas 2D, aucune dépendance).
 *
 * Quatre couches, dessinées du fond vers l'avant, en boucle :
 *   1. un dégradé « mesh » : de grandes taches de couleur qui dérivent très lentement —
 *      presque monochromes, avec une petite lueur des couleurs de l'application ;
 *   2. des nuages de carrés tramés (tramage de Bayer sur un bruit) : les petits pixels
 *      groupés en amas et en vides, qui dérivent à peine ;
 *   3. un réseau en GRILLE : lignes et colonnes ordonnées, une toute petite maille carrée
 *      (12 px), un point à chaque intersection ;
 *   4. des flux de données : de très petits carrés qui circulent le long des fils, dans tous
 *      les sens, et tournent aux intersections, avec une lueur naturelle qui pulse. Chaque
 *      arrivée allume l'intersection et réchauffe le fil, comme un neurone qui s'active.
 *
 * Légèreté (les postes du centre ne sont pas des machines de jeu) :
 *   - le mesh est dessiné à petite échelle puis agrandi ; les nuages sont calculés UNE fois
 *     (à la taille de la fenêtre), puis seulement déplacés ;
 *   - ~40 images/s au plus, en pause dès que l'onglet est caché ;
 *   - si une image coûte trop cher, la qualité baisse toute seule (moins de pixels) ;
 *   - « réduire les animations » demandé au système : une seule image fixe.
 */

type RGB = readonly [number, number, number]

interface Tache {
  rgb: RGB
  /** Opacité au centre de la tache. */
  a: number
  /** Rayon, en fraction de la plus grande dimension de la fenêtre. */
  r: number
  /** Centre (0..1) et amplitude (0..1) du mouvement, vitesses (rad/s) et phases. */
  x: number; y: number; ax: number; ay: number; vx: number; vy: number; px: number; py: number
}

interface Palette {
  sombre: boolean
  /** Couleurs des pixels qui circulent, et leur poids de tirage. */
  pixels: { rgb: RGB; poids: number }[]
  fil: RGB
  nuage: RGB
  nuageTeal: RGB
  taches: Tache[]
}

/** Thème sombre : gris bleutés presque noirs, une lueur teal (l'accent de l'application) et une pointe de doré (le logo). */
const PALETTE_SOMBRE: Palette = {
  sombre: true,
  pixels: [
    { rgb: [206, 214, 224], poids: 68 },
    { rgb: [110, 176, 200], poids: 22 },
    { rgb: [232, 190, 70], poids: 5 },
    { rgb: [244, 247, 250], poids: 5 },
  ],
  fil: [150, 170, 190],
  nuage: [190, 200, 212],
  nuageTeal: [78, 139, 164],
  taches: [
    { rgb: [70, 84, 104], a: 0.211, r: 0.60, x: 0.22, y: 0.30, ax: 0.10, ay: 0.08, vx: 0.11, vy: 0.09, px: 0, py: 1 },
    { rgb: [56, 66, 82], a: 0.186, r: 0.55, x: 0.78, y: 0.62, ax: 0.09, ay: 0.10, vx: 0.08, vy: 0.12, px: 2, py: 0.5 },
    { rgb: [78, 139, 164], a: 0.124, r: 0.38, x: 0.62, y: 0.24, ax: 0.12, ay: 0.10, vx: 0.13, vy: 0.10, px: 1, py: 3 },
    { rgb: [34, 86, 104], a: 0.136, r: 0.42, x: 0.30, y: 0.78, ax: 0.10, ay: 0.08, vx: 0.09, vy: 0.14, px: 4, py: 2 },
    { rgb: [224, 181, 43], a: 0.031, r: 0.30, x: 0.84, y: 0.86, ax: 0.06, ay: 0.05, vx: 0.10, vy: 0.07, px: 5, py: 1 },
  ],
}

/** Thème clair : mêmes gestes, encre ardoise sur fond clair. */
const PALETTE_CLAIRE: Palette = {
  sombre: false,
  pixels: [
    { rgb: [61, 71, 83], poids: 60 },
    { rgb: [61, 122, 146], poids: 30 },
    { rgb: [196, 150, 20], poids: 6 },
    { rgb: [110, 122, 138], poids: 4 },
  ],
  fil: [96, 112, 130],
  nuage: [70, 82, 98],
  nuageTeal: [61, 122, 146],
  taches: [
    { rgb: [190, 202, 216], a: 0.40, r: 0.60, x: 0.22, y: 0.30, ax: 0.10, ay: 0.08, vx: 0.11, vy: 0.09, px: 0, py: 1 },
    { rgb: [160, 176, 194], a: 0.28, r: 0.55, x: 0.78, y: 0.62, ax: 0.09, ay: 0.10, vx: 0.08, vy: 0.12, px: 2, py: 0.5 },
    { rgb: [78, 139, 164], a: 0.16, r: 0.38, x: 0.62, y: 0.24, ax: 0.12, ay: 0.10, vx: 0.13, vy: 0.10, px: 1, py: 3 },
    { rgb: [120, 170, 190], a: 0.14, r: 0.42, x: 0.30, y: 0.78, ax: 0.10, ay: 0.08, vx: 0.09, vy: 0.14, px: 4, py: 2 },
    { rgb: [224, 181, 43], a: 0.10, r: 0.30, x: 0.84, y: 0.86, ax: 0.06, ay: 0.05, vx: 0.10, vy: 0.07, px: 5, py: 1 },
  ],
}

const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const lisse = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }

// ── Bruit (pour les nuages de carrés) ────────────────────────────────────────

function hachage(ix: number, iy: number, graine: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(graine, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

function bruit(x: number, y: number, graine: number): number {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy)
  return lerp(
    lerp(hachage(ix, iy, graine), hachage(ix + 1, iy, graine), u),
    lerp(hachage(ix, iy + 1, graine), hachage(ix + 1, iy + 1, graine), u),
    v,
  )
}

/** Trois octaves : un grand relief, des détails, des grains. */
const relief = (x: number, y: number, g: number) =>
  0.55 * bruit(x, y, g) + 0.30 * bruit(x * 2.1, y * 2.1, g + 1) + 0.15 * bruit(x * 4.3, y * 4.3, g + 2)

/** Matrice de tramage de Bayer 4×4 : le seuil de chaque case. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

// ── Sprites de lueur ─────────────────────────────────────────────────────────

/** Une lueur douce : un point lumineux qui s'éteint en s'éloignant, sans bord. */
function creerLueur(rgb: RGB, rayon: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = rayon * 2
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(rayon, rayon, 0, rayon, rayon, rayon)
  grad.addColorStop(0, rgba(rgb, 1))
  grad.addColorStop(0.22, rgba(rgb, 0.42))
  grad.addColorStop(0.55, rgba(rgb, 0.1))
  grad.addColorStop(1, rgba(rgb, 0))
  g.fillStyle = grad
  g.fillRect(0, 0, rayon * 2, rayon * 2)
  return c
}

// ── Le moteur ────────────────────────────────────────────────────────────────

/** Un pixel qui voyage sur le fil allant de l'intersection (ci, ri) à (ci+dx, ri+dy), à la fraction `u` du trajet. */
interface Paquet { ci: number; ri: number; dx: number; dy: number; u: number; v: number; taille: number; couleur: number; ph: number; hz: number }

const IMAGES_PAR_SECONDE_MAX = 40
const PAS_NUAGE = 5
/** Distance entre deux fils de la grille : très petite, des « trous » carrés de 12 px. */
const PAS_GRILLE = 12

/**
 * Lance l'animation dans `canvas` (qui doit occuper tout son parent). Rend la fonction qui
 * l'arrête et libère tout.
 */
export function demarrerFondAnime(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => undefined
  const parent = canvas.parentElement ?? canvas

  const reduire = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  let palette = document.documentElement.classList.contains('dark') ? PALETTE_SOMBRE : PALETTE_CLAIRE

  let W = 0, H = 0, dpr = 1
  /** La grille : `cols` fils verticaux et `lignes` fils horizontaux, centrés dans la fenêtre. */
  let cols = 0, lignes = 0, ox = 0, oy = 0
  let grille: HTMLCanvasElement | null = null
  let paquets: Paquet[] = []
  let nuages: HTMLCanvasElement | null = null
  /** Fils réchauffés par un passage, et nœuds allumés à une arrivée — seulement ceux qui brillent encore. */
  const chaleur = new Map<number, number>()
  const eclats = new Map<number, number>()
  const marge = 48
  const mesh = document.createElement('canvas')
  const meshCtx = mesh.getContext('2d')!
  let lueurs: { sprites: HTMLCanvasElement[]; noeud: HTMLCanvasElement } = { sprites: [], noeud: document.createElement('canvas') }
  let qualite = 1
  let poids: number[] = []

  function tirerCouleur(): number {
    const r = Math.random() * poids[poids.length - 1]!
    for (let i = 0; i < poids.length; i++) if (r < poids[i]!) return i
    return 0
  }

  function preparerPalette() {
    let cumul = 0
    poids = palette.pixels.map(p => (cumul += p.poids))
    lueurs = { sprites: palette.pixels.map(p => creerLueur(p.rgb, 16)), noeud: creerLueur(palette.pixels[1]!.rgb, 22) }
  }

  // ── La grille ───────────────────────────────────────────────────────────────
  const xFil = (c: number) => Math.round(ox + c * PAS_GRILLE)
  const yFil = (r: number) => Math.round(oy + r * PAS_GRILLE)
  /** Identifiant d'un fil : son intersection de départ (la plus haute / la plus à gauche) et son sens. */
  const cleFil = (ci: number, ri: number, dx: number, dy: number) =>
    (((dy < 0 ? ri + dy : ri) * cols + (dx < 0 ? ci + dx : ci)) * 2) + (dx !== 0 ? 0 : 1)

  /** La grille au repos, dessinée UNE fois : des fils d'un pixel et un point à chaque intersection. */
  function genererGrille() {
    const c = document.createElement('canvas')
    c.width = Math.round(W * dpr)
    c.height = Math.round(H * dpr)
    const g = c.getContext('2d')!
    g.scale(dpr, dpr)
    g.strokeStyle = rgba(palette.fil, palette.sombre ? 0.15 : 0.18)
    g.lineWidth = 1
    g.beginPath()
    for (let i = 0; i < cols; i++) { g.moveTo(xFil(i) + 0.5, 0); g.lineTo(xFil(i) + 0.5, H) }
    for (let j = 0; j < lignes; j++) { g.moveTo(0, yFil(j) + 0.5); g.lineTo(W, yFil(j) + 0.5) }
    g.stroke()
    g.fillStyle = rgba(palette.fil, palette.sombre ? 0.32 : 0.36)
    g.beginPath()
    for (let j = 0; j < lignes; j++) for (let i = 0; i < cols; i++) g.rect(xFil(i), yFil(j), 2, 2)
    g.fill()
    grille = c
  }

  // ── Construction (à chaque changement de taille) ────────────────────────────
  function construire() {
    const r = parent.getBoundingClientRect()
    W = Math.max(1, Math.round(r.width))
    H = Math.max(1, Math.round(r.height))
    dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    mesh.width = Math.max(8, Math.round(W / 8))
    mesh.height = Math.max(8, Math.round(H / 8))

    cols = Math.floor(W / PAS_GRILLE) + 1
    lignes = Math.floor(H / PAS_GRILLE) + 1
    ox = (W - (cols - 1) * PAS_GRILLE) / 2
    oy = (H - (lignes - 1) * PAS_GRILLE) / 2
    chaleur.clear()
    eclats.clear()
    genererGrille()
    peuplerPaquets()
    genererNuages()
  }

  /** Où repart un pixel arrivé à une intersection : tout droit le plus souvent, parfois à gauche ou à droite, demi-tour au bord. */
  function orienter(p: Paquet) {
    let dx = p.dx, dy = p.dy
    if (Math.random() < 0.18) {
      if (dx !== 0) { dy = Math.random() < 0.5 ? 1 : -1; dx = 0 } else { dx = Math.random() < 0.5 ? 1 : -1; dy = 0 }
    }
    const valide = (ax: number, ay: number) => {
      const c = p.ci + ax, r = p.ri + ay
      return c >= 0 && c < cols && r >= 0 && r < lignes
    }
    if (!valide(dx, dy)) {
      const options: [number, number][] = dx !== 0
        ? (Math.random() < 0.5 ? [[0, 1], [0, -1], [-dx, 0]] : [[0, -1], [0, 1], [-dx, 0]])
        : (Math.random() < 0.5 ? [[1, 0], [-1, 0], [0, -dy]] : [[-1, 0], [1, 0], [0, -dy]])
      const bon = options.find(([ax, ay]) => valide(ax, ay)) ?? [0, 0]
      dx = bon[0]; dy = bon[1]
    }
    p.dx = dx; p.dy = dy
  }

  function peuplerPaquets() {
    const nb = Math.round(clamp(Math.round((W * H) / 5000), 120, 460) * qualite)
    paquets = []
    for (let i = 0; i < nb; i++) {
      const horizontal = Math.random() < 0.5
      const sens = Math.random() < 0.5 ? 1 : -1
      const p: Paquet = {
        ci: Math.floor(Math.random() * cols), ri: Math.floor(Math.random() * lignes),
        dx: horizontal ? sens : 0, dy: horizontal ? 0 : sens, u: Math.random(),
        v: 30 + Math.random() * 90, taille: Math.random() < 0.7 ? 2 : 3, couleur: tirerCouleur(),
        ph: Math.random() * 6.28, hz: 0.35 + Math.random() * 0.9,
      }
      orienter(p) // une direction qui ne sort pas de la grille
      paquets.push(p)
    }
  }

  /** Les nuages de carrés : calculés une fois, puis seulement déplacés. */
  function genererNuages() {
    const w = W + marge * 2, h = H + marge * 2
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const g = c.getContext('2d')!
    const seaux = new Map<string, number[]>()
    const colonnes = Math.ceil(w / PAS_NUAGE), rangees = Math.ceil(h / PAS_NUAGE)
    for (let cy = 0; cy < rangees; cy++) {
      for (let cx = 0; cx < colonnes; cx++) {
        const n = relief(cx * 0.035, cy * 0.035, 11)
        const n2 = relief(cx * 0.035 + 3.7, cy * 0.035 + 1.3, 5)
        let d = lisse(0.40, 0.72, n) * (0.35 + 0.65 * lisse(0.25, 0.8, n2))
        // Plus serrés vers les bords, plus clairsemés au centre (là où se tient la carte).
        const dx = (cx * PAS_NUAGE) / w - 0.5, dy = (cy * PAS_NUAGE) / h - 0.5
        d *= 0.45 + 0.9 * lisse(0.15, 0.75, Math.hypot(dx * 1.1, dy * 1.3))
        if (d <= (BAYER[(cy & 3) * 4 + (cx & 3)]! + 0.5) / 16) continue
        const teinte = n2 > 0.72 ? 1 : 0
        const niveau = Math.min(3, Math.floor(d * 4))
        const cle = `${teinte}${niveau}`
        let l = seaux.get(cle)
        if (!l) { l = []; seaux.set(cle, l) }
        l.push(cx * PAS_NUAGE, cy * PAS_NUAGE)
      }
    }
    for (const [cle, pts] of seaux) {
      g.fillStyle = rgba(cle[0] === '1' ? palette.nuageTeal : palette.nuage, 0.14 + 0.09 * Number(cle[1]))
      g.beginPath()
      for (let i = 0; i < pts.length; i += 2) g.rect(pts[i]!, pts[i + 1]!, 2, 2)
      g.fill()
    }
    nuages = c
  }

  // ── Dessin ──────────────────────────────────────────────────────────────────
  function dessinerMesh(t: number) {
    const mw = mesh.width, mh = mesh.height
    meshCtx.clearRect(0, 0, mw, mh)
    meshCtx.globalCompositeOperation = palette.sombre ? 'lighter' : 'source-over'
    const grand = Math.max(mw, mh)
    for (const s of palette.taches) {
      const cx = (s.x + s.ax * Math.sin(t * s.vx + s.px)) * mw
      const cy = (s.y + s.ay * Math.cos(t * s.vy + s.py)) * mh
      const rayon = s.r * grand
      const g = meshCtx.createRadialGradient(cx, cy, 0, cx, cy, rayon)
      g.addColorStop(0, rgba(s.rgb, s.a))
      g.addColorStop(1, rgba(s.rgb, 0))
      meshCtx.fillStyle = g
      meshCtx.fillRect(0, 0, mw, mh)
    }
  }

  let imageMesh = 0
  function dessiner(t: number, dt: number) {
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx!.clearRect(0, 0, W, H)
    ctx!.globalCompositeOperation = 'source-over'

    // 1. mesh (redessiné une image sur deux : il bouge trop lentement pour que ça se voie)
    if ((imageMesh++ & 1) === 0) dessinerMesh(t)
    ctx!.imageSmoothingEnabled = true
    ctx!.drawImage(mesh, 0, 0, W, H)

    // 2. nuages de carrés, à peine en dérive, qui respirent
    if (nuages) {
      ctx!.imageSmoothingEnabled = false
      ctx!.globalAlpha = 0.78 + 0.22 * Math.sin(t * 0.33)
      ctx!.drawImage(nuages, -marge + Math.sin(t * 0.05) * 16, -marge + Math.cos(t * 0.04) * 11)
      ctx!.globalAlpha = 1
    }

    // 3. la grille au repos, qui respire lentement
    if (grille) {
      ctx!.imageSmoothingEnabled = true
      ctx!.globalAlpha = 0.82 + 0.18 * Math.sin(t * 0.5)
      ctx!.drawImage(grille, 0, 0, W, H)
      ctx!.globalAlpha = 1
    }

    ctx!.globalCompositeOperation = palette.sombre ? 'lighter' : 'source-over'

    // 4. fils réchauffés par un passage : ils s'éteignent doucement
    ctx!.lineWidth = 1
    for (const [cle, v] of chaleur) {
      const e = v * Math.exp(-dt * 1.4)
      if (e < 0.03) { chaleur.delete(cle); continue }
      chaleur.set(cle, e)
      const horizontal = cle % 2 === 0
      const idx = (cle - (horizontal ? 0 : 1)) / 2
      const c = idx % cols, r = Math.floor(idx / cols)
      const x0 = xFil(c) + 0.5, y0 = yFil(r) + 0.5
      ctx!.strokeStyle = rgba(palette.fil, 0.14 + 0.34 * e)
      ctx!.beginPath()
      ctx!.moveTo(x0, y0)
      if (horizontal) ctx!.lineTo(xFil(c + 1) + 0.5, y0)
      else ctx!.lineTo(x0, yFil(r + 1) + 0.5)
      ctx!.stroke()
    }

    // 5. pixels : avancent le long des fils, tournent aux intersections, brillent en pulsant
    const onde = (x: number, y: number) => 0.5 + 0.5 * Math.sin((x * 0.004 + y * 0.003) - t * 0.9)
    for (const p of paquets) {
      p.u += (p.v * dt) / PAS_GRILLE
      while (p.u >= 1) {
        p.ci += p.dx; p.ri += p.dy; p.u -= 1
        eclats.set(p.ri * cols + p.ci, 1)
        orienter(p)
        const k = cleFil(p.ci, p.ri, p.dx, p.dy)
        chaleur.set(k, Math.max(chaleur.get(k) ?? 0, 0.7))
      }
      const x = ox + (p.ci + p.dx * p.u) * PAS_GRILLE
      const y = oy + (p.ri + p.dy * p.u) * PAS_GRILLE
      const pulse = 0.55 + 0.45 * Math.sin(t * p.hz * 6.28 + p.ph)
      const eclat = clamp(pulse * (0.55 + 0.6 * onde(x, y)), 0, 1)
      const col = palette.pixels[p.couleur]!.rgb
      // lueur
      ctx!.globalAlpha = (palette.sombre ? 0.38 : 0.3) * eclat
      ctx!.drawImage(lueurs.sprites[p.couleur]!, x - 16, y - 16)
      // le pixel : un petit carré posé sur le fil, plus sa courte traîne
      const s = p.taille
      ctx!.fillStyle = rgba(col, 1)
      ctx!.globalAlpha = (palette.sombre ? 1 : 0.9) * (0.6 + 0.4 * eclat)
      ctx!.fillRect(Math.round(x - s / 2) + 0.5, Math.round(y - s / 2) + 0.5, s, s)
      if (qualite > 0.5) {
        for (let k = 1; k <= 2; k++) {
          ctx!.globalAlpha = (palette.sombre ? 0.34 : 0.26) / k * (0.5 + 0.5 * eclat)
          ctx!.fillRect(Math.round(x - p.dx * k * 4 - s / 2) + 0.5, Math.round(y - p.dy * k * 4 - s / 2) + 0.5, s, s)
        }
      }
    }

    // 6. intersections qui viennent de recevoir un pixel : une braise qui s'avive puis s'éteint
    for (const [cle, v] of eclats) {
      const e = v * Math.exp(-dt * 2.2)
      if (e < 0.04) { eclats.delete(cle); continue }
      eclats.set(cle, e)
      const x = xFil(cle % cols) + 1, y = yFil(Math.floor(cle / cols)) + 1
      const taille = 14 * (0.8 + 0.6 * e)
      ctx!.globalAlpha = clamp(e, 0, 1) * (palette.sombre ? 0.6 : 0.4)
      ctx!.drawImage(lueurs.noeud, x - taille, y - taille, taille * 2, taille * 2)
    }
    ctx!.globalAlpha = 1
    ctx!.globalCompositeOperation = 'source-over'
  }

  // ── Boucle ──────────────────────────────────────────────────────────────────
  preparerPalette()
  construire()

  let temps = 12 // on démarre « en cours de route » : pas d'écran vide au premier instant
  let raf = 0
  let dernier = 0
  let dernierDessin = 0
  let coutMoyen = 0
  let imagesLentes = 0

  if (reduire) {
    dessiner(temps, 0.016)
  } else {
    const boucle = (ms: number) => {
      raf = requestAnimationFrame(boucle)
      if (document.hidden) { dernier = ms; return }
      if (ms - dernierDessin < 1000 / IMAGES_PAR_SECONDE_MAX - 1) return
      const dt = Math.min(0.05, Math.max(0.001, (ms - (dernier || ms)) / 1000))
      dernier = ms
      dernierDessin = ms
      temps += dt
      const debut = performance.now()
      dessiner(temps, dt)
      // Qualité adaptative : si le dessin coûte trop cher, moins de pixels (jamais moins de 30 %).
      coutMoyen = coutMoyen * 0.92 + (performance.now() - debut) * 0.08
      if (coutMoyen > 13 && qualite > 0.31) {
        if (++imagesLentes > 45) { qualite = Math.max(0.3, qualite * 0.7); imagesLentes = 0; peuplerPaquets() }
      } else imagesLentes = 0
    }
    raf = requestAnimationFrame(boucle)
  }

  // ── Écouteurs : taille de la fenêtre, thème clair/sombre ────────────────────
  let minuteur = 0
  const surTaille = () => {
    window.clearTimeout(minuteur)
    minuteur = window.setTimeout(() => { construire(); if (reduire) dessiner(temps, 0.016) }, 150)
  }
  const observateurTaille = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(surTaille) : null
  observateurTaille?.observe(parent)
  const observateurTheme = new MutationObserver(() => {
    const sombre = document.documentElement.classList.contains('dark')
    if (sombre === palette.sombre) return
    palette = sombre ? PALETTE_SOMBRE : PALETTE_CLAIRE
    preparerPalette()
    genererGrille()
    genererNuages()
    if (reduire) dessiner(temps, 0.016)
  })
  observateurTheme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

  return () => {
    cancelAnimationFrame(raf)
    window.clearTimeout(minuteur)
    observateurTaille?.disconnect()
    observateurTheme.disconnect()
  }
}
