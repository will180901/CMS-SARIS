/**
 * CertificatReposPrintModal — document A4 imprimable « Certificat médical de repos /
 * arrêt de travail ». Réutilise le gabarit unifié `MedicalPrintSheet` ; ne décrit que
 * le CORPS propre au repos (durée, date de reprise, diagnostics, recommandations).
 * La donnée vient de la consultation (reposJours / reposInclutJour / dateReprise).
 */
import { useTranslation } from 'react-i18next'
import {
  MedicalPrintSheet, PrintSection, PrintCallout,
  PRINT_ACCENT, PRINT_MUTED, PRINT_SOFT,
} from '@/components/print/MedicalPrintSheet'
import { formatDate } from '@/lib/intl'
import type { ConsultationDetail } from '@cms-saris/types'

interface Props {
  consultation: ConsultationDetail
  onClose:      () => void
  variant?:     'modal' | 'inline'
}

export function CertificatReposPrintModal({ consultation, onClose, variant }: Props) {
  const { t } = useTranslation()
  const p      = consultation.visite.patient
  const numero = consultation.id.slice(0, 8).toUpperCase()
  const jours  = consultation.reposJours ?? 0
  const reprise = consultation.dateReprise ? formatDate(consultation.dateReprise, { day: '2-digit', month: 'long', year: 'numeric' }) : null

  return (
    <MedicalPrintSheet
      rootId="certificat-repos-print-root"
      titre={t('consultation.certReposDocTitle')}
      apercuLabel={t('consultation.certReposPreviewLabel')}
      numero={numero}
      date={consultation.createdAt}
      patient={{ identite: p.identite, numeroPatient: p.numeroPatient, categorieLibelle: p.categoriePatient.libelle }}
      soignant={consultation.soignant}
      onClose={onClose}
      variant={variant}
    >
      {/* Diagnostics (motif médical du repos) */}
      {consultation.diagnostics.length > 0 && (
        <PrintSection titre={t('consultation.printDiagnostic')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {consultation.diagnostics.map(d => {
              const principal = d.type === 'PRINCIPAL'
              return (
                <span key={d.id} style={{
                  fontSize: 10, padding: '3px 10px', borderRadius: 9999,
                  background: principal ? PRINT_ACCENT : PRINT_SOFT,
                  color: principal ? '#fff' : '#234b58',
                  fontWeight: principal ? 700 : 600,
                  border: principal ? 'none' : '1px solid #cfe0e7',
                }}>
                  {d.pathologie.libelle}
                </span>
              )
            })}
          </div>
        </PrintSection>
      )}

      {/* Prescription de repos */}
      <PrintSection titre={t('consultation.certReposSectionTitle')}>
        <p style={{ margin: 0, fontSize: 11, lineHeight: 1.6, color: '#1f2937' }}>
          {t('consultation.certReposStatement', { count: jours })}
          {consultation.reposInclutJour && <span style={{ color: PRINT_MUTED }}> {t('consultation.certReposIncludeDayNote')}</span>}
        </p>
        {reprise && (
          <p style={{ margin: '8px 0 0', fontSize: 11, fontWeight: 700, color: PRINT_ACCENT }}>
            {t('consultation.certReposResumeOn', { date: reprise })}
          </p>
        )}
      </PrintSection>

      {/* Recommandations */}
      {consultation.conclusion && (
        <PrintCallout>
          <strong style={{ display: 'block', marginBottom: 3, color: PRINT_ACCENT, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 8.5 }}>
            {t('consultation.printRecommendations')}
          </strong>
          {consultation.conclusion}
        </PrintCallout>
      )}
    </MedicalPrintSheet>
  )
}
