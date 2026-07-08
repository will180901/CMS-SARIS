/**
 * ConsultationArchiveSummary — vue de fin de vie d'une consultation CLÔTURÉE ou
 * ANNULÉE : remplace ENTIÈREMENT le stepper actif (Examen & diagnostic / Documents
 * / Décision) par un seul écran qui défile, en lecture seule, propre et lisible.
 *
 * Réutilise les cartes documents existantes (déjà lecture-seule-capables) plutôt
 * que de réinventer leur affichage — seule la présentation d'ensemble change.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, XCircle, Trash2 } from 'lucide-react'
import { Button, Modal, InfoSection, InfoRow, StatusPill } from '@/components/saris'
import { usePermissions } from '@/hooks/usePermissions'
import { useDeleteConsultation } from '../hooks/useConsultation'
import { formatDateTime } from '@/lib/intl'
import { labelDecision } from '@/config/labels'
import { DiagnosticsCard } from './DiagnosticsCard'
import { OrdonnanceCard } from './OrdonnanceCard'
import { OrdonnancePrintModal } from './OrdonnancePrintModal'
import { CertificatReposPrintModal } from './CertificatReposPrintModal'
import { CertificatCard } from './CertificatCard'
import { BonExamenCard } from '@/modules/bon-examen/components/BonExamenCard'
import { BonPharmacieCard } from '@/modules/bon-pharmacie/components/BonPharmacieCard'
import { EvacuationCard } from '@/modules/sorties-critiques/components/EvacuationCard'
import type { useConsultation } from '../hooks/useConsultation'

interface Props {
  consultationId: string
  consultation:   NonNullable<ReturnType<typeof useConsultation>['data']>
}

export function ConsultationArchiveSummary({ consultationId, consultation }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { has } = usePermissions()
  const [previewOrdId, setPreviewOrdId] = useState<string | null>(null)
  const [previewRepos, setPreviewRepos] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const deleteConsult = useDeleteConsultation(consultationId)

  const { patient } = consultation.visite
  const cloturee = consultation.statut === 'CLOTUREE'
  const canDelete = has('consultation.delete')

  const impact = [
    consultation.diagnostics.length > 0 && t('consultation.archiveImpactDiagnostics', { count: consultation.diagnostics.length }),
    consultation.ordonnances.length > 0 && t('consultation.archiveImpactOrdonnances', { count: consultation.ordonnances.length }),
    consultation._count.bonsExamen > 0 && t('consultation.archiveImpactBonsExamen', { count: consultation._count.bonsExamen }),
    consultation._count.bonsPharmacie > 0 && t('consultation.archiveImpactBonsPharmacie', { count: consultation._count.bonsPharmacie }),
    consultation._count.certificats > 0 && t('consultation.archiveImpactCertificats', { count: consultation._count.certificats }),
    consultation.evacuation && consultation.evacuation.statut !== 'ANNULE' && t('consultation.archiveImpactEvacuation'),
  ].filter((x): x is string => !!x)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      <InfoSection
        title={t('consultation.archiveDecisionTitle')}
        icon={cloturee ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
      >
        <InfoRow
          label={t('consultation.archiveStatusLabel')}
          valueNode={
            <StatusPill tone={cloturee ? 'success' : 'error'}>
              {cloturee ? t('consultation.consultationClosed') : t('consultation.consultationCancelled')}
            </StatusPill>
          }
        />
        <InfoRow
          label={cloturee ? t('consultation.archiveClosedAtLabel') : t('consultation.archiveCancelledAtLabel')}
          value={consultation.closedAt ? formatDateTime(consultation.closedAt, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null}
        />
        {cloturee && (
          <InfoRow label={t('consultation.archiveDecisionLabel')} value={labelDecision(consultation.decisionMedicale)} />
        )}
        {!cloturee && (
          <InfoRow label={t('consultation.archiveCancelReasonLabel')} value={consultation.motifAnnulation} full />
        )}
        {consultation.conclusion && (
          <InfoRow label={t('consultation.conclusionTitle')} value={consultation.conclusion} full />
        )}
      </InfoSection>

      <InfoSection title={t('consultation.stepExamen')}>
        <InfoRow label={t('consultation.archiveTypeConsultationLabel')} value={consultation.typeConsultation?.libelle} full />
        <InfoRow label={t('consultation.examenClinicalLabel', { defaultValue: 'Examen clinique' })} value={consultation.examenClinique} full />
      </InfoSection>

      <DiagnosticsCard consultationId={consultationId} diagnostics={consultation.diagnostics} readonly />

      <OrdonnanceCard
        consultationId={consultationId}
        consultation={consultation}
        ordonnances={consultation.ordonnances}
        readonly
        onPreview={setPreviewOrdId}
      />
      <BonExamenCard
        consultationId={consultationId}
        readonly
        soignant={consultation.soignant}
        categorieLibelle={patient.categoriePatient.libelle}
        categorieCode={patient.categoriePatient.code}
      />
      <BonPharmacieCard
        consultationId={consultationId}
        readonly
        categorieCode={patient.categoriePatient.code}
        soignant={consultation.soignant}
        categorieLibelle={patient.categoriePatient.libelle}
      />
      <EvacuationCard
        consultationId={consultationId}
        readonly
        patient={{ identite: patient.identite, numeroPatient: patient.numeroPatient, categorieLibelle: patient.categoriePatient.libelle }}
        soignant={consultation.soignant}
      />
      <CertificatCard
        consultationId={consultationId}
        reposJours={consultation.reposJours ?? null}
        reposInclutJour={consultation.reposInclutJour ?? false}
        dateReprise={consultation.dateReprise ?? null}
        readonly
        onPrint={() => setPreviewRepos(true)}
      />

      {canDelete && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
          <Button
            variant="outline"
            leftIcon={<Trash2 size={13} />}
            onClick={() => setConfirmDel(true)}
            style={{ color: 'var(--erreur-texte)', borderColor: 'var(--erreur-bordure)' }}
          >
            {t('consultation.deletePermanently')}
          </Button>
        </div>
      )}

      {confirmDel && (
        <Modal
          icon={<Trash2 size={16} />}
          title={t('consultation.deleteConsultationTitle')}
          subtitle={t('consultation.deleteConsultationSubtitle')}
          width={480}
          onClose={() => setConfirmDel(false)}
          footer={<>
            <Button variant="outline" onClick={() => setConfirmDel(false)} disabled={deleteConsult.isPending}>{t('consultation.cancel')}</Button>
            <Button
              onClick={() => deleteConsult.mutate(undefined, { onSuccess: () => navigate('/consultations') })}
              disabled={deleteConsult.isPending}
              style={{ background: 'var(--erreur-accent)', color: '#fff', border: 'none', gap: 5 }}
            >
              <Trash2 size={14} /> {deleteConsult.isPending ? t('consultation.deleting') : t('consultation.delete')}
            </Button>
          </>}
        >
          <p style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--texte-secondaire)', lineHeight: 1.6 }}>
            {t('consultation.deleteConsultationBody')}
          </p>
          {impact.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {impact.map((line, i) => (
                <li key={i} style={{ fontSize: '13px', color: 'var(--erreur-texte)', fontWeight: 600 }}>{line}</li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {previewOrdId && (() => {
        const ord = consultation.ordonnances.find(o => o.id === previewOrdId)
        return ord ? <OrdonnancePrintModal consultation={consultation} ordonnance={ord} onClose={() => setPreviewOrdId(null)} variant="inline" /> : null
      })()}
      {previewRepos && (
        <CertificatReposPrintModal consultation={consultation} onClose={() => setPreviewRepos(false)} variant="inline" />
      )}
    </div>
  )
}
