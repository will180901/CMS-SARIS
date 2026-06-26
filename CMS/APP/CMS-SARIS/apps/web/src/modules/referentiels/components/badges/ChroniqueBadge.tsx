import { useTranslation } from 'react-i18next'

interface ChroniqueBadgeProps {
  chronique: boolean
}

export function ChroniqueBadge({ chronique }: ChroniqueBadgeProps) {
  const { t } = useTranslation()
  return (
    <span
      style={{
        display:      'inline-flex',
        alignItems:   'center',
        padding:      '2px 8px',
        borderRadius: '4px',
        fontSize:     '11px',
        fontWeight:   '500',
        background:   chronique ? 'var(--avert-fond)'      : 'var(--fond-surface-2)',
        color:        chronique ? 'var(--avert-texte)'     : 'var(--texte-tertiaire)',
        whiteSpace:   'nowrap',
      } as React.CSSProperties}
    >
      {chronique ? t('referentiels.pathoChronic') : t('referentiels.pathoAcute')}
    </span>
  )
}
