/**
 * mediaUtils — règles & outils de partage médias (façon WhatsApp).
 * - Limites de taille par type + durée vidéo max.
 * - Compression d'image (canvas) pour rester sous la limite.
 * - Lecture de la durée vidéo/audio (métadonnées).
 */

export type MediaKind = 'image' | 'video' | 'audio' | 'document'

/** Durée vidéo maximale autorisée (2 min, comme WhatsApp). */
export const VIDEO_MAX_SEC = 120

/** Limites de taille (octets) par type, après compression éventuelle. */
export const LIMITS: Record<MediaKind, number> = {
  image:    8 * 1024 * 1024,
  video:    16 * 1024 * 1024,
  audio:    16 * 1024 * 1024,
  document: 16 * 1024 * 1024,
}

export function fileKind(file: File): MediaKind {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  return 'document'
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Durée (secondes) d'un fichier vidéo/audio via ses métadonnées.
 * Garde-fou : si les métadonnées ne se chargent pas (fichier illisible/corrompu),
 * on résout à 0 après un délai pour ne jamais bloquer l'aperçu.
 */
export function mediaDuration(file: File, kind: 'video' | 'audio'): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement(kind) as HTMLMediaElement
    el.preload = 'metadata'
    const url = URL.createObjectURL(file)
    let settled = false
    const done = (d: number) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      el.removeAttribute('src'); el.load()
      resolve(d)
    }
    const timer = setTimeout(() => done(0), 5000)
    el.onloadedmetadata = () => {
      // ⚠️ Bug WebM/MediaRecorder : `duration` reste Infinity tant qu'on n'a pas
      // seeké jusqu'au bout. On force le calcul en seekant très loin.
      if (el.duration === Infinity || !isFinite(el.duration)) {
        el.ontimeupdate = () => { el.ontimeupdate = null; done(isFinite(el.duration) ? el.duration : 0) }
        try { el.currentTime = 1e7 } catch { done(0) }
      } else {
        done(el.duration)
      }
    }
    el.onerror = () => done(0)
    el.src = url
  })
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e) }
    img.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality))
}

/**
 * Compresse une image (redimensionnement + ré-encodage JPEG) pour rester sous
 * `maxBytes`. Les GIF (animés) ne sont pas recompressés. Renvoie le fichier
 * d'origine si déjà petit ou en cas d'échec.
 */
export async function compressImage(file: File, maxDim = 1920, maxBytes = LIMITS.image): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const img = await loadImage(file)
    let width = img.naturalWidth, height = img.naturalHeight
    const needsResize = width > maxDim || height > maxDim
    if (!needsResize && file.size <= maxBytes) return file
    if (needsResize) {
      const r = Math.min(maxDim / width, maxDim / height)
      width = Math.round(width * r); height = Math.round(height * r)
    }
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(img, 0, 0, width, height)
    let quality = 0.85
    let blob = await canvasToBlob(canvas, 'image/jpeg', quality)
    while (blob && blob.size > maxBytes && quality > 0.4) {
      quality -= 0.12
      blob = await canvasToBlob(canvas, 'image/jpeg', quality)
    }
    if (blob && blob.size > maxBytes && maxDim > 1280) {
      return compressImage(file, 1280, maxBytes) // ré-essai plus petit
    }
    if (!blob) return file
    const name = file.name.replace(/\.\w+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return file
  }
}

/**
 * Durée max sélectionnable pour une vidéo : bornée par la durée WhatsApp
 * (`VIDEO_MAX_SEC`) ET par la taille acceptée (estimation à débit constant
 * `taille/durée`). Renvoie la portion de secondes qui « tient » dans la limite.
 */
export function videoMaxSpan(fileSize: number, duration: number): number {
  if (!duration || duration <= 0) return VIDEO_MAX_SEC
  const bytesPerSec = fileSize / duration
  // 90 % de la limite → marge pour l'overhead conteneur / arrondi GOP (copie de flux).
  const spanBySize = bytesPerSec > 0 ? (LIMITS.video * 0.9) / bytesPerSec : VIDEO_MAX_SEC
  return Math.max(1, Math.min(VIDEO_MAX_SEC, spanBySize, duration))
}

/**
 * Extrait `count` vignettes réparties sur la durée de la vidéo (pellicule du
 * rogneur). Décode chaque image par seek successif → renvoie des data URL JPEG.
 * Dégrade en tableau partiel/vide si le décodage échoue (ex. onglet en arrière-plan).
 */
export function extractThumbnails(
  url: string, duration: number, count = 12, w = 96, h = 56,
): Promise<string[]> {
  return new Promise((resolve) => {
    if (!duration || duration <= 0) { resolve([]); return }
    const v = document.createElement('video')
    v.src = url; v.muted = true; v.preload = 'auto'
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h
    const ctx = cv.getContext('2d')
    const out: string[] = []
    const times = Array.from({ length: count }, (_, k) => Math.min(duration * 0.999, (duration * (k + 0.5)) / count))
    let i = 0
    let settled = false
    const finish = () => { if (settled) return; settled = true; clearTimeout(timer); v.removeAttribute('src'); try { v.load() } catch { /* noop */ } resolve(out) }
    const grab = () => { if (i >= times.length) { finish(); return } try { v.currentTime = times[i] } catch { finish() } }
    v.onloadeddata = () => grab()
    v.onseeked = () => {
      try { if (ctx) { ctx.drawImage(v, 0, 0, w, h); out.push(cv.toDataURL('image/jpeg', 0.55)) } } catch { /* noop */ }
      i++; grab()
    }
    v.onerror = () => finish()
    const timer = setTimeout(finish, 12000)
  })
}

/** Taille estimée (octets) d'une portion de vidéo (débit constant). */
export function estimateTrimBytes(fileSize: number, duration: number, span: number): number {
  if (!duration || duration <= 0) return fileSize
  return Math.round((fileSize / duration) * span)
}

/** Le navigateur peut-il découper une vidéo côté client (MediaRecorder + captureStream) ? */
export function canTrimVideo(): boolean {
  return typeof MediaRecorder !== 'undefined'
    && typeof HTMLMediaElement !== 'undefined'
    && ('captureStream' in HTMLMediaElement.prototype || 'mozCaptureStream' in HTMLMediaElement.prototype)
}

/**
 * Découpe une vidéo sur l'intervalle [start, end] (secondes) côté client via
 * MediaRecorder (ré-encodage WebM/VP9, en temps réel). Lecture muette pour ne
 * pas jouer le son pendant le traitement. `onProgress` : 0→1.
 * ⚠️ Le temps de traitement ≈ durée de l'extrait (limitation MediaRecorder).
 */
export async function trimVideo(
  file: File, start: number, end: number, onProgress?: (p: number) => void, videoBitsPerSecond?: number,
): Promise<File> {
  if (!canTrimVideo()) throw new Error('trim-unsupported')
  const span = Math.max(0.1, end - start)
  const url = URL.createObjectURL(file)
  const v = document.createElement('video')
  v.src = url
  v.muted = true
  ;(v as HTMLVideoElement).playsInline = true
  v.preload = 'auto'

  const cleanup = (stream?: MediaStream) => {
    try { stream?.getTracks().forEach(t => t.stop()) } catch { /* noop */ }
    try { v.pause() } catch { /* noop */ }
    v.removeAttribute('src'); v.load()
    URL.revokeObjectURL(url)
  }

  try {
    await new Promise<void>((res, rej) => {
      v.onloadedmetadata = () => res()
      v.onerror = () => rej(new Error('video-load'))
      setTimeout(() => rej(new Error('video-load-timeout')), 8000)
    })

    const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    const mimeType = candidates.find(c => MediaRecorder.isTypeSupported(c)) || 'video/webm'
    // @ts-expect-error captureStream non typé partout
    const stream: MediaStream = v.captureStream ? v.captureStream() : v.mozCaptureStream()
    // Débit borné (300 kbit/s → 4 Mbit/s). Sans valeur fournie, on reste prudent
    // pour ne pas dépasser la limite de taille (le défaut MediaRecorder gonfle).
    const vbr = Math.round(Math.max(300_000, Math.min(4_000_000, videoBitsPerSecond ?? 1_200_000)))
    const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: vbr, audioBitsPerSecond: 96_000 })
    const chunks: BlobPart[] = []
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data) }
    const stopped = new Promise<void>(res => { rec.onstop = () => res() })

    await new Promise<void>(res => { v.onseeked = () => res(); v.currentTime = Math.max(0, start) })
    rec.start(150)
    await v.play()

    await new Promise<void>(res => {
      const tick = () => {
        onProgress?.(Math.min(1, (v.currentTime - start) / span))
        if (v.currentTime >= end - 0.03 || v.ended) res()
        else requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })

    rec.stop()
    await stopped
    onProgress?.(1)
    cleanup(stream)

    const blob = new Blob(chunks, { type: 'video/webm' })
    if (!blob.size) throw new Error('trim-empty')
    const name = file.name.replace(/\.\w+$/, '') + '-extrait.webm'
    return new File([blob], name, { type: 'video/webm', lastModified: Date.now() })
  } catch (e) {
    cleanup()
    throw e
  }
}
