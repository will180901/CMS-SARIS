/**
 * PrivacyCurtain — rideau de confidentialité (verre poli + grain subtil) couvrant une
 * zone de détail. Visible en PERMANENCE tant que la souris ne survole pas ; se dissipe
 * au survol pour lire/agir. Piloté par `privacy.store` (bascule globale dans le header).
 *
 * Neutralisé sur appareil TACTILE (pas de survol fiable → sinon masquage permanent).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EyeOff } from 'lucide-react'
import { usePrivacyStore } from '@/stores/privacy.store'
import { useIsTouch } from '@/hooks/useMediaQuery'

export function PrivacyCurtain({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const enabled = usePrivacyStore(s => s.curtain)
  const isTouch = useIsTouch()
  const [reveal, setReveal] = useState(false)
  const active = enabled && !isTouch

  return (
    <div
      style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
      onMouseEnter={active ? () => setReveal(true)  : undefined}
      onMouseLeave={active ? () => setReveal(false) : undefined}
    >
      {children}
      {active && (
        <div
          className="saris-grain"
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, zIndex: 45,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            background: 'color-mix(in srgb, var(--fond-surface) 20%, transparent)',
            backdropFilter: 'blur(9px) saturate(112%)',
            WebkitBackdropFilter: 'blur(9px) saturate(112%)',
            opacity: reveal ? 0 : 1,
            pointerEvents: 'none',                       // purement visuel : le survol passe au contenu
            transition: 'opacity 0.28s ease',
          }}
        >
          {/* Indice discret — se dissipe avec le rideau au survol */}
          <span style={{
            marginTop: 20, display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '6px 13px', borderRadius: 9999,
            background: 'color-mix(in srgb, var(--fond-surface) 72%, transparent)',
            border: '1px solid var(--bordure-legere)',
            color: 'var(--texte-tertiaire)', fontSize: 12, fontWeight: 600,
            boxShadow: 'var(--ombre-1)',
          }}>
            <EyeOff size={13} /> {t('privacy.hint')}
          </span>
        </div>
      )}
    </div>
  )
}
