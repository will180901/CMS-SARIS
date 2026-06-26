/**
 * DossierPrintModal — export PDF « synthèse complète » du dossier patient.
 * Réutilise le gabarit A4 MedicalPrintSheet (impression @media print → PDF natif).
 * Contenu : alertes/allergies, antécédents, dernières constantes, consultations,
 * documents générés.
 */
import { useTranslation } from 'react-i18next'
import { MedicalPrintSheet, PrintSection, PRINT_ACCENT, PRINT_INK, PRINT_MUTED, PRINT_LINE } from '@/components/print/MedicalPrintSheet'
import { labelAlerteType, labelAntecedentType, labelGravite, labelStatut } from '@/config/labels'
import { usePatientConstantes } from '../../hooks/usePatients'
import { usePatientConsultations, usePatientDocuments } from '@/modules/consultation/hooks/useConsultation'
import { formatDate as intlFormatDate } from '@/lib/intl'
import type { PatientDossier } from '@cms-saris/types'
import type { PatientDocument } from '@/modules/consultation/api/consultation.api'

// `labelKey` = clé i18n (résolue dans le composant, jamais au niveau module).
const DOC_LABEL_KEY: Record<PatientDocument['type'], string> = {
  ORDONNANCE: 'patients.docOrdonnance', BON_EXAMEN: 'patients.docBonExamen', BON_PHARMACIE: 'patients.docBonPharmacie', EVACUATION: 'patients.docEvacuation',
}
// Famille de statut par type de document (pour traduire le statut en français).
const DOC_STATUT_FAMILY: Record<PatientDocument['type'], string> = {
  ORDONNANCE: 'ordonnance', BON_EXAMEN: 'bon_examen', BON_PHARMACIE: 'bon_pharmacie', EVACUATION: 'evacuation',
}

function fmt(iso: string) {
  return intlFormatDate(iso, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ── Styles partagés (corps imprimé, Arial hérité du gabarit) ────────────────────
const TH: React.CSSProperties = { textAlign: 'left', padding: '4px 6px', fontSize: '8.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: PRINT_ACCENT, borderBottom: `1.5px solid ${PRINT_ACCENT}` }
const TD: React.CSSProperties = { padding: '4px 6px', fontSize: '10px', color: PRINT_INK, borderBottom: `1px solid ${PRINT_LINE}`, verticalAlign: 'top' }
const EMPTY: React.CSSProperties = { fontSize: '10px', color: PRINT_MUTED, fontStyle: 'italic', margin: 0 }

export function DossierPrintModal({ dossier, onClose }: { dossier: PatientDossier; onClose: () => void }) {
  const { t } = useTranslation()
  const patientId = dossier.id
  const { data: constantes = [] } = usePatientConstantes(patientId)
  const { data: consultations = [] } = usePatientConsultations(patientId)
  const { data: documents = [] } = usePatientDocuments(patientId)

  const allergies   = dossier.allergies.filter(a => a.statut === 'ACTIVE')
  const alertes     = dossier.alertesMedicales.filter(a => a.statut === 'ACTIVE')
  const antecedents = dossier.antecedents.filter(a => a.statut === 'ACTIF')
  const last        = constantes[0]

  return (
    <MedicalPrintSheet
      rootId="dossier-print"
      titre={t('patients.printTitle')}
      apercuLabel={t('patients.printPreviewLabel')}
      numero={dossier.numeroPatient}
      date={new Date().toISOString()}
      patient={{
        identite: dossier.identite,
        numeroPatient: dossier.numeroPatient,
        categorieLibelle: dossier.categoriePatient?.libelle,
      }}
      soignant={null}
      secondSignatureLabel={t('patients.printSecondSignature')}
      onClose={onClose}
    >
      {/* Alertes & allergies */}
      <PrintSection titre={t('patients.printAllergiesSection')}>
        {allergies.length === 0 && alertes.length === 0 ? (
          <p style={EMPTY}>{t('patients.printNoAlertAllergy')}</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {alertes.map(a => (
                <tr key={a.id}>
                  <td style={{ ...TD, width: '32%', fontWeight: 700 }}>{labelAlerteType(a.type)}</td>
                  <td style={TD}>{a.message}</td>
                  <td style={{ ...TD, width: '18%', textAlign: 'right', fontWeight: 700 }}>{labelGravite(a.gravite)}</td>
                </tr>
              ))}
              {allergies.map(a => (
                <tr key={a.id}>
                  <td style={{ ...TD, width: '32%', fontWeight: 700 }}>{t('patients.printAllergy')}</td>
                  <td style={TD}>{a.substance}{a.confirme ? t('patients.printAllergyConfirmed') : t('patients.printAllergyToConfirm')}</td>
                  <td style={{ ...TD, width: '18%', textAlign: 'right', fontWeight: 700 }}>{labelGravite(a.gravite)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PrintSection>

      {/* Antécédents */}
      <PrintSection titre={t('patients.printAntecedentsSection')}>
        {antecedents.length === 0 ? (
          <p style={EMPTY}>{t('patients.printNoActiveAntecedent')}</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {antecedents.map(a => (
                <tr key={a.id}>
                  <td style={{ ...TD, width: '28%', fontWeight: 700 }}>{labelAntecedentType(a.type)}</td>
                  <td style={TD}>{a.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PrintSection>

      {/* Dernières constantes */}
      <PrintSection titre={last ? t('patients.printLastVitalsDated', { date: fmt(last.createdAt) }) : t('patients.printLastVitals')}>
        {!last ? (
          <p style={EMPTY}>{t('patients.printNoVitals')}</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={TH}>{t('patients.printColTemp')}</th><th style={TH}>{t('patients.printColTension')}</th><th style={TH}>{t('patients.printColFc')}</th>
              <th style={TH}>{t('patients.printColSpo2')}</th><th style={TH}>{t('patients.printColWeight')}</th><th style={TH}>{t('patients.printColHeight')}</th>
              <th style={TH}>{t('patients.printColImc')}</th><th style={TH}>{t('patients.printColGlycemie')}</th>
            </tr></thead>
            <tbody><tr>
              <td style={TD}>{last.temperature != null ? `${last.temperature}°C` : '—'}</td>
              <td style={TD}>{last.tensionSystolique != null ? `${last.tensionSystolique}/${last.tensionDiastolique ?? '—'}` : '—'}</td>
              <td style={TD}>{last.frequenceCardiaque ?? '—'}</td>
              <td style={TD}>{last.saturationO2 != null ? `${last.saturationO2}%` : '—'}</td>
              <td style={TD}>{last.poids != null ? `${last.poids} kg` : '—'}</td>
              <td style={TD}>{last.taille != null ? `${last.taille} cm` : '—'}</td>
              <td style={TD}>{last.imc ?? '—'}</td>
              <td style={TD}>{last.glycemie ?? '—'}</td>
            </tr></tbody>
          </table>
        )}
      </PrintSection>

      {/* Consultations */}
      <PrintSection titre={t('patients.printConsultationsSection', { count: consultations.length })}>
        {consultations.length === 0 ? (
          <p style={EMPTY}>{t('patients.printNoConsultation')}</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={{ ...TH, width: '18%' }}>{t('patients.printColDate')}</th>
              <th style={TH}>{t('patients.printColReason')}</th>
              <th style={{ ...TH, width: '22%' }}>{t('patients.printColStatus')}</th>
            </tr></thead>
            <tbody>
              {(consultations as any[]).map(c => (
                <tr key={c.id}>
                  <td style={TD}>{fmt(c.createdAt)}</td>
                  <td style={TD}>{c.visite?.motifPrincipal?.libelle ?? '—'}</td>
                  <td style={TD}>{labelStatut('consultation', String(c.statut))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PrintSection>

      {/* Documents */}
      <PrintSection titre={t('patients.printDocumentsSection', { count: documents.length })}>
        {documents.length === 0 ? (
          <p style={EMPTY}>{t('patients.printNoDocument')}</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={{ ...TH, width: '18%' }}>{t('patients.printColDate')}</th>
              <th style={{ ...TH, width: '28%' }}>{t('patients.printColType')}</th>
              <th style={TH}>{t('patients.printColDetail')}</th>
              <th style={{ ...TH, width: '16%' }}>{t('patients.printColStatus')}</th>
            </tr></thead>
            <tbody>
              {documents.map(d => (
                <tr key={`${d.type}-${d.id}`}>
                  <td style={TD}>{fmt(d.date)}</td>
                  <td style={TD}>{t(DOC_LABEL_KEY[d.type])}</td>
                  <td style={TD}>{d.details || d.motif || '—'}</td>
                  <td style={TD}>{labelStatut(DOC_STATUT_FAMILY[d.type], String(d.statut))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PrintSection>
    </MedicalPrintSheet>
  )
}
