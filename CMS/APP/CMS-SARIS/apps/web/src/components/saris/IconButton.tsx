/**
 * IconButton — bouton compact avec icône seule, focus visible, aria-label requis.
 */

import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Tooltip } from './Tooltip'

export type IconButtonTone =
  | 'neutral' | 'accent' | 'danger' | 'success'
  | 'rose' | 'violet' | 'bleu' | 'emeraude' | 'cyan' | 'ambre'
type Size = 'sm' | 'md' | 'lg'

const SIZE_MAP = {
  sm: { size: 26, icon: 13 },
  md: { size: 32, icon: 15 },
  lg: { size: 38, icon: 17 },
}

/**
 * Formule commune aux 6 tons décoratifs (rose/violet/bleu/emeraude/cyan/ambre) :
 * repos = fond doux + bordure douce + icône colorée ; survol = le fond DEVIENT
 * la bordure, l'icône devient sa teinte "survol" — même règle mécanique pour
 * tous les tons, donc perceptuellement cohérente quel que soit le bouton.
 * Les 4 tons historiques (neutral/accent/danger/success) restent transparents
 * au repos (bg/border inertes) — comportement inchangé.
 */
const TONE_MAP: Record<IconButtonTone, { color: string; bg: string; border: string; hoverBg: string; hoverColor: string }> = {
  neutral:  { color: 'var(--texte-secondaire)', bg: 'transparent', border: 'transparent', hoverBg: 'var(--fond-surface-2)', hoverColor: 'var(--texte-primaire)' },
  accent:   { color: 'var(--ap-600)',           bg: 'transparent', border: 'transparent', hoverBg: 'var(--ap-50)',         hoverColor: 'var(--ap-700)'         },
  danger:   { color: 'var(--erreur-accent)',    bg: 'transparent', border: 'transparent', hoverBg: 'var(--erreur-fond)',   hoverColor: 'var(--erreur-texte)'   },
  success:  { color: 'var(--succes-accent)',    bg: 'transparent', border: 'transparent', hoverBg: 'var(--succes-fond)',   hoverColor: 'var(--succes-texte)'   },
  rose:     { color: 'var(--ton-rose-icone)',     bg: 'var(--ton-rose-fond)',     border: 'var(--ton-rose-bordure)',     hoverBg: 'var(--ton-rose-bordure)',     hoverColor: 'var(--ton-rose-icone-survol)'     },
  violet:   { color: 'var(--ton-violet-icone)',   bg: 'var(--ton-violet-fond)',   border: 'var(--ton-violet-bordure)',   hoverBg: 'var(--ton-violet-bordure)',   hoverColor: 'var(--ton-violet-icone-survol)'   },
  bleu:     { color: 'var(--ton-bleu-icone)',     bg: 'var(--ton-bleu-fond)',     border: 'var(--ton-bleu-bordure)',     hoverBg: 'var(--ton-bleu-bordure)',     hoverColor: 'var(--ton-bleu-icone-survol)'     },
  emeraude: { color: 'var(--ton-emeraude-icone)', bg: 'var(--ton-emeraude-fond)', border: 'var(--ton-emeraude-bordure)', hoverBg: 'var(--ton-emeraude-bordure)', hoverColor: 'var(--ton-emeraude-icone-survol)' },
  cyan:     { color: 'var(--ton-cyan-icone)',     bg: 'var(--ton-cyan-fond)',     border: 'var(--ton-cyan-bordure)',     hoverBg: 'var(--ton-cyan-bordure)',     hoverColor: 'var(--ton-cyan-icone-survol)'     },
  ambre:    { color: 'var(--ton-ambre-icone)',    bg: 'var(--ton-ambre-fond)',    border: 'var(--ton-ambre-bordure)',    hoverBg: 'var(--ton-ambre-bordure)',    hoverColor: 'var(--ton-ambre-icone-survol)'    },
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
  { icon, tone = 'neutral', size = 'md', style, className, tooltip, tooltipSide = 'top', ...rest },
  ref,
) {
  const s = SIZE_MAP[size]
  const t = TONE_MAP[tone]
  const btn = (
    <button
      ref={ref}
      {...rest}
      className={['saris-focus-ring', className].filter(Boolean).join(' ')}
      style={{
        width:        s.size,
        height:       s.size,
        borderRadius: 'var(--radius-md)',
        background:   t.bg,
        border:       `1px solid ${t.border}`,
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
        e.currentTarget.style.background = t.bg
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
