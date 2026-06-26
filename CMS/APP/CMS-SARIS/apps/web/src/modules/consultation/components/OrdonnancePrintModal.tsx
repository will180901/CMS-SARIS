/**
 * OrdonnancePrintModal — aperçu + impression de l'ordonnance.
 * Utilise le gabarit A4 unifié `MedicalPrintSheet` (en-tête logo, identité,
 * signatures, pied) ; ce fichier ne décrit que le CORPS propre à l'ordonnance :
 * diagnostics, tableau des médicaments, recommandations de sortie.
 */
import { useTranslation } from 'react-i18next'
import {
  MedicalPrintSheet, PrintSection, PrintTable, PrintCallout,
  PRINT_ACCENT, PRINT_MUTED, PRINT_SOFT,
} from '@/components/print/MedicalPrintSheet'
import type { ConsultationDetail, OrdonnanceDetail } from '@cms-saris/types'

interface Props {
  consultation: ConsultationDetail
  ordonnance:   OrdonnanceDetail
  onClose:      () => void
  variant?:     'modal' | 'inline'
}

export function OrdonnancePrintModal({ consultation, ordonnance, onClose, variant }: Props) {
  const { t } = useTranslation()
  const p       = consultation.visite.patient
  const numero  = ordonnance.id.slice(0, 8).toUpperCase()

  return (
    <MedicalPrintSheet
      rootId="ordonnance-print-root"
      titre={t('consultation.printTitle')}
      apercuLabel={t('consultation.printPreviewLabel')}
      numero={numero}
      date={ordonnance.createdAt}
      patient={{ identite: p.identite, numeroPatient: p.numeroPatient, categorieLibelle: p.categoriePatient.libelle }}
      soignant={consultation.soignant}
      secondSignatureLabel={t('consultation.printPharmacyDelivery')}
      onClose={onClose}
      variant={variant}
    >
      {/* Diagnostics */}
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
                  border: principal ? 'none' : `1px solid #cfe0e7`,
                }}>
                  {d.pathologie.libelle}
                </span>
              )
            })}
          </div>
        </PrintSection>
      )}

      {/* Prescription */}
      <PrintSection titre={ordonnance.lignes.length
        ? t('consultation.printPrescriptionCount', { count: ordonnance.lignes.length })
        : t('consultation.printPrescription')}>
        {ordonnance.lignes.length === 0 ? (
          <p style={{ margin: 0, fontStyle: 'italic', color: PRINT_MUTED, fontSize: 10.5 }}>{t('consultation.printNoMedication')}</p>
        ) : (
          <PrintTable
            columns={[
              { key: 'n', label: '#', width: 28, align: 'center' },
              { key: 'med', label: t('consultation.colMedication') },
              { key: 'poso', label: t('consultation.colDosage') },
              { key: 'duree', label: t('consultation.colDuration') },
              { key: 'voie', label: t('consultation.colRoute') },
            ]}
            rows={ordonnance.lignes.map((l, i) => ({
              n: <span style={{ fontWeight: 700, color: PRINT_ACCENT }}>{i + 1}</span>,
              med: (
                <div>
                  <span style={{ fontWeight: 700 }}>{l.medicament.nomGenerique}</span>
                  {l.medicament.nomCommercial && <span style={{ color: PRINT_MUTED, fontStyle: 'italic' }}> ({l.medicament.nomCommercial})</span>}
                  {l.instructions && <div style={{ color: '#374151', fontStyle: 'italic', fontSize: 9.5, marginTop: 2 }}>{l.instructions}</div>}
                </div>
              ),
              poso: l.posologie,
              duree: l.duree,
              voie: <span style={{ whiteSpace: 'nowrap' }}>{l.voieAdmin}</span>,
            }))}
          />
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
