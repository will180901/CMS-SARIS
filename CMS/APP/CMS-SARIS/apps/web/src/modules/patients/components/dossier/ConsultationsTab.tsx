/**
 * ConsultationsTab — Historique des consultations médicales d'un patient
 * Affiché dans le dossier patient · triées par date décroissante
 */

import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Stethoscope, ChevronRight, Pill, FileText, AlertCircle, Loader2 } from 'lucide-react'
import { EmptyState, StatusPill } from '@/components/saris'
import { labelDecision } from '@/config/labels'
import { usePatientConsultations } from '@/modules/consultation/hooks/useConsultation'
import { formatDuree } from '@/lib/duree'
import { formatDate as intlFormatDate } from '@/lib/intl'
import type { ConsultationListItem } from '@cms-saris/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return intlFormatDate(iso, {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

// ── Config statut ─────────────────────────────────────────────────────────────

// `labelKey` = clé i18n (résolue dans le composant, jamais au niveau module).
const STATUT_CONFIG = {
  OUVERTE:  { labelKey: 'patients.consultStatusOpen',      tone: 'info'    as const, bg: 'var(--info-fond)',   text: 'var(--info-texte)'   },
  CLOTUREE: { labelKey: 'patients.consultStatusClosed',    tone: 'success' as const, bg: 'var(--succes-fond)', text: 'var(--succes-texte)' },
  ANNULEE:  { labelKey: 'patients.consultStatusCancelled', tone: 'error'   as const, bg: 'var(--erreur-fond)', text: 'var(--erreur-texte)' },
} as const

// ── Carte consultation ────────────────────────────────────────────────────────

function ConsultationCard({ c }: { c: ConsultationListItem & { soignant?: { nom: string; prenom: string; role: string } | null } }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const cfg = STATUT_CONFIG[c.statut as keyof typeof STATUT_CONFIG] ?? STATUT_CONFIG.CLOTUREE

  const nbDiags = c._count?.diagnostics ?? 0
  const nbOrds  = c._count?.ordonnances ?? 0

  return (
    <div
      style={{
        background:   'var(--fond-surface)',
        border:       '1px solid var(--bordure-legere)',
        borderRadius: 10,
        overflow:     'hidden',
        transition:   'border-color .15s, box-shadow .15s',
        cursor:       'pointer',
      }}
      onClick={() => navigate('/consultations', { state: { openConsultationId: c.id } })}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--ap-300)'
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--bordure-legere)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        background: 'var(--fond-surface-2)',
        borderBottom: '1px solid var(--bordure-legere)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: cfg.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Stethoscope size={13} style={{ color: cfg.text }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: 'var(--texte-primaire)', lineHeight: 1 }}>
              {formatDate(c.createdAt)}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--texte-tertiaire)' }}>
              {c.visite.motifPrincipal.libelle}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Statut badge */}
          <StatusPill tone={cfg.tone}>{t(cfg.labelKey)}</StatusPill>

          {/* Lien vers consultation ouverte */}
          {c.statut === 'OUVERTE' && (
            <ChevronRight size={14} style={{ color: 'var(--ap-600)', flexShrink: 0 }} />
          )}
        </div>
      </div>

      {/* Corps */}
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>

        {/* Soignant + durée */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {c.soignant && (
            <span style={{ fontSize: '12px', color: 'var(--texte-secondaire)' }}>
              <span style={{ color: 'var(--texte-tertiaire)' }}>{t('patients.caregiverLabel')}</span>
              {c.soignant.prenom} {c.soignant.nom}
            </span>
          )}
          {c.closedAt && (
            <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)' }}>
              {t('patients.durationLabel', { duration: formatDuree(c.createdAt, c.closedAt ?? undefined, { precis: true }) })}
            </span>
          )}
        </div>

        {/* Décision médicale */}
        {(c as any).decisionMedicale && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <FileText size={11} style={{ color: 'var(--ap-600)', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: 'var(--texte-secondaire)' }}>
              {labelDecision((c as any).decisionMedicale)}
            </span>
          </div>
        )}

        {/* Compteurs */}
        <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
          {nbDiags > 0 && (
            <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle size={11} style={{ color: 'var(--ap-600)' }} />
              {t(nbDiags > 1 ? 'patients.diagnosticCountPlural' : 'patients.diagnosticCountSingular', { count: nbDiags })}
            </span>
          )}
          {nbOrds > 0 && (
            <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Pill size={11} style={{ color: 'var(--ap-600)' }} />
              {t(nbOrds > 1 ? 'patients.ordonnanceCountPlural' : 'patients.ordonnanceCountSingular', { count: nbOrds })}
            </span>
          )}
          {nbDiags === 0 && nbOrds === 0 && (
            <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', fontStyle: 'italic' }}>
              {t('patients.noActRecorded')}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Onglet principal ──────────────────────────────────────────────────────────

interface Props {
  patientId: string
}

export function ConsultationsTab({ patientId }: Props) {
  const { t } = useTranslation()
  const { data: consultations = [], isLoading } = usePatientConsultations(patientId)

  // Trier : ouvertes en premier, puis par date décroissante
  const sorted = [...consultations].sort((a, b) => {
    if (a.statut === 'OUVERTE' && b.statut !== 'OUVERTE') return -1
    if (b.statut === 'OUVERTE' && a.statut !== 'OUVERTE') return 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const ouvertes  = consultations.filter(c => c.statut === 'OUVERTE').length

  return (
    <div>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Stethoscope size={15} style={{ color: 'var(--ap-600)' }} />
        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--texte-primaire)' }}>
          {t('patients.consultationsTitle')}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{
            fontSize: '11px', color: 'var(--texte-tertiaire)',
            background: 'var(--fond-surface-2)', padding: '1px 7px', borderRadius: 99,
          }}>
            {t('patients.totalCount', { count: consultations.length })}
          </span>
          {ouvertes > 0 && (
            <span style={{
              fontSize: '11px', fontWeight: '600',
              background: 'var(--info-fond)', color: 'var(--info-texte)',
              padding: '1px 7px', borderRadius: 99,
            }}>
              {t(ouvertes > 1 ? 'patients.openCountPlural' : 'patients.openCountSingular', { count: ouvertes })}
            </span>
          )}
        </div>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 8, color: 'var(--texte-tertiaire)' }}>
          <Loader2 size={16} className="animate-spin" />
          <span style={{ fontSize: '13px' }}>{t('patients.loading')}</span>
        </div>
      )}

      {!isLoading && consultations.length === 0 && (
        <EmptyState
          icon={<Stethoscope size={20} />}
          title={t('patients.consultEmptyTitle')}
          description={t('patients.consultEmptyDesc')}
          variant="subtle"
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 680 }}>
        {sorted.map(c => (
          <ConsultationCard key={c.id} c={c as any} />
        ))}
      </div>
    </div>
  )
}
