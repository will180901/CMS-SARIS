/**
 * CePosteCard — « où suis-je, et où en suis-je ? », en tête de la page Synchronisation.
 *
 * Particularité DESKTOP : l'application y est elle-même une machine du parc. Sa propre
 * situation prime donc sur celle des autres — chercher son poste dans une liste de vingt
 * pour savoir si SES données sont remontées n'a pas de sens quand on est assis devant.
 *
 * Le web n'affiche jamais ce bloc : un navigateur n'est pas un poste, il n'a ni nom, ni
 * site de rattachement, ni file d'attente locale.
 *
 * Le nom affiché est celui saisi à la première configuration — « Bureau Accueil »,
 * « Salle de soins 2 » — et non l'identifiant technique de la machine, qui ne dit rien
 * à personne.
 */
import { useTranslation } from 'react-i18next'
import { MonitorSmartphone, MapPin, Wifi, WifiOff, CloudUpload } from 'lucide-react'
import { Card, StatusPill } from '@/components/saris'
import { desktopBridge } from '@/lib/desktop'
import { useConnectivityStore } from '@/stores/connectivity.store'

export function CePosteCard({ enAttente }: { enAttente?: number }) {
  const { t } = useTranslation()
  const bridge = desktopBridge()
  const online = useConnectivityStore(s => s.online)

  // Sans nom de poste, la carte n'aurait rien à dire : mieux vaut ne pas l'afficher que
  // montrer un cadre vide (poste jamais configuré, ou pont desktop indisponible).
  const nom = bridge?.posteLibelle
  if (!nom) return null

  return (
    <Card padding="none">
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--espace-4)',
        padding: 'var(--espace-4)', flexWrap: 'wrap',
      }}>
        {/* Identité */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 40, height: 40, borderRadius: 'var(--radius-md)', flexShrink: 0,
          background: 'var(--ap-50)', color: 'var(--ap-600)',
        }}>
          <MonitorSmartphone size={19} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)',
            textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700,
          }}>
            {t('admin.cePoste', { defaultValue: 'Ce poste' })}
          </p>
          <p style={{
            margin: '2px 0 0', fontSize: 'var(--font-size-h4)', fontWeight: 700,
            color: 'var(--texte-primaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {nom}
          </p>
        </div>

        {/* État réseau — un poste hors ligne travaille quand même : il accumule
            localement et remontera plus tard. On le dit sans dramatiser. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-3)', flexShrink: 0 }}>
          {bridge?.posteSiteId && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 'var(--font-size-caption)', color: 'var(--texte-secondaire)',
            }}>
              <MapPin size={13} />
              {t('admin.cePosteRattache', { defaultValue: 'Rattaché à un site' })}
            </span>
          )}

          {enAttente != null && enAttente > 0 && (
            <StatusPill tone="warning" size="sm">
              <CloudUpload size={11} style={{ marginRight: 3 }} />
              {t('admin.cePosteEnAttente', {
                defaultValue: '{{n}} en attente d’envoi',
                n: enAttente,
              })}
            </StatusPill>
          )}

          <StatusPill tone={online ? 'success' : 'neutral'} size="sm">
            {online ? <Wifi size={11} style={{ marginRight: 3 }} /> : <WifiOff size={11} style={{ marginRight: 3 }} />}
            {online
              ? t('admin.cePosteEnLigne', { defaultValue: 'En ligne' })
              : t('admin.cePosteHorsLigne', { defaultValue: 'Hors ligne — les données seront envoyées au retour du réseau' })}
          </StatusPill>
        </div>
      </div>
    </Card>
  )
}
