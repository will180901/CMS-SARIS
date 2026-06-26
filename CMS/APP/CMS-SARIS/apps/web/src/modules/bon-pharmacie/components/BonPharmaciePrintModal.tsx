/**
 * BonPharmaciePrintModal — document A4 imprimable du bon de pharmacie (recueil),
 * présentable à la pharmacie interne pour le retrait gratuit des médicaments
 * (personnel CDI et ayants droit).
 */
import { useTranslation } from 'react-i18next'
import { MedicalPrintSheet, PrintSection, PrintProse, PrintTable, PrintCallout, type PrintSoignant } from '@/components/print/MedicalPrintSheet'
import type { BonPharmacie } from '../api/bon-pharmacie.api'

interface Props {
  bon:               BonPharmacie
  soignant?:         PrintSoignant | null
  categorieLibelle?: string
  onClose:           () => void
  variant?:          'modal' | 'inline'
}

export function BonPharmaciePrintModal({ bon, soignant, categorieLibelle, onClose, variant }: Props) {
  const { t } = useTranslation()
  const p = bon.consultation.visite.patient
  const numero = bon.id.slice(0, 8).toUpperCase()

  return (
    <MedicalPrintSheet
      rootId="bon-pharmacie-print-root"
      titre={t('bonPharmacie.printTitle', { defaultValue: 'Bon de pharmacie' })}
      apercuLabel={t('bonPharmacie.printPreviewLabel', { defaultValue: 'Aperçu du bon de pharmacie' })}
      numero={numero}
      date={bon.createdAt}
      patient={{ identite: p.identite, numeroPatient: p.numeroPatient, categorieLibelle }}
      soignant={soignant}
      secondSignatureLabel={t('bonPharmacie.printSecondSignature', { defaultValue: 'Pharmacie (délivrance)' })}
      onClose={onClose}
      variant={variant}
    >
      <PrintSection titre={t('bonPharmacie.printMedicaments', { defaultValue: 'Médicaments à délivrer' })}>
        <PrintTable
          columns={[
            { key: 'n', label: t('bonPharmacie.printColNumber', { defaultValue: 'N°' }), width: 30, align: 'center' },
            { key: 'medicament', label: t('bonPharmacie.printColMedicament', { defaultValue: 'Médicament' }) },
            { key: 'posologie', label: t('bonPharmacie.printColPosologie', { defaultValue: 'Posologie' }) },
            { key: 'quantite', label: t('bonPharmacie.printColQuantite', { defaultValue: 'Quantité' }), width: 80, align: 'center' },
          ]}
          rows={bon.lignes.map((l, i) => ({
            n: i + 1,
            medicament: <span style={{ fontWeight: 700 }}>{l.medicament?.nomGenerique ?? l.libelle}</span>,
            posologie: l.posologie ?? '—',
            quantite: l.quantite ?? '—',
          }))}
        />
      </PrintSection>

      {bon.observations && (
        <PrintSection titre={t('bonPharmacie.printObservations', { defaultValue: 'Observations' })}>
          <PrintProse>{bon.observations}</PrintProse>
        </PrintSection>
      )}

      <PrintCallout>
        {t('bonPharmacie.printCallout', { defaultValue: 'Médicaments pris en charge gratuitement — réservé au personnel CDI et à leurs ayants droit.' })}
      </PrintCallout>
    </MedicalPrintSheet>
  )
}
