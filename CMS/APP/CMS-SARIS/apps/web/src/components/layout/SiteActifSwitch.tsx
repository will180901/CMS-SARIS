/**
 * SiteActifSwitch — affiche le site auquel ce poste est rattaché.
 *
 * Multi-site sans restriction : les données ne sont plus cloisonnées par site,
 * donc il n'y a plus de « bascule » à faire — le site est un repère de
 * traçabilité (qui/où), pas un filtre d'accès.
 *
 * SUR UN POSTE DESKTOP, c'est le site DU POSTE qui prime, jamais celui du compte
 * connecté. Une machine est physiquement quelque part : c'est ce lieu-là qui est
 * porté par les actes qu'on y saisit. Afficher le site de la personne conduisait
 * à annoncer « Moutela » sur une machine installée à Nkayi — dès qu'un soignant
 * d'un autre site s'y connecte, le repère devient faux.
 *
 * En navigateur, il n'y a pas de poste : on retombe sur le site du compte.
 */
import { MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tooltip } from '@/components/saris'
import { useSites } from '@/modules/referentiels/hooks/useReferentiels'
import { useSessionStore } from '@/stores/session.store'
import { desktopBridge } from '@/lib/desktop'

export function SiteActifSwitch() {
  const { t } = useTranslation()
  const { data: sites = [] } = useSites()
  const mySiteId = useSessionStore(s => s.user?.siteId)
  const posteSiteId = desktopBridge()?.posteSiteId

  const current = sites.find(s => s.id === (posteSiteId || mySiteId))
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
