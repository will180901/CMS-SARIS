/**
 * sounds — petits sons d'interface synthétisés via Web Audio (0 fichier, 0 CDN,
 * hors-ligne). Sons courts et discrets pour : confirmation, échec, notification,
 * envoi, réception, tap. Respecte une préférence utilisateur (localStorage).
 *
 * Aucune dépendance React → appelable depuis n'importe où (toasts, SSE, actions).
 */
export type SoundName = 'success' | 'error' | 'notification' | 'sent' | 'received' | 'tap'

const PREF_KEY = 'saris.sounds.enabled'
let ctx: AudioContext | null = null
let enabled = readPref()

function readPref(): boolean {
  try { return localStorage.getItem(PREF_KEY) !== '0' } catch { return true }
}

export function soundsEnabled(): boolean { return enabled }

export function setSoundsEnabled(v: boolean): void {
  enabled = v
  try { localStorage.setItem(PREF_KEY, v ? '1' : '0') } catch { /* noop */ }
  if (v) playSound('tap') // retour immédiat à l'activation
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    if (!ctx) ctx = new Ctor()
    if (ctx.state === 'suspended') ctx.resume().catch(() => { /* noop */ })
    return ctx
  } catch { return null }
}

interface ToneOpts { freq: number; start: number; dur: number; type?: OscillatorType; gain?: number; slideTo?: number }

function tone(c: AudioContext, { freq, start, dur, type = 'sine', gain = 0.06, slideTo }: ToneOpts): void {
  const t0 = c.currentTime + start
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.03)
}

const RECIPES: Record<SoundName, (c: AudioContext) => void> = {
  success:      c => { tone(c, { freq: 660, start: 0, dur: 0.12, gain: 0.07 }); tone(c, { freq: 988, start: 0.09, dur: 0.17, gain: 0.06 }) },
  error:        c => { tone(c, { freq: 300, start: 0, dur: 0.22, type: 'triangle', gain: 0.07, slideTo: 150 }) },
  notification: c => { tone(c, { freq: 880, start: 0, dur: 0.10, gain: 0.05 }); tone(c, { freq: 1175, start: 0.085, dur: 0.15, gain: 0.05 }) },
  sent:         c => { tone(c, { freq: 520, start: 0, dur: 0.07, gain: 0.04 }) },
  received:     c => { tone(c, { freq: 740, start: 0, dur: 0.10, gain: 0.05 }); tone(c, { freq: 988, start: 0.06, dur: 0.12, gain: 0.045 }) },
  tap:          c => { tone(c, { freq: 420, start: 0, dur: 0.05, gain: 0.03 }) },
}

export function playSound(name: SoundName): void {
  if (!enabled) return
  const c = getCtx()
  if (!c) return
  try { RECIPES[name](c) } catch { /* noop */ }
}
