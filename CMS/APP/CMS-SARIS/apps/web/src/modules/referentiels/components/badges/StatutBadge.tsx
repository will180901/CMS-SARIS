import { useTranslation } from 'react-i18next'
import { isActif } from '../../api/referentiels.api'

interface StatutBadgeProps {
  statut: string
  /** Si true, le badge est cliquable pour toggle le statut */
  onClick?: () => void
}

export function StatutBadge({ statut, onClick }: StatutBadgeProps) {
  const { t } = useTranslation()
  const actif = isActif(statut)

  const badge = (
    <span
      style={{
        display:      'inline-flex',
        alignItems:   'center',
        gap:          '5px',
        padding:      '3px 9px',
        borderRadius: '4px',
        fontSize:     '12px',
        fontWeight:   '500',
        background:   actif ? 'var(--succes-fond)'    : 'var(--fond-surface-2)',
        color:        actif ? 'var(--succes-texte)'   : 'var(--texte-tertiaire)',
        cursor:       onClick ? 'pointer' : 'default',
        userSelect:   'none',
        transition:   'opacity 0.15s',
        whiteSpace:   'nowrap',
      } as React.CSSProperties}
      onClick={onClick}
      title={onClick ? (actif ? t('referentiels.statusDeactivateTooltip') : t('referentiels.statusActivateTooltip')) : undefined}
    >
      <span
        style={{
          width:        '6px',
          height:       '6px',
          borderRadius: '50%',
          background:   actif ? 'var(--succes-accent)' : 'var(--texte-tertiaire)',
          flexShrink:   '0',
        } as React.CSSProperties}
      />
      {actif ? t('referentiels.statusActive') : t('referentiels.statusInactive')}
    </span>
  )

  return badge
}
