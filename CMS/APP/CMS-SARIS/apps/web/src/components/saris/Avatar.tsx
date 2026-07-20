/**
 * Avatar — initiales sur fond coloré déterministe.
 * Pour les patients, utiliser plutôt PatientAvatar (couleur par catégorie).
 */

import { useMemo } from 'react'

interface Props {
  nom:    string
  prenom?: string
  size?:  number
  /** Palette de couleurs déterministe (hash du nom) */
  tone?:  'auto' | 'accent' | 'gold' | 'neutral'
  /** Photo de profil (data URL). Si fournie, remplace les initiales — même principe que PatientAvatar. */
  photoUrl?: string | null
}

// Les 6 premières entrées partagent leurs hex avec les tons décoratifs de
// packages/ui/src/styles/globals.css (--ton-bleu/emeraude/ambre/rose/violet/cyan) —
// même langage colore que les tuiles de page. Gardées en hex figé (pas de var(--ton-*)
// adaptative) : ces tokens s'assombrissent fortement en mode sombre, ce qui changerait
// l'apparence des avatars dans le thème sombre déjà validé. Les 2 dernières (framboise,
// vert citron) élargissent juste l'entropie du hash, hors des 6 tons de module.
const PALETTE = [
  { bg: '#DBEAFE', text: '#1D4ED8', border: '#93C5FD' },
  { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7' },
  { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
  { bg: '#FCE7F3', text: '#9D174D', border: '#F9A8D4' },
  { bg: '#EDE9FE', text: '#5B21B6', border: '#C4B5FD' },
  { bg: '#E0F2FE', text: '#0369A1', border: '#7DD3FC' },
  { bg: '#FFE4E6', text: '#9F1239', border: '#FDA4AF' },
  { bg: '#ECFCCB', text: '#3F6212', border: '#BEF264' },
]

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function Avatar({ nom, prenom, size = 32, tone = 'auto', photoUrl }: Props) {
  const initials = useMemo(() => {
    const a = (prenom?.[0] ?? '').toUpperCase()
    const b = (nom?.[0] ?? '').toUpperCase()
    return (a + b) || '?'
  }, [nom, prenom])

  const colors = useMemo(() => {
    if (tone === 'accent')  return { bg: 'var(--ap-100)',  text: 'var(--ap-700)', border: 'var(--ap-200)' }
    if (tone === 'gold')    return { bg: 'var(--as-50)',   text: 'var(--as-700)', border: 'var(--as-200)' }
    if (tone === 'neutral') return { bg: 'var(--fond-surface-2)', text: 'var(--texte-secondaire)', border: 'var(--bordure-normale)' }
    const idx = hash(nom + (prenom ?? '')) % PALETTE.length
    return PALETTE[idx]!
  }, [tone, nom, prenom])

  const radius = size > 40 ? 'var(--radius-lg)' : 'var(--radius-md)'

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={`${prenom ?? ''} ${nom}`.trim()}
        style={{
          width: size, height: size, borderRadius: radius,
          objectFit: 'cover', flexShrink: 0, userSelect: 'none',
          border: `1.5px solid ${colors.border}`,
        }}
      />
    )
  }

  return (
    <div
      aria-label={`${prenom ?? ''} ${nom}`.trim()}
      style={{
        width:        size,
        height:       size,
        borderRadius: radius,
        background:   colors.bg,
        color:        colors.text,
        border:       `1.5px solid ${colors.border}`,
        fontSize:     Math.max(10, Math.round(size * 0.38)),
        fontWeight:   700,
        letterSpacing: '0.02em',
        display:      'inline-flex',
        alignItems:   'center',
        justifyContent: 'center',
        flexShrink:   0,
        userSelect:   'none',
      }}
    >
      {initials}
    </div>
  )
}
