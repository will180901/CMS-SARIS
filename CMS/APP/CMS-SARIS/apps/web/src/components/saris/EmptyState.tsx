/**
 * EmptyState — état vide expressif et accueillant.
 * Toujours proposer une action quand c'est possible (CTA).
 */

import type { ReactNode } from 'react'

interface Props {
  icon?:        ReactNode
  title:        ReactNode
  description?: ReactNode
  action?:      ReactNode
  /** Variante visuelle */
  variant?:     'default' | 'subtle'
}

export function EmptyState({ icon, title, description, action, variant = 'default' }: Props) {
  const isSubtle = variant === 'subtle'

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      textAlign:      'center',
      padding:        'var(--espace-8) var(--espace-6)',
      gap:            'var(--espace-3)',
      background:     isSubtle ? 'transparent' : 'var(--fond-surface-2)',
      border:         isSubtle ? 'none' : '1px dashed var(--bordure-normale)',
      borderRadius:   'var(--radius-xl)',
      color:          'var(--texte-secondaire)',
    }}>
      {icon && (
        <div style={{
          width: 48, height: 48, borderRadius: 'var(--radius-xl)',
          background: 'var(--fond-surface)',
          border: '1px solid var(--bordure-legere)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--texte-tertiaire)',
        }}>
          {icon}
        </div>
      )}
      <div>
        <p style={{
          margin: 0,
          fontSize:   'var(--font-size-body)',
          fontWeight: 600,
          color:      'var(--texte-primaire)',
        }}>
          {title}
        </p>
        {description && (
          <p style={{
            margin:    '4px 0 0',
            fontSize:  'var(--font-size-body-sm)',
            color:     'var(--texte-tertiaire)',
            maxWidth:  400,
            lineHeight: 1.5,
          }}>
            {description}
          </p>
        )}
      </div>
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  )
}
