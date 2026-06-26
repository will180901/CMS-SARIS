/**
 * TimelineTab — parcours chronologique unifié du patient : consultations,
 * documents générés (ordonnances, bons, évacuations, accidents, suivis) et
 * changements de catégorie, fusionnés sur un seul axe temporel décroissant.
 *
 * Chaque événement rattaché à une consultation est cliquable et ouvre celle-ci.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  GitCommitVertical, Stethoscope, Pill, FlaskConical, Ambulance, Receipt,
  Tag, ChevronRight, Loader2, HeartPulse,
} from 'lucide-react'
import { EmptyState } from '@/components/saris'
import { formatDate, formatTime } from '@/lib/intl'
import { labelDecision } from '@/config/labels'
import { usePatientConsultations, usePatientDocuments } from '@/modules/consultation/hooks/useConsultation'
import { usePatientVisites } from '@/modules/triage/hooks/useTriage'
import type { PatientDocument } from '@/modules/consultation/api/consultation.api'
import type { PatientDossier } from '@cms-saris/types'

// ── Méta documents (icône + couleurs) ───────────────────────────────────────────

// `labelKey` = clé i18n (résolue dans le composant, jamais au niveau module).
const DOC_META: Record<PatientDocument['type'], { labelKey: string; icon: typeof Pill; tint: string; bg: string }> = {
  ORDONNANCE:       { labelKey: 'patients.docOrdonnance',      icon: Pill,         tint: 'var(--ap-600)',        bg: 'var(--ap-50)' },
  BON_EXAMEN:       { labelKey: 'patients.docBonExamen',       icon: FlaskConical, tint: 'var(--info-accent)',   bg: 'var(--info-fond)' },
  BON_PHARMACIE:    { labelKey: 'patients.docBonPharmacie',    icon: Receipt,      tint: 'var(--succes-accent)', bg: 'var(--succes-fond)' },
  EVACUATION:       { labelKey: 'patients.docEvacuation',      icon: Ambulance,    tint: 'var(--erreur-accent)', bg: 'var(--erreur-fond)' },
}

const STATUT_CONSULT: Record<string, { labelKey: string; tint: string; bg: string }> = {
  OUVERTE:  { labelKey: 'patients.consultStatusOpen',      tint: 'var(--info-texte)',   bg: 'var(--info-fond)'   },
  CLOTUREE: { labelKey: 'patients.consultStatusClosed',    tint: 'var(--succes-texte)', bg: 'var(--succes-fond)' },
  ANNULEE:  { labelKey: 'patients.consultStatusCancelled', tint: 'var(--erreur-texte)', bg: 'var(--erreur-fond)' },
}

const STATUT_VISITE: Record<string, { labelKey: string; tint: string; bg: string }> = {
  EN_ATTENTE: { labelKey: 'patients.visiteEnAttente', tint: 'var(--avert-texte)',  bg: 'var(--avert-fond)'  },
  EN_COURS:   { labelKey: 'patients.visiteEnCours',   tint: 'var(--info-texte)',   bg: 'var(--info-fond)'   },
  CLOTUREE:   { labelKey: 'patients.visiteCloturee',  tint: 'var(--succes-texte)', bg: 'var(--succes-fond)' },
  ANNULEE:    { labelKey: 'patients.visiteAnnulee',   tint: 'var(--erreur-texte)', bg: 'var(--erreur-fond)' },
}

type Kind = 'VISITE' | 'CONSULTATION' | 'DOCUMENT' | 'CATEGORIE'

interface TLEvent {
  key: string
  date: string
  kind: Kind
  icon: React.ReactNode
  tint: string
  bg: string
  title: string
  subtitle?: string
  badge?: string
  badgeTint?: string
  badgeBg?: string
  consultationId?: string
}

const FILTERS: { key: 'TOUS' | Kind; labelKey: string }[] = [
  { key: 'TOUS',         labelKey: 'patients.tlFilterAll' },
  { key: 'VISITE',       labelKey: 'patients.tlFilterVisites' },
  { key: 'CONSULTATION', labelKey: 'patients.tlFilterConsultations' },
  { key: 'DOCUMENT',     labelKey: 'patients.tlFilterDocuments' },
  { key: 'CATEGORIE',    labelKey: 'patients.tlFilterCategory' },
]

function fmtDate(iso: string) {
  return formatDate(iso, { day: '2-digit', month: 'long', year: 'numeric' })
}
function fmtTime(iso: string) {
  return formatTime(iso, { hour: '2-digit', minute: '2-digit' })
}

export function TimelineTab({ dossier }: { dossier: PatientDossier }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const patientId = dossier.id
  const { data: consultations = [], isLoading: loadC } = usePatientConsultations(patientId)
  const { data: documents = [],     isLoading: loadD } = usePatientDocuments(patientId)
  const { data: visites = [],       isLoading: loadV } = usePatientVisites(patientId)
  const [filtre, setFiltre] = useState<'TOUS' | Kind>('TOUS')

  const events = useMemo<TLEvent[]>(() => {
    const list: TLEvent[] = []

    // Visites (passages au triage) — distinctes des consultations qui en découlent.
    for (const v of visites) {
      const cfg = STATUT_VISITE[v.statut] ?? STATUT_VISITE.CLOTUREE
      const consult = v.consultations.find(c => c.statut !== 'ANNULEE') ?? null
      list.push({
        key: `v-${v.id}`, date: v.dateOuverture, kind: 'VISITE',
        icon: <HeartPulse size={14} />, tint: 'var(--ap-600)', bg: 'var(--ap-50)',
        title: t('patients.tlVisite'),
        subtitle: v.motifPrincipal?.libelle ?? undefined,
        badge: t(cfg.labelKey), badgeTint: cfg.tint, badgeBg: cfg.bg,
        consultationId: consult?.id,
      })
    }

    for (const c of consultations as any[]) {
      const cfg = STATUT_CONSULT[c.statut] ?? STATUT_CONSULT.CLOTUREE
      const decision = c.decisionMedicale ? labelDecision(c.decisionMedicale) : null
      list.push({
        key: `c-${c.id}`, date: c.createdAt, kind: 'CONSULTATION',
        icon: <Stethoscope size={14} />, tint: cfg.tint, bg: cfg.bg,
        title: t('patients.tlConsultation'),
        subtitle: c.visite?.motifPrincipal?.libelle + (decision ? t('patients.tlDecisionPrefix', { decision }) : ''),
        badge: t(cfg.labelKey), badgeTint: cfg.tint, badgeBg: cfg.bg,
        consultationId: c.id,
      })
    }

    for (const d of documents) {
      const m = DOC_META[d.type]
      const Icon = m.icon
      list.push({
        key: `d-${d.type}-${d.id}`, date: d.date, kind: 'DOCUMENT',
        icon: <Icon size={14} />, tint: m.tint, bg: m.bg,
        title: t(m.labelKey), subtitle: d.details || d.motif, badge: d.statut,
        consultationId: d.consultationId,
      })
    }

    for (const h of dossier.historiquesCateg) {
      list.push({
        key: `h-${h.id}`, date: h.dateEffet ?? h.createdAt, kind: 'CATEGORIE',
        icon: <Tag size={14} />, tint: 'var(--texte-secondaire)', bg: 'var(--fond-surface-2)',
        title: h.ancienneCategId ? t('patients.tlCategoryChange') : t('patients.tlInitialCategory'),
        subtitle: `→ ${h.nouvelleCategorie.libelle}${h.motif ? ` · ${h.motif}` : ''}`,
      })
    }

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [visites, consultations, documents, dossier.historiquesCateg, t])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const e of events) c[e.kind] = (c[e.kind] ?? 0) + 1
    return c
  }, [events])

  const filtered = filtre === 'TOUS' ? events : events.filter(e => e.kind === filtre)
  const isLoading = loadC || loadD || loadV

  return (
    <div>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <GitCommitVertical size={15} style={{ color: 'var(--ap-600)' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--texte-primaire)' }}>{t('patients.chronologyTitle')}</span>
        <span style={{ fontSize: 11, color: 'var(--texte-tertiaire)', background: 'var(--fond-surface-2)', padding: '1px 7px', borderRadius: 99 }}>
          {t(events.length > 1 ? 'patients.eventCountPlural' : 'patients.eventCountSingular', { count: events.length })}
        </span>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {FILTERS.map(f => {
          const active = filtre === f.key
          const n = f.key === 'TOUS' ? events.length : (counts[f.key] ?? 0)
          return (
            <button
              key={f.key}
              onClick={() => setFiltre(f.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 9999, cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                border: `1px solid ${active ? 'var(--ap-400)' : 'var(--bordure-normale)'}`,
                background: active ? 'var(--ap-100)' : 'var(--fond-surface)',
                color: active ? 'var(--ap-700)' : 'var(--texte-secondaire)',
              }}
            >
              {t(f.labelKey)}
              <span style={{ fontSize: 10, opacity: 0.8 }}>{n}</span>
            </button>
          )
        })}
      </div>

      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 8, color: 'var(--texte-tertiaire)' }}>
          <Loader2 size={16} className="animate-spin" />
          <span style={{ fontSize: 13 }}>{t('patients.loading')}</span>
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <EmptyState
          icon={<GitCommitVertical size={20} />}
          title={filtre !== 'TOUS' ? t('patients.tlEmptyTyped') : t('patients.tlEmpty')}
          variant="subtle"
        />
      )}

      {/* Timeline */}
      {!isLoading && filtered.length > 0 && (
        <div style={{ maxWidth: 680 }}>
          {filtered.map((e, i) => {
            const clickable = !!e.consultationId
            const isLast = i === filtered.length - 1
            return (
              <div key={e.key} style={{ display: 'flex', gap: 14 }}>
                {/* Axe */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                    background: e.bg, color: e.tint,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid var(--bordure-legere)',
                  }}>
                    {e.icon}
                  </div>
                  {!isLast && <div style={{ flex: 1, width: 1, background: 'var(--bordure-legere)', minHeight: 14 }} />}
                </div>

                {/* Contenu */}
                <div style={{ paddingBottom: 18, flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--texte-tertiaire)' }}>{fmtDate(e.date)}</span>
                    <span style={{ fontSize: 10, color: 'var(--bordure-normale)' }}>·</span>
                    <span style={{ fontSize: 11, color: 'var(--texte-tertiaire)' }}>{fmtTime(e.date)}</span>
                  </div>

                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => clickable && navigate('/consultations', { state: { openConsultationId: e.consultationId } })}
                    title={clickable ? t('patients.openConsultation') : undefined}
                    style={{
                      width: '100%', textAlign: 'left',
                      background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)',
                      borderRadius: 8, padding: '11px 13px',
                      cursor: clickable ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', gap: 10,
                      transition: 'border-color 0.12s, background 0.12s',
                    }}
                    onMouseEnter={ev => { if (clickable) { ev.currentTarget.style.borderColor = 'var(--ap-300)'; ev.currentTarget.style.background = 'var(--fond-surface-2)' } }}
                    onMouseLeave={ev => { ev.currentTarget.style.borderColor = 'var(--bordure-legere)'; ev.currentTarget.style.background = 'var(--fond-surface)' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--texte-primaire)' }}>{e.title}</span>
                        {e.badge && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em',
                            padding: '2px 7px', borderRadius: 9999,
                            background: e.badgeBg ?? 'var(--fond-surface-2)',
                            color: e.badgeTint ?? 'var(--texte-secondaire)',
                            border: e.badgeBg ? 'none' : '1px solid var(--bordure-legere)',
                          }}>
                            {e.badge}
                          </span>
                        )}
                      </div>
                      {e.subtitle && (
                        <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--texte-secondaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.subtitle}
                        </p>
                      )}
                    </div>
                    {clickable && <ChevronRight size={15} style={{ color: 'var(--texte-tertiaire)', flexShrink: 0 }} />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
