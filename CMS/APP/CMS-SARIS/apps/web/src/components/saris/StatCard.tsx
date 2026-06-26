/**
 * StatCard — KPI tile expressive.
 * Composition : icône + label + valeur + tendance optionnelle.
 */

import type { ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface Props {
  icon?:        ReactNode
  label:        string
  value:        ReactNode
  /** Sous-texte (description courte) */
  hint?:        ReactNode
  /** Variation par rapport à la période précédente (en % ou texte libre) */
  trend?:       { value: string; direction: 'up' | 'down' | 'flat'; tone?: 'positive' | 'negative' | 'neutral' }
  /** Couleur de l'accent (icône + barre latérale) */
  tone?:        'accent' | 'gold' | 'success' | 'warning' | 'error' | 'neutral'
  /** Action de clic optionnelle (rend la carte interactive) */
  onClick?:     () => void
}

const TONE_MAP = {
  accent:  { bg: 'var(--ap-50)',       color: 'var(--ap-600)'        },
  gold:    { bg: 'var(--as-50)',       color: 'var(--as-700)'        },
  success: { bg: 'var(--succes-fond)', color: 'var(--succes-accent)' },
  warning: { bg: 'var(--avert-fond)',  color: 'var(--avert-accent)'  },
  error:   { bg: 'var(--erreur-fond)', color: 'var(--erreur-accent)' },
  neutral: { bg: 'var(--fond-surface-2)', color: 'var(--texte-secondaire)' },
}

export function StatCard({ icon, label, value, hint, trend, tone = 'accent', onClick }: Props) {
  const t = TONE_MAP[tone]
  const Trend = trend?.direction === 'up' ? TrendingUp
              : trend?.direction === 'down' ? TrendingDown
              : Minus
  const trendColor =
      trend?.tone === 'positive' ? 'var(--succes-accent)'
    : trend?.tone === 'negative' ? 'var(--erreur-accent)'
    : 'var(--texte-tertiaire)'

  return (
    <div
      onClick={onClick}
      className="saris-grain"
      style={{
        backgroundColor: 'var(--fond-surface)',
        border:       '1px solid var(--bordure-legere)',
        borderRadius: 'var(--radius-xl)',
        padding:      'var(--espace-4)',
        cursor:       onClick ? 'pointer' : 'default',
        transition:   'border-color 0.15s, box-shadow 0.15s',
        position:     'relative',
        overflow:     'hidden',
      }}
      onMouseEnter={onClick ? e => {
        e.currentTarget.style.borderColor = 'var(--ap-300)'
        e.currentTarget.style.boxShadow = 'var(--ombre-1)'
      } : undefined}
      onMouseLeave={onClick ? e => {
        e.currentTarget.style.borderColor = 'var(--bordure-legere)'
        e.currentTarget.style.boxShadow = 'none'
      } : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--espace-3)' }}>
        {icon && (
          <div style={{
            width: 38, height: 38, borderRadius: 'var(--radius-lg)',
            background: t.bg, color: t.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {icon}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0,
            fontSize: 'var(--font-size-overline)',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            fontWeight: 700,
            color: 'var(--texte-tertiaire)',
          }}>
            {label}
          </p>
          <p style={{
            margin: '4px 0 0',
            fontSize: 'var(--font-size-h1)',
            fontWeight: 700,
            color: 'var(--texte-primaire)',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}>
            {value}
          </p>
          {hint && (
            <p style={{
              margin: '4px 0 0',
              fontSize: 'var(--font-size-caption)',
              color: 'var(--texte-tertiaire)',
            }}>
              {hint}
            </p>
          )}
          {trend && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              marginTop: 6,
              fontSize: 'var(--font-size-caption)',
              fontWeight: 600,
              color: trendColor,
            }}>
              <Trend size={12} />
              {trend.value}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
