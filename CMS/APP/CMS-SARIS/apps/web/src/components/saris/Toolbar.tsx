/**
 * Toolbar — barre d'outils horizontale (filtres + actions).
 * Avec un slot search et un slot trailing.
 */

import type { ReactNode } from 'react'
import { Search } from 'lucide-react'

interface Props {
  search?:        string
  onSearchChange?: (v: string) => void
  searchPlaceholder?: string
  filters?:       ReactNode
  actions?:       ReactNode
}

export function Toolbar({ search, onSearchChange, searchPlaceholder = 'Rechercher…', filters, actions }: Props) {
  return (
    <div style={{
      display:       'flex',
      alignItems:    'center',
      gap:           'var(--espace-3)',
      padding:       'var(--espace-3) var(--espace-4)',
      background:    'var(--fond-surface)',
      borderBottom:  '1px solid var(--bordure-legere)',
      flexWrap:      'wrap',
    }}>
      {onSearchChange && (
        <div style={{ position: 'relative', flex: '1 1 280px', minWidth: 200, maxWidth: 360 }}>
          <Search
            size={14}
            style={{
              position: 'absolute', left: 10, top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--texte-tertiaire)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={search ?? ''}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            style={{
              width: '100%',
              height: 34,
              paddingLeft: 32, paddingRight: 10,
              fontSize: 'var(--font-size-body-sm)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--fond-surface-2)',
              border: '1px solid var(--bordure-normale)',
              color: 'var(--texte-primaire)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {filters && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-2)', flexWrap: 'wrap' }}>
          {filters}
        </div>
      )}

      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-2)', marginLeft: 'auto' }}>
          {actions}
        </div>
      )}
    </div>
  )
}
