import { useTranslation } from 'react-i18next'
import type { TypeExamen } from '@cms-saris/types'

interface DomaineBadgeProps {
  domaine: TypeExamen['domaine']
}

const DOMAINE_CONFIG: Record<TypeExamen['domaine'], { labelKey: string; bg: string; color: string }> = {
  BIOLOGIE:   { labelKey: 'referentiels.domainBiology',    bg: 'var(--ap-50)',  color: 'var(--ap-700)'  },
  IMAGERIE:   { labelKey: 'referentiels.domainImaging',    bg: '#F3EEFF',       color: '#6D28D9'        },
  SPECIALISE: { labelKey: 'referentiels.domainSpecialized', bg: '#E0FDF4',       color: '#0F766E'        },
}

export function DomaineBadge({ domaine }: DomaineBadgeProps) {
  const { t } = useTranslation()
  const cfg = DOMAINE_CONFIG[domaine]
  return (
    <span
      style={{
        display:      'inline-flex',
        alignItems:   'center',
        padding:      '2px 8px',
        borderRadius: '4px',
        fontSize:     '11px',
        fontWeight:   '500',
        background:   cfg.bg,
        color:        cfg.color,
        whiteSpace:   'nowrap',
      } as React.CSSProperties}
    >
      {t(cfg.labelKey)}
    </span>
  )
}
