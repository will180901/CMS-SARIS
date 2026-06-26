/**
 * VoiceRecorder — note vocale façon WhatsApp : enregistrement → ENVOI DIRECT.
 *
 * Micro → MediaRecorder (Opus/WebM). Pendant l'enregistrement : chrono + onde
 * d'amplitude (barres arrondies) + bouton ENVOYER (➤) qui ARRÊTE ET ENVOIE en UN
 * SEUL geste (pas d'étape de relecture avant envoi). Corbeille = annuler. 5 min max.
 * La lecture + le changement de vitesse se font ensuite sur la BULLE du message
 * (lecteur intégré dans PieceJointe).
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, Send, Mic, Loader2 } from 'lucide-react'
import { formatDuration } from './mediaUtils'

const MAX_SEC = 300
const BARS = 44          // nb de barres affichées dans l'onde
const SAMPLE_MS = 80     // période d'échantillonnage de l'amplitude

function pickMime(): string {
  const c = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4']
  return c.find(m => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) || ''
}

/** Ré-échantillonne une suite de niveaux (0..1) vers exactement `bars` valeurs. */
function resample(raw: number[], bars: number): number[] {
  if (raw.length === 0) return new Array(bars).fill(0)
  const out: number[] = []
  const size = raw.length / bars
  for (let i = 0; i < bars; i++) {
    const s = Math.floor(i * size)
    const e = Math.max(s + 1, Math.floor((i + 1) * size))
    let sum = 0, n = 0
    for (let j = s; j < e && j < raw.length; j++) { sum += raw[j]; n++ }
    out.push(n ? sum / n : 0)
  }
  return out
}

export function VoiceRecorder({ onCancel, onSend }: { onCancel: () => void; onSend: (file: File) => void }) {
  const { t } = useTranslation()
  const [starting, setStarting] = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [elapsed, setElapsed]   = useState(0)
  const [bars, setBars]         = useState<number[]>(() => new Array(BARS).fill(0))

  const recRef      = useRef<MediaRecorder | null>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const chunksRef   = useRef<BlobPart[]>([])
  const rawRef      = useRef<number[]>([])
  const lastSampleRef = useRef(0)
  const rafRef      = useRef(0)
  const startedAtRef = useRef(0)
  const elapsedRef  = useRef(0)
  const modeRef     = useRef<'send' | 'cancel'>('send')
  const sendingRef  = useRef(false)

  const onSendRef   = useRef(onSend);   onSendRef.current = onSend
  const onCancelRef = useRef(onCancel); onCancelRef.current = onCancel
  const filePrefixRef = useRef(t('messagerie.voiceNoteFilename')); filePrefixRef.current = t('messagerie.voiceNoteFilename')

  function stopMicro() {
    cancelAnimationFrame(rafRef.current)
    try { streamRef.current?.getTracks().forEach(t => t.stop()) } catch { /* noop */ }
    try { audioCtxRef.current?.close() } catch { /* noop */ }
    streamRef.current = null; audioCtxRef.current = null; analyserRef.current = null
  }

  // ── Démarrage du micro + capture ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        const mimeType = pickMime()
        const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
        recRef.current = rec
        rec.ondataavailable = e => { if (e.data && e.data.size) chunksRef.current.push(e.data) }
        // À l'arrêt : soit on ENVOIE directement le fichier, soit on annule.
        rec.onstop = () => {
          const type = mimeType || 'audio/webm'
          const blob = new Blob(chunksRef.current, { type })
          chunksRef.current = []
          stopMicro()
          if (modeRef.current === 'cancel' || blob.size === 0) { onCancelRef.current(); return }
          const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
          const name = `${filePrefixRef.current}-${formatDuration(elapsedRef.current).replace(':', 'm')}s.${ext}`
          onSendRef.current(new File([blob], name, { type, lastModified: Date.now() }))
        }

        // Analyser d'amplitude (time-domain → pic 0..1) pour l'onde.
        try {
          const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
          const actx = new Ctor()
          audioCtxRef.current = actx
          const srcNode = actx.createMediaStreamSource(stream)
          const analyser = actx.createAnalyser()
          analyser.fftSize = 1024
          srcNode.connect(analyser)
          analyserRef.current = analyser
        } catch { /* onde optionnelle */ }

        rec.start(120)
        startedAtRef.current = performance.now()
        lastSampleRef.current = performance.now()
        setStarting(false)
        recLoop()
      } catch {
        setError(t('messagerie.micUnavailable'))
        setStarting(false)
        setTimeout(() => onCancelRef.current(), 1600)
      }
    })()
    return () => { cancelled = true; sendingRef.current = false; try { recRef.current?.state !== 'inactive' && (modeRef.current = 'cancel', recRef.current?.stop()) } catch { /* noop */ } stopMicro() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Boucle d'enregistrement : chrono + échantillonnage amplitude ───────────
  function recLoop() {
    const buf = new Uint8Array(analyserRef.current?.fftSize ?? 1024)
    const tick = () => {
      const rec = recRef.current
      if (rec && rec.state === 'recording') {
        const sec = Math.floor((performance.now() - startedAtRef.current) / 1000)
        if (sec !== elapsedRef.current) { elapsedRef.current = sec; setElapsed(sec) }
        if (sec >= MAX_SEC) { sendNote(); return }   // limite atteinte → on envoie
      }
      const an = analyserRef.current
      if (an && performance.now() - lastSampleRef.current >= SAMPLE_MS) {
        lastSampleRef.current = performance.now()
        an.getByteTimeDomainData(buf)
        let peak = 0
        for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i] - 128) / 128; if (v > peak) peak = v }
        rawRef.current.push(Math.min(1, peak * 1.4))
        setBars(resample(rawRef.current, BARS))
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  /** Arrête l'enregistrement ET envoie en un seul geste (onstop fait l'envoi). */
  function sendNote() {
    if (sendingRef.current) return
    sendingRef.current = true
    modeRef.current = 'send'
    try {
      if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop()
      else onCancelRef.current()
    } catch { onCancelRef.current() }
  }

  function cancel() {
    modeRef.current = 'cancel'
    try {
      if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop()
      else { stopMicro(); onCancelRef.current() }
    } catch { stopMicro(); onCancelRef.current() }
  }

  if (error) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--erreur-accent)', fontSize: 12.5, padding: '0 6px' }}><Mic size={16} /> {error}</div>
  }

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', minHeight: 38 }}>
      {/* Annuler / corbeille */}
      <button onClick={cancel} title={t('messagerie.cancel')} style={iconBtn('var(--erreur-accent)')}><Trash2 size={18} /></button>

      {/* Point rouge d'enregistrement */}
      <span style={{ width: 9, height: 9, borderRadius: 9999, background: 'var(--erreur-accent)', flexShrink: 0, animation: 'saris-rec-pulse 1s infinite' }} />

      {/* Onde d'amplitude (live) */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, height: 30, minWidth: 80 }}>
        {bars.map((v, i) => (
          <span key={i} style={{ flex: 1, maxWidth: 4, height: Math.max(3, Math.round((0.12 + v * 0.88) * 26)), borderRadius: 9999, background: 'var(--ap-400)', transition: 'height .08s linear' }} />
        ))}
      </div>

      {/* Chrono */}
      <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12.5, fontWeight: 600, color: 'var(--texte-secondaire)', minWidth: 38, textAlign: 'right' }}>{formatDuration(elapsed)}</span>

      {/* ENVOYER directement (arrête + envoie) */}
      {starting
        ? <Loader2 size={18} className="animate-spin" style={{ color: 'var(--texte-tertiaire)', flexShrink: 0 }} />
        : <button onClick={sendNote} title={t('messagerie.sendVoiceNote')} style={roundBtn('var(--ap-400)', '#fff', 38)}><Send size={16} /></button>}

      <style>{'@keyframes saris-rec-pulse{0%,100%{opacity:1}50%{opacity:0.25}}'}</style>
    </div>
  )
}

function iconBtn(color: string): React.CSSProperties {
  return { width: 34, height: 34, flexShrink: 0, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color }
}
function roundBtn(bg: string, fg: string, size: number): React.CSSProperties {
  return { width: size, height: size, flexShrink: 0, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, color: fg, border: 'none', cursor: 'pointer' }
}
