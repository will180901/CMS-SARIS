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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MonitorSmartphone, MapPin, Wifi, WifiOff, CloudUpload, Crosshair, Loader2 } from 'lucide-react'
import { Card, StatusPill, Button, Tooltip } from '@/components/saris'
import { toast } from '@workspace/ui/components/sonner'
import { desktopBridge } from '@/lib/desktop'
import { useConnectivityStore } from '@/stores/connectivity.store'
import { useSites } from '@/modules/referentiels/hooks/useReferentiels'
import { syncApi } from '../api/sync.api'
import { releverPosition, messageErreurPosition } from '@/lib/position'

export function CePosteCard({ enAttente }: { enAttente?: number }) {
  const { t } = useTranslation()
  const bridge = desktopBridge()
  const online = useConnectivityStore(s => s.online)
  const qc = useQueryClient()
  const [releve, setReleve] = useState(false)

  // Position DÉJÀ enregistrée pour ce poste — pour dire s'il en a une, et depuis quand.
  const posteId = bridge?.posteLocalId
  const { data: config } = useQuery({
    queryKey: ['sync', 'poste', posteId],
    queryFn: () => syncApi.lirePoste(posteId as string),
    enabled: !!posteId,
    staleTime: 60_000,
  })
  // « Rattaché à un site » n'apprend rien à qui veut savoir OÙ est la machine.
  // On nomme le site ; on ne retombe sur la mention générique que si le référentiel
  // n'est pas encore chargé (première synchro) ou si le site a été supprimé depuis.
  const { data: sites = [] } = useSites()
  const site = sites.find(s => s.id === bridge?.posteSiteId)

  // Sans nom de poste, la carte n'aurait rien à dire : mieux vaut ne pas l'afficher que
  // montrer un cadre vide (poste jamais configuré, ou pont desktop indisponible).
  const nom = bridge?.posteLibelle
  if (!nom) return null

  /**
   * Relève la position de CETTE machine et l'enregistre sur le poste.
   *
   * Le geste est manuel et se fait depuis le poste concerné : c'est la seule façon
   * d'obtenir une position qui veuille dire quelque chose. Un refus n'a aucune
   * conséquence — le poste continue de fonctionner sans position.
   */
  async function enregistrerPosition() {
    if (!posteId || !bridge?.posteSiteId) return
    setReleve(true)
    try {
      const pos = await releverPosition()
      await syncApi.configurerPoste({
        posteLocalId: posteId,
        siteId: bridge.posteSiteId,
        latitude: pos.latitude,
        longitude: pos.longitude,
        precisionM: pos.precisionM,
      })
      await qc.invalidateQueries({ queryKey: ['sync', 'poste', posteId] })
      toast.success(t('admin.postePosition.enregistree', { metres: pos.precisionM }))
    } catch (e) {
      toast.error(t(messageErreurPosition(e)))
    } finally {
      setReleve(false)
    }
  }

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
              {site
                ? t('admin.cePosteSite', { site: site.libelle })
                : t('admin.cePosteRattache')}
            </span>
          )}

          {/* Position du poste — relevée une fois, à l'installation. On affiche la
              marge annoncée par le navigateur : sans elle, « position enregistrée »
              laisserait croire à une exactitude que le relevé n'a pas forcément. */}
          {config?.latitude != null && config.longitude != null ? (
            <Tooltip label={t('admin.postePosition.detail', {
              lat: config.latitude.toFixed(5),
              lon: config.longitude.toFixed(5),
              metres: config.precisionM ?? '?',
            })}>
              <StatusPill tone="neutral" size="sm">
                <Crosshair size={11} style={{ marginRight: 3 }} />
                {t('admin.postePosition.situee', { metres: config.precisionM ?? '?' })}
              </StatusPill>
            </Tooltip>
          ) : bridge?.posteSiteId ? (
            <Button
              size="sm"
              variant="outline"
              disabled={releve}
              leftIcon={releve ? <Loader2 size={12} className="animate-spin" /> : <Crosshair size={12} />}
              onClick={enregistrerPosition}
            >
              {releve
                ? t('admin.postePosition.enCours')
                : t('admin.postePosition.action')}
            </Button>
          ) : null}

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
