/**
 * Skeleton — placeholder de chargement avec animation pulse.
 */

import type { CSSProperties } from 'react'

interface Props {
  width?:  number | string
  height?: number | string
  /** Forme : ligne fine | bloc | cercle (avatar) */
  variant?: 'text' | 'block' | 'circle'
  style?:   CSSProperties
}

export function Skeleton({ width, height, variant = 'block', style }: Props) {
  const w = width ?? '100%'
  const h = height ?? (variant === 'text' ? 14 : variant === 'circle' ? 32 : 32)
  const isCircle = variant === 'circle'

  return (
    <div
      aria-hidden="true"
      style={{
        width:        w,
        height:       h,
        borderRadius: isCircle ? '50%' : variant === 'text' ? 4 : 'var(--radius-md)',
        background:   'linear-gradient(90deg, var(--fond-surface-2) 0%, var(--fond-input) 50%, var(--fond-surface-2) 100%)',
        backgroundSize: '200% 100%',
        animation:    'saris-shimmer 1.4s infinite',
        ...style,
      }}
    />
  )
}

// Injection de l'animation @keyframes au chargement du module
if (typeof document !== 'undefined' && !document.getElementById('saris-shimmer-style')) {
  const styleTag = document.createElement('style')
  styleTag.id = 'saris-shimmer-style'
  styleTag.textContent = `
    @keyframes saris-shimmer {
      0%   { background-position:  200% 0; }
      100% { background-position: -200% 0; }
    }
  `
  document.head.appendChild(styleTag)
}
