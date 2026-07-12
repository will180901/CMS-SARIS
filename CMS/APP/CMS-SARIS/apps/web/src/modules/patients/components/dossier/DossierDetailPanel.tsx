/**
 * DossierDetailDrawer — tiroir de détail des onglets du dossier patient (Suivi,
 * Chronologie, Documents) : glisse de la droite PAR-DESSUS la liste et affiche
 * le document ciblé. AUCUNE navigation, aucune modale centrée.
 *
 *   - ORDONNANCE / BON_EXAMEN / BON_PHARMACIE / EVACUATION → aperçu A4
 *     (mêmes gabarits `*PrintModal` en variante `inline` que la consultation)
 *   - RESULTAT      → contenu du résultat + accès au bon d'examen A4
 *   - CONSULTATION  → résumé complet lecture seule (ConsultationArchiveSummary)
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X, Loader2, FlaskConical, FileText, Stethoscope, Pill, Receipt, Ambulance, ArrowUpRight, PenLine } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@workspace/ui/components/sheet'
import { InfoSection, InfoRow, StatusPill, Button } from '@/components/saris'
import { PreviewHostContext } from '@/components/print/MedicalPrintSheet'
import { useConsultation } from '@/modules/consultation/hooks/useConsultation'
import { ConsultationArchiveSummary } from '@/modules/consultation/components/ConsultationArchiveSummary'
import { OrdonnancePrintModal } from '@/modules/consultation/components/OrdonnancePrintModal'
import { useBonsExamen } from '@/modules/bon-examen/hooks/useBonExamen'
import { BonExamenCard } from '@/modules/bon-examen/components/BonExamenCard'
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
  | { kind: 'CONSULTATION';       consultationId: string }
  | { kind: 'ORDONNANCE';         consultationId: string; ordonnanceId: string }
  | { kind: 'BON_EXAMEN';         consultationId: string; bonId: string }
  | { kind: 'BON_PHARMACIE';      consultationId: string; bonId: string }
  | { kind: 'EVACUATION';         consultationId: string; evacuationId: string }
  | { kind: 'RESULTAT';           consultationId: string; bonId: string; resultat: SuiviResultatExamenItem }
  /** Saisie d'un résultat en attente — carte interactive du bon SANS passer par
   *  useConsultation() (qui applique la restriction confidentialité infirmier sur
   *  l'historique) : la liste des bons n'est, elle, pas restreinte, et la saisie
   *  du résultat est un acte propre gardé par sa propre permission (bon_examen.result). */
  | { kind: 'BON_EXAMEN_ACTION';  consultationId: string; bonId: string }

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
  CONSULTATION:      'patients.consultationViewerTitle',
  ORDONNANCE:        'patients.docOrdonnance',
  BON_EXAMEN:        'patients.docBonExamen',
  BON_PHARMACIE:     'patients.docBonPharmacie',
  EVACUATION:        'patients.docEvacuation',
  RESULTAT:          'patients.suiviResultatTitle',
  BON_EXAMEN_ACTION: 'patients.docBonExamen',
}

const KIND_ICON: Record<DossierDetailTarget['kind'], typeof FileText> = {
  CONSULTATION:      Stethoscope,
  ORDONNANCE:        Pill,
  BON_EXAMEN:        FlaskConical,
  BON_PHARMACIE:     Receipt,
  EVACUATION:        Ambulance,
  RESULTAT:          FlaskConical,
  BON_EXAMEN_ACTION: PenLine,
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
  return <p style={{ margin: '16px 20px', fontSize: 'var(--font-size-body-sm)', color: 'var(--erreur-texte)' }}>{t(msgKey)}</p>
}

// ── Corps par type de cible ────────────────────────────────────────────────────

function ConsultationBody({ consultationId, onBack }: { consultationId: string; onBack: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: consultation, isLoading } = useConsultation(consultationId)
  if (isLoading) return <Loading />
  if (!consultation) return <NotFound msgKey="patients.consultationViewerNotFound" />

  // Consultation encore OUVERTE : le résumé d'archive n'a pas de sens (il présume
  // clôturée/annulée) — on affiche l'essentiel + un lien vers l'espace de travail
  // actif (seul endroit où la saisie sur une consultation ouverte a lieu).
  if (consultation.statut === 'OUVERTE') {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
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
        <div style={{ marginTop: 12 }}>
          <Button
            variant="outline"
            leftIcon={<ArrowUpRight size={13} />}
            onClick={() => navigate('/consultations', { state: { openConsultationId: consultationId } })}
          >
            {t('patients.consultationOpenGoTo')}
          </Button>
        </div>
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

/**
 * Carte INTERACTIVE du bon (bouton « Ajouter résultat ») — volontairement SANS
 * useConsultation() : la liste des bons (useBonsExamen) n'est pas soumise à la
 * restriction confidentialité infirmier sur l'historique, et la saisie du
 * résultat est gardée par sa propre permission (bon_examen.result). C'est le
 * chemin direct depuis « Résultats en attente » du Suivi.
 */
function BonExamenActionBody({ consultationId }: { consultationId: string }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
      <BonExamenCard consultationId={consultationId} />
    </div>
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
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
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

// ── Tiroir principal (glisse de la droite, par-dessus la liste) ────────────────

export function DossierDetailDrawer({ target, onClose }: { target: DossierDetailTarget; onClose: () => void }) {
  const { t } = useTranslation()
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  // `open` piloté par un état : on le passe à false pour laisser Radix jouer le
  // slide-out, puis le parent démonte (onClose) une fois l'animation terminée.
  const [open, setOpen] = useState(true)
  const Icon = KIND_ICON[target.kind]
  const requestClose = () => { setOpen(false); window.setTimeout(onClose, 220) }

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) requestClose() }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        aria-describedby={undefined}
        style={{
          width: 860, maxWidth: '95vw', padding: 0, gap: 0,
          height: '100vh', maxHeight: '100vh',
          display: 'flex', flexDirection: 'column',
          background: 'var(--fond-surface)',
        }}
      >
        {/* En-tête */}
        <SheetHeader style={{
          position: 'relative', flexShrink: 0,
          padding: 'var(--espace-4) var(--espace-5)',
          borderBottom: '1px solid var(--bordure-legere)',
          display: 'flex', flexDirection: 'row', alignItems: 'center',
          gap: 'var(--espace-3)', textAlign: 'left',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 'var(--radius-lg)',
            background: 'var(--ap-50)', color: 'var(--ap-600)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon size={17} />
          </div>
          <SheetTitle style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 'var(--font-size-h4)', fontWeight: 700, color: 'var(--texte-primaire)', lineHeight: 1.25 }}>
            {t(TITLE_KEY[target.kind])}
          </SheetTitle>
          <button
            aria-label={t('common.close', { defaultValue: 'Fermer' })}
            onClick={requestClose}
            style={{
              background: 'transparent', border: 'none', padding: 6,
              borderRadius: 'var(--radius-md)', color: 'var(--texte-tertiaire)', cursor: 'pointer',
              transition: 'background 0.12s, color 0.12s', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--fond-surface-2)'; e.currentTarget.style.color = 'var(--texte-primaire)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--texte-tertiaire)' }}
          >
            <X size={16} />
          </button>
        </SheetHeader>

        {/* Corps — hôte positionné : les aperçus A4 `inline` le recouvrent */}
        <div ref={setHost} style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PreviewHostContext.Provider value={host}>
            {target.kind === 'CONSULTATION'  && <ConsultationBody consultationId={target.consultationId} onBack={requestClose} />}
            {target.kind === 'ORDONNANCE'    && <OrdonnanceBody consultationId={target.consultationId} ordonnanceId={target.ordonnanceId} onBack={requestClose} />}
            {target.kind === 'BON_EXAMEN'    && <BonExamenBody consultationId={target.consultationId} bonId={target.bonId} onBack={requestClose} />}
            {target.kind === 'BON_PHARMACIE' && <BonPharmacieBody consultationId={target.consultationId} bonId={target.bonId} onBack={requestClose} />}
            {target.kind === 'EVACUATION'    && <EvacuationBody consultationId={target.consultationId} evacuationId={target.evacuationId} onBack={requestClose} />}
            {target.kind === 'RESULTAT'      && <ResultatBody consultationId={target.consultationId} resultat={target.resultat} />}
            {target.kind === 'BON_EXAMEN_ACTION' && <BonExamenActionBody consultationId={target.consultationId} />}
          </PreviewHostContext.Provider>
        </div>
      </SheetContent>
    </Sheet>
  )
}
