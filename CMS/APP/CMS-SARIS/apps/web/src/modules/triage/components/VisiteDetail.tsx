import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, FileText, Stethoscope, History, NotebookPen, Plus, Check,
} from 'lucide-react'
import { useVisite, useUpdateNotesVisite, visiteKey } from '../hooks/useTriage'
import { useCreateAntecedent, useCreateAllergie, useCreateAlerte } from '@/modules/patients/hooks/usePatients'
import { usePermissions } from '@/hooks/usePermissions'
import { useIsCompact } from '@/hooks/useMediaQuery'
import { SegmentedTabs, SelectBox, Card, Textarea, StatusPill }  from '@/components/saris'
import { labelGravite, humanizeCode } from '@/config/labels'
import { formatDateTime } from '@/lib/intl'
import { VisiteSidebar }  from './VisiteSidebar'
import { ConstantesForm } from './ConstantesForm'
import { ActionsCard }    from './ActionsCard'
import type { VisiteDetail as VisiteDetailType, VisiteEvenement } from '@cms-saris/types'

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'triage',      labelKey: 'triage.tabTriage',      icon: Stethoscope },
  { key: 'antecedents', labelKey: 'triage.tabAntecedents', icon: FileText    },
  { key: 'historique',  labelKey: 'triage.tabHistorique',  icon: History     },
] as const
type TabKey = typeof TABS[number]['key']

// ── Bannière critique (calque exact DossierPage.AlerteBanner) ─────────────────

function AlerteBanner({ visite }: { visite: VisiteDetailType }) {
  const { t } = useTranslation()
  const severe    = (visite.patient?.allergies ?? []).filter(a => a.gravite === 'SEVERE')
  const critiques = (visite.patient?.alertesMedicales ?? []).filter(a => a.gravite === 'CRITIQUE')
  if (severe.length === 0 && critiques.length === 0) return null

  return (
    <div style={{
      margin: '16px 24px 0',
      padding: '12px 14px',
      borderRadius: 'var(--radius-md)',
      background: 'var(--erreur-fond)',
      border: '1px solid var(--erreur-bordure)',
      display: 'flex',
      gap: '10px',
      alignItems: 'flex-start',
    }}>
      <AlertTriangle size={15} style={{ color: 'var(--erreur-accent)', flexShrink: 0, marginTop: 1 }} />
      <div>
        <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--erreur-texte)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {t('triage.attentionCritique')}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {severe.map(a => (
            <span key={a.id} style={{ fontSize: '12px', background: 'var(--fond-surface)', color: 'var(--erreur-texte)', border: '1px solid var(--erreur-bordure)', padding: '2px 8px', borderRadius: 99, fontWeight: '500' }}>
              {t('triage.allergiePrefix', { substance: a.substance })}
            </span>
          ))}
          {critiques.map(a => (
            <span key={a.id} style={{ fontSize: '12px', background: 'var(--fond-surface)', color: 'var(--erreur-texte)', border: '1px solid var(--erreur-bordure)', padding: '2px 8px', borderRadius: 99, fontWeight: '500' }}>
              {a.message}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Fil de parcours de la visite (Accueil → Consultation → Clôture) ───────────

function VisiteJourney({ statut }: { statut: string }) {
  const { t } = useTranslation()
  const annulee = statut === 'ANNULEE'
  // Index de l'étape courante : 0 = accueil, 1 = en consultation, 2 = clôturée.
  const current = statut === 'CLOTUREE' ? 2 : statut === 'EN_COURS' ? 1 : 0
  const steps = [t('triage.journeyAccueil'), t('triage.journeyConsultation'), t('triage.journeyCloturee')]

  if (annulee) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', borderRadius: 9999,
        background: 'var(--erreur-fond)', color: 'var(--erreur-accent)',
        border: '1px solid var(--erreur-accent)', fontSize: '12px', fontWeight: 700,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor' }} />
        {t('triage.visiteAnnuleeBadge')}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {steps.map((label, i) => {
        const done    = i < current || statut === 'CLOTUREE'
        const active  = i === current && statut !== 'CLOTUREE'
        const reached = i <= current
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : '0 0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 700,
                background: active ? 'var(--ap-500)' : done ? 'var(--succes-fond)' : 'var(--fond-surface-2)',
                color:      active ? '#fff' : done ? 'var(--succes-accent)' : 'var(--texte-tertiaire)',
                border:     active ? 'none' : `1px solid ${reached ? 'var(--ap-200)' : 'var(--bordure-legere)'}`,
              }}>
                {done ? <Check size={13} /> : i + 1}
              </span>
              <span style={{
                fontSize: '12px', fontWeight: active ? 700 : 500, whiteSpace: 'nowrap',
                color: active ? 'var(--texte-primaire)' : reached ? 'var(--texte-secondaire)' : 'var(--texte-tertiaire)',
              }}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, margin: '0 10px', borderRadius: 2, background: i < current ? 'var(--ap-300)' : 'var(--bordure-legere)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Card "Motif" ──────────────────────────────────────────────────────────────

function MotifCard({ visite }: { visite: VisiteDetailType }) {
  const { t } = useTranslation()
  return (
    <Card elevation="raised">
      <Card.Header icon={<FileText size={14} />} title={t('triage.motifConsultation')} />
      <Card.Body padding="md">
        <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--texte-primaire)', margin: 0 }}>
          {visite.motifPrincipal?.libelle ?? '—'}
        </p>
      </Card.Body>
    </Card>
  )
}

// ── Card "Notes d'accueil" ────────────────────────────────────────────────────

function NotesCard({ visite }: { visite: VisiteDetailType }) {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const isActive = (visite.statut === 'EN_ATTENTE' || visite.statut === 'EN_COURS') && has('visite.update')
  const update   = useUpdateNotesVisite(visite.id)

  const [value, setValue] = useState(visite.notesAccueil ?? '')

  // Re-sync si la visite change (notes mises à jour ailleurs)
  useEffect(() => {
    setValue(visite.notesAccueil ?? '')
  }, [visite.id, visite.notesAccueil])

  const charsLeft = 2000 - value.length
  const saved = value === (visite.notesAccueil ?? '')

  // Enregistrement automatique : 1 s après la dernière frappe (débounce).
  useEffect(() => {
    if (!isActive || saved) return
    const t = setTimeout(() => update.mutate(value || null), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, isActive])

  // …et immédiatement à la perte de focus.
  function flush() {
    if (isActive && value !== (visite.notesAccueil ?? '')) update.mutate(value || null)
  }

  return (
    <Card elevation="raised">
      <Card.Header
        icon={<NotebookPen size={14} />}
        title={t('triage.notesAccueil')}
        actions={
          !isActive ? undefined
          : update.isPending ? <StatusPill tone="neutral" dot={false}>{t('triage.enregistrement')}</StatusPill>
          : !saved ? <StatusPill tone="warning" dot={false}>{t('triage.modifie')}</StatusPill>
          : value ? <StatusPill tone="success" dot={false}><Check size={11} style={{ marginRight: 3 }} /> {t('triage.enregistre')}</StatusPill>
          : undefined
        }
      />
      <Card.Body padding="md">
        <Textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={flush}
          disabled={!isActive}
          maxLength={2000}
          placeholder={isActive ? t('triage.notesPlaceholderActif') : t('triage.notesPlaceholderInactif')}
          rows={4}
          style={{ minHeight: 80 }}
        />
        {isActive && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: '11px', color: charsLeft < 100 ? 'var(--avert-texte)' : 'var(--texte-tertiaire)' }}>
              {t('triage.caracteresRestants', { count: charsLeft })}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', fontStyle: 'italic' }}>
              {t('triage.enregistrementAutomatique')}
            </span>
          </div>
        )}
      </Card.Body>
    </Card>
  )
}

// ── Onglet Antécédents ────────────────────────────────────────────────────────

// Clés i18n des types d'antécédent / alerte (codes Prisma → clé `triage.`)
const ANTECEDENT_LIBELLE: Record<string, string> = {
  MEDICAL:             'triage.antecedentMedical',
  CHIRURGICAL:         'triage.antecedentChirurgical',
  FAMILIAL:            'triage.antecedentFamilial',
  GYNECO_OBSTETRICAL:  'triage.antecedentGynecoObstetrical',
  AUTRE:               'triage.antecedentAutre',
}

const ALERTE_LIBELLE: Record<string, string> = {
  ALLERGIE:             'triage.alerteAllergie',
  PATHOLOGIE_CHRONIQUE: 'triage.alertePathologieChronique',
  CONTRE_INDICATION:    'triage.alerteContreIndication',
  SURVEILLANCE:         'triage.alerteSurveillance',
  AUTRE:                'triage.alerteAutre',
}

// Couleurs par type d'antécédent
const ANTECEDENT_TONE: Record<string, { bg: string; text: string; border: string }> = {
  MEDICAL:             { bg: 'var(--info-fond)',   text: 'var(--info-texte)',   border: 'var(--info-bordure)'   },
  CHIRURGICAL:         { bg: 'var(--erreur-fond)', text: 'var(--erreur-texte)', border: 'var(--erreur-bordure)' },
  FAMILIAL:            { bg: 'var(--succes-fond)', text: 'var(--succes-texte)', border: 'var(--succes-bordure)' },
  GYNECO_OBSTETRICAL:  { bg: 'var(--avert-fond)',  text: 'var(--avert-texte)',  border: 'var(--avert-bordure)'  },
  AUTRE:               { bg: 'var(--fond-surface-2)', text: 'var(--texte-secondaire)', border: 'var(--bordure-normale)' },
}

function Section({
  title, count, empty, addRow, children,
}: {
  title:    string
  count:    number
  empty:    string
  addRow?:  React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div style={{
      background:   'var(--fond-surface)',
      border:       '1px solid var(--bordure-legere)',
      borderRadius: '10px',
      boxShadow:    'var(--ombre-1)',
      padding:      '16px',
    }}>
      <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--texte-tertiaire)', margin: '0 0 10px' }}>
        {title} ({count})
      </p>
      {/* Zone d'affichage en lecture seule (liste à puces) */}
      <div style={{
        minHeight: 44, borderRadius: 8,
        border: '1px solid var(--bordure-legere)', background: 'var(--fond-surface-2)',
        padding: count === 0 ? 0 : '6px 4px',
        display: 'flex', flexDirection: 'column',
        justifyContent: count === 0 ? 'center' : 'flex-start',
        marginBottom: addRow ? 10 : 0,
      }}>
        {count === 0
          ? <p style={{ fontSize: '12px', color: 'var(--texte-tertiaire)', fontStyle: 'italic', margin: 0, textAlign: 'center' }}>{empty}</p>
          : children}
      </div>
      {addRow}
    </div>
  )
}

// Puce d'une liste (point coloré + contenu)
function Puce({ children, dot = 'var(--ap-500)' }: { children: React.ReactNode; dot?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '5px 10px' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0, marginTop: 6 }} />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}

// Champs / bouton compacts réutilisables
const addInput = {
  width: '100%', height: 36, padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' as const,
  borderRadius: 8, border: '1px solid var(--bordure-normale)',
  background: 'var(--fond-surface)', color: 'var(--texte-primaire)', outline: 'none',
}
const addBtn = (disabled: boolean) => ({
  width: 36, height: 36, flexShrink: 0, borderRadius: 8,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: disabled ? 'var(--fond-surface-2)' : 'var(--ap-500)',
  color: disabled ? 'var(--texte-tertiaire)' : '#fff',
  border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
})

function AntecedentsTab({ visite }: { visite: VisiteDetailType }) {
  const { t } = useTranslation()
  const allergies   = visite.patient?.allergies ?? []
  const alertes     = visite.patient?.alertesMedicales ?? []
  const antecedents = visite.patient?.antecedents ?? []
  const patientId   = visite.patient?.id ?? ''

  const { has } = usePermissions()
  const canEdit = has('patient.update') && !!patientId
  const qc = useQueryClient()

  // Mutations (réutilisent les endpoints du dossier patient)
  const createAnt     = useCreateAntecedent(patientId)
  const createAllergie = useCreateAllergie(patientId)
  const createAlerte  = useCreateAlerte(patientId)
  // Après ajout : rafraîchir la visite (la liste affichée vient de visite.patient)
  const refreshVisite = () => qc.invalidateQueries({ queryKey: visiteKey(visite.id) })

  // Champs antécédent
  const [antType, setAntType] = useState('MEDICAL')
  const [antDesc, setAntDesc] = useState('')
  // Champs allergie
  const [allSub, setAllSub]   = useState('')
  const [allGrav, setAllGrav] = useState('MODERE')
  // Champs alerte
  const [altType, setAltType] = useState('SURVEILLANCE')
  const [altMsg, setAltMsg]   = useState('')
  const [altGrav, setAltGrav] = useState('IMPORTANT')

  async function submitAnt() {
    if (antDesc.trim().length < 5) return
    await createAnt.mutateAsync({ type: antType, description: antDesc.trim() })
    refreshVisite(); setAntDesc('')
  }
  async function submitAllergie() {
    if (allSub.trim().length < 2) return
    await createAllergie.mutateAsync({ substance: allSub.trim(), gravite: allGrav })
    refreshVisite(); setAllSub('')
  }
  async function submitAlerte() {
    if (altMsg.trim().length < 5) return
    await createAlerte.mutateAsync({ type: altType, message: altMsg.trim(), gravite: altGrav })
    refreshVisite(); setAltMsg('')
  }

  const allGravColor = (g: string) => g === 'SEVERE' ? 'var(--erreur-accent)' : g === 'MODERE' ? 'var(--avert-accent)' : 'var(--succes-accent)'
  const altGravColor = (g: string) => g === 'CRITIQUE' ? 'var(--erreur-accent)' : g === 'IMPORTANT' ? 'var(--avert-accent)' : 'var(--info-accent)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Antécédents médicaux ─────────────────────────────────────── */}
      <Section
        title={t('triage.antecedentsMedicaux')} count={antecedents.length} empty={t('triage.antecedentsEmpty')}
        addRow={canEdit && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ width: 160, flexShrink: 0 }}>
              <SelectBox size="md" value={antType} onChange={setAntType} aria-label={t('triage.typeAntecedentAria')}
                options={Object.entries(ANTECEDENT_LIBELLE).map(([v, l]) => ({ value: v, label: t(l) }))} />
            </div>
            <input
              value={antDesc} maxLength={500}
              onChange={e => setAntDesc(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitAnt() } }}
              placeholder={t('triage.antecedentPlaceholder')}
              style={{ ...addInput, flex: '1 1 160px' }}
            />
            <button type="button" onClick={submitAnt} disabled={antDesc.trim().length < 5 || createAnt.isPending} title={t('triage.ajouter')} style={addBtn(antDesc.trim().length < 5 || createAnt.isPending)}>
              <Plus size={16} />
            </button>
          </div>
        )}
      >
        {antecedents.map(a => {
          const tone = ANTECEDENT_TONE[a.type] ?? ANTECEDENT_TONE.AUTRE
          return (
            <Puce key={a.id} dot={tone.text}>
              <span style={{ fontSize: '14px', color: 'var(--texte-primaire)', lineHeight: 1.4 }}>{a.description}</span>
              <span style={{ fontSize: '11px', color: tone.text, fontWeight: 600, marginLeft: 8 }}>{ANTECEDENT_LIBELLE[a.type] ? t(ANTECEDENT_LIBELLE[a.type]) : humanizeCode(a.type)}</span>
            </Puce>
          )
        })}
      </Section>

      {/* ── Allergies ────────────────────────────────────────────────── */}
      <Section
        title={t('triage.allergiesConnues')} count={allergies.length} empty={t('triage.allergiesEmpty')}
        addRow={canEdit && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              value={allSub} maxLength={200}
              onChange={e => setAllSub(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitAllergie() } }}
              placeholder={t('triage.substancePlaceholder')}
              style={{ ...addInput, flex: '1 1 160px' }}
            />
            <div style={{ width: 130, flexShrink: 0 }}>
              <SelectBox size="md" value={allGrav} onChange={setAllGrav} aria-label={t('triage.graviteAllergieAria')}
                options={[{ value: 'FAIBLE', label: t('triage.graviteFaible') }, { value: 'MODERE', label: t('triage.graviteModeree') }, { value: 'SEVERE', label: t('triage.graviteSevere') }]} />
            </div>
            <button type="button" onClick={submitAllergie} disabled={allSub.trim().length < 2 || createAllergie.isPending} title={t('triage.ajouter')} style={addBtn(allSub.trim().length < 2 || createAllergie.isPending)}>
              <Plus size={16} />
            </button>
          </div>
        )}
      >
        {allergies.map(a => (
          <Puce key={a.id} dot={allGravColor(a.gravite)}>
            <span style={{ fontSize: '14px', color: 'var(--texte-primaire)' }}>{a.substance}</span>
            <span style={{ fontSize: '11px', color: allGravColor(a.gravite), fontWeight: 600, marginLeft: 8 }}>{labelGravite(a.gravite)}</span>
          </Puce>
        ))}
      </Section>

      {/* ── Alertes médicales ────────────────────────────────────────── */}
      <Section
        title={t('triage.alertesMedicales')} count={alertes.length} empty={t('triage.alertesEmpty')}
        addRow={canEdit && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                <SelectBox size="md" value={altType} onChange={setAltType} aria-label={t('triage.typeAlerteAria')}
                  options={Object.entries(ALERTE_LIBELLE).map(([v, l]) => ({ value: v, label: t(l) }))} />
              </div>
              <div style={{ width: 140, flexShrink: 0 }}>
                <SelectBox size="md" value={altGrav} onChange={setAltGrav} aria-label={t('triage.graviteAlerteAria')}
                  options={[{ value: 'INFO', label: t('triage.graviteInfo') }, { value: 'IMPORTANT', label: t('triage.graviteImportant') }, { value: 'CRITIQUE', label: t('triage.graviteCritique') }]} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={altMsg} maxLength={500}
                onChange={e => setAltMsg(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitAlerte() } }}
                placeholder={t('triage.messageAlertePlaceholder')}
                style={{ ...addInput, flex: '1 1 160px' }}
              />
              <button type="button" onClick={submitAlerte} disabled={altMsg.trim().length < 5 || createAlerte.isPending} title={t('triage.ajouter')} style={addBtn(altMsg.trim().length < 5 || createAlerte.isPending)}>
                <Plus size={16} />
              </button>
            </div>
          </div>
        )}
      >
        {alertes.map(a => (
          <Puce key={a.id} dot={altGravColor(a.gravite)}>
            <span style={{ fontSize: '14px', color: 'var(--texte-primaire)' }}>{a.message}</span>
            <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', marginLeft: 8 }}>{ALERTE_LIBELLE[a.type] ? t(ALERTE_LIBELLE[a.type]) : humanizeCode(a.type)}</span>
            <span style={{ fontSize: '11px', color: altGravColor(a.gravite), fontWeight: 600, marginLeft: 6 }}>· {labelGravite(a.gravite)}</span>
          </Puce>
        ))}
      </Section>
    </div>
  )
}

// ── Onglet Historique (audit trail réel) ──────────────────────────────────────

type TFunc = (key: string, opts?: Record<string, unknown>) => string

function formatEvent(e: VisiteEvenement, t: TFunc): { label: string; detail?: string; tone: 'info' | 'success' | 'warn' | 'neutral' } {
  const av = e.ancienneVal ?? '—'
  const nv = e.nouvelleVal ?? '—'
  switch (e.type) {
    case 'STATUT_CHANGE': {
      const STATUT_LIBS: Record<string, string> = {
        EN_ATTENTE: t('triage.statutEnAttente'), EN_COURS: t('triage.statutEnCours'),
        CLOTUREE: t('triage.statutCloturee'), ANNULEE: t('triage.statutAnnulee'),
      }
      const tone = nv === 'ANNULEE' ? 'warn' : nv === 'CLOTUREE' ? 'success' : 'info'
      return {
        label:  t('triage.statutChangeLabel', { from: STATUT_LIBS[av] ?? av, to: STATUT_LIBS[nv] ?? nv }),
        detail: e.commentaire ?? undefined,
        tone,
      }
    }
    case 'PRIORITE_CHANGE':
      // Conservé pour l'historique des anciennes visites (la priorité n'est plus modifiable).
      return {
        label:  t('triage.prioriteChangeLabel', { from: av, to: nv }),
        tone:   'info',
      }
    case 'SOIGNANT_CHANGE':
      return {
        label:  e.nouvelleVal ? t('triage.soignantAssigneEvent') : t('triage.soignantRetireEvent'),
        detail: e.nouvelleVal ? undefined : (e.ancienneVal ? t('triage.precedentDesaffecte') : undefined),
        tone:   'neutral',
      }
    case 'NOTES_UPDATE':
      return { label: t('triage.notesMisesAJour'), tone: 'neutral' }
    default:
      return { label: t('triage.evenement'), tone: 'neutral' }
  }
}

function HistoriqueTab({ visite }: { visite: VisiteDetailType }) {
  const { t } = useTranslation()
  type TimelineItem = {
    time:    string
    label:   string
    detail?: string
    actor?:  string
    tone:    'info' | 'success' | 'warn' | 'neutral'
  }

  const items: TimelineItem[] = []

  // Événement initial : ouverture
  items.push({
    time:  visite.dateOuverture,
    label: t('triage.visiteOuverte'),
    detail: visite.motifPrincipal?.libelle,
    tone: 'info',
  })

  // Constantes saisies
  for (const c of visite.constantes ?? []) {
    const parts = [
      c.temperature       != null ? `T° ${c.temperature}°C` : null,
      c.tensionSystolique != null ? `TA ${c.tensionSystolique}/${c.tensionDiastolique ?? '?'}` : null,
      c.frequenceCardiaque!= null ? `FC ${c.frequenceCardiaque}` : null,
      c.saturationO2      != null ? `SpO₂ ${c.saturationO2}%`   : null,
    ].filter(Boolean)
    items.push({
      time:   c.createdAt,
      label:  t('triage.constantesSaisies'),
      detail: parts.join(' · '),
      tone:   'success',
    })
  }

  // Événements de l'audit trail
  for (const e of visite.evenements ?? []) {
    const f = formatEvent(e, t)
    items.push({
      time:   e.createdAt,
      label:  f.label,
      detail: f.detail,
      actor:  e.acteur ? `${e.acteur.prenom} ${e.acteur.nom}` : undefined,
      tone:   f.tone,
    })
  }

  // Tri chronologique inverse (plus récent en haut)
  items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  const TONE = {
    info:    { dot: 'var(--info-accent)'   },
    success: { dot: 'var(--succes-accent)' },
    warn:    { dot: 'var(--avert-accent)'  },
    neutral: { dot: 'var(--texte-tertiaire)' },
  } as const

  return (
    <div style={{
      background:   'var(--fond-surface)',
      border:       '1px solid var(--bordure-legere)',
      borderRadius: '10px',
      boxShadow:    'var(--ombre-1)',
      padding:      '16px 20px',
    }}>
      <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--texte-tertiaire)', margin: '0 0 14px' }}>
        {t('triage.chronologieVisite', { count: items.length })}
      </p>
      <div style={{ position: 'relative', paddingLeft: 18 }}>
        <div style={{ position: 'absolute', left: 5, top: 4, bottom: 4, width: 1, background: 'var(--bordure-legere)' }} />
        {items.map((it, i) => (
          <div key={i} style={{ position: 'relative', paddingBottom: i === items.length - 1 ? 0 : 14 }}>
            <div style={{
              position: 'absolute', left: -18, top: 3,
              width: 11, height: 11, borderRadius: '50%',
              background: TONE[it.tone].dot, border: '2px solid var(--fond-surface)',
            }} />
            <p style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
              {formatDateTime(it.time, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              {it.actor && <span style={{ marginLeft: 8 }}>{t('triage.parActor', { actor: it.actor })}</span>}
            </p>
            <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--texte-primaire)', margin: '2px 0 0' }}>
              {it.label}
            </p>
            {it.detail && (
              <p style={{ fontSize: '12px', color: 'var(--texte-secondaire)', margin: '2px 0 0' }}>{it.detail}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

export function VisiteDetail({ visiteId, onSent }: { visiteId: string; onSent?: () => void }) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<TabKey>('triage')
  const { data: visite, isLoading, isError } = useVisite(visiteId)
  const { has } = usePermissions()
  const isCompact = useIsCompact()

  /* Redimensionnement sidebar visite ↔ contenu */
  const splitRef                    = useRef<HTMLDivElement>(null)
  const [sidebarWidth, setSWidth]   = useState(268)
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

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--texte-tertiaire)', fontSize: '13px' }}>
        {t('triage.chargementVisite')}
      </div>
    )
  }
  if (isError || !visite) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--erreur-texte)', fontSize: '13px' }}>
        {t('triage.erreurChargement')}
      </div>
    )
  }

  const lastConst = visite.constantes?.[0] ?? null

  return (
    <>
      <style>{`
        .vis-resize:hover           { background: var(--ap-50) !important; }
        .vis-resize:hover > div     { background: var(--ap-400) !important; }
      `}</style>

      <div ref={splitRef} style={{ flex: 1, display: 'flex', flexDirection: isCompact ? 'column' : 'row', minHeight: 0, overflow: isCompact ? 'auto' : 'hidden', height: '100%' }}>

        <VisiteSidebar visite={visite} width={sidebarWidth} compact={isCompact} />

        {/* Poignée redimensionnement sidebar ↔ contenu — bureau uniquement */}
        {!isCompact && (
        <div
          onMouseDown={() => setIsResizing(true)}
          onDoubleClick={() => setSWidth(268)}
          title={t('triage.resizeHint')}
          className="vis-resize"
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

        <div style={{ flex: isCompact ? 'none' : 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: isCompact ? 'visible' : 'hidden' }}>

          <AlerteBanner visite={visite} />

          {/* Fil de parcours de la visite */}
          <div style={{ padding: '14px 24px 4px', flexShrink: 0 }}>
            <VisiteJourney statut={visite.statut} />
          </div>

          <div style={{
            borderBottom: '1px solid var(--bordure-legere)',
            padding: 'var(--espace-3) 24px',
            flexShrink: 0,
          }}>
            <SegmentedTabs
              value={activeTab}
              onChange={k => setActiveTab(k as typeof activeTab)}
              tabs={TABS.map(tab => { const Ic = tab.icon; return { key: tab.key, label: t(tab.labelKey), icon: <Ic size={14} /> } })}
            />
          </div>

          <div style={{ flex: isCompact ? 'none' : 1, padding: '20px 24px', overflowY: isCompact ? 'visible' : 'auto', background: 'var(--fond-page)' }}>
            {activeTab === 'triage' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <MotifCard      visite={visite} />
                <NotesCard      visite={visite} />
                {(visite.statut === 'EN_ATTENTE' || visite.statut === 'EN_COURS') && has('visite.update') && (
                  <ConstantesForm visiteId={visiteId} lastValues={lastConst} />
                )}
                <ActionsCard    visite={visite} onSent={onSent} />
              </div>
            )}
            {activeTab === 'antecedents' && <AntecedentsTab visite={visite} />}
            {activeTab === 'historique'  && <HistoriqueTab  visite={visite} />}
          </div>
        </div>
      </div>
    </>
  )
}
