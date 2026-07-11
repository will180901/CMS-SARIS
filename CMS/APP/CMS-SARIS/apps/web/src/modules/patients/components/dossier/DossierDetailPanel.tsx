/**
 * DossierDetailPanel — « page » de détail INTERNE aux onglets du dossier patient
 * (Suivi, Chronologie, Documents) : remplace le contenu de l'onglet par le
 * document ciblé, avec bouton retour. AUCUNE modale, aucune redirection.
 *
 *   - ORDONNANCE / BON_EXAMEN / BON_PHARMACIE / EVACUATION → aperçu A4
 *     (mêmes gabarits `*PrintModal` en variante `inline` que la consultation)
 *   - RESULTAT      → contenu du résultat + accès au bon d'examen A4
 *   - CONSULTATION  → résumé complet lecture seule (ConsultationArchiveSummary)
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Loader2, FlaskConical, FileText, Stethoscope } from 'lucide-react'
import { InfoSection, InfoRow, StatusPill, Button } from '@/components/saris'
import { PreviewHostContext } from '@/components/print/MedicalPrintSheet'
import { useConsultation } from '@/modules/consultation/hooks/useConsultation'
import { ConsultationArchiveSummary } from '@/modules/consultation/components/ConsultationArchiveSummary'
import { OrdonnancePrintModal } from '@/modules/consultation/components/OrdonnancePrintModal'
import { useBonsExamen } from '@/modules/bon-examen/hooks/useBonExamen'
import { BonExamenPrintModal } from '@/modules/bon-examen/components/BonExamenPrintModal'
import { useBonsPharmacie } from '@/modules/bon-pharmacie/hooks/useBonPharmacie'
import { BonPharmaciePrintModal } from '@/modules/bon-pharmacie/components/BonPharmaciePrintModal'
import { useEvacuations } from '@/modules/sorties-critiques/hooks/useSorties'
import { EvacuationPrintModal } from '@/modules/sorties-critiques/components/EvacuationPrintModal'
import { formatDate, formatTime } from '@/lib/intl'
import { labelStatut } from '@/config/labels'
import type { SuiviResultatExamenItem } from '../../api/patients.api'

// ── Cible de la page détail ────────────────────────────────────────────────────

export type DossierDetailTarget =
  | { kind: 'CONSULTATION';  consultationId: string }
  | { kind: 'ORDONNANCE';    consultationId: string; ordonnanceId: string }
  | { kind: 'BON_EXAMEN';    consultationId: string; bonId: string }
  | { kind: 'BON_PHARMACIE'; consultationId: string; bonId: string }
  | { kind: 'EVACUATION';    consultationId: string; evacuationId: string }
  | { kind: 'RESULTAT';      consultationId: string; bonId: string; resultat: SuiviResultatExamenItem }

/** Cible détail pour un document du dossier (Chronologie, Documents). */
export function targetForDocument(
  type: 'ORDONNANCE' | 'BON_EXAMEN' | 'BON_PHARMACIE' | 'EVACUATION',
  id: string,
  consultationId: string,
): DossierDetailTarget {
  switch (type) {
    case 'ORDONNANCE':    return { kind: 'ORDONNANCE',    consultationId, ordonnanceId: id }
    case 'BON_EXAMEN':    return { kind: 'BON_EXAMEN',    consultationId, bonId: id }
    case 'BON_PHARMACIE': return { kind: 'BON_PHARMACIE', consultationId, bonId: id }
    case 'EVACUATION':    return { kind: 'EVACUATION',    consultationId, evacuationId: id }
  }
}

const TITLE_KEY: Record<DossierDetailTarget['kind'], string> = {
  CONSULTATION:  'patients.consultationViewerTitle',
  ORDONNANCE:    'patients.docOrdonnance',
  BON_EXAMEN:    'patients.docBonExamen',
  BON_PHARMACIE: 'patients.docBonPharmacie',
  EVACUATION:    'patients.docEvacuation',
  RESULTAT:      'patients.suiviResultatTitle',
}

// ── États partagés ─────────────────────────────────────────────────────────────

function Loading() {
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 8, color: 'var(--texte-tertiaire)' }}>
      <Loader2 size={16} className="animate-spin" />
      <span style={{ fontSize: 13 }}>{t('patients.loading')}</span>
    </div>
  )
}

function NotFound({ msgKey }: { msgKey: string }) {
  const { t } = useTranslation()
  return <p style={{ margin: '16px 4px', fontSize: 'var(--font-size-body-sm)', color: 'var(--erreur-texte)' }}>{t(msgKey)}</p>
}

// ── Corps par type de cible ────────────────────────────────────────────────────

function ConsultationBody({ consultationId, onBack }: { consultationId: string; onBack: () => void }) {
  const { t } = useTranslation()
  const { data: consultation, isLoading } = useConsultation(consultationId)
  if (isLoading) return <Loading />
  if (!consultation) return <NotFound msgKey="patients.consultationViewerNotFound" />

  // Consultation encore OUVERTE : le résumé d'archive n'a pas de sens (il présume
  // clôturée/annulée) — on affiche l'essentiel + une note explicative.
  if (consultation.statut === 'OUVERTE') {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 2px', maxWidth: 680 }}>
        <InfoSection title={t('patients.consultationViewerTitle')} icon={<Stethoscope size={14} />}>
          <InfoRow
            label={t('patients.sidebarStatus')}
            valueNode={<StatusPill tone="info">{t('patients.consultStatusOpen')}</StatusPill>}
          />
          <InfoRow
            label={t('patients.colDate')}
            value={`${formatDate(consultation.createdAt, { day: '2-digit', month: 'long', year: 'numeric' })} · ${formatTime(consultation.createdAt, { hour: '2-digit', minute: '2-digit' })}`}
          />
          {consultation.typeConsultation?.libelle && (
            <InfoRow label={t('consultation.archiveTypeConsultationLabel')} value={consultation.typeConsultation.libelle} />
          )}
          {consultation.soignant && (
            <InfoRow label={t('patients.caregiverLabel')} value={`${consultation.soignant.prenom} ${consultation.soignant.nom}`} />
          )}
        </InfoSection>
        <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--texte-tertiaire)', lineHeight: 1.6 }}>
          {t('patients.consultationOpenNotice')}
        </p>
      </div>
    )
  }

  return <ConsultationArchiveSummary consultationId={consultationId} consultation={consultation} onDeleted={onBack} />
}

function OrdonnanceBody({ consultationId, ordonnanceId, onBack }: { consultationId: string; ordonnanceId: string; onBack: () => void }) {
  const { data: consultation, isLoading } = useConsultation(consultationId)
  if (isLoading) return <Loading />
  const ordonnance = consultation?.ordonnances.find(o => o.id === ordonnanceId)
  if (!consultation || !ordonnance) return <NotFound msgKey="patients.docViewerNotFound" />
  return <OrdonnancePrintModal consultation={consultation} ordonnance={ordonnance} variant="inline" onClose={onBack} />
}

function BonExamenBody({ consultationId, bonId, onBack }: { consultationId: string; bonId: string; onBack: () => void }) {
  const { data: consultation, isLoading: loadC } = useConsultation(consultationId)
  const { data: bons = [], isLoading: loadB } = useBonsExamen({ consultationId })
  if (loadC || loadB) return <Loading />
  const bon = bons.find(b => b.id === bonId)
  if (!bon) return <NotFound msgKey="patients.docViewerNotFound" />
  return (
    <BonExamenPrintModal
      bon={bon}
      soignant={consultation?.soignant}
      categorieLibelle={consultation?.visite.patient.categoriePatient.libelle}
      variant="inline"
      onClose={onBack}
    />
  )
}

function BonPharmacieBody({ consultationId, bonId, onBack }: { consultationId: string; bonId: string; onBack: () => void }) {
  const { data: consultation, isLoading: loadC } = useConsultation(consultationId)
  const { data: bons = [], isLoading: loadB } = useBonsPharmacie({ consultationId })
  if (loadC || loadB) return <Loading />
  const bon = bons.find(b => b.id === bonId)
  if (!bon) return <NotFound msgKey="patients.docViewerNotFound" />
  return (
    <BonPharmaciePrintModal
      bon={bon}
      soignant={consultation?.soignant}
      categorieLibelle={consultation?.visite.patient.categoriePatient.libelle}
      variant="inline"
      onClose={onBack}
    />
  )
}

function EvacuationBody({ consultationId, evacuationId, onBack }: { consultationId: string; evacuationId: string; onBack: () => void }) {
  const { data: consultation, isLoading: loadC } = useConsultation(consultationId)
  const { data: evacuations = [], isLoading: loadE } = useEvacuations({ consultationId })
  if (loadC || loadE) return <Loading />
  const evacuation = evacuations.find(e => e.id === evacuationId)
  if (!consultation || !evacuation) return <NotFound msgKey="patients.docViewerNotFound" />
  const p = consultation.visite.patient
  return (
    <EvacuationPrintModal
      evacuation={evacuation}
      patient={{ identite: p.identite, numeroPatient: p.numeroPatient, categorieLibelle: p.categoriePatient.libelle }}
      soignant={consultation.soignant}
      variant="inline"
      onClose={onBack}
    />
  )
}

function ResultatBody({ consultationId, resultat }: { consultationId: string; resultat: SuiviResultatExamenItem }) {
  const { t } = useTranslation()
  const [showBon, setShowBon] = useState(false)

  if (showBon) return <BonExamenBody consultationId={consultationId} bonId={resultat.bonId} onBack={() => setShowBon(false)} />

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '4px 2px', maxWidth: 680 }}>
      <InfoSection title={t('patients.suiviResultatTitle')} icon={<FlaskConical size={14} />}>
        <InfoRow
          label={t('patients.colDate')}
          value={`${formatDate(resultat.date, { day: '2-digit', month: 'long', year: 'numeric' })} · ${formatTime(resultat.date, { hour: '2-digit', minute: '2-digit' })}`}
        />
        <InfoRow
          label={t('patients.sidebarStatus')}
          valueNode={<StatusPill tone="neutral">{labelStatut('resultat_examen', resultat.statut)}</StatusPill>}
        />
        {resultat.examens.length > 0 && (
          <InfoRow label={t('patients.suiviExamensRealises')} value={resultat.examens.join(', ')} full />
        )}
        {resultat.laboratoire && (
          <InfoRow label={t('patients.suiviLaboratoire')} value={resultat.laboratoire} />
        )}
        <InfoRow
          label={t('patients.suiviContenu')}
          valueNode={<span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{resultat.contenu}</span>}
          full
        />
        {resultat.interpretation && (
          <InfoRow
            label={t('patients.suiviInterpretation')}
            valueNode={<span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{resultat.interpretation}</span>}
            full
          />
        )}
      </InfoSection>
      <div style={{ marginTop: 12 }}>
        <Button variant="outline" leftIcon={<FileText size={13} />} onClick={() => setShowBon(true)}>
          {t('patients.suiviVoirBon')}
        </Button>
      </div>
    </div>
  )
}

// ── Panneau principal ──────────────────────────────────────────────────────────

export function DossierDetailPanel({ target, onBack }: { target: DossierDetailTarget; onBack: () => void }) {
  const { t } = useTranslation()
  const [host, setHost] = useState<HTMLDivElement | null>(null)

  return (
    <div style={{ height: '100%', minHeight: 620, display: 'flex', flexDirection: 'column' }}>
      {/* Barre retour */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
            color: 'var(--texte-secondaire)', background: 'var(--fond-surface)',
            border: '1px solid var(--bordure-normale)', borderRadius: 8,
            padding: '6px 12px', cursor: 'pointer',
          }}
        >
          <ArrowLeft size={14} /> {t('patients.detailBack')}
        </button>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--texte-primaire)' }}>{t(TITLE_KEY[target.kind])}</span>
      </div>

      {/* Zone de contenu — hôte positionné : les aperçus A4 `inline` la recouvrent */}
      <div ref={setHost} style={{ position: 'relative', flex: 1, minHeight: 480, display: 'flex', flexDirection: 'column' }}>
        <PreviewHostContext.Provider value={host}>
          {target.kind === 'CONSULTATION'  && <ConsultationBody consultationId={target.consultationId} onBack={onBack} />}
          {target.kind === 'ORDONNANCE'    && <OrdonnanceBody consultationId={target.consultationId} ordonnanceId={target.ordonnanceId} onBack={onBack} />}
          {target.kind === 'BON_EXAMEN'    && <BonExamenBody consultationId={target.consultationId} bonId={target.bonId} onBack={onBack} />}
          {target.kind === 'BON_PHARMACIE' && <BonPharmacieBody consultationId={target.consultationId} bonId={target.bonId} onBack={onBack} />}
          {target.kind === 'EVACUATION'    && <EvacuationBody consultationId={target.consultationId} evacuationId={target.evacuationId} onBack={onBack} />}
          {target.kind === 'RESULTAT'      && <ResultatBody consultationId={target.consultationId} resultat={target.resultat} />}
        </PreviewHostContext.Provider>
      </div>
    </div>
  )
}
