/**
 * IconButton — bouton compact avec icône seule, focus visible, aria-label requis.
 */

import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Tooltip } from './Tooltip'

export type IconButtonTone = 'neutral' | 'accent' | 'danger' | 'success'
type Size = 'sm' | 'md' | 'lg'

const SIZE_MAP = {
  sm: { size: 26, icon: 13 },
  md: { size: 32, icon: 15 },
  lg: { size: 38, icon: 17 },
}

const TONE_MAP: Record<IconButtonTone, { color: string; hoverBg: string; hoverColor: string }> = {
  neutral: { color: 'var(--texte-secondaire)', hoverBg: 'var(--fond-surface-2)', hoverColor: 'var(--texte-primaire)' },
  accent:  { color: 'var(--ap-600)',           hoverBg: 'var(--ap-50)',         hoverColor: 'var(--ap-700)'         },
  danger:  { color: 'var(--erreur-accent)',    hoverBg: 'var(--erreur-fond)',   hoverColor: 'var(--erreur-texte)'   },
  success: { color: 'var(--succes-accent)',    hoverBg: 'var(--succes-fond)',   hoverColor: 'var(--succes-texte)'   },
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon:        ReactNode
  /** Texte d'accessibilité (obligatoire — c'est un bouton sans texte visible) */
  'aria-label': string
  tone?:       IconButtonTone
  size?:       Size
  /** Info-bulle. Par défaut = aria-label. Passer `false` pour la désactiver, ou un texte/JSX pour la personnaliser. */
  tooltip?:    ReactNode | false
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right'
}

export const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { icon, tone = 'neutral', size = 'md', style, tooltip, tooltipSide = 'top', ...rest },
  ref,
) {
  const s = SIZE_MAP[size]
  const t = TONE_MAP[tone]
  const btn = (
    <button
      ref={ref}
      {...rest}
      style={{
        width:        s.size,
        height:       s.size,
        borderRadius: 'var(--radius-md)',
        background:   'transparent',
        border:       'none',
        color:        t.color,
        display:      'inline-flex',
        alignItems:   'center',
        justifyContent: 'center',
        cursor:       'pointer',
        transition:   'background 0.12s, color 0.12s',
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = t.hoverBg
        e.currentTarget.style.color = t.hoverColor
        rest.onMouseEnter?.(e)
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = t.color
        rest.onMouseLeave?.(e)
      }}
    >
      {icon}
    </button>
  )

  // Info-bulle automatique depuis l'aria-label (tooltips « partout »), sauf opt-out.
  const label = tooltip === false ? null : (tooltip ?? rest['aria-label'])
  if (!label) return btn
  return <Tooltip label={label} side={tooltipSide} delay={350}>{btn}</Tooltip>
})
