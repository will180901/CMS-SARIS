/**
 * Sélecteur de langue FR/EN (toggle). Applique la langue à toute la plateforme et la
 * persiste (localStorage). Style aligné sur la charte SARIS.
 */
import { useTranslation } from 'react-i18next'
import { setLanguage, type Lang } from '@/i18n/config'

const LANGS: { code: Lang; label: string }[] = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
]

export function LanguageSwitcher({ compact = false, onChange }: { compact?: boolean; onChange?: (lang: Lang) => void }) {
  const { i18n } = useTranslation()
  const current = (i18n.language || 'fr').slice(0, 2)

  return (
    <div
      role="group"
      aria-label="Langue / Language"
      style={{
        display: 'inline-flex',
        borderRadius: 9999,
        border: '1px solid var(--bordure-legere)',
        overflow: 'hidden',
        background: 'var(--fond-surface-2)',
      }}
    >
      {LANGS.map((l) => {
        const active = current === l.code
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => { setLanguage(l.code); onChange?.(l.code) }}
            aria-pressed={active}
            style={{
              fontSize: compact ? 11 : 12,
              fontWeight: 700,
              letterSpacing: '0.03em',
              padding: compact ? '3px 10px' : '5px 13px',
              border: 'none',
              cursor: 'pointer',
              background: active ? 'var(--ap-400)' : 'transparent',
              color: active ? '#fff' : 'var(--texte-secondaire)',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {l.label}
          </button>
        )
      })}
    </div>
  )
}
