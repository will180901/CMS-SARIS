/**
 * SuiviTab — suivi clinique du dossier, sur trois axes (recueil) :
 *   1. Évolution des pathologies chroniques (occurrences + suivi formel s'il existe)
 *   2. Traitement (historique des lignes d'ordonnances validées)
 *   3. Résultats d'examens
 * Calculé sur l'historique COMPLET du patient, tous sites (dossier centralisé) —
 * chaque ligne cliquable ouvre son document EN PLACE : page détail interne à
 * l'onglet (aperçu A4 de l'ordonnance, contenu du résultat) avec bouton retour.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Activity, TrendingUp, Pill, FlaskConical, Loader2, ChevronRight,
} from 'lucide-react'
import { EmptyState, StatusPill } from '@/components/saris'
import { formatDate, formatTime } from '@/lib/intl'
import { labelStatut } from '@/config/labels'
import { usePatientSuivi } from '../../hooks/usePatients'
import { DossierDetailPanel } from './DossierDetailPanel'
import type { DossierDetailTarget } from './DossierDetailPanel'
import type { SuiviChroniqueItem, SuiviTraitementItem, SuiviResultatExamenItem } from '../../api/patients.api'

// ── Ligne cliquable générique (renvoie vers la consultation d'origine) ─────────

function ClickableRow({
  icon, tint, bg, title, subtitle, badge, badgeTone, date, onClick,
}: {
  icon: React.ReactNode
  tint: string
  bg:   string
  title: string
  subtitle?: string
  badge?: string
  badgeTone?: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'accent' | 'gold'
  date: string
  onClick?: () => void
}) {
  const clickable = !!onClick
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left',
        background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)',
        borderRadius: 8, padding: '11px 13px',
        cursor: clickable ? 'pointer' : 'default',
        display: 'flex', alignItems: 'center', gap: 12,
        transition: 'border-color 0.12s, background 0.12s',
      }}
      onMouseEnter={ev => { if (clickable) { ev.currentTarget.style.borderColor = 'var(--ap-300)'; ev.currentTarget.style.background = 'var(--fond-surface-2)' } }}
      onMouseLeave={ev => { ev.currentTarget.style.borderColor = 'var(--bordure-legere)'; ev.currentTarget.style.background = 'var(--fond-surface)' }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: bg, color: tint,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--texte-primaire)' }}>{title}</span>
          {badge && <StatusPill tone={badgeTone ?? 'neutral'}>{badge}</StatusPill>}
        </div>
        {subtitle && (
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--texte-secondaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {subtitle}
          </p>
        )}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--texte-tertiaire)' }}>{formatDate(date, { day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
        <div style={{ fontSize: 10, color: 'var(--texte-quaternaire)' }}>{formatTime(date, { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
      {clickable && <ChevronRight size={15} style={{ color: 'var(--texte-tertiaire)', flexShrink: 0 }} />}
    </button>
  )
}

// ── Section : évolution des pathologies chroniques ──────────────────────────────

function ChroniqueCard({ item }: { item: SuiviChroniqueItem }) {
  const { t } = useTranslation()
  const suivi = item.suivi
  return (
    <div style={{
      border: '1px solid var(--bordure-legere)', borderRadius: 8,
      background: 'var(--fond-surface)', padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--texte-primaire)' }}>{item.pathologie.libelle}</span>
        <StatusPill tone="neutral">
          {t(item.occurrences > 1 ? 'patients.suiviOccurrencePlural' : 'patients.suiviOccurrenceSingular', { count: item.occurrences })}
        </StatusPill>
        <StatusPill tone={suivi ? 'success' : 'neutral'}>
          {suivi ? t('patients.suiviChroniqueSuiviActif') : t('patients.suiviChroniqueSansSuivi')}
        </StatusPill>
      </div>

      {suivi && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8, fontSize: 12, color: 'var(--texte-secondaire)' }}>
          {suivi.frequenceSuivi && <span><strong style={{ color: 'var(--texte-tertiaire)', fontWeight: 600 }}>{t('patients.suiviFrequence')} : </strong>{suivi.frequenceSuivi}</span>}
          {suivi.objectifs && <span><strong style={{ color: 'var(--texte-tertiaire)', fontWeight: 600 }}>{t('patients.suiviObjectifs')} : </strong>{suivi.objectifs}</span>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--texte-tertiaire)' }}>
        <span>{t('patients.suiviPremierDiagnostic')} : {formatDate(item.premierDiagnostic, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        <span>{t('patients.suiviDernierDiagnostic')} : {formatDate(item.dernierDiagnostic, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span style={{ color: 'var(--ap-600)', display: 'flex' }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--texte-primaire)' }}>{title}</span>
    </div>
  )
}

function EmptySection({ text }: { text: string }) {
  return <p style={{ fontSize: 13, color: 'var(--texte-tertiaire)', fontStyle: 'italic', margin: 0 }}>{text}</p>
}

export function SuiviTab({ patientId }: { patientId: string }) {
  const { t } = useTranslation()
  const { data, isLoading } = usePatientSuivi(patientId)
  const [detail, setDetail] = useState<DossierDetailTarget | null>(null)

  // Page détail interne : remplace le contenu de l'onglet (pas de modale).
  if (detail) return <DossierDetailPanel target={detail} onBack={() => setDetail(null)} />

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 8, color: 'var(--texte-tertiaire)' }}>
        <Loader2 size={16} className="animate-spin" />
        <span style={{ fontSize: 13 }}>{t('patients.loading')}</span>
      </div>
    )
  }

  const chroniques       = data?.chroniques ?? []
  const traitements       = data?.traitements ?? []
  const resultatsExamens  = data?.resultatsExamens ?? []
  const tout = chroniques.length + traitements.length + resultatsExamens.length

  return (
    <div>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <Activity size={15} style={{ color: 'var(--ap-600)' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--texte-primaire)' }}>{t('patients.suiviTitle')}</span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--texte-tertiaire)', margin: '0 0 20px' }}>{t('patients.suiviIntro')}</p>

      {tout === 0 ? (
        <EmptyState icon={<Activity size={20} />} title={t('patients.suiviEmptyChroniques')} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          {/* 1. Évolution des pathologies chroniques */}
          <div>
            <SectionHeader icon={<TrendingUp size={14} />} title={t('patients.suiviSectionChroniques')} />
            {chroniques.length === 0 ? (
              <EmptySection text={t('patients.suiviEmptyChroniques')} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {chroniques.map(c => <ChroniqueCard key={c.pathologieId} item={c} />)}
              </div>
            )}
          </div>

          {/* 2. Traitement */}
          <div>
            <SectionHeader icon={<Pill size={14} />} title={t('patients.suiviSectionTraitements')} />
            {traitements.length === 0 ? (
              <EmptySection text={t('patients.suiviEmptyTraitements')} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 680 }}>
                {traitements.map((tr: SuiviTraitementItem) => (
                  <ClickableRow
                    key={tr.ligneId}
                    icon={<Pill size={14} />} tint="var(--ap-600)" bg="var(--ap-50)"
                    title={tr.medicament}
                    subtitle={`${tr.posologie} · ${tr.duree} · ${tr.voieAdmin}`}
                    badge={labelStatut('ordonnance', tr.statutOrdonnance)}
                    badgeTone={tr.statutOrdonnance === 'VALIDEE' ? 'success' : tr.statutOrdonnance === 'ANNULEE' ? 'error' : 'neutral'}
                    date={tr.date}
                    onClick={() => setDetail({ kind: 'ORDONNANCE', consultationId: tr.consultationId, ordonnanceId: tr.ordonnanceId })}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 3. Résultats d'examens */}
          <div>
            <SectionHeader icon={<FlaskConical size={14} />} title={t('patients.suiviSectionExamens')} />
            {resultatsExamens.length === 0 ? (
              <EmptySection text={t('patients.suiviEmptyExamens')} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 680 }}>
                {resultatsExamens.map((r: SuiviResultatExamenItem) => (
                  <ClickableRow
                    key={r.id}
                    icon={<FlaskConical size={14} />} tint="var(--info-accent)" bg="var(--info-fond)"
                    title={r.examens.length > 0 ? r.examens.join(', ') : t('patients.suiviExamensRealises')}
                    subtitle={[r.laboratoire, r.interpretation].filter(Boolean).join(' · ') || undefined}
                    badge={labelStatut('resultat_examen', r.statut)}
                    date={r.date}
                    onClick={() => setDetail({ kind: 'RESULTAT', consultationId: r.consultationId, bonId: r.bonId, resultat: r })}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
