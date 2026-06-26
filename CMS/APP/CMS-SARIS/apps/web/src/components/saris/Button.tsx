/**
 * Button — bouton SARIS unifié avec variantes, tailles et état chargement.
 * Inclut le focus ring accessible WCAG 2.1.
 */

import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline'
export type ButtonSize    = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?:    ButtonSize
  loading?: boolean
  leftIcon?:  ReactNode
  rightIcon?: ReactNode
  /** Prend toute la largeur du conteneur */
  fullWidth?: boolean
}

const SIZE_MAP: Record<ButtonSize, { h: number; px: number; fs: string; gap: number; iconSize: number }> = {
  sm: { h: 30, px: 12, fs: 'var(--font-size-body-sm)', gap: 5, iconSize: 13 },
  md: { h: 36, px: 16, fs: 'var(--font-size-body)',    gap: 6, iconSize: 15 },
  lg: { h: 44, px: 22, fs: 'var(--font-size-body-lg)', gap: 7, iconSize: 16 },
}

const VARIANT_STYLES: Record<ButtonVariant, { bg: string; text: string; border: string; hoverBg: string; hoverBorder?: string }> = {
  primary:   { bg: 'var(--ap-500)',          text: '#FFFFFF',                   border: 'transparent',                hoverBg: 'var(--ap-600)' },
  secondary: { bg: 'var(--fond-surface-2)',  text: 'var(--texte-primaire)',     border: '1px solid var(--bordure-normale)', hoverBg: 'var(--fond-input)', hoverBorder: '1px solid var(--bordure-forte)' },
  ghost:     { bg: 'transparent',            text: 'var(--texte-secondaire)',   border: 'transparent',                hoverBg: 'var(--fond-surface-2)' },
  outline:   { bg: 'var(--fond-surface)',    text: 'var(--ap-700)',             border: '1px solid var(--ap-200)',    hoverBg: 'var(--ap-50)', hoverBorder: '1px solid var(--ap-400)' },
  danger:    { bg: 'var(--erreur-accent)',   text: '#FFFFFF',                   border: 'transparent',                hoverBg: '#7A2E2E' },
  success:   { bg: 'var(--succes-accent)',   text: '#FFFFFF',                   border: 'transparent',                hoverBg: 'var(--succes-texte)' },
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = 'primary',
    size    = 'md',
    loading,
    leftIcon, rightIcon,
    fullWidth,
    style, children, disabled, ...rest
  },
  ref,
) {
  const s = SIZE_MAP[size]
  const v = VARIANT_STYLES[variant]
  const isDisabled = disabled || loading

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      {...rest}
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            s.gap,
        height:         s.h,
        padding:        `0 ${s.px}px`,
        fontSize:       s.fs,
        fontWeight:     600,
        borderRadius:   'var(--radius-md)',
        background:     v.bg,
        color:          v.text,
        border:         v.border,
        cursor:         isDisabled ? 'not-allowed' : 'pointer',
        opacity:        isDisabled ? 0.55 : 1,
        width:          fullWidth ? '100%' : 'auto',
        transition:     'background 0.12s, border-color 0.12s, transform 0.04s',
        userSelect:     'none',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!isDisabled) {
          e.currentTarget.style.background = v.hoverBg
          if (v.hoverBorder) e.currentTarget.style.border = v.hoverBorder
        }
        rest.onMouseEnter?.(e)
      }}
      onMouseLeave={(e) => {
        if (!isDisabled) {
          e.currentTarget.style.background = v.bg
          e.currentTarget.style.border = v.border
        }
        rest.onMouseLeave?.(e)
      }}
      onMouseDown={(e) => {
        if (!isDisabled) e.currentTarget.style.transform = 'scale(0.97)'
        rest.onMouseDown?.(e)
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'scale(1)'
        rest.onMouseUp?.(e)
      }}
    >
      {loading ? (
        <Loader2 size={s.iconSize} className="animate-spin" />
      ) : leftIcon ? (
        <span style={{ display: 'inline-flex' }}>{leftIcon}</span>
      ) : null}
      {children}
      {!loading && rightIcon && <span style={{ display: 'inline-flex' }}>{rightIcon}</span>}
    </button>
  )
})
