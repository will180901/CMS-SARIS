/**
 * PageHeader — barre de titre de page uniforme.
 *
 * Composition : icône + titre + sous-titre + actions à droite.
 * + breadcrumb optionnel.
 */

import type { ReactNode } from 'react'

interface BreadcrumbItem {
  label: ReactNode
  href?: string
  onClick?: () => void
}

interface Props {
  icon?:       ReactNode
  title:       ReactNode
  subtitle?:   ReactNode
  actions?:    ReactNode
  breadcrumb?: BreadcrumbItem[]
  /** Variante "compacte" — réduit la hauteur (pour les sous-pages) */
  compact?:    boolean
}

export function PageHeader({ icon, title, subtitle, actions, breadcrumb, compact }: Props) {
  const padY = compact ? 'var(--espace-3)' : 'var(--espace-4)'
  return (
    <div style={{
      padding:      `${padY} var(--espace-6)`,
      background:   'var(--fond-surface)',
      borderBottom: '1px solid var(--bordure-legere)',
      flexShrink:   0,
    }}>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Fil d'Ariane" style={{
          display:      'flex',
          alignItems:   'center',
          gap:          6,
          fontSize:     'var(--font-size-caption)',
          color:        'var(--texte-tertiaire)',
          marginBottom: compact ? 4 : 6,
        }}>
          {breadcrumb.map((b, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {b.href || b.onClick ? (
                <button
                  onClick={b.onClick}
                  style={{
                    background: 'none',
                    border:     'none',
                    cursor:     'pointer',
                    padding:    0,
                    fontSize:   'inherit',
                    color:      'var(--texte-secondaire)',
                  }}
                >
                  {b.label}
                </button>
              ) : (
                <span style={{ color: 'var(--texte-primaire)', fontWeight: 500 }}>{b.label}</span>
              )}
              {i < breadcrumb.length - 1 && (
                <span style={{ color: 'var(--bordure-normale)' }}>/</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div style={{
        display:        'flex',
        alignItems:     'center',
        gap:            'var(--espace-3)',
      }}>
        {icon && (
          <div style={{
            width: compact ? 32 : 40,
            height: compact ? 32 : 40,
            borderRadius: 'var(--radius-lg)',
            background: 'var(--ap-50)',
            color: 'var(--ap-600)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {icon}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{
            margin: 0,
            fontSize: compact ? 'var(--font-size-h3)' : 'var(--font-size-h2)',
            fontWeight: 700,
            color: 'var(--texte-primaire)',
            lineHeight: 1.2,
            letterSpacing: '-0.01em',
          }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{
              margin:    '4px 0 0',
              fontSize:  'var(--font-size-body-sm)',
              color:     'var(--texte-tertiaire)',
            }}>
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-2)', flexShrink: 0 }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
