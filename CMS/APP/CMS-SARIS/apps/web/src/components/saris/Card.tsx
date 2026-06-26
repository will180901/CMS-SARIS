/**
 * Card — conteneur de surface unifié SARIS.
 *
 * Variantes :
 *   - elevation : "flat" (bordure seulement) | "raised" (ombre-1) | "floating" (ombre-2)
 *   - padding   : "none" | "sm" | "md" | "lg"
 *
 * Composition : <Card><Card.Header>…</Card.Header><Card.Body>…</Card.Body></Card>
 */

import { forwardRef } from 'react'
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'

// ── Tokens dérivés des CSS variables ──────────────────────────────────────────

const PADDING_MAP = {
  none: 0,
  sm:   'var(--espace-3)',   // 12px
  md:   'var(--espace-4)',   // 16px
  lg:   'var(--espace-5)',   // 20px
} as const

const ELEVATION_MAP = {
  flat:     'none',
  raised:   'var(--ombre-1)',
  floating: 'var(--ombre-2)',
} as const

// ── Card racine ───────────────────────────────────────────────────────────────

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: keyof typeof ELEVATION_MAP
  padding?:   keyof typeof PADDING_MAP
  /** Si vrai, applique un fond légèrement contrasté (utile pour les sous-cartes) */
  muted?:     boolean
  /** Bordure d'accent (utilisée pour signaler une carte importante) */
  accent?:    boolean
}

const CardRoot = forwardRef<HTMLDivElement, CardProps>(function Card(
  { elevation = 'flat', padding = 'none', muted, accent, style, children, ...rest },
  ref,
) {
  const merged: CSSProperties = {
    // Verre poli : surface translucide + flou d'arrière-plan (laisse transparaître
    // le grain de la page derrière). Les sous-cartes `muted` restent opaques.
    background:   muted ? 'var(--fond-surface-2)' : 'var(--verre-fond)',
    ...(muted ? {} : { backdropFilter: 'blur(var(--verre-blur))', WebkitBackdropFilter: 'blur(var(--verre-blur))' }),
    border:       accent
      ? '1px solid var(--ap-200)'
      : '1px solid var(--glass-bordure)',
    borderRadius: 'var(--radius-xl)',
    boxShadow:    ELEVATION_MAP[elevation],
    overflow:     'hidden',
    padding:      PADDING_MAP[padding],
    ...style,
  }
  return (
    <div ref={ref} style={merged} {...rest}>
      {children}
    </div>
  )
})

// ── Card.Header ───────────────────────────────────────────────────────────────

interface CardHeaderProps {
  icon?:        ReactNode
  title:        ReactNode
  subtitle?:    ReactNode
  actions?:     ReactNode
  /** Visuellement plus discret (uppercase / petit) */
  compact?:     boolean
}

function CardHeader({ icon, title, subtitle, actions, compact }: CardHeaderProps) {
  return (
    <div style={{
      padding:      'var(--espace-3) var(--espace-4)',
      borderBottom: '1px solid var(--bordure-legere)',
      background:   'color-mix(in srgb, var(--fond-surface-2) 55%, transparent)',
      display:      'flex',
      alignItems:   'center',
      gap:          'var(--espace-2)',
    }}>
      {icon && (
        <div style={{
          width: 28, height: 28, borderRadius: 'var(--radius-md)',
          background: 'var(--ap-50)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--ap-600)', flexShrink: 0,
        }}>
          {icon}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {compact ? (
          <p style={{
            margin: 0,
            fontSize:        'var(--font-size-overline)',
            fontWeight:      700,
            textTransform:   'uppercase',
            letterSpacing:   '0.07em',
            color:           'var(--texte-tertiaire)',
          }}>
            {title}
          </p>
        ) : (
          <p style={{
            margin: 0,
            fontFamily: 'var(--font-heading)',
            fontSize:   'var(--font-size-h4)',
            fontWeight: 700,
            letterSpacing: '-0.012em',
            color:      'var(--texte-primaire)',
            lineHeight: 1.2,
          }}>
            {title}
          </p>
        )}
        {subtitle && (
          <p style={{
            margin:      '2px 0 0',
            fontSize:    'var(--font-size-caption)',
            color:       'var(--texte-tertiaire)',
          }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 'var(--espace-1)', flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  )
}

// ── Card.Body ─────────────────────────────────────────────────────────────────

interface CardBodyProps {
  children: ReactNode
  padding?: 'none' | 'sm' | 'md' | 'lg'
  style?:   CSSProperties
}

function CardBody({ children, padding = 'md', style }: CardBodyProps) {
  return (
    <div style={{ padding: PADDING_MAP[padding], ...style }}>
      {children}
    </div>
  )
}

// ── Card.Footer ───────────────────────────────────────────────────────────────

interface CardFooterProps {
  children: ReactNode
  align?:   'start' | 'center' | 'end' | 'between'
}

function CardFooter({ children, align = 'end' }: CardFooterProps) {
  const justify = align === 'between' ? 'space-between'
                : align === 'start'   ? 'flex-start'
                : align === 'center'  ? 'center'
                :                       'flex-end'
  return (
    <div style={{
      padding:    'var(--espace-3) var(--espace-4)',
      borderTop:  '1px solid var(--bordure-legere)',
      background: 'color-mix(in srgb, var(--fond-surface-2) 55%, transparent)',
      display:    'flex',
      alignItems: 'center',
      justifyContent: justify,
      gap:        'var(--espace-2)',
    }}>
      {children}
    </div>
  )
}

// ── API composite ─────────────────────────────────────────────────────────────

type CardComponent = typeof CardRoot & {
  Header: typeof CardHeader
  Body:   typeof CardBody
  Footer: typeof CardFooter
}

const CardWithStatics = CardRoot as CardComponent
CardWithStatics.Header = CardHeader
CardWithStatics.Body   = CardBody
CardWithStatics.Footer = CardFooter

/** Card composé : `<Card><Card.Header/><Card.Body/><Card.Footer/></Card>`. */
export const Card = CardWithStatics

/** @deprecated alias historique — `Card` porte déjà .Header/.Body/.Footer. */
export const CardComposite = CardWithStatics
