/**
 * SortieDetailDrawer — panneau de détail d'une évacuation, ouvert au clic sur une
 * ligne du tableau. Reste DANS la page (pas de navigation intempestive) ; un bouton
 * explicite permet d'ouvrir la consultation d'origine. Permet la clôture et
 * l'annulation depuis le détail (selon permissions + statut), avec confirmation.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Ambulance, Stethoscope, Ban, CheckCircle2 } from 'lucide-react'
import { Modal, Button, StatusPill, MotifDialog } from '@/components/saris'
import { usePermissions } from '@/hooks/usePermissions'
import { humanizeCode } from '@/config/labels'
import { useCloturerEvacuation, useAnnulerEvacuation } from '../hooks/useSorties'
import type { Evacuation } from '../api/sorties.api'

export type SortieDetail = { type: 'evacuation'; data: Evacuation }

const URGENCE_KEY: Record<string, string> = { BASSE: 'urgenceBasse', MOYENNE: 'urgenceMoyenne', HAUTE: 'urgenceHaute', CRITIQUE: 'urgenceCritique' }
const STATUT_KEY:  Record<string, string> = { EN_COURS: 'evacStatutEnCours', CLOTURE: 'evacStatutCloture', ANNULE: 'evacStatutAnnule' }

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <p style={{ margin: 0, fontSize: 'var(--font-size-overline)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--texte-tertiaire)' }}>{label}</p>
      <p style={{ margin: '3px 0 0', fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-primaire)', whiteSpace: 'pre-wrap' }}>{value}</p>
    </div>
  )
}

export function SortieDetailDrawer({ detail, onClose }: { detail: SortieDetail | null; onClose: () => void }) {
  if (!detail) return null
  return <SortieDetailInner detail={detail} onClose={onClose} />
}

function SortieDetailInner({ detail, onClose }: { detail: SortieDetail; onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { has } = usePermissions()
  const [dialog, setDialog] = useState<'annuler' | null>(null)

  const evac = detail.data
  const cloturerEvac = useCloturerEvacuation(evac.id)
  const annulerEvac  = useAnnulerEvacuation(evac.id)

  const consultationId = evac.consultation.id
  const patient = evac.consultation.visite.patient
  const pid = patient?.identite
  const nom = pid ? `${pid.prenom} ${pid.nom}` : (patient?.numeroPatient ?? '—')

  const estActif  = evac.statut === 'EN_COURS'
  const canClose  = estActif && has('evacuation.close')
  const canCancel = estActif && has('evacuation.cancel')

  function doCloturer() {
    cloturerEvac.mutate(undefined, { onSuccess: () => onClose() })
  }
  function doAnnuler(motif: string) {
    annulerEvac.mutate(motif, { onSuccess: () => { setDialog(null); onClose() } })
  }

  return (
    <Modal
      icon={<Ambulance size={16} />}
      title={t('sorties.drawerEvacuationTitle')}
      subtitle={`${nom}${patient?.numeroPatient ? ` · ${patient.numeroPatient}` : ''}`}
      width={520}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('sorties.close')}</Button>
          {canCancel && (
            <Button variant="ghost" leftIcon={<Ban size={14} />} onClick={() => setDialog('annuler')} disabled={annulerEvac.isPending}>
              {t('sorties.cancel')}
            </Button>
          )}
          {canClose && (
            <Button variant="success" leftIcon={<CheckCircle2 size={14} />} loading={cloturerEvac.isPending} onClick={doCloturer}>
              {t('sorties.cloturer')}
            </Button>
          )}
          {consultationId && (
            <Button variant="primary" leftIcon={<Stethoscope size={14} />} onClick={() => { navigate('/consultations', { state: { openConsultationId: consultationId } }); onClose() }}>
              {t('sorties.openConsultation')}
            </Button>
          )}
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <StatusPill tone={evac.niveauUrgence === 'CRITIQUE' ? 'error' : evac.niveauUrgence === 'HAUTE' ? 'warning' : 'info'}>
            {t('sorties.urgenceBadge', { niveau: t(`sorties.${URGENCE_KEY[evac.niveauUrgence]}`) })}
          </StatusPill>
          <StatusPill tone={evac.statut === 'ANNULE' ? 'neutral' : (evac.statut === 'CLOTURE' ? 'success' : 'info')}>
            {STATUT_KEY[evac.statut] ? t(`sorties.${STATUT_KEY[evac.statut]}`) : humanizeCode(evac.statut)}
          </StatusPill>
        </div>

        {evac.etablissement && <Field label={t('sorties.fieldEtablissementDestination')} value={evac.etablissement.nom} />}
        <Field label={t('sorties.fieldInfosCliniques')} value={evac.infosCliniques} />
        {evac.motifAnnulation && <Field label={t('sorties.fieldMotifAnnulation')} value={evac.motifAnnulation} />}
      </div>

      {dialog === 'annuler' && (
        <MotifDialog
          icon={<Ban size={16} />}
          title={t('sorties.cancelDialogTitle')}
          subtitle={t('sorties.cancelDialogSubtitle')}
          label={t('sorties.cancelDialogLabel')}
          placeholder={t('sorties.cancelDialogPlaceholder')}
          confirmLabel={t('sorties.cancelDialogConfirm')}
          confirmIcon={<Ban size={14} />}
          danger
          loading={annulerEvac.isPending}
          onConfirm={doAnnuler}
          onClose={() => setDialog(null)}
        />
      )}
    </Modal>
  )
}
