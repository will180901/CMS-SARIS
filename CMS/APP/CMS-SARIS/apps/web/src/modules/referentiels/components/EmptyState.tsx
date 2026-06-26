import type { LucideIcon } from 'lucide-react'
import { FileQuestion } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?:        LucideIcon
  title:        string
  description?: string
  action?:      ReactNode
}

export function EmptyState({
  icon: Icon = FileQuestion,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <tr>
      <td colSpan={99} style={{ padding: '64px 24px' }}>
        <div
          style={{
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            textAlign:      'center',
            gap:            '12px',
          }}
        >
          {/* Icône */}
          <div
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              width:          '52px',
              height:         '52px',
              borderRadius:   '12px',
              background:     'var(--fond-surface-2)',
              marginBottom:   '4px',
            }}
          >
            <Icon size={24} style={{ color: 'var(--texte-tertiaire)' }} />
          </div>

          {/* Titre */}
          <p
            style={{
              fontSize:   '14px',
              fontWeight: '500',
              color:      'var(--texte-primaire)',
              margin:     0,
            }}
          >
            {title}
          </p>

          {/* Description */}
          {description && (
            <p
              style={{
                fontSize:  '13px',
                color:     'var(--texte-tertiaire)',
                maxWidth:  '300px',
                lineHeight: '1.5',
                margin:    0,
              }}
            >
              {description}
            </p>
          )}

          {/* Action */}
          {action && <div style={{ marginTop: '4px' }}>{action}</div>}
        </div>
      </td>
    </tr>
  )
}
