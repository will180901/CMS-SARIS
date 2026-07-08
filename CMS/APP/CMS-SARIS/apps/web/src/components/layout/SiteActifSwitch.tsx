/**
 * SiteActifSwitch — bascule le site actif de la session (Moutela ⇄ Nkayi).
 *
 * Le personnel médical n'est pas affecté à un site unique : il tourne entre les
 * deux selon un planning de permutation (recueil de l'existant). Ce petit contrôle
 * déclare "aujourd'hui je travaille à X" — la session entière (Triage, Consultations,
 * création de visite…) bascule sur ce site le temps qu'on ne re-bascule pas.
 */
import { MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tooltip } from '@/components/saris'
import { useSites } from '@/modules/referentiels/hooks/useReferentiels'
import { useSessionStore } from '@/stores/session.store'
import { useChangerSiteActif } from '@/modules/auth/hooks/useChangerSiteActif'

export function SiteActifSwitch() {
  const { t } = useTranslation()
  const { data: sites = [] } = useSites()
  const mySiteId = useSessionStore(s => s.user?.siteId)
  const changer  = useChangerSiteActif()

  const current = sites.find(s => s.id === mySiteId)
  const autre   = sites.find(s => s.id !== mySiteId)
  if (!current || !autre) return null

  return (
    <Tooltip label={changer.isPending ? t('header.switchingSite') : t('header.switchSiteTooltip', { site: autre.libelle })}>
      <button
        type="button"
        onClick={() => changer.mutate(autre.id)}
        disabled={changer.isPending}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 11, fontWeight: 600,
          padding: '4px 9px', borderRadius: 9999,
          background: 'var(--fond-surface-2)', border: 'none', cursor: changer.isPending ? 'wait' : 'pointer',
          color: 'var(--texte-secondaire)', opacity: changer.isPending ? 0.7 : 1,
        }}
      >
        <MapPin size={12} />
        {current.libelle.replace('Centre Médico-Social ', '')}
      </button>
    </Tooltip>
  )
}
