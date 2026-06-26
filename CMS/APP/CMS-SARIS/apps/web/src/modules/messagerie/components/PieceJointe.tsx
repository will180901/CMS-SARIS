/**
 * PieceJointe — affichage d'une pièce jointe chiffrée selon son type.
 * - Image : aperçu chargé à la demande (data URL déchiffrée), clic = plein écran.
 * - Vidéo / Audio : carte « ▶ » → chargement + lecteur natif au clic.
 * - Document : carte (icône + nom + taille + téléchargement).
 * - En cours d'envoi (optimiste) : carte « envoi… » sans requête.
 *
 * ⚠️ Les pièces jointes sont rendues SUR le fond de conversation (hors bulle
 * colorée). Elles ont donc TOUJOURS un fond opaque lisible (pas de texte blanc
 * sur fond clair) — `mine` ne fait varier qu'une légère teinte d'identité.
 */
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { FileText, Download, Loader2, Play, Pause } from 'lucide-react'
import { messagerieApi, type PieceJointeMeta } from '../api/messagerie.api'
import { formatBytes, formatDuration } from './mediaUtils'

export function PieceJointe({ pj, mine, pending, onOpen }: { pj: PieceJointeMeta; mine: boolean; pending?: boolean; onOpen?: (pj: PieceJointeMeta) => void }) {
  const { t } = useTranslation()
  if (pending) {
    return (
      <Card mine={mine}>
        <IconTile mine={mine}><Loader2 size={18} className="animate-spin" /></IconTile>
        <Texts name={pj.nomFichier} sub={t('messagerie.sending')} />
      </Card>
    )
  }
  const mime = pj.mimeType
  if (mime.startsWith('image/')) return <ImagePiece pj={pj} onOpen={onOpen} />
  if (mime.startsWith('video/')) return <VideoPiece pj={pj} onOpen={onOpen} />
  if (mime.startsWith('audio/')) return <VoiceNotePlayer pj={pj} mine={mine} />
  return <DocPiece pj={pj} mine={mine} />
}

function usePiece(pj: PieceJointeMeta, enabled: boolean) {
  return useQuery({
    queryKey: ['messagerie', 'piece', pj.id],
    queryFn:  () => messagerieApi.piece(pj.id),
    enabled,
    staleTime: 5 * 60_000,
  })
}

function ImagePiece({ pj, onOpen }: { pj: PieceJointeMeta; onOpen?: (pj: PieceJointeMeta) => void }) {
  const { t } = useTranslation()
  const { data, isLoading, isError } = usePiece(pj, true)
  if (isLoading) return <div style={{ width: 220, height: 150, borderRadius: 10, background: 'var(--fond-surface-2)', border: '1px solid var(--bordure-legere)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={18} className="animate-spin" style={{ color: 'var(--texte-tertiaire)' }} /></div>
  if (isError || !data) return <DocPiece pj={pj} mine={false} />
  return (
    <button onClick={() => (onOpen ? onOpen(pj) : window.open(data.dataUrl, '_blank'))} title={t('messagerie.open', { nom: pj.nomFichier })}
      style={{ display: 'block', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}>
      <img src={data.dataUrl} alt={pj.nomFichier} style={{ maxWidth: 260, maxHeight: 260, borderRadius: 10, display: 'block', border: '1px solid var(--bordure-legere)' }} />
    </button>
  )
}

// Vidéo : la vignette ouvre le LECTEUR plein-panneau (même comportement que l'aperçu).
function VideoPiece({ pj, onOpen }: { pj: PieceJointeMeta; onOpen?: (pj: PieceJointeMeta) => void }) {
  const { t } = useTranslation()
  const [, setLoad] = useState(false)
  return (
    <button onClick={() => (onOpen ? onOpen(pj) : setLoad(true))} title={t('messagerie.play', { nom: pj.nomFichier })}
      style={{ width: 240, height: 150, cursor: 'pointer', padding: 0, borderRadius: 10, border: '1px solid var(--bordure-legere)', background: '#0f172a', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <span style={{ width: 50, height: 50, borderRadius: 9999, background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Play size={24} fill="currentColor" /></span>
      <span style={{ fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pj.nomFichier}</span>
      <span style={{ fontSize: 10, opacity: 0.75 }}>{formatBytes(pj.taille)}</span>
    </button>
  )
}

/* ── Lecteur de note vocale façon WhatsApp ─────────────────────────────────────
 * ▶/⏸ + onde décodée (Web Audio) avec pastille de lecture (clic = se positionner)
 * + durée + bouton de VITESSE 1×/1,5×/2× visible UNIQUEMENT pendant la lecture.
 * L'onde est calculée depuis l'audio déchiffré ; la durée vient du buffer décodé
 * (fiable, contourne le bug WebM `duration === Infinity`).
 */
const WAVE_BARS = 36
const VOICE_SPEEDS = [1, 1.5, 2] as const

let sharedAudioCtx: AudioContext | null = null
function getAudioCtx(): AudioContext {
  if (!sharedAudioCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    sharedAudioCtx = new Ctor()
  }
  return sharedAudioCtx
}

async function decodePeaks(dataUrl: string, bars: number): Promise<{ peaks: number[]; duration: number }> {
  const arr = await (await fetch(dataUrl)).arrayBuffer()
  const audio = await getAudioCtx().decodeAudioData(arr)
  const ch = audio.getChannelData(0)
  const block = Math.max(1, Math.floor(ch.length / bars))
  const raw: number[] = []
  let max = 0
  for (let i = 0; i < bars; i++) {
    let sum = 0
    const s = i * block
    for (let j = 0; j < block; j++) sum += Math.abs(ch[s + j] || 0)
    const v = sum / block
    raw.push(v); if (v > max) max = v
  }
  return { peaks: raw.map(v => (max > 0 ? Math.min(1, v / max) : 0)), duration: audio.duration }
}

function VoiceNotePlayer({ pj, mine }: { pj: PieceJointeMeta; mine: boolean }) {
  const { t } = useTranslation()
  const { data, isLoading, isError } = usePiece(pj, true)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef   = useRef(0)
  const [peaks, setPeaks]   = useState<number[]>(() => new Array(WAVE_BARS).fill(0.4))
  const [duration, setDur]  = useState(0)
  const [playing, setPlay]  = useState(false)
  const [frac, setFrac]     = useState(0)
  const [speedIdx, setSpeed] = useState(0)

  useEffect(() => {
    if (!data?.dataUrl) return
    let off = false
    decodePeaks(data.dataUrl, WAVE_BARS)
      .then(r => { if (!off) { setPeaks(r.peaks); if (isFinite(r.duration) && r.duration > 0) setDur(r.duration) } })
      .catch(() => { /* onde optionnelle : on garde des barres plates */ })
    return () => { off = true }
  }, [data?.dataUrl])
  useEffect(() => () => { cancelAnimationFrame(rafRef.current); try { audioRef.current?.pause() } catch { /* noop */ } }, [])

  function loop() {
    const a = audioRef.current
    if (a && !a.paused) {
      const d = duration || a.duration || 1
      setFrac(Math.min(1, a.currentTime / d))
      rafRef.current = requestAnimationFrame(loop)
    }
  }
  function toggle() {
    const a = audioRef.current; if (!a) return
    if (a.paused) { a.playbackRate = VOICE_SPEEDS[speedIdx]; a.play().then(() => { setPlay(true); loop() }).catch(() => { /* noop */ }) }
    else { a.pause(); setPlay(false); cancelAnimationFrame(rafRef.current) }
  }
  function cycleSpeed(e: React.MouseEvent) {
    e.stopPropagation()
    const n = (speedIdx + 1) % VOICE_SPEEDS.length
    setSpeed(n)
    if (audioRef.current) audioRef.current.playbackRate = VOICE_SPEEDS[n]
  }
  function seek(e: React.PointerEvent<HTMLDivElement>) {
    const a = audioRef.current; if (!a) return
    const r = e.currentTarget.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    setFrac(f)
    try { a.currentTime = f * (duration || a.duration || 0) } catch { /* noop */ }
  }

  if (isError) return <DocPiece pj={pj} mine={mine} />

  // Palette : sur bulle colorée (mine) → blanc ; sinon → teal/gris.
  const C = mine
    ? { play: 'rgba(255,255,255,0.92)', playFg: 'var(--ap-600)', done: '#ffffff', todo: 'rgba(255,255,255,0.42)', dot: '#ffffff', txt: 'rgba(255,255,255,0.9)', pill: 'rgba(255,255,255,0.22)', pillFg: '#fff' }
    : { play: 'var(--ap-400)', playFg: '#fff', done: 'var(--ap-500)', todo: 'var(--bordure-forte)', dot: 'var(--ap-500)', txt: 'var(--texte-secondaire)', pill: 'var(--fond-surface-2)', pillFg: 'var(--ap-600)' }

  const playedBars = Math.round(frac * peaks.length)
  const timeLabel  = formatDuration(playing ? frac * (duration || 0) : duration)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, width: 250, maxWidth: '100%', padding: '3px 2px' }}>
      <button onClick={toggle} disabled={isLoading} title={playing ? t('messagerie.pause') : t('messagerie.listen')}
        style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 9999, border: 'none', cursor: isLoading ? 'default' : 'pointer', background: C.play, color: C.playFg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isLoading ? <Loader2 size={16} className="animate-spin" /> : playing ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 2 }} fill="currentColor" />}
      </button>

      <div onPointerDown={seek} style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', gap: 2, height: 30, cursor: 'pointer', minWidth: 70 }}>
        {peaks.map((v, i) => (
          <span key={i} style={{ flex: 1, maxWidth: 3, height: Math.max(3, Math.round((0.18 + v * 0.82) * 24)), borderRadius: 9999, background: i < playedBars ? C.done : C.todo }} />
        ))}
        <span style={{ position: 'absolute', top: '50%', left: `${frac * 100}%`, transform: 'translate(-50%,-50%)', width: 10, height: 10, borderRadius: 9999, background: C.dot, boxShadow: '0 0 0 2px rgba(0,0,0,0.10)', pointerEvents: 'none' }} />
      </div>

      <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: C.txt, minWidth: 30, textAlign: 'right' }}>{timeLabel}</span>

      {playing && (
        <button onClick={cycleSpeed} title={t('messagerie.playbackSpeed')}
          style={{ flexShrink: 0, height: 22, padding: '0 7px', borderRadius: 9999, border: 'none', cursor: 'pointer', background: C.pill, color: C.pillFg, fontSize: 10.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {VOICE_SPEEDS[speedIdx].toString().replace('.', ',')}×
        </button>
      )}

      {data && <audio ref={audioRef} src={data.dataUrl} preload="metadata" onEnded={() => { setPlay(false); setFrac(0); cancelAnimationFrame(rafRef.current) }} style={{ display: 'none' }} />}
    </div>
  )
}

function DocPiece({ pj, mine }: { pj: PieceJointeMeta; mine: boolean }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  async function download() {
    if (loading) return
    setLoading(true)
    try {
      const { dataUrl, nomFichier } = await messagerieApi.piece(pj.id)
      const a = document.createElement('a')
      a.href = dataUrl; a.download = nomFichier
      document.body.appendChild(a); a.click(); a.remove()
    } finally { setLoading(false) }
  }
  return (
    <Card mine={mine} onClick={download} title={t('messagerie.download', { nom: pj.nomFichier })}>
      <IconTile mine={mine}>{loading ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}</IconTile>
      <Texts name={pj.nomFichier} sub={formatBytes(pj.taille)} />
      <Download size={15} style={{ flexShrink: 0, color: 'var(--texte-tertiaire)' }} />
    </Card>
  )
}

/* ── Primitives visibles sur le fond de conversation (jamais blanc-sur-clair) ── */

function Card({ children, mine, onClick, title }: { children: React.ReactNode; mine: boolean; onClick?: () => void; title?: string }) {
  return (
    <div onClick={onClick} title={title}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: 250, maxWidth: '100%',
        padding: 9, borderRadius: 10,
        background: mine ? 'var(--ap-50)' : 'var(--fond-surface)',
        border: `1px solid ${mine ? 'var(--ap-200)' : 'var(--bordure-legere)'}`,
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        cursor: onClick ? 'pointer' : 'default',
      }}>
      {children}
    </div>
  )
}

function IconTile({ children, mine }: { children: React.ReactNode; mine: boolean }) {
  return (
    <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: mine ? 'var(--ap-100, #C2DBE6)' : 'var(--ap-50)', color: 'var(--ap-600)' }}>
      {children}
    </span>
  )
}

function Texts({ name, sub }: { name: string; sub: string }) {
  return (
    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--texte-primaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      <span style={{ fontSize: 10.5, color: 'var(--texte-tertiaire)' }}>{sub}</span>
    </span>
  )
}

/**
 * MediaThumb — cellule média pour l'album dans la bulle (image/vidéo).
 * `single` = seule image → aspect naturel ; sinon = cellule carrée (cover).
 * `overlay` = nombre « +N » affiché par-dessus (dernière cellule d'un album tronqué).
 */
export function MediaThumb({ pj, onOpen, single, overlay }: { pj: PieceJointeMeta; onOpen?: (pj: PieceJointeMeta) => void; single?: boolean; overlay?: number }) {
  const { t } = useTranslation()
  const isVideo = pj.mimeType.startsWith('video/')
  const { data, isLoading, isError } = usePiece(pj, !isVideo)
  const click = () => onOpen?.(pj)
  const Ovl = overlay && overlay > 0
    ? <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, fontWeight: 700 }}>+{overlay}</div>
    : null

  if (isVideo) {
    return (
      <button onClick={click} title={t('messagerie.play', { nom: pj.nomFichier })}
        style={{ position: 'relative', display: 'block', padding: 0, border: 'none', cursor: 'pointer', background: '#0f172a', width: single ? 280 : '100%', height: single ? 168 : undefined, aspectRatio: single ? undefined : '1', overflow: 'hidden' }}>
        <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 46, height: 46, borderRadius: 9999, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><Play size={22} fill="currentColor" /></span>
        {Ovl}
      </button>
    )
  }
  return (
    <button onClick={click} title={t('messagerie.open', { nom: pj.nomFichier })}
      style={{ position: 'relative', display: 'block', padding: 0, border: 'none', cursor: 'pointer', background: 'var(--fond-surface-2)', width: single ? 'auto' : '100%', aspectRatio: single ? undefined : '1', overflow: 'hidden', lineHeight: 0 }}>
      {isLoading
        ? <div style={{ width: single ? 220 : '100%', aspectRatio: single ? '4 / 3' : '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={18} className="animate-spin" style={{ color: 'var(--texte-tertiaire)' }} /></div>
        : isError || !data
          ? <div style={{ width: single ? 220 : '100%', aspectRatio: single ? '4 / 3' : '1' }} />
          : single
            ? <img src={data.dataUrl} alt={pj.nomFichier} style={{ display: 'block', maxWidth: 300, maxHeight: 360, width: 'auto', height: 'auto' }} />
            : <img src={data.dataUrl} alt={pj.nomFichier} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
      {Ovl}
    </button>
  )
}
