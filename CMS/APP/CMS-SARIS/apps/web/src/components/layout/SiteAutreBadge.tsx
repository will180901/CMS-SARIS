/**
 * SiteAutreBadge — repère « autre site » sur un passage (visite, consultation).
 *
 * Multi-site sans restriction : les files du Triage et des Consultations sont COMMUNES aux
 * deux sites. Sans repère, un soignant de Moutela ne distinguait pas le patient qui attend
 * devant lui de celui qui attend à Nkayi.
 *
 * Le site n'est montré que s'il DIFFÈRE de celui où l'on travaille — le site du poste sur
 * un client de bureau, celui confirmé à la connexion en navigateur (même règle que
 * SiteActifSwitch). Sinon chaque carte porterait la même mention, qui ne dirait plus rien.
 */
import { MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '@/stores/session.store'
import { desktopBridge } from '@/lib/desktop'
import { nomCourtSite } from '@/lib/site'

export function SiteAutreBadge({ site }: { site?: { id?: string; libelle: string } | null }) {
  const { t } = useTranslation()
  const siteSession = useSessionStore(s => s.user?.siteId)
  const ici = desktopBridge()?.posteSiteId || siteSession
  if (!site?.id || !ici || site.id === ici) return null

  return (
    <span
      title={t('header.autreSite', { site: site.libelle })}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0,
        fontSize: '10px', fontWeight: 600, lineHeight: 1.4,
        padding: '1px 6px', borderRadius: 9999,
        color: 'var(--avert-texte)', background: 'var(--avert-fond)',
        border: '1px solid var(--avert-bordure)',
      }}
    >
      <MapPin size={10} /> {nomCourtSite(site.libelle)}
    </span>
  )
}
