/**
 * Découpe vidéo RAPIDE via ffmpeg.wasm (cœur auto-hébergé `/ffmpeg/`, 0 CDN).
 *
 * `-ss <start> -i input -t <span> -c copy` = COPIE DE FLUX : aucune ré-encodage
 * → quasi-instantané, qualité d'origine, taille proportionnelle à la durée.
 * Le cœur (~30 Mo) est chargé À LA DEMANDE au 1er découpage (puis mis en cache
 * par le service worker → disponible hors-ligne ensuite).
 */
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

let instance: FFmpeg | null = null
let loading: Promise<FFmpeg> | null = null

/** ffmpeg.wasm est-il utilisable ici ? (WebAssembly requis ; cœur mono-thread = pas besoin de COOP/COEP). */
export function ffmpegAvailable(): boolean {
  return typeof WebAssembly !== 'undefined' && typeof Worker !== 'undefined'
}

async function load(): Promise<FFmpeg> {
  if (instance) return instance
  if (!loading) {
    loading = (async () => {
      const ff = new FFmpeg()
      const base = new URL(`${import.meta.env.BASE_URL}ffmpeg`, window.location.origin).href
      await ff.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
      })
      instance = ff
      return ff
    })()
  }
  try {
    return await loading
  } catch (e) {
    loading = null // autoriser une nouvelle tentative au prochain appel
    throw e
  }
}

/**
 * Découpe [start, end] (secondes) par copie de flux. `onProgress` 0→1.
 * Renvoie un nouveau File `<nom>-extrait.<ext>` (même conteneur/type que la source).
 */
export async function trimVideoFast(
  file: File, start: number, end: number, onProgress?: (p: number) => void,
): Promise<File> {
  const ff = await load()
  const span = Math.max(0.1, end - start)
  const ext = (file.name.match(/\.(\w+)$/)?.[1] || 'mp4').toLowerCase()
  const input = `in.${ext}`
  const output = `out.${ext}`

  const prog = (e: { progress: number }) => onProgress?.(Math.min(1, Math.max(0, e.progress)))
  ff.on('progress', prog)
  try {
    await ff.writeFile(input, await fetchFile(file))
    const args = ['-ss', String(start), '-i', input, '-t', String(span), '-c', 'copy', '-avoid_negative_ts', 'make_zero']
    // +faststart : utile uniquement pour les conteneurs MP4/MOV (lecture web progressive).
    if (ext === 'mp4' || ext === 'mov' || ext === 'm4v') args.push('-movflags', '+faststart')
    args.push(output)

    const code = await ff.exec(args)
    if (code !== 0) throw new Error('ffmpeg-exec-failed')

    const data = await ff.readFile(output)
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : (data as Uint8Array)
    if (!bytes.byteLength) throw new Error('ffmpeg-empty')
    onProgress?.(1)
    const name = file.name.replace(/\.\w+$/, '') + '-extrait.' + ext
    return new File([new Uint8Array(bytes)], name, { type: file.type || 'video/mp4', lastModified: Date.now() })
  } finally {
    ff.off('progress', prog)
    try { await ff.deleteFile(input) } catch { /* noop */ }
    try { await ff.deleteFile(output) } catch { /* noop */ }
  }
}
