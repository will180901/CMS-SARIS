/**
 * EvacuationPrintModal — fiche d'évacuation A4 imprimable, présentable à
 * l'établissement de référence qui accueille le patient.
 */
import { useTranslation } from 'react-i18next'
import { MedicalPrintSheet, PrintSection, PrintProse, PrintEmphasis, PrintCallout, type PrintPatient, type PrintSoignant } from '@/components/print/MedicalPrintSheet'
import type { Evacuation } from '../api/sorties.api'

const URGENCE_KEY: Record<Evacuation['niveauUrgence'], string> = {
  BASSE: 'urgenceBasse', MOYENNE: 'urgenceMoyenne', HAUTE: 'urgenceHaute', CRITIQUE: 'urgenceCritique',
}

interface Props {
  evacuation: Evacuation
  patient:    PrintPatient
  soignant?:  PrintSoignant | null
  onClose:    () => void
  variant?:   'modal' | 'inline'
}

export function EvacuationPrintModal({ evacuation, patient, soignant, onClose, variant }: Props) {
  const { t } = useTranslation()
  const numero = evacuation.id.slice(0, 8).toUpperCase()
  const urgent = evacuation.niveauUrgence === 'CRITIQUE' || evacuation.niveauUrgence === 'HAUTE'

  return (
    <MedicalPrintSheet
      rootId="evacuation-print-root"
      titre={t('sorties.printEvacTitre')}
      apercuLabel={t('sorties.printEvacApercu')}
      numero={numero}
      date={evacuation.createdAt}
      patient={patient}
      soignant={soignant}
      secondSignatureLabel={t('sorties.printEvacSecondSignature')}
      onClose={onClose}
      variant={variant}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 14 }}>
        <PrintSection titre={t('sorties.printNiveauUrgence')}>
          <PrintEmphasis danger={urgent}>{t(`sorties.${URGENCE_KEY[evacuation.niveauUrgence]}`)}</PrintEmphasis>
        </PrintSection>
        <PrintSection titre={t('sorties.printEtablissementDestination')}>
          <p style={{ margin: 0, fontSize: 11, color: '#1f2933', fontWeight: 600 }}>
            {evacuation.etablissement ? evacuation.etablissement.nom : t('sorties.printEtablissementAPreciser')}
          </p>
        </PrintSection>
      </div>

      <PrintSection titre={t('sorties.printInfosCliniques')}>
        <PrintProse>{evacuation.infosCliniques}</PrintProse>
      </PrintSection>

      <PrintCallout tone="danger">
        {t('sorties.printEvacCallout')}
      </PrintCallout>
    </MedicalPrintSheet>
  )
}
