/**
 * MediaPreview — écran d'aperçu réel des médias avant envoi (façon WhatsApp).
 *
 * - Couvre UNIQUEMENT le panneau de droite (rendu en place, `position:absolute`
 *   dans MessageThread en `position:relative` ; PAS de portail body).
 * - **Thème cohérent avec l'app** : utilise les tokens SARIS (`--fond-*`,
 *   `--texte-*`, `--bordure-*`) → clair en mode clair, sombre en mode sombre.
 *   Seule la timeline du rogneur reste sombre (c'est un contrôle vidéo).
 * - Aperçu réel par type ; vidéo GRANDE (flex:1) et lisible (lecteur natif).
 * - Rogneur « pellicule » : sélection déplaçable d'un bloc, bornée par durée/taille.
 * - Bande de miniatures + « + », légende, envoi (découpe vidéo à l'envoi).
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { X, Plus, Send, FileText, Music, Film, AlertTriangle, Loader2, Scissors } from 'lucide-react'
import { toast } from '@workspace/ui/components/sonner'
import {
  fileKind, compressImage, mediaDuration, formatBytes, formatDuration,
  videoMaxSpan, estimateTrimBytes, canTrimVideo, trimVideo, extractThumbnails,
  LIMITS, VIDEO_MAX_SEC, type MediaKind,
} from './mediaUtils'
import { ffmpegAvailable, trimVideoFast } from './ffmpegTrim'

// Palette pilotée par les tokens SARIS → cohérente avec le thème courant (clair/sombre).
const C = {
  modal:  'var(--fond-surface)',
  stage:  'var(--fond-page)',
  field:  'var(--fond-surface-2)',
  border: 'var(--bordure-legere)',
  border2:'var(--bordure-normale)',
  txt:    'var(--texte-primaire)',
  txt2:   'var(--texte-secondaire)',
  txt3:   'var(--texte-tertiaire)',
  accent: 'var(--ap-400)',
  errBg:  'var(--erreur-fond)',
  err:    'var(--erreur-accent)',
  okBg:   'var(--succes-fond)',
  ok:     'var(--succes-texte)',
}

interface Trim { start: number; end: number }
interface Item {
  id: string
  file: File
  kind: MediaKind
  url: string
  sizeText: string
  durationSec?: number
  durationText?: string
  note?: string
  error?: string
  maxSpan?: number
  trimRequired?: boolean
  trim?: Trim
}

let seq = 0
const ACCEPT_ALL = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt'

async function buildItem(f: File, t: TFunction): Promise<Item> {
  const kind = fileKind(f)
  const base: Item = { id: `m${++seq}`, file: f, kind, url: URL.createObjectURL(f), sizeText: formatBytes(f.size) }

  if (kind === 'image') {
    const before = f.size
    const file = await compressImage(f)
    URL.revokeObjectURL(base.url)
    base.file = file; base.url = URL.createObjectURL(file); base.sizeText = formatBytes(file.size)
    if (file.size < before * 0.92) base.note = t('messagerie.compressedNote', { avant: formatBytes(before), apres: formatBytes(file.size) })
    if (file.size > LIMITS.image) base.error = t('messagerie.imageTooHeavy', { taille: formatBytes(file.size) })
  } else if (kind === 'video') {
    const d = await mediaDuration(f, 'video')
    base.durationSec = d
    base.durationText = d ? formatDuration(d) : undefined
    if (!d || d <= 0) {
      if (f.size > LIMITS.video) base.error = t('messagerie.videoTooHeavyUnknown', { taille: formatBytes(f.size) })
    } else {
      const fitsWhole = d <= VIDEO_MAX_SEC + 0.5 && f.size <= LIMITS.video
      const maxSpan = fitsWhole ? d : videoMaxSpan(f.size, d)
      base.maxSpan = maxSpan
      base.trimRequired = !fitsWhole
      base.trim = { start: 0, end: Math.min(d, maxSpan) }
    }
  } else if (kind === 'audio') {
    const d = await mediaDuration(f, 'audio')
    base.durationText = d ? formatDuration(d) : undefined
    if (f.size > LIMITS.audio) base.error = t('messagerie.audioTooHeavy', { taille: formatBytes(f.size), max: formatBytes(LIMITS.audio) })
  } else if (f.size > LIMITS.document) {
    base.error = t('messagerie.documentTooHeavy', { taille: formatBytes(f.size), max: formatBytes(LIMITS.document) })
  }
  return base
}

export function MediaPreview({ initialFiles, onCancel, onSend }: {
  initialFiles: File[]
  onCancel: () => void
  onSend: (files: File[], caption: string) => void
}) {
  const { t } = useTranslation()
  const [items, setItems] = useState<Item[]>([])
  const [active, setActive] = useState(0)
  const [caption, setCaption] = useState('')
  const [processing, setProcessing] = useState(true)
  const [busy, setBusy] = useState(false)
  const [prog, setProg] = useState<{ id: string; p: number } | null>(null)
  const addRef = useRef<HTMLInputElement>(null)
  const urls = useRef<string[]>([])

  const process = useCallback(async (files: File[]) => {
    const built = await Promise.all(files.slice(0, 10).map(f => buildItem(f, t)))
    built.forEach(b => urls.current.push(b.url))
    return built
  }, [t])

  useEffect(() => {
    let cancelled = false
    process(initialFiles).then(res => { if (!cancelled) { setItems(res); setProcessing(false) } })
    return () => { cancelled = true; urls.current.forEach(u => URL.revokeObjectURL(u)) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function addMore(list: FileList | null) {
    if (!list?.length) return
    setProcessing(true)
    const more = await process(Array.from(list))
    setItems(prev => [...prev, ...more].slice(0, 10))
    setProcessing(false)
    if (addRef.current) addRef.current.value = ''
  }

  function removeAt(i: number) {
    setItems(prev => {
      const next = prev.filter((_, j) => j !== i)
      if (active >= next.length) setActive(Math.max(0, next.length - 1))
      return next
    })
  }

  function setTrim(id: string, trim: Trim) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, trim } : it))
  }

  const cur = items[active]
  const hasError = items.some(i => i.error)
  const canSend = !processing && !busy && items.length > 0 && !hasError

  async function send() {
    if (!canSend) return
    setBusy(true)
    try {
      const out: File[] = []
      for (const it of items) {
        const needsTrim = it.kind === 'video' && it.trim && it.durationSec &&
          (it.trimRequired || it.trim.start > 0.15 || it.trim.end < it.durationSec - 0.15)
        if (needsTrim && it.trim) {
          setProg({ id: it.id, p: 0 })
          let trimmed: File | null = null
          // 1) ffmpeg.wasm : découpe RAPIDE par copie de flux (pas de ré-encodage).
          if (ffmpegAvailable()) {
            try { trimmed = await trimVideoFast(it.file, it.trim.start, it.trim.end, p => setProg({ id: it.id, p })) }
            catch { trimmed = null }
          }
          // 2) Repli MediaRecorder (ré-encodage temps réel) au débit source.
          if (!trimmed && canTrimVideo()) {
            try {
              const dur = it.durationSec || 1
              const span = Math.max(0.5, it.trim.end - it.trim.start)
              const sourceBps = (it.file.size * 8) / dur
              const budgetBps = (LIMITS.video * 0.82 * 8) / span
              const bps = Math.max(300_000, Math.min(sourceBps, budgetBps))
              trimmed = await trimVideo(it.file, it.trim.start, it.trim.end, p => setProg({ id: it.id, p }), bps)
            } catch { trimmed = null }
          }
          if (!trimmed) {
            if (it.trimRequired) { toast.error(t('messagerie.cannotTrim', { nom: it.file.name })); setBusy(false); setProg(null); return }
            out.push(it.file); continue
          }
          if (trimmed.size > LIMITS.video) { toast.error(t('messagerie.extractStillTooHeavy', { max: formatBytes(LIMITS.video) })); setBusy(false); setProg(null); return }
          out.push(trimmed)
        } else {
          out.push(it.file)
        }
      }
      setProg(null); setBusy(false)
      onSend(out, caption.trim())
    } catch { setBusy(false); setProg(null) }
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60, background: C.modal, display: 'flex', flexDirection: 'column' }}>
      <input ref={addRef} type="file" multiple accept={ACCEPT_ALL} style={{ display: 'none' }} onChange={e => addMore(e.target.files)} />

      {/* En-tête */}
      <div style={{ flexShrink: 0, height: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', borderBottom: `1px solid ${C.border}` }}>
        <button onClick={onCancel} disabled={busy} title={t('messagerie.cancel')} style={iconBtn}><X size={20} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cur?.file.name ?? t('messagerie.preview')}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: C.txt3 }}>
            {cur ? `${cur.sizeText}${cur.durationText ? ' · ' + cur.durationText : ''}` : ''}{items.length > 1 ? ` · ${active + 1}/${items.length}` : ''}
          </p>
        </div>
      </div>

      {/* Aperçu principal */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, position: 'relative', background: C.stage }}>
        {processing && items.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: C.txt3 }}>
            <Loader2 size={26} className="animate-spin" /><span style={{ fontSize: 13 }}>{t('messagerie.preparingMedia')}</span>
          </div>
        ) : cur ? <MainPreview item={cur} t={t} onTrim={tr => setTrim(cur.id, tr)} /> : (
          <span style={{ color: C.txt3, fontSize: 13 }}>{t('messagerie.noMedia')}</span>
        )}
        {cur?.error && (
          <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8, background: C.errBg, color: C.err, padding: '8px 14px', borderRadius: 9999, fontSize: 12, fontWeight: 600, boxShadow: '0 2px 10px rgba(0,0,0,0.12)' }}>
            <AlertTriangle size={14} /> {cur.error}
          </div>
        )}
        {cur?.note && !cur.error && (
          <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', background: C.okBg, color: C.ok, padding: '6px 12px', borderRadius: 9999, fontSize: 11, fontWeight: 600 }}>
            {cur.note}
          </div>
        )}
      </div>

      {/* Légende */}
      <div style={{ flexShrink: 0, padding: '10px 16px', borderTop: `1px solid ${C.border}` }}>
        <input value={caption} onChange={e => setCaption(e.target.value)} placeholder={t('messagerie.captionPlaceholder')}
          disabled={busy}
          onKeyDown={e => { if (e.key === 'Enter') send() }}
          style={{ width: '100%', height: 42, padding: '0 16px', fontSize: 13, borderRadius: 9999, border: `1px solid ${C.border2}`, background: C.field, outline: 'none', color: C.txt }} />
      </div>

      {/* Miniatures + ajouter + envoyer */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px 16px' }}>
        <div style={{ flex: 1, display: 'flex', gap: 8, overflowX: 'auto', alignItems: 'center' }}>
          {items.map((it, i) => (
            <div key={it.id} style={{ position: 'relative', flexShrink: 0, transform: i === active ? 'translateY(-2px)' : 'none', transition: 'transform 0.12s' }}>
              <button onClick={() => setActive(i)} title={it.file.name} disabled={busy}
                style={{ width: 56, height: 56, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.field, border: `2.5px solid ${i === active ? C.accent : it.error ? C.err : C.border}`, boxShadow: i === active ? '0 4px 14px rgba(0,0,0,0.18)' : 'none' }}>
                <Thumb item={it} />
              </button>
              <button onClick={() => removeAt(i)} title={t('messagerie.remove')} disabled={busy}
                style={{ position: 'absolute', top: -6, right: -6, width: 19, height: 19, borderRadius: 9999, background: C.txt, color: C.modal, border: `2px solid ${C.modal}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                <X size={11} />
              </button>
            </div>
          ))}
          <button onClick={() => addRef.current?.click()} title={t('messagerie.add')} disabled={items.length >= 10 || busy}
            style={{ width: 56, height: 56, flexShrink: 0, borderRadius: 10, border: `1.5px dashed ${C.border2}`, background: C.field, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.txt3, opacity: items.length >= 10 ? 0.4 : 1 }}>
            {processing ? <Loader2 size={18} className="animate-spin" /> : <Plus size={20} />}
          </button>
        </div>
        <button onClick={send} disabled={!canSend} title={hasError ? t('messagerie.removeErrorFiles') : t('messagerie.send')}
          style={{ width: 54, height: 54, flexShrink: 0, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: canSend ? C.accent : C.field, color: canSend ? '#fff' : C.txt3, border: 'none', cursor: canSend ? 'pointer' : 'not-allowed', boxShadow: canSend ? '0 4px 14px rgba(0,0,0,0.18)' : 'none' }}>
          {busy ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
        </button>
      </div>

      {/* Overlay de traitement (découpe vidéo) */}
      {busy && (
        <div style={{ position: 'absolute', inset: 0, background: 'color-mix(in srgb, var(--fond-surface) 88%, transparent)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <Scissors size={30} style={{ color: C.accent }} />
          <span style={{ color: C.txt, fontSize: 14, fontWeight: 600 }}>{t('messagerie.trimmingExtract')}</span>
          <div style={{ width: 220, height: 6, borderRadius: 9999, background: C.field, overflow: 'hidden' }}>
            <div style={{ width: `${Math.round((prog?.p ?? 0) * 100)}%`, height: '100%', background: C.accent, transition: 'width 0.15s' }} />
          </div>
          <span style={{ color: C.txt3, fontSize: 11 }}>{t('messagerie.trimToolFirstRun')}</span>
        </div>
      )}
    </div>
  )
}

function MainPreview({ item, t, onTrim }: { item: Item; t: TFunction; onTrim: (trim: Trim) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [thumbs, setThumbs] = useState<string[]>([])
  const [playhead, setPlayhead] = useState(0)

  useEffect(() => {
    setThumbs([]); setPlayhead(0)
    if (item.kind !== 'video' || !item.durationSec) return
    let cancelled = false
    extractThumbnails(item.url, item.durationSec, 12).then(t => { if (!cancelled) setThumbs(t) })
    return () => { cancelled = true }
  }, [item.url, item.durationSec, item.kind])

  if (item.kind === 'image') {
    return <img src={item.url} alt={item.file.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 12, boxShadow: '0 10px 34px rgba(0,0,0,0.22)' }} />
  }

  if (item.kind === 'video') {
    const d = item.durationSec ?? 0
    const trim = item.trim ?? { start: 0, end: d }
    const maxSpan = item.maxSpan ?? d
    const span = Math.max(0, trim.end - trim.start)
    const estBytes = estimateTrimBytes(item.file.size, d, span)
    const clampPlayback = () => {
      const v = videoRef.current; if (!v) return
      if (v.currentTime < trim.start - 0.1 || v.currentTime >= trim.end - 0.02) v.currentTime = trim.start
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%', height: '100%', maxWidth: 860 }}>
        {/* La vidéo prend tout l'espace dispo (flex:1) → grande et bien visible. */}
        <video ref={videoRef} src={item.url} controls playsInline
          onPlay={clampPlayback}
          onTimeUpdate={() => { const v = videoRef.current; if (!v) return; setPlayhead(v.currentTime); if (v.currentTime >= trim.end - 0.02) { v.pause(); v.currentTime = trim.end } }}
          style={{ flex: 1, minHeight: 0, width: '100%', objectFit: 'contain', borderRadius: 12, background: '#000', boxShadow: '0 10px 34px rgba(0,0,0,0.28)' }} />
        {d > 0 && (
          <div style={{ flexShrink: 0, width: '100%', maxWidth: 700, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <FilmstripTrimBar duration={d} maxSpan={maxSpan} value={trim} thumbs={thumbs} playhead={playhead} t={t}
              onChange={onTrim} onSeek={sec => { if (videoRef.current) { videoRef.current.currentTime = sec; setPlayhead(sec) } }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12.5, color: C.txt2 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, background: C.field, padding: '4px 10px', borderRadius: 9999 }}>
                <Scissors size={13} style={{ color: C.accent }} />
                {formatDuration(trim.start)} – {formatDuration(trim.end)}
                <span style={{ color: C.txt3, fontWeight: 500 }}>· {formatDuration(span)}</span>
              </span>
              <span style={{ background: estBytes > LIMITS.video ? C.errBg : C.field, color: estBytes > LIMITS.video ? C.err : C.txt3, padding: '4px 10px', borderRadius: 9999, fontWeight: 600 }}>~{formatBytes(estBytes)}</span>
              {item.trimRequired && (
                <span style={{ color: '#fff', background: C.accent, fontWeight: 700, padding: '4px 10px', borderRadius: 9999 }}>
                  {t('messagerie.chooseExtract', { duree: formatDuration(maxSpan) })}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (item.kind === 'audio') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '28px 36px', borderRadius: 18, background: C.modal, border: `1px solid ${C.border}`, boxShadow: '0 6px 24px rgba(0,0,0,0.10)' }}>
        <div style={{ width: 104, height: 104, borderRadius: 9999, background: C.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 22px rgba(0,0,0,0.22)' }}><Music size={46} /></div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: C.txt, maxWidth: 340, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.file.name}</p>
        <audio src={item.url} controls style={{ width: 340 }} />
        <span style={{ fontSize: 12, color: C.txt3 }}>{item.durationText ? `${item.durationText} · ` : ''}{item.sizeText}</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '32px 40px', borderRadius: 18, background: C.modal, border: `1px solid ${C.border}`, boxShadow: '0 6px 24px rgba(0,0,0,0.10)' }}>
      <div style={{ width: 104, height: 104, borderRadius: 20, background: C.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 22px rgba(0,0,0,0.22)' }}><FileText size={46} /></div>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: C.txt, maxWidth: 380, textAlign: 'center', wordBreak: 'break-word' }}>{item.file.name}</p>
      <span style={{ fontSize: 12, color: C.txt3 }}>{item.sizeText}</span>
    </div>
  )
}

/**
 * Rogneur « pellicule » : timeline SOMBRE (contrôle vidéo, lisible sur tout thème)
 * avec vignettes + fenêtre de sélection DÉPLAÇABLE D'UN BLOC (capture pointeur) +
 * 2 poignées + tête de lecture. Sélection bornée à `maxSpan`.
 */
function FilmstripTrimBar({ duration, maxSpan, value, thumbs, playhead, t, onChange, onSeek }: {
  duration: number; maxSpan: number; value: Trim; thumbs: string[]; playhead: number; t: TFunction
  onChange: (trim: Trim) => void; onSeek?: (sec: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const pct = (t: number) => `${Math.max(0, Math.min(100, (t / duration) * 100))}%`
  const H = 58
  const FRAME = 'var(--ap-400)'

  function beginDrag(kind: 'start' | 'end' | 'region') {
    return (e: React.PointerEvent) => {
      e.preventDefault(); e.stopPropagation()
      const target = e.currentTarget as HTMLElement
      try { target.setPointerCapture(e.pointerId) } catch { /* noop */ }
      const startX = e.clientX
      const orig = { ...value }
      const len = orig.end - orig.start
      const onMove = (ev: PointerEvent) => {
        const w = trackRef.current?.getBoundingClientRect().width || 1
        const dt = ((ev.clientX - startX) / w) * duration
        if (kind === 'region') {
          const s = Math.min(Math.max(0, orig.start + dt), duration - len)
          onChange({ start: s, end: s + len }); onSeek?.(s)
        } else if (kind === 'start') {
          const s = Math.min(Math.max(orig.end - maxSpan, 0, orig.start + dt), orig.end - 0.5)
          onChange({ start: s, end: orig.end }); onSeek?.(s)
        } else {
          const en = Math.max(Math.min(orig.start + maxSpan, duration, orig.end + dt), orig.start + 0.5)
          onChange({ start: orig.start, end: en }); onSeek?.(en)
        }
      }
      const onUp = () => {
        try { target.releasePointerCapture(e.pointerId) } catch { /* noop */ }
        target.removeEventListener('pointermove', onMove)
        target.removeEventListener('pointerup', onUp)
        target.removeEventListener('pointercancel', onUp)
      }
      target.addEventListener('pointermove', onMove)
      target.addEventListener('pointerup', onUp)
      target.addEventListener('pointercancel', onUp)
    }
  }

  return (
    <div ref={trackRef} style={{ position: 'relative', width: '100%', height: H, borderRadius: 12, overflow: 'hidden', background: '#0b141a', border: '1px solid rgba(255,255,255,0.12)', touchAction: 'none', userSelect: 'none' }}>
      {/* Pellicule */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        {thumbs.length > 0
          ? thumbs.map((src, i) => <img key={i} src={src} alt="" draggable={false} style={{ flex: 1, minWidth: 0, height: '100%', objectFit: 'cover', opacity: 0.95 }} />)
          : <div style={{ flex: 1, background: 'repeating-linear-gradient(90deg,#16222b,#16222b 22px,#1c2c36 22px,#1c2c36 44px)' }} />}
      </div>

      {/* Voiles hors-sélection */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: pct(value.start), background: 'rgba(6,10,14,0.7)' }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: pct(duration - value.end), background: 'rgba(6,10,14,0.7)' }} />

      {/* Tête de lecture */}
      {playhead > value.start - 0.05 && playhead < value.end + 0.05 && (
        <div style={{ position: 'absolute', top: 2, bottom: 2, left: pct(playhead), width: 2, background: '#fff', boxShadow: '0 0 4px rgba(0,0,0,0.7)', pointerEvents: 'none' }} />
      )}

      {/* Fenêtre de sélection (déplaçable d'un bloc) */}
      <div onPointerDown={beginDrag('region')}
        style={{ position: 'absolute', top: 0, bottom: 0, left: pct(value.start), width: pct(value.end - value.start), borderTop: `3px solid ${FRAME}`, borderBottom: `3px solid ${FRAME}`, cursor: 'grab', boxSizing: 'border-box' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', display: 'flex', gap: 3, opacity: 0.95, pointerEvents: 'none' }}>
          {[0, 1, 2].map(k => <span key={k} style={{ width: 3, height: 3, borderRadius: 9999, background: '#fff' }} />)}
        </div>
      </div>

      <TrimHandle leftPct={pct(value.start)} edge="left" color={FRAME} title={t('messagerie.trimStart')} onDown={beginDrag('start')} />
      <TrimHandle leftPct={pct(value.end)} edge="right" color={FRAME} title={t('messagerie.trimEnd')} onDown={beginDrag('end')} />
    </div>
  )
}

function TrimHandle({ leftPct, edge, color, title, onDown }: { leftPct: string; edge: 'left' | 'right'; color: string; title: string; onDown: (e: React.PointerEvent) => void }) {
  return (
    <div onPointerDown={onDown} title={title}
      style={{ position: 'absolute', top: 0, bottom: 0, left: leftPct, transform: `translateX(${edge === 'left' ? '-100%' : '0'})`, width: 20, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'ew-resize', touchAction: 'none', borderRadius: edge === 'left' ? '11px 0 0 11px' : '0 11px 11px 0' }}>
      <div style={{ width: 3, height: 22, background: 'rgba(255,255,255,0.92)', borderRadius: 2 }} />
    </div>
  )
}

function Thumb({ item }: { item: Item }) {
  if (item.kind === 'image') return <img src={item.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  if (item.kind === 'video') return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <video src={item.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
      <Film size={14} style={{ position: 'absolute', bottom: 2, right: 2, color: '#fff', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.6))' }} />
    </div>
  )
  if (item.kind === 'audio') return <Music size={20} style={{ color: C.txt2 }} />
  return <FileText size={20} style={{ color: C.txt2 }} />
}

const iconBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--texte-secondaire)' }
