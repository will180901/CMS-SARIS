/**
 * ControleFluxPoste — ce qu'un administrateur peut décider pour les ÉCHANGES d'un poste.
 *
 *  - SUSPENDRE : le serveur refuse ce que le poste envoie (et, s'il est à jour, ne lui envoie
 *    plus rien). Le poste continue de travailler avec sa base locale et rattrape tout à la
 *    reprise : rien n'est perdu, seulement retardé. Réversible en un clic.
 *  - FORCER UNE RESYNCHRONISATION COMPLÈTE : le poste retélécharge toutes les données du
 *    serveur à son prochain contact (ce qu'il n'a pas encore envoyé est conservé).
 *  - VIDAGE DES DONNÉES DU CENTRE (information, rien à commander ici) : quand le centre est vidé
 *    depuis la page « Données de test », chaque poste reçoit l'ordre de vider sa copie ; tant qu'il
 *    ne l'a pas fait, ses échanges sont refusés. Cette ligne dit où en est CE poste.
 *
 * Seuls les boutons qui ont un EFFET sont offerts. La resynchronisation n'est proposée que si
 * le poste dit comprendre l'ordre (version récente) : sans cela, la demande resterait « en
 * attente » sans fin, et l'on croirait la reprise lancée. La suspension, elle, est toujours
 * possible — le serveur refuse l'envoi d'un poste ancien aussi — mais la fenêtre le dit : un
 * poste ancien peut encore recevoir.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eraser, KeyRound, Pause, Play, RefreshCw, Unplug } from 'lucide-react'
import { Button, Modal, Field, Textarea } from '@/components/saris'
import { toast } from '@workspace/ui/components/sonner'
import { formatDateTime } from '@/lib/intl'
import {
  useSuspendrePoste, useReprendrePoste, useDemanderResync, useAnnulerResync, useRevoquerAccesPoste,
} from '../hooks/useSync'
import type { SyncSupervisionPosteDetail } from '../api/sync.api'
import { relative } from './relatif'

type Modale = null | 'suspendre' | 'resync' | 'couper'

interface Props {
  poste: SyncSupervisionPosteDetail
  /** Droit `synchronisation.execute` : sans lui, l'état se lit mais rien ne se commande. */
  peutAgir: boolean
  /** Dit au tiroir qu'une fenêtre est ouverte : Échap doit fermer la fenêtre, pas le tiroir. */
  onModale: (ouverte: boolean) => void
}

const rangee: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 'var(--espace-3)', flexWrap: 'wrap',
  padding: 'var(--espace-3)',
}
const titre: React.CSSProperties = {
  margin: 0, fontSize: 'var(--font-size-body-sm)', fontWeight: 600, color: 'var(--texte-primaire)',
}
const aide: React.CSSProperties = {
  margin: '2px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-secondaire)', lineHeight: 1.5,
}

export function ControleFluxPoste({ poste, peutAgir, onModale }: Props) {
  const { t } = useTranslation()
  const suspendre = useSuspendrePoste()
  const reprendre = useReprendrePoste()
  const demander = useDemanderResync()
  const annuler = useAnnulerResync()
  const revoquer = useRevoquerAccesPoste()
  const [modale, setModale] = useState<Modale>(null)
  const [motif, setMotif] = useState('')

  const compatible = (poste.niveauControle ?? 0) >= 1
  const enAttente = !!poste.resyncDemandeeAt
  const vidageEnAttente = !!poste.vidageDemandeAt
  const sait_vider = (poste.niveauControle ?? 0) >= 2
  const echec = () => toast.error(t('admin.supCtlErreur'))
  const ouvrir = (m: Modale) => { setModale(m); onModale(m !== null) }

  function confirmerSuspension() {
    suspendre.mutate({ id: poste.id, motif: motif.trim() || undefined }, {
      onSuccess: () => { ouvrir(null); setMotif(''); toast.success(t('admin.supCtlSuspenduFait')) },
      onError: echec,
    })
  }
  function confirmerResync() {
    demander.mutate(poste.id, {
      onSuccess: () => { ouvrir(null); toast.success(t('admin.supCtlResyncDemandee')) },
      onError: echec,
    })
  }

  function confirmerCoupure() {
    revoquer.mutate(poste.id, {
      onSuccess: () => { ouvrir(null); toast.success(t('admin.appAccesCoupeFait')) },
      onError: echec,
    })
  }

  const depuis = !poste.suspenduAt ? '' : poste.suspenduParNom
    ? t('admin.supCtlDepuisPar', { date: formatDateTime(poste.suspenduAt), nom: poste.suspenduParNom })
    : t('admin.supCtlDepuis', { date: formatDateTime(poste.suspenduAt) })

  return (
    <>
      <div style={{ border: '1px solid var(--bordure-legere)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {/* ── Les échanges : actifs ou suspendus ─────────────────────────── */}
        <div style={rangee}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {poste.suspendu
                ? <Pause size={14} style={{ color: 'var(--avert-accent)', flexShrink: 0 }} />
                : <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--succes-accent)', flexShrink: 0 }} />}
              <p style={titre}>{poste.suspendu ? t('admin.supCtlSuspendus') : t('admin.supCtlActifs')}</p>
            </div>
            <p style={aide}>
              {poste.suspendu
                ? <>{depuis}{poste.suspensionMotif && <><br />{t('admin.supCtlMotif', { motif: poste.suspensionMotif })}</>}</>
                : t('admin.supCtlActifsAide')}
            </p>
          </div>
          {peutAgir && (poste.suspendu ? (
            <Button
              size="sm" variant="outline" leftIcon={<Play size={13} />} loading={reprendre.isPending}
              onClick={() => reprendre.mutate(poste.id, {
                onSuccess: () => toast.success(t('admin.supCtlRepriseFaite')),
                onError: echec,
              })}
            >
              {t('admin.supCtlReprendre')}
            </Button>
          ) : (
            <Button
              size="sm" variant="outline" leftIcon={<Pause size={13} />} onClick={() => ouvrir('suspendre')}
              style={{ color: 'var(--avert-texte)', borderColor: 'var(--avert-accent)' }}
            >
              {t('admin.supCtlSuspendre')}
            </Button>
          ))}
        </div>

        {/* ── La resynchronisation complète ──────────────────────────────── */}
        <div style={{ ...rangee, borderTop: '1px solid var(--bordure-legere)' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={titre}>{t('admin.supCtlResyncTitre')}</p>
            <p style={aide}>
              {!compatible
                ? t('admin.supCtlResyncAncien')
                : enAttente
                  ? t('admin.supCtlResyncAttente', { quand: relative(poste.resyncDemandeeAt) })
                  : <>
                      {t('admin.supCtlResyncAide')}
                      {poste.resyncFaiteAt && <> {t('admin.supCtlResyncDerniere', { date: formatDateTime(poste.resyncFaiteAt) })}</>}
                    </>}
            </p>
          </div>
          {peutAgir && compatible && (enAttente ? (
            <Button
              size="sm" variant="ghost" loading={annuler.isPending}
              onClick={() => annuler.mutate(poste.id, {
                onSuccess: () => toast.success(t('admin.supCtlResyncAnnulee')),
                onError: echec,
              })}
            >
              {t('admin.supCtlResyncAnnuler')}
            </Button>
          ) : (
            <Button size="sm" variant="outline" leftIcon={<RefreshCw size={13} />} onClick={() => ouvrir('resync')}>
              {t('admin.supCtlResyncBtn')}
            </Button>
          ))}
        </div>

        {/* ── L'appairage : ce poste s'est enregistré avec un code, sans compte ──── */}
        {poste.appaireAt && (
          <div style={{ ...rangee, borderTop: '1px solid var(--bordure-legere)' }}>
            <KeyRound
              size={14}
              style={{ color: poste.accesRevoqueAt ? 'var(--erreur-accent)' : 'var(--texte-tertiaire)', flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={titre}>{t('admin.appAcces')}</p>
              <p style={aide}>
                {poste.accesRevoqueAt
                  ? t('admin.appAccesCoupe', { date: formatDateTime(poste.accesRevoqueAt) })
                  : <>{t('admin.appAccesActif', { date: formatDateTime(poste.appaireAt) })}<br />{t('admin.appAccesAide')}</>}
              </p>
            </div>
            {peutAgir && !poste.accesRevoqueAt && (
              <Button
                size="sm" variant="outline" leftIcon={<Unplug size={13} />} onClick={() => ouvrir('couper')}
                style={{ color: 'var(--erreur-texte)', borderColor: 'var(--erreur-accent)' }}
              >
                {t('admin.appCouper')}
              </Button>
            )}
          </div>
        )}

        {/* ── Le vidage des données du centre : où en est ce poste ───────── */}
        {(vidageEnAttente || poste.vidageFaitAt) && (
          <div style={{ ...rangee, borderTop: '1px solid var(--bordure-legere)' }}>
            <Eraser
              size={14}
              style={{ color: vidageEnAttente ? 'var(--avert-accent)' : 'var(--texte-tertiaire)', flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={titre}>{t('admin.supCtlVidageTitre')}</p>
              <p style={aide}>
                {vidageEnAttente
                  ? <>
                      {t('admin.supCtlVidageAttente', { quand: relative(poste.vidageDemandeAt) })}
                      {!sait_vider && <><br />{t('admin.supCtlVidageAncien')}</>}
                    </>
                  : t('admin.supCtlVidageFait', { date: formatDateTime(poste.vidageFaitAt ?? '') })}
              </p>
            </div>
          </div>
        )}
      </div>

      {modale === 'suspendre' && (
        <Modal
          icon={<Pause size={18} />} tone="warning" width={500}
          title={t('admin.supSuspTitre')} subtitle={poste.libelle}
          onClose={() => ouvrir(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => ouvrir(null)}>{t('common.cancel')}</Button>
              <Button variant="primary" loading={suspendre.isPending} onClick={confirmerSuspension}>
                {t('admin.supSuspConfirmer')}
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--texte-secondaire)', lineHeight: 1.6 }}>
              {compatible ? t('admin.supSuspCorpsAJour') : t('admin.supSuspCorpsAncien')}
            </p>
            <Field label={t('admin.supSuspMotif')} hint={t('admin.supSuspMotifAide')}>
              {(id) => (
                <Textarea
                  id={id} rows={2} maxLength={200} value={motif} data-autofocus
                  placeholder={t('admin.supSuspMotifPlaceholder')}
                  onChange={(e) => setMotif(e.target.value)}
                />
              )}
            </Field>
            <p style={{
              margin: 0, padding: 'var(--espace-2) var(--espace-3)', borderRadius: 'var(--radius-md)',
              background: 'var(--info-fond)', color: 'var(--info-texte)',
              fontSize: 'var(--font-size-caption)', lineHeight: 1.5,
            }}>
              {t('admin.supSuspAppareilVole')}
            </p>
          </div>
        </Modal>
      )}

      {modale === 'couper' && (
        <Modal
          icon={<Unplug size={18} />} tone="error" width={500}
          title={t('admin.appCouperTitre')} subtitle={poste.libelle}
          onClose={() => ouvrir(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => ouvrir(null)}>{t('common.cancel')}</Button>
              <Button variant="danger" loading={revoquer.isPending} onClick={confirmerCoupure}>
                {t('admin.appCouperConfirmer')}
              </Button>
            </>
          }
        >
          <p style={{ margin: 0, fontSize: 13, color: 'var(--texte-secondaire)', lineHeight: 1.6 }}>
            {t('admin.appCouperCorps')}
          </p>
        </Modal>
      )}

      {modale === 'resync' && (
        <Modal
          icon={<RefreshCw size={18} />} tone="accent" width={500}
          title={t('admin.supResyncModalTitre')} subtitle={poste.libelle}
          onClose={() => ouvrir(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => ouvrir(null)}>{t('common.cancel')}</Button>
              <Button variant="primary" loading={demander.isPending} onClick={confirmerResync}>
                {t('admin.supResyncConfirmer')}
              </Button>
            </>
          }
        >
          <p style={{ margin: 0, fontSize: 13, color: 'var(--texte-secondaire)', lineHeight: 1.6 }}>
            {t('admin.supResyncModalCorps')}
          </p>
        </Modal>
      )}
    </>
  )
}
