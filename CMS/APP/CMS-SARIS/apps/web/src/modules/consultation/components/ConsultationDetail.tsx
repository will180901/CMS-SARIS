/**
 * ConsultationDetail — Panel principal de consultation
 * Tabs : Examen | Ordonnance | Décision
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Stethoscope, Pill, CheckCircle2, XCircle, AlertTriangle,
  Clock, Check, NotebookPen, MapPin,
  FileText, ChevronLeft, ChevronRight, Plus, X, ExternalLink,
} from 'lucide-react'
import { SegmentedTabs, Button } from '@/components/saris'
import { useIsCompact } from '@/hooks/useMediaQuery'
import { calcAge } from '@/lib/age'
import {
  useConsultation, useUpdateExamen, useUpdateAnamnese, useUpdateConclusion,
  useCloturer, useAnnulerConsultation, usePrendreEnCharge,
} from '../hooks/useConsultation'
import { useSessionStore } from '@/stores/session.store'
import { useMyActiveDelegation } from '@/modules/acteurs/hooks/useDelegations'
import { useCreateEvacuation } from '@/modules/sorties-critiques/hooks/useSorties'
import { useCreateSuiviTraitement } from '@/modules/suivi-traitement/hooks/useSuiviTraitement'
import { DiagnosticsCard } from './DiagnosticsCard'
import { OrdonnanceCard }  from './OrdonnanceCard'
import { OrdonnancePrintModal } from './OrdonnancePrintModal'
import { CertificatReposPrintModal } from './CertificatReposPrintModal'
import { PreviewHostContext } from '@/components/print/MedicalPrintSheet'
import { CertificatCard }  from './CertificatCard'
import { ConsultationArchiveSummary } from './ConsultationArchiveSummary'
import { TypeConsultationSelect } from './TypeConsultationSelect'
import { CategorieBadge }  from '@/modules/patients/components/CategorieBadge'
import { BonExamenCard }   from '@/modules/bon-examen/components/BonExamenCard'
import { BonPharmacieCard } from '@/modules/bon-pharmacie/components/BonPharmacieCard'
import { EvacuationCard }     from '@/modules/sorties-critiques/components/EvacuationCard'
import { SuiviTraitementCard } from '@/modules/suivi-traitement/components/SuiviTraitementCard'
import { FlaskConical, Ambulance, Activity, Loader2 } from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'
import { formatDuree, elapsedMinutes } from '@/lib/duree'
import { formatTime as intlFormatTime, formatDateTime } from '@/lib/intl'

// ── Décisions médicales ───────────────────────────────────────────────────────
// Réduites à EVACUATION/SUIVI_TRAITEMENT (refonte) : la voie normale d'une consultation
// est la clôture simple (pas besoin d'un choix explicite) ; prescription et examen
// complémentaire sont désormais couverts par le flux Ordonnance → Générer un bon.
// Sélectionnable ET désélectionnable (choix unique, jamais les deux en même temps).

const DECISIONS = [
  { value: 'EVACUATION',       labelKey: 'decisionEvacuation'      },
  { value: 'SUIVI_TRAITEMENT', labelKey: 'decisionSuiviTraitement' },
] as const

const DECISION_ICON: Record<string, React.ReactNode> = {
  EVACUATION:       <Ambulance size={16} />,
  SUIVI_TRAITEMENT: <Activity size={16} />,
}

// ── Onglets ───────────────────────────────────────────────────────────────────
// Indépendants de la décision médicale (Ordonnance/Bons toujours visibles, plus de
// présélection automatique) — seul le contenu des documents dépend encore de ce qui a
// été généré.

type DocView = 'ordonnance' | 'examens-c' | 'sorties' | 'suivi-traitement'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return intlFormatTime(iso, { hour: '2-digit', minute: '2-digit' })
}


// ── Stepper du parcours de consultation ───────────────────────────────────────

interface StepDef { n: 1 | 2 | 3; label: string; icon: React.ReactNode; done?: boolean; badge?: React.ReactNode }

function ConsultationStepper({ current, onStep, steps }: {
  current: 1 | 2 | 3
  onStep: (n: 1 | 2 | 3) => void
  steps: StepDef[]
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {steps.map((s, i) => {
        const active  = current === s.n
        const reached = current >= s.n
        return (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : '0 0 auto' }}>
            <button
              type="button"
              onClick={() => onStep(s.n)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <span style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: active ? 'var(--ap-500)' : s.done ? 'var(--succes-fond)' : 'var(--fond-surface-2)',
                color:      active ? '#fff' : s.done ? 'var(--succes-accent)' : 'var(--texte-tertiaire)',
                border:     active ? 'none' : `1px solid ${reached ? 'var(--ap-200)' : 'var(--bordure-legere)'}`,
                fontSize: '12px', fontWeight: 700, transition: 'all .15s',
              }}>
                {s.done && !active ? <Check size={14} /> : s.icon}
              </span>
              <span style={{
                fontSize: '13px', fontWeight: active ? 700 : 500, whiteSpace: 'nowrap',
                color: active ? 'var(--texte-primaire)' : reached ? 'var(--texte-secondaire)' : 'var(--texte-tertiaire)',
              }}>
                {s.label}
              </span>
              {s.badge != null && (
                <span style={{
                  minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9999,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: 700,
                  background: active ? 'var(--ap-50)' : 'var(--fond-surface)',
                  color: active ? 'var(--ap-700)' : 'var(--texte-tertiaire)',
                  border: '1px solid var(--bordure-legere)',
                }}>{s.badge}</span>
              )}
            </button>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, margin: '0 14px', borderRadius: 2, background: current > s.n ? 'var(--ap-300)' : 'var(--bordure-legere)', transition: 'background .15s' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

interface Props {
  consultationId: string
  /** Vue documents à ouvrir d'emblée (clic sur un document depuis le dossier). */
  initialDocView?: string | null
}

export function ConsultationDetail({ consultationId, initialDocView }: Props) {
  const { t } = useTranslation()
  const isCompact = useIsCompact()
  const [step, setStep]       = useState<1 | 2 | 3>(1)
  const [docView, setDocView] = useState<DocView>('ordonnance')
  const [previewOrdId, setPreviewOrdId] = useState<string | null>(null)   // aperçu ordonnance (monté hors Card, pleine zone)
  const [previewRepos, setPreviewRepos] = useState(false)                 // aperçu certificat de repos
  const [previewHost, setPreviewHost]   = useState<HTMLDivElement | null>(null)   // hôte de portalisation des aperçus (bon, sorties…)
  const [decision, setDecision] = useState('')   // remonté ici pour survivre aux changements d'étape
  const { has } = usePermissions()
  const myUserId = useSessionStore(s => s.user?.id ?? '')
  const myRoles  = useSessionStore(s => s.user?.roles ?? [])
  const prendre   = usePrendreEnCharge(consultationId)
  // Infirmier SANS délégation active : onglet Ordonnance en lecture seule (validées
  // uniquement). Un infirmier délégué garde les mêmes droits qu'un médecin.
  const { data: myDelegation } = useMyActiveDelegation()
  const infirmierNonDelegue = myRoles.includes('INFIRMIER')
    && !myRoles.includes('MEDECIN_CHEF') && !myRoles.includes('ADMIN_SYSTEME')
    && !myDelegation?.active

  /* Redimensionnement sidebar patient ↔ contenu (mêmes bornes que VisiteDetail) */
  const splitRef                    = useRef<HTMLDivElement>(null)
  const [sidebarWidth, setSWidth]   = useState(296)
  const [isResizing, setIsResizing] = useState(false)

  useEffect(() => {
    if (!isResizing) return
    function onMove(e: MouseEvent) {
      if (!splitRef.current) return
      const rect = splitRef.current.getBoundingClientRect()
      const w = e.clientX - rect.left
      setSWidth(Math.max(220, Math.min(420, w)))
    }
    function onUp() { setIsResizing(false) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',   onUp)
    document.body.style.cursor     = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup',   onUp)
      document.body.style.cursor     = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  // Permissions granulaires pour différencier les actions selon le rôle
  const canExamen     = has('consultation.examen')
  const canDiagnose   = has('consultation.diagnose')
  const canUpdate     = has('consultation.update')
  const canClose      = has('consultation.close')
  const canCancel     = has('consultation.cancel')
  const canOrdonnance = has('ordonnance.create')

  const { data: consultation, isLoading, error } = useConsultation(consultationId)

  // Réinitialise à l'ouverture d'une autre consultation.
  useEffect(() => { setStep(1); setDecision(''); setPreviewOrdId(null) }, [consultationId])

  // Consultation déjà décidée (rouverte) → réhydrate le choix (les onglets Documents sont
  // désormais indépendants de la décision, plus de présélection automatique).
  const decisionMed = consultation?.decisionMedicale
  useEffect(() => {
    if (decisionMed === 'EVACUATION' || decisionMed === 'SUIVI_TRAITEMENT') setDecision(decisionMed)
  }, [decisionMed])

  // Arriver depuis le dossier en cliquant un document précis : ouvrir d'emblée
  // l'étape Documents (step 2) sur la bonne vue (ordonnance / examens / sorties).
  // S'exécute après le reset par consultationId → gagne donc sur step=1.
  useEffect(() => {
    if (initialDocView === 'ordonnance' || initialDocView === 'examens-c' || initialDocView === 'sorties') {
      setStep(2)
      setDocView(initialDocView)
    }
  }, [consultationId, initialDocView])

  // ── Verrou souple : prise en charge ──────────────────────────────────────
  const priseEnCharge = consultation?.priseEnCharge ?? null
  const heldByOther   = !!priseEnCharge && priseEnCharge.userId !== myUserId
  const consOuverte   = consultation?.statut === 'OUVERTE'

  // Auto-prise-en-charge SILENCIEUSE si la consultation est libre (personne en main).
  useEffect(() => {
    if (canUpdate && consOuverte && !priseEnCharge && !prendre.isPending) prendre.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationId, consOuverte, priseEnCharge])

  /** Décision sélectionnable ET désélectionnable : recliquer la décision déjà active
   *  l'annule (choix unique, jamais les deux ensemble). */
  function handleDecisionPick(value: string) {
    setDecision(d => d === value ? '' : value)
  }

  /** Après génération d'une fiche (Évacuation/Suivi) : va voir le document généré. */
  function goToDocuments(view: DocView) {
    setStep(2)
    setDocView(view)
  }

  if (isLoading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--texte-tertiaire)', fontSize: '13px' }}>
        {t('consultation.loading')}
      </div>
    )
  }

  if (error || !consultation) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--erreur-texte)', fontSize: '13px' }}>
        {t('consultation.notFound')}
      </div>
    )
  }

  const { visite } = consultation
  const patient     = visite.patient
  const isActive    = consultation.statut === 'OUVERTE'

  // Compteurs pour les badges d'onglets — « savoir à quoi s'attendre ».
  const nbDiagnostics   = consultation.diagnostics.length
  const nbOrdonnances   = consultation.ordonnances.length
  const nbBonsExamen    = consultation._count.bonsExamen
  const nbBonsPharmacie = consultation._count.bonsPharmacie
  const evacActive      = !!consultation.evacuation && consultation.evacuation.statut !== 'ANNULE'
  const nbSorties       = (evacActive ? 1 : 0)
  const hasDecision     = !!consultation.decisionMedicale

  return (
    <div ref={splitRef} style={{ flex: 1, display: 'flex', flexDirection: isCompact ? 'column' : 'row', overflow: isCompact ? 'auto' : 'hidden', minWidth: 0, position: 'relative' }}>

      <style>{`
        .cons-resize:hover           { background: var(--ap-50) !important; }
        .cons-resize:hover > div     { background: var(--ap-400) !important; }
      `}</style>

      {/* `consultationId`/`canUpdate` retirés : ils ne servaient qu'au sélecteur de type,
          désormais à l'étape Examen. Le rail est redevenu purement consultatif. */}
      <PatientContextRail
        consultation={consultation}
        isActive={isActive}
        width={sidebarWidth}
      />

      {/* Poignée redimensionnement sidebar ↔ contenu — bureau uniquement */}
      {!isCompact && (
        <div
          onMouseDown={() => setIsResizing(true)}
          onDoubleClick={() => setSWidth(296)}
          title={t('consultation.resizeHint')}
          className="cons-resize"
          style={{
            width: 5,
            flexShrink: 0,
            cursor: 'col-resize',
            position: 'relative',
            background: isResizing ? 'var(--ap-50)' : 'transparent',
            transition: 'background 0.15s',
          }}
        >
          <div style={{
            position: 'absolute',
            left: 2, top: 0, bottom: 0,
            width: 1,
            background: isResizing ? 'var(--ap-400)' : 'var(--bordure-legere)',
            transition: 'background 0.15s',
          }} />
        </div>
      )}

      <div ref={setPreviewHost} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: isCompact ? 'visible' : 'hidden', minWidth: 0, position: 'relative' }}>
        <PreviewHostContext.Provider value={previewHost}>

      {!isActive ? (
        <ConsultationArchiveSummary consultationId={consultationId} consultation={consultation} />
      ) : (
      <>
      {/* ── Stepper du parcours (scroll horizontal si trop étroit) ────────── */}
      <div style={{
        flexShrink: 0, padding: '14px 20px',
        borderBottom: '1px solid var(--bordure-legere)', background: 'var(--fond-surface)',
        overflowX: isCompact ? 'auto' : undefined, scrollbarWidth: 'none',
      }}>
        <ConsultationStepper
          current={step}
          onStep={setStep}
          steps={[
            { n: 1, label: t('consultation.stepExamen'),    icon: <Stethoscope size={14} />,  done: nbDiagnostics > 0, badge: nbDiagnostics || undefined },
            { n: 2, label: t('consultation.stepDocuments'), icon: <FileText size={14} />,     badge: (nbOrdonnances + nbBonsExamen + nbSorties) || undefined },
            { n: 3, label: t('consultation.stepDecision'),  icon: <CheckCircle2 size={14} />, done: hasDecision },
          ]}
        />
      </div>

      {/* ── Contenu de l'étape ─────────────────────────────────────────────── */}
      <div className="cons-step" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Même piège que ConsultationArchiveSummary : sans flex-shrink:0, les cartes se
            compressent pour tenir dans la hauteur visible au lieu de déborder + défiler. */}
        <style>{`.cons-step > * { flex-shrink: 0; }`}</style>

        {/* Verrou souple : consultation déjà prise en main par un autre soignant */}
        {isActive && heldByOther && priseEnCharge && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 10,
            background: 'var(--avert-fond)', border: '1px solid var(--avert-bordure)',
          }}>
            <AlertTriangle size={16} style={{ color: 'var(--avert-accent)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--avert-texte)' }}>
                {t('consultation.heldByOther', { name: priseEnCharge.nom })}
              </p>
              <p style={{ margin: '1px 0 0', fontSize: '11px', color: 'var(--texte-secondaire)' }}>
                {priseEnCharge.at ? `${t('consultation.heldSince', { date: formatDateTime(priseEnCharge.at, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) })} ` : ''}{t('consultation.avoidSimultaneous')}
              </p>
            </div>
            <button
              onClick={() => prendre.mutate()}
              disabled={prendre.isPending}
              style={{
                flexShrink: 0, padding: '6px 12px', borderRadius: 8, fontSize: '12px', fontWeight: 600,
                background: 'var(--avert-accent)', color: '#fff', border: 'none', cursor: 'pointer',
              }}
            >
              {t('consultation.takeOver')}
            </button>
          </div>
        )}

        {/* ① Examen & diagnostic */}
        {step === 1 && (
          <>
            {/* Type de consultation — EN TÊTE de l'étape Examen : c'est le premier geste
                du médecin, qualifier l'acte qu'il commence. Il conditionne la clôture
                (cf. consultation.service : « type requis avant de clôturer ») — le placer
                ici évite de découvrir un champ obligatoire au moment de fermer. */}
            <div style={{
              padding: '10px 12px', borderRadius: 8,
              background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)',
            }}>
              <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--texte-tertiaire)', margin: '0 0 6px' }}>
                {t('consultation.railTypeConsultation', { defaultValue: 'Type de consultation' })}
              </p>
              <TypeConsultationSelect
                consultationId={consultationId}
                currentTypeId={consultation.typeConsultation?.id ?? null}
                readonly={!isActive || !canUpdate}
                categorieCode={patient.categoriePatient.code}
              />
              {!consultation.typeConsultation && isActive && canUpdate && (
                <p style={{ fontSize: '11px', color: 'var(--avert-texte)', margin: '6px 0 0' }}>
                  {t('consultation.typeRequisCloture', { defaultValue: 'Requis pour clôturer la consultation.' })}
                </p>
              )}
            </div>

            {visite.notesAccueil && (
              <div style={{
                padding: '10px 12px', borderRadius: 8,
                background: 'var(--fond-surface-2)', border: '1px solid var(--bordure-legere)',
              }}>
                <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--texte-tertiaire)', margin: '0 0 4px' }}>
                  {t('consultation.triageNotes')}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--texte-secondaire)', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {visite.notesAccueil}
                </p>
              </div>
            )}
            <AnamneseSection
              consultationId={consultationId}
              anamneseDateDebut={consultation.anamneseDateDebut ?? ''}
              anamneseDuree={consultation.anamneseDuree ?? ''}
              anamneseModeDebut={consultation.anamneseModeDebut ?? ''}
              anamneseSymptomes={consultation.anamneseSymptomes ?? ''}
              readonly={!isActive || !canExamen || heldByOther}
            />
            <ExamenSection
              consultationId={consultationId}
              examenClinique={consultation.examenClinique ?? ''}
              readonly={!isActive || !canExamen || heldByOther}
            />
            <DiagnosticsCard
              consultationId={consultationId}
              diagnostics={consultation.diagnostics}
              readonly={!isActive || !canDiagnose || heldByOther}
            />
          </>
        )}

        {/* ③ Décision médicale */}
        {step === 3 && (
          <>
            <DecisionSection
              consultationId={consultationId}
              consultation={consultation}
              isActive={isActive && !heldByOther}
              canClose={canClose}
              canCancel={canCancel}
              decision={decision}
              onPickDecision={handleDecisionPick}
              onGoToDocuments={goToDocuments}
            />
            <CertificatCard
              consultationId={consultationId}
              reposJours={consultation.reposJours ?? null}
              reposInclutJour={consultation.reposInclutJour ?? false}
              dateReprise={consultation.dateReprise ?? null}
              readonly={!isActive || heldByOther}
              canRepos={canUpdate}
              onPrint={() => setPreviewRepos(true)}
            />
          </>
        )}

        {/* ② Documents générés (ordonnance / bon d'examen / sorties critiques) */}
        {step === 2 && (
          <>
            <SegmentedTabs
              value={docView}
              onChange={k => setDocView(k as DocView)}
              tabs={[
                { key: 'ordonnance', label: t('consultation.tabPrescription'), icon: <Pill size={13} />,         badge: nbOrdonnances || undefined },
                { key: 'examens-c',  label: t('consultation.tabExamForm'),     icon: <FlaskConical size={13} />, badge: (nbBonsExamen + nbBonsPharmacie) || undefined },
                { key: 'sorties',    label: t('consultation.tabCriticalCases'), icon: <Ambulance size={13} />,   badge: nbSorties || undefined },
                { key: 'suivi-traitement', label: t('consultation.tabSuivi'),  icon: <Activity size={13} /> },
              ]}
            />

            {docView === 'ordonnance' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
                <OrdonnanceCard
                  consultationId={consultationId}
                  consultation={consultation}
                  ordonnances={consultation.ordonnances}
                  readonly={!isActive || !canOrdonnance || heldByOther}
                  restrictToValidatedReadOnly={infirmierNonDelegue}
                  onPreview={setPreviewOrdId}
                />
              </div>
            )}

            {docView === 'examens-c' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
                {/* Affichage pur : un bon naît exclusivement de « Générer un bon » sur une
                    ordonnance validée (onglet Ordonnance) — gérable tant que la consultation
                    est active, plus de dépendance à la clôture (ancien bug de régression). */}
                <BonExamenCard
                  consultationId={consultationId}
                  readonly={!isActive || heldByOther}
                  soignant={consultation.soignant}
                  categorieLibelle={patient.categoriePatient.libelle}
                  categoriePatientId={patient.categoriePatient.id}
                />
                <BonPharmacieCard
                  consultationId={consultationId}
                  readonly={!isActive || heldByOther}
                  categoriePatientId={patient.categoriePatient.id}
                  soignant={consultation.soignant}
                  categorieLibelle={patient.categoriePatient.libelle}
                />
              </div>
            )}

            {docView === 'sorties' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
                <EvacuationCard
                  consultationId={consultationId}
                  readonly={!isActive}
                  patient={{ identite: patient.identite, numeroPatient: patient.numeroPatient, categorieLibelle: patient.categoriePatient.libelle }}
                  soignant={consultation.soignant}
                />
              </div>
            )}

            {docView === 'suivi-traitement' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
                <SuiviTraitementCard
                  consultationId={consultationId}
                  readonly={!isActive}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Navigation entre étapes ────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, padding: '10px 20px',
        borderTop: '1px solid var(--bordure-legere)', background: 'var(--fond-surface)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <Button
          variant="secondary" size="sm"
          disabled={step === 1}
          leftIcon={<ChevronLeft size={14} />}
          onClick={() => setStep(s => (s > 1 ? (s - 1) as 1 | 2 | 3 : s))}
        >
          {t('consultation.previous')}
        </Button>
        {step < 3 ? (
          <Button
            variant="primary" size="sm"
            onClick={() => setStep(s => (s < 3 ? (s + 1) as 1 | 2 | 3 : s))}
          >
            {step === 1 ? t('consultation.toDocuments') : t('consultation.toDecision')}
            <ChevronRight size={14} style={{ marginLeft: 4 }} />
          </Button>
        ) : <span />}
      </div>

      {/* Aperçu document — monté HORS de la Card (dont le backdrop-filter créait un
          bloc conteneur trop petit) → couvre toute la zone de travail, pleine hauteur. */}
      {step === 2 && previewOrdId && (() => {
        const ord = consultation.ordonnances.find(o => o.id === previewOrdId)
        return ord
          ? <OrdonnancePrintModal consultation={consultation} ordonnance={ord} onClose={() => setPreviewOrdId(null)} variant="inline" />
          : null
      })()}
      {step === 2 && previewRepos && (
        <CertificatReposPrintModal consultation={consultation} onClose={() => setPreviewRepos(false)} variant="inline" />
      )}
      </>
      )}
        </PreviewHostContext.Provider>
      </div>
    </div>
  )
}

// ── Anamnèse structurée (recueil §3.2) ────────────────────────────────────────

function AnamneseSection({
  consultationId, anamneseDateDebut, anamneseDuree, anamneseModeDebut, anamneseSymptomes, readonly,
}: {
  consultationId: string
  anamneseDateDebut: string
  anamneseDuree: string
  anamneseModeDebut: string
  anamneseSymptomes: string
  readonly?: boolean
}) {
  const { t } = useTranslation()
  const updateAnamnese = useUpdateAnamnese(consultationId)
  const [dateDebut, setDateDebut] = useState(anamneseDateDebut.slice(0, 10))
  const [duree,     setDuree]     = useState(anamneseDuree)
  const [modeDebut, setModeDebut] = useState(anamneseModeDebut)
  const [symptomes, setSymptomes] = useState(anamneseSymptomes)
  const [saved, setSaved] = useState(true)

  useEffect(() => {
    setDateDebut(anamneseDateDebut.slice(0, 10)); setDuree(anamneseDuree)
    setModeDebut(anamneseModeDebut); setSymptomes(anamneseSymptomes)
    setSaved(true)
  }, [anamneseDateDebut, anamneseDuree, anamneseModeDebut, anamneseSymptomes])

  function flush() {
    if (readonly) return
    const dirty = dateDebut !== anamneseDateDebut.slice(0, 10) || duree !== anamneseDuree
      || modeDebut !== anamneseModeDebut || symptomes !== anamneseSymptomes
    if (!dirty) return
    setSaved(false)
    updateAnamnese.mutate({
      anamneseDateDebut: dateDebut || null,
      anamneseDuree:     duree.trim() || null,
      anamneseModeDebut: modeDebut.trim() || null,
      anamneseSymptomes: symptomes.trim() || null,
    }, { onSuccess: () => setSaved(true) })
  }

  const fld = { display: 'flex', flexDirection: 'column' as const, gap: 4 }
  const lbl = { fontSize: '11px', fontWeight: 600 as const, color: 'var(--texte-tertiaire)', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }
  const inp = { height: 34, padding: '0 10px', fontSize: '13px', borderRadius: 6, border: '1px solid var(--bordure-normale)', background: readonly ? 'var(--fond-surface-2)' : 'var(--fond-surface)', color: 'var(--texte-primaire)', outline: 'none' }

  return (
    <div style={{ background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)', borderRadius: '10px', overflow: 'hidden' }} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) flush() }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--bordure-legere)', background: 'var(--fond-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <NotebookPen size={13} style={{ color: 'var(--ap-600)' }} />
          <p style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--texte-tertiaire)', margin: 0 }}>
            {t('consultation.anamneseTitle')}
          </p>
        </div>
        {!readonly && (
          <span style={{ fontSize: '10px', color: saved ? 'var(--succes-texte)' : 'var(--texte-tertiaire)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            {saved && <Check size={11} />}{saved ? t('consultation.saved') : t('consultation.saving')}
          </span>
        )}
      </div>
      <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        <div style={fld}>
          <label style={lbl}>{t('consultation.anamneseDateDebut')}</label>
          <input type="date" value={dateDebut} disabled={readonly} onChange={e => setDateDebut(e.target.value)} style={inp} />
        </div>
        <div style={fld}>
          <label style={lbl}>{t('consultation.anamneseDuree')}</label>
          <input type="text" value={duree} disabled={readonly} maxLength={100} placeholder={t('consultation.anamneseDureePlaceholder')} onChange={e => setDuree(e.target.value)} style={inp} />
        </div>
        <div style={fld}>
          <label style={lbl}>{t('consultation.anamneseModeDebut')}</label>
          <input type="text" value={modeDebut} disabled={readonly} maxLength={200} placeholder={t('consultation.anamneseModeDebutPlaceholder')} onChange={e => setModeDebut(e.target.value)} style={inp} />
        </div>
        <div style={{ ...fld, gridColumn: '1 / -1' }}>
          <label style={lbl}>{t('consultation.anamneseSymptomes')}</label>
          <textarea value={symptomes} disabled={readonly} maxLength={2000} rows={2} placeholder={t('consultation.anamneseSymptomesPlaceholder')}
            onChange={e => setSymptomes(e.target.value)}
            style={{ ...inp, height: 'auto', padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit' }} />
        </div>
      </div>
    </div>
  )
}

// ── Examen clinique (auto-save) ───────────────────────────────────────────────

/** Découpe / recompose la liste d'observations (stockée en texte, 1 ligne = 1 puce). */
function splitLignes(s: string): string[] {
  return (s ?? '').split('\n').map(l => l.trim()).filter(Boolean)
}

function ExamenSection({ consultationId, examenClinique, readonly }: {
  consultationId: string
  examenClinique: string
  readonly?: boolean
}) {
  const { t } = useTranslation()
  const [items, setItems] = useState<string[]>(() => splitLignes(examenClinique))
  const [input, setInput] = useState('')
  const [saved, setSaved] = useState(true)
  const updateExamen      = useUpdateExamen(consultationId)

  // Sync si prop change (navigation entre consultations)
  useEffect(() => { setItems(splitLignes(examenClinique)); setSaved(true) }, [examenClinique])

  function persist(next: string[]) {
    setItems(next)
    setSaved(false)
    updateExamen.mutate(next.join('\n') || null, { onSuccess: () => setSaved(true) })
  }
  function ajouter() {
    const v = input.trim()
    if (!v) return
    persist([...items, v])
    setInput('')
  }
  function retirer(i: number) {
    persist(items.filter((_, idx) => idx !== i))
  }

  return (
    <div style={{
      background:   'var(--fond-surface)',
      border:       '1px solid var(--bordure-legere)',
      borderRadius: '10px',
      overflow:     'hidden',
    }}>
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--bordure-legere)',
        background:   'var(--fond-surface-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Stethoscope size={13} style={{ color: 'var(--ap-600)' }} />
          <p style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--texte-tertiaire)', margin: 0 }}>
            {t('consultation.clinicalExam')}
          </p>
        </div>
        {!readonly && (
          <span style={{ fontSize: '10px', color: saved ? 'var(--succes-texte)' : 'var(--texte-tertiaire)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            {saved && <Check size={11} />}{saved ? t('consultation.saved') : t('consultation.saving')}
          </span>
        )}
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Zone d'affichage (lecture seule, liste à puces) */}
        <div style={{
          minHeight: 72, borderRadius: 8,
          border: '1px solid var(--bordure-legere)', background: 'var(--fond-surface-2)',
          padding: items.length === 0 ? 0 : '8px 4px',
          display: 'flex', flexDirection: 'column',
          justifyContent: items.length === 0 ? 'center' : 'flex-start',
        }}>
          {items.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--texte-tertiaire)', fontStyle: 'italic', textAlign: 'center', margin: 0 }}>
              {readonly ? t('consultation.examEmptyReadonly') : t('consultation.examEmpty')}
            </p>
          ) : (
            items.map((it, i) => (
              <div
                key={i}
                style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '5px 10px' }}
                onMouseEnter={e => { const b = e.currentTarget.querySelector('button'); if (b) (b as HTMLElement).style.opacity = '1' }}
                onMouseLeave={e => { const b = e.currentTarget.querySelector('button'); if (b) (b as HTMLElement).style.opacity = '0' }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ap-500)', flexShrink: 0, marginTop: 7 }} />
                <span style={{ flex: 1, fontSize: '14px', lineHeight: 1.45, color: 'var(--texte-primaire)' }}>{it}</span>
                {!readonly && (
                  <button
                    onClick={() => retirer(i)}
                    title={t('consultation.remove')}
                    style={{
                      width: 22, height: 22, borderRadius: 4, flexShrink: 0, opacity: 0,
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--texte-tertiaire)', transition: 'opacity 0.12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--erreur-fond)'; e.currentTarget.style.color = 'var(--erreur-accent)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--texte-tertiaire)' }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Petit champ + bouton ➕ */}
        {!readonly && (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={input}
              maxLength={500}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); ajouter() } }}
              placeholder={t('consultation.examInputPlaceholder')}
              aria-label={t('consultation.examInputPlaceholder')}
              style={{
                flex: 1, minWidth: 0, height: 36, padding: '0 12px', fontSize: '13px',
                borderRadius: 8, boxSizing: 'border-box', outline: 'none',
                border: '1px solid var(--bordure-normale)',
                background: 'var(--fond-surface)', color: 'var(--texte-primaire)',
              }}
            />
            <button
              onClick={ajouter}
              disabled={!input.trim()}
              title={t('consultation.add')}
              style={{
                width: 36, height: 36, flexShrink: 0, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: !input.trim() ? 'var(--fond-surface-2)' : 'var(--ap-500)',
                color: !input.trim() ? 'var(--texte-tertiaire)' : '#fff',
                border: 'none', cursor: !input.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              <Plus size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Section décision médicale ─────────────────────────────────────────────────

function DecisionSection({ consultationId, consultation, isActive, canClose: canCloseRole, canCancel, decision, onPickDecision, onGoToDocuments }: {
  consultationId: string
  consultation: ReturnType<typeof useConsultation>['data'] & {}
  isActive: boolean
  canClose: boolean
  canCancel: boolean
  decision: string
  onPickDecision: (value: string) => void
  onGoToDocuments: (view: 'sorties' | 'suivi-traitement') => void
}) {
  const { t } = useTranslation()
  const isCompact = useIsCompact()
  const [conclusion,       setConclusion]        = useState<string>(consultation.conclusion ?? '')
  const [conclusionSaved,  setConclusionSaved]   = useState(true)
  const [cancelStep,       setCancelStep]        = useState(false)
  const [motifAnnul,       setMotifAnnul]        = useState('')
  const conclusionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cloturer         = useCloturer(consultationId)
  const annuler          = useAnnulerConsultation(consultationId)
  const updateConclusion = useUpdateConclusion(consultationId)

  // Sync si la consultation change
  useEffect(() => {
    if (conclusionTimer.current) { clearTimeout(conclusionTimer.current); conclusionTimer.current = null }
    setConclusion(consultation.conclusion ?? '')
    setConclusionSaved(true)
  }, [consultation.id])

  // Nettoyage du débounce au démontage (pas d'écriture tardive après navigation).
  useEffect(() => () => { if (conclusionTimer.current) clearTimeout(conclusionTimer.current) }, [])

  function handleConclusionChange(v: string) {
    setConclusion(v)
    setConclusionSaved(false)
    if (conclusionTimer.current) clearTimeout(conclusionTimer.current)
    conclusionTimer.current = setTimeout(() => {
      updateConclusion.mutate(v || null, { onSuccess: () => setConclusionSaved(true) })
    }, 1200)
  }

  // La fiche (évacuation/suivi) est désormais générée AVANT ce point, inline ci-dessous —
  // ces enregistrements enfants existent déjà quand ils sont requis par la décision choisie.
  const evacActive = !!consultation.evacuation && consultation.evacuation.statut !== 'ANNULE'
  const suiviActif = !!consultation.suiviTraitement && consultation.suiviTraitement.statut !== 'ANNULE'

  // Choix unique réel (pas juste un radio visuel) : le backend rejette déjà la création
  // croisée (409) — on bloque en plus le clic ici pour ne pas laisser l'utilisateur
  // remplir tout un formulaire avant de découvrir l'erreur.
  const blockedByOther: Record<string, boolean> = {
    EVACUATION:       suiviActif,
    SUIVI_TRAITEMENT: evacActive,
  }

  // Prérequis de clôture, anticipés AVANT le clic (alignés sur les gardes serveur).
  // Aucune décision (voie normale, cas dominant) : aucun prérequis documentaire supplémentaire.
  const blockers: string[] = []
  if (consultation.diagnostics.length === 0) blockers.push(t('consultation.blockerDiagnostic'))
  if (!consultation.typeConsultationId) blockers.push(t('consultation.blockerType'))
  if (decision === 'EVACUATION' && !evacActive) blockers.push(t('consultation.blockerDocument'))
  if (decision === 'SUIVI_TRAITEMENT' && !suiviActif) blockers.push(t('consultation.blockerDocument'))
  const canClose = isActive && blockers.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Décision médicale */}
      <div style={{
        background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)',
        borderRadius: 10, overflow: 'hidden',
      }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--bordure-legere)', background: 'var(--fond-surface-2)' }}>
          <p style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--texte-tertiaire)', margin: 0 }}>
            {t('consultation.medicalDecision')}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {DECISIONS.map((d, i) => {
            const active = decision === d.value
            const blocked = blockedByOther[d.value] ?? false
            const clickable = isActive && !blocked
            return (
              <div key={d.value} style={{ borderBottom: i < DECISIONS.length - 1 ? '1px solid var(--bordure-legere)' : 'none' }}>
                <button
                  onClick={() => onPickDecision(d.value)}
                  disabled={!clickable}
                  title={blocked ? t('consultation.decisionBlockedBySibling') : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 11,
                    padding: '11px 14px', fontSize: '13px', fontWeight: active ? 700 : 500,
                    cursor: clickable ? 'pointer' : 'not-allowed', textAlign: 'left', width: '100%',
                    opacity: clickable ? 1 : 0.6,
                    border: 'none', borderLeft: `3px solid ${active ? 'var(--ap-500)' : 'transparent'}`,
                    background: active ? 'var(--ap-50)' : 'transparent',
                    color: active ? 'var(--ap-700)' : 'var(--texte-secondaire)',
                    transition: 'background 0.12s, color 0.12s',
                  }}
                  onMouseEnter={e => { if (!active && clickable) e.currentTarget.style.background = 'var(--fond-surface-2)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ display: 'flex', flexShrink: 0, color: active ? 'var(--ap-600)' : 'var(--texte-tertiaire)' }}>
                    {DECISION_ICON[d.value]}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>{t(`consultation.${d.labelKey}`)}</span>
                  {active && <CheckCircle2 size={15} style={{ color: 'var(--ap-600)', flexShrink: 0 }} />}
                </button>
                {blocked && (
                  <p style={{ margin: '0 14px 10px', fontSize: '11px', color: 'var(--avert-texte)' }}>
                    {t('consultation.decisionBlockedBySibling')}
                  </p>
                )}
                {active && !blocked && d.value === 'EVACUATION' && (
                  <div style={{ padding: '0 14px 14px' }}>
                    <EvacuationInlineForm consultationId={consultationId} isActive={isActive} already={evacActive} onGenerated={() => onGoToDocuments('sorties')} />
                  </div>
                )}
                {active && !blocked && d.value === 'SUIVI_TRAITEMENT' && (
                  <div style={{ padding: '0 14px 14px' }}>
                    <SuiviInlineForm consultationId={consultationId} isActive={isActive} already={suiviActif} onGenerated={() => onGoToDocuments('suivi-traitement')} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Conclusion */}
      <div style={{
        background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)',
        borderRadius: 10, overflow: 'hidden',
      }}>
        <div style={{
          padding: '10px 14px', borderBottom: '1px solid var(--bordure-legere)',
          background: 'var(--fond-surface-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <p style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--texte-tertiaire)', margin: 0 }}>
            {t('consultation.conclusionTitle')}
          </p>
          <span style={{ fontSize: '10px', color: conclusionSaved ? 'var(--succes-texte)' : 'var(--texte-tertiaire)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            {conclusionSaved && <Check size={11} />}{conclusionSaved ? t('consultation.saved') : t('consultation.savingInProgress')}
          </span>
        </div>
        <div style={{ padding: '10px 14px' }}>
          <textarea
            value={conclusion}
            maxLength={5000}
            onChange={e => handleConclusionChange(e.target.value)}
            readOnly={!isActive}
            rows={4}
            placeholder={t('consultation.conclusionPlaceholder')}
            aria-label={t('consultation.conclusionPlaceholder')}
            style={{
              width: '100%', fontSize: '13px', lineHeight: '1.5',
              border: '1px solid var(--bordure-normale)', borderRadius: 6,
              padding: '8px 10px', resize: 'vertical', outline: 'none',
              background: isActive ? 'var(--fond-surface)' : 'var(--fond-surface-2)',
              color: 'var(--texte-primaire)', fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Prérequis manquants — anticipés avant la clôture (plus d'erreur subie) */}
      {decision && blockers.length > 0 && (
        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--avert-fond)', border: '1px solid var(--avert-bordure)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: 'var(--avert-texte)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={13} /> {t('consultation.beforeClosing')}
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {blockers.map((b, i) => <li key={i} style={{ fontSize: 12, color: 'var(--texte-secondaire)' }}>{b}</li>)}
          </ul>
        </div>
      )}

      {/* Actions — chaque bouton gardé par sa permission individuelle (close ≠ cancel) */}
      {(canCloseRole || canCancel) && (
      <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : (canCloseRole && canCancel ? '1fr 1fr' : '1fr'), gap: 10 }}>
        {/* Clôturer */}
        {canCloseRole && (
        <button
          onClick={() => cloturer.mutate({ decisionMedicale: decision || undefined, conclusion: conclusion || undefined })}
          disabled={!canClose || cloturer.isPending}
          style={{
            height: 44, borderRadius: 8, fontSize: '13px', fontWeight: '600',
            background: canClose ? 'var(--ap-500)' : 'var(--fond-surface-2)',
            color: canClose ? '#fff' : 'var(--texte-tertiaire)',
            border: `1.5px solid ${canClose ? 'var(--ap-500)' : 'var(--bordure-normale)'}`,
            cursor: !canClose ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <CheckCircle2 size={15} />
          {t('consultation.closeConsultation')}
        </button>
        )}

        {/* Annuler */}
        {canCancel && (
        <button
          onClick={() => setCancelStep(true)}
          disabled={annuler.isPending || !isActive}
          style={{
            height: 44, borderRadius: 8, fontSize: '13px', fontWeight: '500',
            background: 'var(--fond-surface)', color: 'var(--erreur-texte)',
            border: '1.5px solid var(--erreur-bordure)',
            cursor: isActive ? 'pointer' : 'not-allowed',
            opacity: isActive ? 1 : 0.6,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <XCircle size={15} />
          {t('consultation.cancelConsultation')}
        </button>
        )}
      </div>
      )}

      {/* Confirmation annulation */}
      {cancelStep && (
        <div style={{
          padding: '14px', borderRadius: 10,
          background: 'var(--erreur-fond)', border: '1px solid var(--erreur-bordure)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: 'var(--erreur-texte)' }}>
            {t('consultation.cancelReasonRequired')}
          </p>
          <textarea
            rows={2}
            maxLength={1000}
            value={motifAnnul}
            onChange={e => setMotifAnnul(e.target.value)}
            placeholder={t('consultation.cancelReasonPlaceholder')}
            aria-label={t('consultation.cancelReasonPlaceholder')}
            autoFocus
            style={{
              width: '100%', fontSize: '12px', borderRadius: 6,
              border: '1px solid var(--erreur-bordure)', padding: '6px 10px',
              background: 'var(--fond-surface)', color: 'var(--texte-primaire)',
              resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setCancelStep(false); setMotifAnnul('') }}
              style={{ padding: '5px 14px', borderRadius: 6, fontSize: '12px', background: 'var(--fond-surface)', color: 'var(--texte-secondaire)', border: '1px solid var(--bordure-normale)', cursor: 'pointer' }}
            >
              {t('consultation.goBack')}
            </button>
            <button
              onClick={() => annuler.mutate(motifAnnul)}
              disabled={!motifAnnul.trim() || annuler.isPending}
              style={{
                padding: '5px 14px', borderRadius: 6, fontSize: '12px', fontWeight: '600',
                background: 'var(--erreur-accent)', color: '#fff', border: 'none',
                cursor: !motifAnnul.trim() ? 'not-allowed' : 'pointer',
                opacity: !motifAnnul.trim() ? 0.5 : 1,
              }}
            >
              {t('consultation.confirmCancellation')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Fiche d'évacuation — capture inline depuis l'étape Décision ───────────────
// Remplace l'ancien CreateEvacuationDialog (EvacuationCard) : mêmes champs, même hook
// useCreateEvacuation, mais générée ici et non plus depuis l'onglet Évacuation (devenu
// affichage pur).

function EvacuationInlineForm({ consultationId, isActive, already, onGenerated }: {
  consultationId: string
  isActive: boolean
  already: boolean
  onGenerated: () => void
}) {
  const { t } = useTranslation()
  const isCompact = useIsCompact()
  const create = useCreateEvacuation()
  const [niveau, setNiveau] = useState<'BASSE' | 'MOYENNE' | 'HAUTE' | 'CRITIQUE'>('HAUTE')
  const [infos,  setInfos]  = useState('')
  const valid = infos.trim().length >= 10

  if (already) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--succes-fond)', color: 'var(--succes-texte)', fontSize: 12 }}>
        <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{t('consultation.evacGenerated')}</span>
        <button onClick={onGenerated} style={{ background: 'none', border: 'none', color: 'var(--succes-texte)', fontWeight: 700, fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
          {t('consultation.viewInDocuments')}
        </button>
      </div>
    )
  }
  if (!isActive) return null

  async function submit() {
    if (!valid) return
    await create.mutateAsync({ consultationId, niveauUrgence: niveau, infosCliniques: infos.trim() })
    onGenerated()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 8, border: '1px solid var(--ap-200)', background: 'var(--ap-50)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: isCompact ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 6 }}>
        {(['BASSE', 'MOYENNE', 'HAUTE', 'CRITIQUE'] as const).map(n => {
          const active = niveau === n
          const colors = {
            BASSE:    { bg: 'var(--fond-surface-2)', text: 'var(--texte-secondaire)' },
            MOYENNE:  { bg: 'var(--info-fond)',      text: 'var(--info-texte)'       },
            HAUTE:    { bg: 'var(--avert-fond)',     text: 'var(--avert-texte)'      },
            CRITIQUE: { bg: 'var(--erreur-fond)',    text: 'var(--erreur-texte)'     },
          }[n]
          return (
            <button
              key={n} type="button" onClick={() => setNiveau(n)}
              style={{
                padding: '8px', borderRadius: 6, border: `1.5px solid ${active ? colors.text : 'var(--bordure-normale)'}`,
                background: active ? colors.bg : 'var(--fond-surface)', color: active ? colors.text : 'var(--texte-secondaire)',
                fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer',
              }}
            >
              {t(`sorties.urgence${n.charAt(0)}${n.slice(1).toLowerCase()}`)}
            </button>
          )
        })}
      </div>
      <textarea
        value={infos}
        maxLength={5000}
        rows={3}
        onChange={e => setInfos(e.target.value)}
        placeholder={t('sorties.createEvacInfosPlaceholder')}
        aria-label={t('sorties.fieldInfosCliniques')}
        style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, boxSizing: 'border-box', outline: 'none', border: '1px solid var(--bordure-normale)', background: 'var(--fond-surface)', color: 'var(--texte-primaire)', resize: 'vertical', fontFamily: 'inherit' }}
      />
      <button
        onClick={submit} disabled={!valid || create.isPending}
        style={{
          alignSelf: 'flex-end', height: 34, padding: '0 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: valid ? 'var(--erreur-accent)' : 'var(--fond-surface-2)', color: valid ? '#fff' : 'var(--texte-tertiaire)',
          border: 'none', cursor: valid ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        {create.isPending ? <Loader2 size={14} className="animate-spin" /> : <Ambulance size={14} />}
        {t('consultation.genererFiche')}
      </button>
    </div>
  )
}

// ── Suivi de traitement — capture inline depuis l'étape Décision ──────────────
// Remplace l'ancien CreateSuiviDialog (SuiviTraitementCard).

function SuiviInlineForm({ consultationId, isActive, already, onGenerated }: {
  consultationId: string
  isActive: boolean
  already: boolean
  onGenerated: () => void
}) {
  const { t } = useTranslation()
  const create = useCreateSuiviTraitement()
  const [motif, setMotif] = useState('')
  const valid = motif.trim().length >= 5

  if (already) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--succes-fond)', color: 'var(--succes-texte)', fontSize: 12 }}>
        <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{t('consultation.suiviGenerated')}</span>
        <button onClick={onGenerated} style={{ background: 'none', border: 'none', color: 'var(--succes-texte)', fontWeight: 700, fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
          {t('consultation.viewInDocuments')}
        </button>
      </div>
    )
  }
  if (!isActive) return null

  async function submit() {
    if (!valid) return
    await create.mutateAsync({ consultationId, motif: motif.trim() })
    onGenerated()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 8, border: '1px solid var(--ap-200)', background: 'var(--ap-50)' }}>
      <textarea
        value={motif}
        maxLength={500}
        rows={3}
        onChange={e => setMotif(e.target.value)}
        placeholder={t('suiviTraitement.createMotifPlaceholder')}
        aria-label={t('suiviTraitement.fieldMotifSuivi')}
        style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, boxSizing: 'border-box', outline: 'none', border: '1px solid var(--bordure-normale)', background: 'var(--fond-surface)', color: 'var(--texte-primaire)', resize: 'vertical', fontFamily: 'inherit' }}
      />
      <button
        onClick={submit} disabled={!valid || create.isPending}
        style={{
          alignSelf: 'flex-end', height: 34, padding: '0 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: valid ? 'var(--ap-500)' : 'var(--fond-surface-2)', color: valid ? '#fff' : 'var(--texte-tertiaire)',
          border: 'none', cursor: valid ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        {create.isPending ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
        {t('consultation.genererFiche')}
      </button>
    </div>
  )
}

// ── Rail patient permanent (cockpit) ──────────────────────────────────────────

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--bordure-legere)' }}>
      <p style={{ margin: '0 0 8px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--texte-tertiaire)' }}>{title}</p>
      {children}
    </div>
  )
}

function RailVital({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)' }}>{label}</span>
      <span style={{ fontSize: '12px', fontWeight: 600, color: warn ? 'var(--erreur-accent)' : 'var(--texte-primaire)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

function PatientContextRail({ consultation, isActive, width }: {
  consultation: ReturnType<typeof useConsultation>['data'] & {}
  isActive: boolean
  width: number
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isCompact = useIsCompact()
  const { visite } = consultation
  const patient   = visite.patient
  const identite  = patient.identite
  const latest    = visite.constantes[0] ?? null
  const sevAllergies = patient.allergies.filter(a => a.gravite === 'SEVERE')
  const critAlertes  = patient.alertesMedicales.filter(a => a.gravite === 'CRITIQUE')
  const hasCritical  = sevAllergies.length > 0 || critAlertes.length > 0

  return (
    <aside style={{
      width: isCompact ? '100%' : width, flexShrink: 0, height: isCompact ? 'auto' : '100%',
      overflowY: isCompact ? 'visible' : 'auto',
      borderRight: isCompact ? 'none' : '1px solid var(--bordure-legere)',
      borderBottom: isCompact ? '1px solid var(--bordure-legere)' : 'none',
      background: 'var(--fond-surface)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Identité */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--bordure-legere)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 9 }}>
        <div style={{ width: 58, height: 58, borderRadius: 16, background: 'var(--ap-100)', border: '2px solid var(--ap-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '19px', fontWeight: 800, color: 'var(--ap-600)' }}>
          {identite ? ((identite.prenom.charAt(0) + identite.nom.charAt(0)).toUpperCase() || '??') : '??'}
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--texte-primaire)', lineHeight: 1.25 }}>
            {identite ? `${identite.prenom} ${identite.nom}` : t('consultation.unknownPatient')}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--texte-tertiaire)' }}>
            <span style={{ fontFamily: 'monospace' }}>{patient.numeroPatient}</span>
            {identite && <> · {identite.sexe === 'M' ? t('consultation.sexM') : identite.sexe === 'F' ? t('consultation.sexF') : '—'}{identite.dateNaissance && <> · {t('consultation.ageYears', { age: calcAge(identite.dateNaissance) })}</>}</>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          <CategorieBadge code={patient.categoriePatient.code} libelle={patient.categoriePatient.libelle} size="sm" />
          <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 9px', borderRadius: 9999,
            background: isActive ? 'var(--ap-100)' : 'var(--fond-surface-2)', color: isActive ? 'var(--ap-700)' : 'var(--texte-tertiaire)', border: `1px solid ${isActive ? 'var(--ap-200)' : 'var(--bordure-normale)'}` }}>
            {consultation.statut === 'OUVERTE' ? t('consultation.statusOpen') : consultation.statut === 'CLOTUREE' ? t('consultation.statusClosed') : t('consultation.statusCancelled')}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '11px', color: elapsedMinutes(visite.dateOuverture) > 45 ? '#dc2626' : 'var(--texte-tertiaire)' }}>
          <Clock size={11} /> {formatTime(visite.dateOuverture)} · {formatDuree(visite.dateOuverture)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '11px', color: 'var(--texte-tertiaire)' }}>
          <MapPin size={11} /> {t('consultation.railSite', { site: visite.site.libelle })}
        </div>
      </div>

      {/* Alertes critiques */}
      {hasCritical && (
        <div style={{ padding: '10px 14px', background: 'var(--erreur-fond)', borderBottom: '1px solid var(--erreur-bordure)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <AlertTriangle size={13} style={{ color: 'var(--erreur-accent)' }} />
            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--erreur-texte)' }}>{t('consultation.criticalInfo')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sevAllergies.map(a => <span key={a.id} style={{ fontSize: '12px', fontWeight: 600, color: 'var(--erreur-texte)' }}>⚠ {t('consultation.severeAllergy', { substance: a.substance })}</span>)}
            {critAlertes.map(a => <span key={a.id} style={{ fontSize: '12px', fontWeight: 600, color: 'var(--erreur-texte)' }}>⚠ {a.message}</span>)}
          </div>
        </div>
      )}

      {/* Motif de venue — information d'ACCUEIL, pas une décision : le rail se lit, il ne
          se remplit pas. Le type de consultation, lui, a rejoint l'étape Examen (zone de
          droite), là où le médecin qualifie l'acte qu'il réalise. Les garder ensemble dans
          un bloc « Motif & type » collait une donnée figée à un champ à saisir, et les
          deux affichaient souvent le même libellé — d'où la confusion. */}
      <RailSection title={t('consultation.railMotif', { defaultValue: 'Motif de venue' })}>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--texte-primaire)', fontWeight: 500 }}>{visite.motifPrincipal.libelle}</p>
        <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--texte-tertiaire)' }}>
          {t('consultation.motifDepuisTriage', { defaultValue: 'Saisi au triage' })}
        </p>
      </RailSection>

      {/* Notes d'accueil */}
      {visite.notesAccueil && (
        <RailSection title={t('consultation.railNotesAccueil')}>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--texte-secondaire)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{visite.notesAccueil}</p>
        </RailSection>
      )}

      {/* Constantes + signes généraux */}
      {latest && (
        <RailSection title={t('consultation.railConstantes')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {latest.temperature != null && <RailVital label={t('consultation.vitalTemperature')} value={`${latest.temperature} °C`} warn={latest.temperature > 38.5} />}
            {latest.tensionSystolique != null && <RailVital label={t('consultation.vitalTension')} value={`${latest.tensionSystolique}/${latest.tensionDiastolique ?? '—'} mmHg`} warn={(latest.tensionSystolique ?? 0) > 140} />}
            {latest.frequenceCardiaque != null && <RailVital label={t('consultation.vitalFreqCard')} value={`${latest.frequenceCardiaque} bpm`} warn={latest.frequenceCardiaque > 100} />}
            {latest.saturationO2 != null && <RailVital label={t('consultation.vitalSpo2')} value={`${latest.saturationO2} %`} warn={latest.saturationO2 < 95} />}
            {latest.imc != null && <RailVital label={t('consultation.vitalImc')} value={`${latest.imc}`} />}
            {latest.glycemie != null && <RailVital label={t('consultation.vitalGlycemie')} value={`${latest.glycemie} g/L`} />}
            {latest.scoreGlasgow != null && <RailVital label={t('consultation.vitalGlasgow')} value={`${latest.scoreGlasgow}/15`} />}
            {latest.etatConscience && <RailVital label={t('consultation.vitalConscience')} value={latest.etatConscience} />}
            {latest.etatGeneral && <RailVital label={t('consultation.vitalEtatGeneral')} value={latest.etatGeneral} />}
            {latest.hydratation && <RailVital label={t('consultation.vitalHydratation')} value={latest.hydratation} />}
            {latest.coloration && <RailVital label={t('consultation.vitalColoration')} value={latest.coloration} />}
          </div>
        </RailSection>
      )}

      {/* Accès au dossier complet du patient — cohérent avec le triage (VisiteSidebar) */}
      <div style={{ marginTop: 'auto', padding: '12px 14px', borderTop: '1px solid var(--bordure-legere)' }}>
        <button
          onClick={() => navigate(`/patients/${patient.id}`)}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: '12px', fontWeight: 500,
            color: 'var(--texte-secondaire)', border: '1px solid var(--bordure-normale)',
            background: 'var(--fond-surface)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--fond-surface-2)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--fond-surface)' }}
        >
          {t('triage.voirDossierComplet')}
          <ExternalLink size={12} />
        </button>
      </div>
    </aside>
  )
}
