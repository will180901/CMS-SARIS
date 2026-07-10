import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, FileText, NotebookPen, Plus, Check, ChevronDown,
  ClipboardList, Stethoscope, ListChecks,
} from 'lucide-react'
import { useVisite, useUpdateNotesVisite, visiteKey } from '../hooks/useTriage'
import { useCreateAntecedent, useCreateAllergie, useCreateAlerte } from '@/modules/patients/hooks/usePatients'
import { usePathologies } from '@/modules/referentiels/hooks/useReferentiels'
import { isActif } from '@/modules/referentiels/api/referentiels.api'
import { usePermissions } from '@/hooks/usePermissions'
import { useIsCompact } from '@/hooks/useMediaQuery'
import { SelectBox, Card, Textarea, StatusPill }  from '@/components/saris'
import { labelGravite, humanizeCode } from '@/config/labels'
import { VisiteSidebar }  from './VisiteSidebar'
import { ConstantesForm } from './ConstantesForm'
import { ActionsCard }    from './ActionsCard'
import { VisiteArchiveSummary } from './VisiteArchiveSummary'
import type { VisiteDetail as VisiteDetailType } from '@cms-saris/types'

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

// ── Bandeau « Triage allégé » (recueil §3.5) ──────────────────────────────────

function TriageAllegeBanner() {
  const { t } = useTranslation()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 14px', borderRadius: 8,
      background: 'var(--info-fond)', border: '1px solid var(--info-bordure)',
    }}>
      <FileText size={14} style={{ color: 'var(--info-texte)', flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: 'var(--info-texte)' }}>{t('triage.triageAllegeBanniere')}</span>
    </div>
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

// ── Antécédents, allergies, alertes (fusionné dans le flux de triage) ────────

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

function AntecedentsSection({ visite }: { visite: VisiteDetailType }) {
  const { t } = useTranslation()
  const allergies   = visite.patient?.allergies ?? []
  const alertes     = visite.patient?.alertesMedicales ?? []
  const antecedents = visite.patient?.antecedents ?? []
  const patientId   = visite.patient?.id ?? ''

  const { has } = usePermissions()
  // Verrouillé dès que la visite est clôturée/annulée — toute la zone de droite d'une
  // visite terminée reste en lecture seule, y compris cet onglet (recueil : pas de saisie
  // possible sur un dossier archivé, même si les antécédents sont des données du patient).
  const isActive = visite.statut === 'EN_ATTENTE' || visite.statut === 'EN_COURS'
  const canEdit = has('patient.update') && !!patientId && isActive
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
  const [antPathologieId, setAntPathologieId] = useState('')
  const { data: pathologies = [] } = usePathologies()
  const pathologiesActives = pathologies.filter(p => isActif(p.statut))
  // Champs allergie
  const [allSub, setAllSub]   = useState('')
  const [allGrav, setAllGrav] = useState('MODERE')
  // Champs alerte
  const [altType, setAltType] = useState('SURVEILLANCE')
  const [altMsg, setAltMsg]   = useState('')
  const [altGrav, setAltGrav] = useState('IMPORTANT')

  async function submitAnt() {
    if (antDesc.trim().length < 5) return
    await createAnt.mutateAsync({ type: antType, description: antDesc.trim(), pathologieId: antPathologieId || undefined })
    refreshVisite(); setAntDesc(''); setAntPathologieId('')
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
            <div style={{ width: 170, flexShrink: 0 }}>
              <SelectBox size="md" value={antPathologieId} onChange={setAntPathologieId} aria-label={t('patients.fieldPathologie')}
                placeholder={t('patients.pathologieNonListeePlaceholder')}
                options={[{ value: '', label: t('patients.pathologieNonListee') }, ...pathologiesActives.map(p => ({ value: p.id, label: p.libelle }))]} />
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
              {a.pathologie && (
                <span style={{ fontSize: '11px', color: 'var(--ap-700)', fontWeight: 600, marginLeft: 8, background: 'var(--ap-50)', border: '1px solid var(--ap-200)', padding: '1px 7px', borderRadius: 99 }}>
                  {a.pathologie.libelle}
                </span>
              )}
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

// ── Accordéon du processus de triage ──────────────────────────────────────────
// Un seul volet ouvert à la fois : ouvrir une étape referme la précédente.
// L'étape courante reste toujours ré-ouvrable manuellement (clic sur l'en-tête).

function AccordionStep({
  index, title, icon, badge, open, onToggle, children,
}: {
  index:    number
  title:    string
  icon:     React.ReactNode
  badge?:   React.ReactNode
  open:     boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div style={{ background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)', borderRadius: 10, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', background: open ? 'var(--fond-surface-2)' : 'var(--fond-surface)',
          border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700,
          background: open ? 'var(--ap-500)' : 'var(--fond-surface-2)',
          color:      open ? '#fff' : 'var(--texte-tertiaire)',
          border:     open ? 'none' : '1px solid var(--bordure-legere)',
        }}>
          {index}
        </span>
        <span style={{ color: 'var(--ap-600)', display: 'flex', flexShrink: 0 }}>{icon}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--texte-primaire)' }}>{title}</span>
        {badge}
        <ChevronDown size={16} style={{ color: 'var(--texte-tertiaire)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div style={{ padding: '16px', borderTop: '1px solid var(--bordure-legere)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function StepBadge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'success' }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, flexShrink: 0,
      background: tone === 'success' ? 'var(--succes-fond)' : 'var(--fond-surface-2)',
      color:      tone === 'success' ? 'var(--succes-texte)' : 'var(--texte-tertiaire)',
    }}>
      {children}
    </span>
  )
}

type StepKey = 'accueil' | 'antecedents' | 'examen' | 'decision'

function TriageAccordion({
  visite, visiteId, onSent, triageAllege, lastConst, canSaisirConstantes,
}: {
  visite: VisiteDetailType
  visiteId: string
  onSent?: () => void
  triageAllege: boolean
  lastConst: VisiteDetailType['constantes'][number] | null
  canSaisirConstantes: boolean
}) {
  const { t } = useTranslation()
  const [openStep, setOpenStep] = useState<StepKey | null>('accueil')

  const antecedentsCount = (visite.patient?.antecedents?.length ?? 0)
    + (visite.patient?.allergies?.length ?? 0)
    + (visite.patient?.alertesMedicales?.length ?? 0)

  const steps: { key: StepKey; title: string; icon: React.ReactNode; badge?: React.ReactNode; content: React.ReactNode }[] = [
    {
      key: 'accueil', title: t('triage.etapeAccueil'), icon: <FileText size={14} />,
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <MotifCard visite={visite} />
          <NotesCard visite={visite} />
        </div>
      ),
    },
    ...(!triageAllege ? [{
      key: 'antecedents' as StepKey, title: t('triage.etapeAntecedents'), icon: <ClipboardList size={14} />,
      badge: antecedentsCount > 0 ? <StepBadge>{antecedentsCount}</StepBadge> : undefined,
      content: <AntecedentsSection visite={visite} />,
    }] : []),
    ...(!triageAllege && canSaisirConstantes ? [{
      key: 'examen' as StepKey, title: t('triage.etapeExamenClinique'), icon: <Stethoscope size={14} />,
      badge: lastConst ? <StepBadge tone="success">{t('triage.etapeSaisies')}</StepBadge> : undefined,
      content: <ConstantesForm visiteId={visiteId} lastValues={lastConst} />,
    }] : []),
    {
      key: 'decision', title: t('triage.etapeDecision'), icon: <ListChecks size={14} />,
      badge: visite.soignantId ? <StepBadge tone="success">{t('triage.etapeAssigne')}</StepBadge> : undefined,
      content: <ActionsCard visite={visite} onSent={onSent} />,
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {triageAllege && <TriageAllegeBanner />}
      {steps.map((s, i) => (
        <AccordionStep
          key={s.key}
          index={i + 1}
          title={s.title}
          icon={s.icon}
          badge={s.badge}
          open={openStep === s.key}
          onToggle={() => setOpenStep(cur => cur === s.key ? null : s.key)}
        >
          {s.content}
        </AccordionStep>
      ))}
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

export function VisiteDetail({ visiteId, onSent }: { visiteId: string; onSent?: () => void }) {
  const { t } = useTranslation()
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
  // Triage allégé (recueil §3.5) : consultation spécialisée (ophtalmo/ORL/stomato)
  // — l'infirmière ne recueille que statut + identité, pas d'examen clinique complet.
  const triageAllege = visite.motifPrincipal?.triageAllege === true

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

          <div style={{ flex: isCompact ? 'none' : 1, padding: '20px 24px', overflowY: isCompact ? 'visible' : 'auto', background: 'var(--fond-page)' }}>
            {(visite.statut === 'EN_ATTENTE' || visite.statut === 'EN_COURS') ? (
              <TriageAccordion
                visite={visite}
                visiteId={visiteId}
                onSent={onSent}
                triageAllege={triageAllege}
                lastConst={lastConst}
                canSaisirConstantes={has('visite.update')}
              />
            ) : (
              <VisiteArchiveSummary visite={visite} />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
