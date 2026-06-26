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
}

const PALETTE = [
  { bg: '#DBEAFE', text: '#1D4ED8' },
  { bg: '#D1FAE5', text: '#065F46' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#FCE7F3', text: '#9D174D' },
  { bg: '#EDE9FE', text: '#5B21B6' },
  { bg: '#E0F2FE', text: '#0369A1' },
  { bg: '#FFE4E6', text: '#9F1239' },
  { bg: '#ECFCCB', text: '#3F6212' },
]

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function Avatar({ nom, prenom, size = 32, tone = 'auto' }: Props) {
  const initials = useMemo(() => {
    const a = (prenom?.[0] ?? '').toUpperCase()
    const b = (nom?.[0] ?? '').toUpperCase()
    return (a + b) || '?'
  }, [nom, prenom])

  const colors = useMemo(() => {
    if (tone === 'accent')  return { bg: 'var(--ap-100)',  text: 'var(--ap-700)'  }
    if (tone === 'gold')    return { bg: 'var(--as-50)',   text: 'var(--as-700)'  }
    if (tone === 'neutral') return { bg: 'var(--fond-surface-2)', text: 'var(--texte-secondaire)' }
    const idx = hash(nom + (prenom ?? '')) % PALETTE.length
    return PALETTE[idx]!
  }, [tone, nom, prenom])

  return (
    <div
      aria-label={`${prenom ?? ''} ${nom}`.trim()}
      style={{
        width:        size,
        height:       size,
        borderRadius: size > 40 ? 'var(--radius-lg)' : 'var(--radius-md)',
        background:   colors.bg,
        color:        colors.text,
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
