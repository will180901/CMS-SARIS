import { useEffect, useState } from 'react'

/**
 * TotpCountdown — compte à rebours avant expiration du code TOTP courant.
 *
 * Les codes TOTP changent toutes les 30 s, alignés sur l'horloge Unix.
 * Le temps restant est donc calculable côté client (aucun appel serveur),
 * parfaitement synchrone avec l'application d'authentification de l'utilisateur :
 *   restant = 30 − (secondes_unix mod 30)
 */

const TOTP_PERIOD = 30

export function TotpCountdown({ align = 'left' }: { align?: 'left' | 'center' }) {
  const [remaining, setRemaining] = useState(() => TOTP_PERIOD - (Math.floor(Date.now() / 1000) % TOTP_PERIOD))

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(TOTP_PERIOD - (Math.floor(Date.now() / 1000) % TOTP_PERIOD))
    }, 250) // sous-seconde → la valeur affichée ne « saute » jamais
    return () => clearInterval(id)
  }, [])

  const R = 9, C = 2 * Math.PI * R
  const frac = remaining / TOTP_PERIOD
  const urgent = remaining <= 5
  const color = urgent ? 'var(--erreur-accent)' : 'var(--ap-500)'

  return (
    <div
      title="Temps restant avant que le code ne change"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)',
      }}
    >
      <svg width={24} height={24} viewBox="0 0 24 24" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }} aria-hidden="true">
        <circle cx="12" cy="12" r={R} fill="none" stroke="var(--bordure-legere)" strokeWidth="2.5" />
        <circle
          cx="12" cy="12" r={R} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - frac)}
          style={{ transition: 'stroke-dashoffset 0.25s linear, stroke 0.2s' }}
        />
      </svg>
      <span>
        Le code expire dans{' '}
        <strong style={{ color, fontVariantNumeric: 'tabular-nums' }}>{remaining}s</strong>
      </span>
    </div>
  )
}
