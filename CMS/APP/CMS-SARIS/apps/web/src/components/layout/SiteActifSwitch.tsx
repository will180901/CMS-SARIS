/**
 * SiteActifSwitch — affiche le site auquel ce poste est rattaché.
 *
 * Multi-site sans restriction : les données ne sont plus cloisonnées par site,
 * donc il n'y a plus de « bascule » à faire — le site est un repère de
 * traçabilité (qui/où), pas un filtre d'accès. Affichage statique uniquement ;
 * le rattachement définitif d'un poste à son site sera fixé une seule fois à
 * l'installation du poste desktop (cf. pivot multi-site).
 */
import { MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tooltip } from '@/components/saris'
import { useSites } from '@/modules/referentiels/hooks/useReferentiels'
import { useSessionStore } from '@/stores/session.store'

export function SiteActifSwitch() {
  const { t } = useTranslation()
  const { data: sites = [] } = useSites()
  const mySiteId = useSessionStore(s => s.user?.siteId)

  const current = sites.find(s => s.id === mySiteId)
  if (!current) return null

  return (
    <Tooltip label={t('header.currentSiteTooltip', { site: current.libelle })}>
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 11, fontWeight: 600,
          padding: '4px 9px', borderRadius: 9999,
          background: 'var(--fond-surface-2)',
          color: 'var(--texte-secondaire)',
        }}
      >
        <MapPin size={12} />
        {current.libelle.replace('Centre Médico-Social ', '')}
      </span>
    </Tooltip>
  )
}
