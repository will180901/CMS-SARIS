/**
 * ConsultationViewerModal — aperçu EN PLACE d'une consultation (lecture seule),
 * réutilisé par Chronologie et Suivi pour ne jamais quitter le dossier patient :
 * réutilise `ConsultationArchiveSummary` (déjà scrollable, déjà lecture-seule)
 * plutôt que de rediriger vers /consultations.
 */
import { useTranslation } from 'react-i18next'
import { Stethoscope, Loader2 } from 'lucide-react'
import { Modal } from '@/components/saris'
import { useConsultation } from '@/modules/consultation/hooks/useConsultation'
import { ConsultationArchiveSummary } from '@/modules/consultation/components/ConsultationArchiveSummary'
import { formatDate } from '@/lib/intl'

export function ConsultationViewerModal({ consultationId, onClose }: { consultationId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const { data: consultation, isLoading } = useConsultation(consultationId)

  const subtitle = consultation
    ? formatDate(consultation.createdAt, { day: '2-digit', month: 'long', year: 'numeric' })
      + (consultation.visite?.motifPrincipal?.libelle ? ` · ${consultation.visite.motifPrincipal.libelle}` : '')
    : undefined

  return (
    <Modal
      icon={<Stethoscope size={16} />}
      title={t('patients.consultationViewerTitle')}
      subtitle={subtitle}
      width={680}
      bodyPadding="0"
      onClose={onClose}
    >
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 8, color: 'var(--texte-tertiaire)' }}>
          <Loader2 size={16} className="animate-spin" />
          <span style={{ fontSize: '13px' }}>{t('patients.loading')}</span>
        </div>
      )}
      {!isLoading && !consultation && (
        <p style={{ margin: '16px 20px', fontSize: 'var(--font-size-body-sm)', color: 'var(--erreur-texte)' }}>
          {t('patients.consultationViewerNotFound')}
        </p>
      )}
      {!isLoading && consultation && (
        <ConsultationArchiveSummary consultationId={consultationId} consultation={consultation} />
      )}
    </Modal>
  )
}
