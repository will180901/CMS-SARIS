/**
 * ConsultationDetail — Panel principal de consultation
 * Tabs : Examen | Ordonnance | Décision
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Stethoscope, Pill, CheckCircle2, XCircle, AlertTriangle,
  Clock, Check,
  FileText, ChevronLeft, ChevronRight, Plus, X, Trash2, ExternalLink,
} from 'lucide-react'
import { SegmentedTabs, Button, Modal } from '@/components/saris'
import { useIsCompact } from '@/hooks/useMediaQuery'
import { calcAge } from '@/lib/age'
import {
  useConsultation, useUpdateExamen, useUpdateConclusion,
  useCloturer, useAnnulerConsultation, useDeleteConsultation, usePrendreEnCharge,
} from '../hooks/useConsultation'
import { useSessionStore } from '@/stores/session.store'
import { DiagnosticsCard } from './DiagnosticsCard'
import { OrdonnanceCard }  from './OrdonnanceCard'
import { OrdonnancePrintModal } from './OrdonnancePrintModal'
import { CertificatReposPrintModal } from './CertificatReposPrintModal'
import { PreviewHostContext } from '@/components/print/MedicalPrintSheet'
import { CertificatCard }  from './CertificatCard'
import { TypeConsultationSelect } from './TypeConsultationSelect'
import { CategorieBadge }  from '@/modules/patients/components/CategorieBadge'
import { BonExamenCard }   from '@/modules/bon-examen/components/BonExamenCard'
import { BonPharmacieCard } from '@/modules/bon-pharmacie/components/BonPharmacieCard'
import { EvacuationCard }     from '@/modules/sorties-critiques/components/EvacuationCard'
import { FlaskConical, Ambulance } from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'
import { formatDuree, elapsedMinutes } from '@/lib/duree'
import { labelDecision } from '@/config/labels'
import { formatTime as intlFormatTime, formatDateTime } from '@/lib/intl'

// ── Décisions médicales ───────────────────────────────────────────────────────

// Mono + accent teal (SARIS) : les ICÔNES distinguent les décisions, pas la couleur.
const DECISIONS = [
  { value: 'CLOTURE_SIMPLE',         labelKey: 'decisionClotureSimple'        },
  { value: 'PRESCRIPTION',           labelKey: 'decisionPrescription'         },
  { value: 'EXAMEN_COMPLEMENTAIRE',  labelKey: 'decisionExamenComplementaire' },
  { value: 'EVACUATION',             labelKey: 'decisionEvacuation'           },
] as const

const DECISION_ICON: Record<string, React.ReactNode> = {
  CLOTURE_SIMPLE:        <CheckCircle2 size={16} />,
  PRESCRIPTION:          <Pill size={16} />,
  EXAMEN_COMPLEMENTAIRE: <FlaskConical size={16} />,
  EVACUATION:            <Ambulance size={16} />,
}

// ── Onglets ───────────────────────────────────────────────────────────────────

type DocView = 'ordonnance' | 'examens-c' | 'sorties'

/** Choix intelligent du document par défaut selon la décision médicale. */
function defaultDocView(decision?: string | null): DocView {
  if (decision === 'EXAMEN_COMPLEMENTAIRE') return 'examens-c'
  if (decision === 'EVACUATION') return 'sorties'
  return 'ordonnance'
}

/**
 * Document à ouvrir quand une décision est choisie. `null` = pas de document
 * (clôture simple) → on reste sur l'écran Décision.
 */
function docViewForDecision(decision: string): DocView | null {
  switch (decision) {
    case 'PRESCRIPTION':           return 'ordonnance'
    case 'EXAMEN_COMPLEMENTAIRE':  return 'examens-c'
    case 'EVACUATION':             return 'sorties'
    default:                       return null
  }
}

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
  const prendre   = usePrendreEnCharge(consultationId)

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

  // Consultation déjà décidée (rouverte) → pré-sélectionne le bon document.
  const decisionMed = consultation?.decisionMedicale
  useEffect(() => {
    if (decisionMed) { setDecision(decisionMed); setDocView(defaultDocView(decisionMed)) }
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

  /**
   * Décision choisie : on pré-sélectionne l'onglet Documents correspondant (sans
   * y naviguer — Documents est désormais l'étape précédente) et, pour une
   * PRESCRIPTION, on prépare l'ordonnance brouillon si elle n'existe pas.
   */
  function handleDecisionPick(value: string) {
    setDecision(value)
    const view = docViewForDecision(value)
    if (view) setDocView(view)
    // L'ordonnance n'est PLUS créée automatiquement ici : elle est créée à l'ajout
    // de la première ligne (création paresseuse), pour ne jamais persister d'ordonnance vide.
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
  const nbDiagnostics = consultation.diagnostics.length
  const nbOrdonnances = consultation.ordonnances.length
  const nbBonsExamen  = consultation._count.bonsExamen
  const evacActive    = !!consultation.evacuation && consultation.evacuation.statut !== 'ANNULE'
  const nbSorties     = (evacActive ? 1 : 0)
  const hasDecision   = !!consultation.decisionMedicale

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: isCompact ? 'column' : 'row', overflow: isCompact ? 'auto' : 'hidden', minWidth: 0, position: 'relative' }}>

      <PatientContextRail
        consultation={consultation}
        consultationId={consultationId}
        isActive={isActive}
        canUpdate={canUpdate}
      />

      <div ref={setPreviewHost} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: isCompact ? 'visible' : 'hidden', minWidth: 0, position: 'relative' }}>
        <PreviewHostContext.Provider value={previewHost}>


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
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

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
                { key: 'examens-c',  label: t('consultation.tabExamForm'),     icon: <FlaskConical size={13} />, badge: nbBonsExamen || undefined },
                { key: 'sorties',    label: t('consultation.tabCriticalCases'), icon: <Ambulance size={13} />,   badge: nbSorties || undefined },
              ]}
            />

            {docView === 'ordonnance' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
                <OrdonnanceCard
                  consultationId={consultationId}
                  consultation={consultation}
                  ordonnances={consultation.ordonnances}
                  readonly={!isActive || !canOrdonnance || heldByOther}
                  onPreview={setPreviewOrdId}
                />
                {/* Bon de pharmacie (recueil) : voucher médicaments, CDI + ayants droit */}
                <BonPharmacieCard
                  consultationId={consultationId}
                  readonly={!isActive}
                  categorieCode={patient.categoriePatient.code}
                  soignant={consultation.soignant}
                  categorieLibelle={patient.categoriePatient.libelle}
                />
              </div>
            )}

            {docView === 'examens-c' && (
              <BonExamenCard
                consultationId={consultationId}
                readonly={!isActive}
                soignant={consultation.soignant}
                categorieLibelle={patient.categoriePatient.libelle}
                categorieCode={patient.categoriePatient.code}
              />
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
        </PreviewHostContext.Provider>
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

function DecisionSection({ consultationId, consultation, isActive, canClose: canCloseRole, canCancel, decision, onPickDecision }: {
  consultationId: string
  consultation: ReturnType<typeof useConsultation>['data'] & {}
  isActive: boolean
  canClose: boolean
  canCancel: boolean
  decision: string
  onPickDecision: (value: string) => void
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
  const deleteConsult    = useDeleteConsultation(consultationId)
  const { has }          = usePermissions()
  const [confirmDel, setConfirmDel] = useState(false)

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

  // État terminal
  if (!isActive) {
    return (
      <div style={{
        padding: '20px',
        background: consultation.statut === 'CLOTUREE' ? 'var(--succes-fond)' : 'var(--fond-surface-2)',
        border: `1px solid ${consultation.statut === 'CLOTUREE' ? 'var(--succes-bordure)' : 'var(--bordure-normale)'}`,
        borderRadius: 10,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: consultation.statut === 'CLOTUREE' ? 'var(--succes-texte)' : 'var(--texte-secondaire)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {consultation.statut === 'CLOTUREE' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {consultation.statut === 'CLOTUREE' ? t('consultation.consultationClosed') : t('consultation.consultationCancelled')}
        </p>
        {consultation.statut === 'ANNULEE' && consultation.motifAnnulation && (
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--texte-secondaire)' }}>
            {t('consultation.cancellationReasonLabel', { reason: consultation.motifAnnulation })}
          </p>
        )}
        {consultation.decisionMedicale && (() => {
          const dec = DECISIONS.find(d => d.value === consultation.decisionMedicale)
          return (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--texte-secondaire)' }}>
              {t('consultation.decisionLabel', { decision: dec ? t(`consultation.${dec.labelKey}`) : labelDecision(consultation.decisionMedicale) })}
            </p>
          )
        })()}
        {consultation.conclusion && (
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--texte-secondaire)', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
            {consultation.conclusion}
          </p>
        )}

        {/* Suppression définitive (consultation ANNULÉE sans documents) */}
        {consultation.statut === 'ANNULEE' && has('consultation.delete') && (
          <button
            onClick={() => setConfirmDel(true)}
            disabled={deleteConsult.isPending}
            style={{
              alignSelf: 'flex-start', marginTop: 2,
              height: 32, padding: '0 12px', borderRadius: 6, fontSize: '12px', fontWeight: '500',
              background: 'transparent', cursor: 'pointer',
              border: '1px solid var(--erreur-bordure)', color: 'var(--erreur-texte)',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
          >
            <Trash2 size={13} /> {t('consultation.deletePermanently')}
          </button>
        )}

        {confirmDel && (
          <Modal
            icon={<Trash2 size={16} />}
            title={t('consultation.deleteConsultationTitle')}
            subtitle={t('consultation.deleteConsultationSubtitle')}
            width={440}
            onClose={() => setConfirmDel(false)}
            footer={<>
              <Button variant="outline" onClick={() => setConfirmDel(false)} disabled={deleteConsult.isPending}>{t('consultation.cancel')}</Button>
              <Button
                onClick={() => deleteConsult.mutate(undefined, { onSuccess: () => setConfirmDel(false) })}
                disabled={deleteConsult.isPending}
                style={{ background: 'var(--erreur-accent)', color: '#fff', border: 'none', gap: 5 }}
              >
                <Trash2 size={14} /> {deleteConsult.isPending ? t('consultation.deleting') : t('consultation.delete')}
              </Button>
            </>}
          >
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--texte-secondaire)', lineHeight: 1.6 }}>
              {t('consultation.deleteConsultationBody')}
            </p>
          </Modal>
        )}
      </div>
    )
  }

  // Prérequis de clôture, anticipés AVANT le clic (alignés sur les gardes serveur).
  const blockers: string[] = []
  if (consultation.diagnostics.length === 0) blockers.push(t('consultation.blockerDiagnostic'))
  if (!consultation.typeConsultationId) blockers.push(t('consultation.blockerType'))
  if (decision === 'PRESCRIPTION' && !consultation.ordonnances.some(o => o.statut === 'VALIDEE')) blockers.push(t('consultation.blockerOrdonnance'))
  if (decision === 'EXAMEN_COMPLEMENTAIRE' && consultation._count.bonsExamen === 0) blockers.push(t('consultation.blockerDocument'))
  if (decision === 'EVACUATION' && (!consultation.evacuation || consultation.evacuation.statut === 'ANNULE')) blockers.push(t('consultation.blockerDocument'))
  const canClose = !!decision && blockers.length === 0

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
            return (
              <button
                key={d.value}
                onClick={() => onPickDecision(d.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11,
                  padding: '11px 14px', fontSize: '13px', fontWeight: active ? 700 : 500,
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                  borderLeft: `3px solid ${active ? 'var(--ap-500)' : 'transparent'}`,
                  borderRight: 'none', borderTop: 'none',
                  borderBottom: i < DECISIONS.length - 1 ? '1px solid var(--bordure-legere)' : 'none',
                  background: active ? 'var(--ap-50)' : 'transparent',
                  color: active ? 'var(--ap-700)' : 'var(--texte-secondaire)',
                  transition: 'background 0.12s, color 0.12s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--fond-surface-2)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ display: 'flex', flexShrink: 0, color: active ? 'var(--ap-600)' : 'var(--texte-tertiaire)' }}>
                  {DECISION_ICON[d.value]}
                </span>
                <span style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>{t(`consultation.${d.labelKey}`)}</span>
                {active && <CheckCircle2 size={15} style={{ color: 'var(--ap-600)', flexShrink: 0 }} />}
              </button>
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
            rows={4}
            placeholder={t('consultation.conclusionPlaceholder')}
            aria-label={t('consultation.conclusionPlaceholder')}
            style={{
              width: '100%', fontSize: '13px', lineHeight: '1.5',
              border: '1px solid var(--bordure-normale)', borderRadius: 6,
              padding: '8px 10px', resize: 'vertical', outline: 'none',
              background: 'var(--fond-surface)',
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
          onClick={() => cloturer.mutate({ decisionMedicale: decision, conclusion: conclusion || undefined })}
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
          disabled={annuler.isPending}
          style={{
            height: 44, borderRadius: 8, fontSize: '13px', fontWeight: '500',
            background: 'var(--fond-surface)', color: 'var(--erreur-texte)',
            border: '1.5px solid var(--erreur-bordure)',
            cursor: 'pointer',
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

function PatientContextRail({ consultation, consultationId, isActive, canUpdate }: {
  consultation: ReturnType<typeof useConsultation>['data'] & {}
  consultationId: string
  isActive: boolean
  canUpdate: boolean
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
      width: isCompact ? '100%' : 296, flexShrink: 0, height: isCompact ? 'auto' : '100%',
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
            {identite && <> · {identite.sexe === 'M' ? t('consultation.sexM') : t('consultation.sexF')} · {t('consultation.ageYears', { age: calcAge(identite.dateNaissance) })}</>}
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

      {/* Motif + type */}
      <RailSection title={t('consultation.railMotifType')}>
        <p style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--texte-primaire)', fontWeight: 500 }}>{visite.motifPrincipal.libelle}</p>
        <TypeConsultationSelect consultationId={consultationId} currentTypeId={consultation.typeConsultation?.id ?? null} readonly={!isActive || !canUpdate} />
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
