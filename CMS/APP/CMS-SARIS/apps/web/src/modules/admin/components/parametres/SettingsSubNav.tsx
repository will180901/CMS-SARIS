/**
 * SettingsSubNav — rail vertical de sous-pages, partagé par les deux écrans de paramètres
 * (ParametresPage = personnel, ParametresSystemePage = système). Extrait de ParametresPage
 * lors de leur séparation pour éviter d'en dupliquer le style.
 *
 * En mode compact, le rail devient une barre horizontale défilante (pas de menu masqué).
 */

import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export interface SettingsSectionItem {
  key: string
  label: string
  icon: ReactNode
  hint?: string
}

export function SettingsSubNav({ items, value, onChange, compact = false }: {
  items: SettingsSectionItem[]
  value: string
  onChange: (k: string) => void
  compact?: boolean
}) {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('settings.sectionsAria')} style={
      compact
        ? { flexShrink: 0, display: 'flex', flexDirection: 'row', gap: 6, overflowX: 'auto', paddingBottom: 4 }
        : { width: 232, flexShrink: 0, alignSelf: 'flex-start', position: 'sticky', top: 0, display: 'flex', flexDirection: 'column', gap: 2 }
    }>
      {items.map((it) => {
        const active = it.key === value
        return (
          <button
            key={it.key}
            onClick={() => onChange(it.key)}
            aria-current={active ? 'page' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--espace-3)',
              padding: '10px 12px', borderRadius: 'var(--radius-md)',
              border: '1px solid transparent', cursor: 'pointer', textAlign: 'left',
              width: compact ? 'auto' : '100%', flexShrink: compact ? 0 : undefined, whiteSpace: compact ? 'nowrap' : undefined,
              background: active ? 'var(--ap-50)' : 'transparent',
              borderColor: active ? 'var(--ap-200)' : 'transparent',
              transition: 'background .12s, color .12s',
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--fond-surface-2)' }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{
              width: 30, height: 30, borderRadius: 'var(--radius-md)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: active ? 'var(--fond-surface)' : 'var(--fond-surface-2)',
              color: active ? 'var(--ap-600)' : 'var(--texte-tertiaire)',
              border: active ? '1px solid var(--ap-200)' : '1px solid var(--bordure-legere)',
            }}>
              {it.icon}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 'var(--font-size-body-sm)', fontWeight: active ? 600 : 500, color: active ? 'var(--ap-700)' : 'var(--texte-primaire)' }}>
                {it.label}
              </span>
              {it.hint && !compact && (
                <span style={{ display: 'block', fontSize: 'var(--font-size-overline)', color: 'var(--texte-tertiaire)', marginTop: 1 }}>
                  {it.hint}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
