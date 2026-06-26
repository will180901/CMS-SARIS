/**
 * StatusPill — badge d'état uniforme.
 * Variantes sémantiques avec point coloré + libellé.
 */

import type { ReactNode } from 'react'

export type StatusTone =
  | 'success' | 'warning' | 'error' | 'info'
  | 'neutral' | 'accent'   | 'gold'

const TONE_MAP: Record<StatusTone, { bg: string; text: string; dot: string }> = {
  success: { bg: 'var(--succes-fond)', text: 'var(--succes-texte)', dot: 'var(--succes-accent)' },
  warning: { bg: 'var(--avert-fond)',  text: 'var(--avert-texte)',  dot: 'var(--avert-accent)'  },
  error:   { bg: 'var(--erreur-fond)', text: 'var(--erreur-texte)', dot: 'var(--erreur-accent)' },
  info:    { bg: 'var(--info-fond)',   text: 'var(--info-texte)',   dot: 'var(--info-accent)'   },
  neutral: { bg: 'var(--fond-surface-2)', text: 'var(--texte-secondaire)', dot: 'var(--texte-tertiaire)' },
  accent:  { bg: 'var(--ap-50)',       text: 'var(--ap-700)',       dot: 'var(--ap-500)'        },
  gold:    { bg: 'var(--as-50)',       text: 'var(--as-700)',       dot: 'var(--as-500)'        },
}

interface Props {
  tone?:    StatusTone
  /** Affiche le point coloré devant le libellé */
  dot?:     boolean
  /** Icône optionnelle à gauche */
  icon?:    ReactNode
  /** Taille — sm par défaut */
  size?:    'sm' | 'md'
  children: ReactNode
}

export function StatusPill({ tone = 'neutral', dot = true, icon, size = 'sm', children }: Props) {
  const cfg = TONE_MAP[tone]
  const padY = size === 'sm' ? 2 : 4
  const padX = size === 'sm' ? 8 : 10
  const fontSize = size === 'sm' ? 'var(--font-size-overline)' : 'var(--font-size-caption)'

  return (
    <span style={{
      display:        'inline-flex',
      alignItems:     'center',
      gap:            4,
      padding:        `${padY}px ${padX}px`,
      borderRadius:   9999,
      fontSize,
      fontWeight:     600,
      background:     cfg.bg,
      color:          cfg.text,
      letterSpacing:  '0.02em',
      lineHeight:     1.4,
      whiteSpace:     'nowrap',
    }}>
      {icon && <span style={{ display: 'inline-flex' }}>{icon}</span>}
      {dot && !icon && (
        <span style={{
          width: size === 'sm' ? 5 : 6,
          height: size === 'sm' ? 5 : 6,
          borderRadius: '50%',
          background: cfg.dot,
          flexShrink: 0,
        }} />
      )}
      {children}
    </span>
  )
}
