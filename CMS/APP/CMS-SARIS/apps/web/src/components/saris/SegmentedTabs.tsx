/**
 * SegmentedTabs — onglets « pills » style shadcn, déclinés à la charte SARIS.
 *
 * Conteneur teinté + onglet actif en pastille surélevée (fond surface + ombre).
 * Contrôlé (value / onChange). Accessible (role tablist/tab, navigation flèches).
 *
 *   <SegmentedTabs
 *     value={tab} onChange={setTab}
 *     tabs={[
 *       { key: 'generaux',  label: 'Généraux',  icon: <Settings size={14} /> },
 *       { key: 'personnel', label: 'Personnel', icon: <User size={14} />, badge: 3 },
 *     ]}
 *   />
 */

import { useRef } from 'react'

export interface SegmentedTab {
  key:    string
  label:  React.ReactNode
  icon?:  React.ReactNode
  badge?: React.ReactNode
  disabled?: boolean
}

interface Props {
  tabs:      SegmentedTab[]
  value:     string
  onChange:  (key: string) => void
  /** Onglets à largeur égale occupant toute la largeur disponible */
  fullWidth?: boolean
  size?:     'sm' | 'md'
  'aria-label'?: string
}

const SIZE = {
  sm: { padX: 10, padY: 5, font: 'var(--font-size-caption)', gap: 5 },
  md: { padX: 14, padY: 7, font: 'var(--font-size-body-sm)', gap: 6 },
} as const

export function SegmentedTabs({
  tabs, value, onChange, fullWidth = false, size = 'md', 'aria-label': ariaLabel,
}: Props) {
  const s = SIZE[size]
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function onKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const dir = e.key === 'ArrowRight' ? 1 : -1
    const n = tabs.length
    let i = idx
    for (let step = 0; step < n; step++) {
      i = (i + dir + n) % n
      if (!tabs[i]?.disabled) break
    }
    const t = tabs[i]
    if (t) { onChange(t.key); refs.current[i]?.focus() }
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{
        display:      'inline-flex',
        gap:          2,
        padding:      3,
        background:   'var(--fond-surface-2)',
        border:       '1px solid var(--bordure-legere)',
        borderRadius: 'var(--radius-lg)',
        width:        fullWidth ? '100%' : 'auto',
      }}
    >
      {tabs.map((t, idx) => {
        const active = t.key === value
        return (
          <button
            key={t.key}
            ref={el => { refs.current[idx] = el }}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            disabled={t.disabled}
            onClick={() => !t.disabled && onChange(t.key)}
            onKeyDown={e => onKeyDown(e, idx)}
            style={{
              flex:         fullWidth ? 1 : '0 0 auto',
              display:      'inline-flex',
              alignItems:   'center',
              justifyContent: 'center',
              gap:          s.gap,
              padding:      `${s.padY}px ${s.padX}px`,
              fontSize:     s.font,
              fontWeight:   active ? 600 : 500,
              lineHeight:   1.2,
              whiteSpace:   'nowrap',
              cursor:       t.disabled ? 'not-allowed' : 'pointer',
              opacity:      t.disabled ? 0.5 : 1,
              color:        active ? 'var(--texte-primaire)' : 'var(--texte-secondaire)',
              background:   active ? 'var(--fond-surface)' : 'transparent',
              border:       active ? '1px solid var(--bordure-legere)' : '1px solid transparent',
              borderRadius: 'var(--radius-md)',
              boxShadow:    active ? 'var(--ombre-1, 0 1px 2px rgba(15,23,42,0.06))' : 'none',
              transition:   'color .15s, background .15s, box-shadow .15s',
            }}
            onMouseEnter={e => { if (!active && !t.disabled) e.currentTarget.style.color = 'var(--texte-primaire)' }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--texte-secondaire)' }}
          >
            {t.icon}
            {t.label}
            {t.badge != null && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9999,
                fontSize: 'var(--font-size-overline)', fontWeight: 700,
                background: active ? 'var(--ap-50)' : 'var(--fond-surface)',
                color: active ? 'var(--ap-700)' : 'var(--texte-tertiaire)',
                border: '1px solid var(--bordure-legere)',
              }}>
                {t.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
