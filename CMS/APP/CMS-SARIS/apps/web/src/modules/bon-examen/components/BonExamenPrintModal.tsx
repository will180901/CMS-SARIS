/**
 * BonExamenPrintModal — document A4 imprimable du bon d'examen, présentable au
 * laboratoire / centre d'imagerie partenaire de SARIS.
 */
import { useTranslation } from 'react-i18next'
import { MedicalPrintSheet, PrintSection, PrintProse, PrintTable, PrintCallout, type PrintSoignant } from '@/components/print/MedicalPrintSheet'
import { labelDomaine } from '@/config/labels'
import type { BonExamen } from '../api/bon-examen.api'

interface Props {
  bon:               BonExamen
  soignant?:         PrintSoignant | null
  categorieLibelle?: string
  onClose:           () => void
  variant?:          'modal' | 'inline'
}

export function BonExamenPrintModal({ bon, soignant, categorieLibelle, onClose, variant }: Props) {
  const { t } = useTranslation()
  const p = bon.consultation.visite.patient
  const numero = bon.id.slice(0, 8).toUpperCase()

  return (
    <MedicalPrintSheet
      rootId="bon-examen-print-root"
      titre={t('bonExamen.printTitle')}
      apercuLabel={t('bonExamen.printPreviewLabel')}
      numero={numero}
      date={bon.createdAt}
      patient={{ identite: p.identite, numeroPatient: p.numeroPatient, categorieLibelle }}
      soignant={soignant}
      secondSignatureLabel={t('bonExamen.printSecondSignature')}
      onClose={onClose}
      variant={variant}
    >
      <PrintSection titre={t('bonExamen.clinicalIndication')}>
        <PrintProse>{bon.indicationClinik}</PrintProse>
      </PrintSection>

      <PrintSection titre={t('bonExamen.examsRequested', { count: bon.lignes.length })}>
        <PrintTable
          columns={[
            { key: 'n', label: t('bonExamen.printColNumber'), width: 30, align: 'center' },
            { key: 'examen', label: t('bonExamen.printColExam') },
            { key: 'domaine', label: t('bonExamen.printColDomain') },
          ]}
          rows={bon.lignes.map((l, i) => ({
            n: i + 1,
            examen: <span style={{ fontWeight: 700 }}>{l.typeExamen.libelle}</span>,
            domaine: labelDomaine(l.typeExamen.domaine),
          }))}
        />
      </PrintSection>

      <PrintCallout>
        {t('bonExamen.printCallout')}
      </PrintCallout>
    </MedicalPrintSheet>
  )
}
