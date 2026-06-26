/**
 * DashboardPage — tableau de bord adaptatif par persona (rôle + permissions).
 *
 *   - Soignant clinique (médecin-chef / médecin / infirmier) → activité
 *     (file, urgences, tendance, affluence, motifs)
 *   - Admin système → gouvernance système (comptes, auth, audit, sessions)
 *
 * Chaque persona ne charge QUE ses données (hooks conditionnés par permission).
 * Graphes : composants SARIS (recharts) — couleurs charte, dark-mode auto.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useIsCompact } from '@/hooks/useMediaQuery'
import {
  Activity, HeartPulse, Stethoscope, Pill, ClipboardList,
  Clock, Users, FileWarning, Ambulance, HardHat, Clock3, ChevronRight,
  TrendingUp, BarChart3, ShieldCheck, ShieldAlert, KeyRound,
  Download, Printer,
} from 'lucide-react'
import {
  StatCard, Card, EmptyState, Skeleton, Button, Avatar,
  AreaTrend, MiniBars, DonutChart, SparkLine, CHART_PALETTE,
  type DonutSlice,
} from '@/components/saris'
import { formatDuree, elapsedMinutes } from '@/lib/duree'
import { formatDate, formatTime } from '@/lib/intl'
import { usePermissions } from '@/hooks/usePermissions'
import { useSessionStore } from '@/stores/session.store'
import {
  useOverview, useUrgences, useMotifsJour, useTendance, useAffluence,
  useAdminSystemStats, useStatistiques,
} from '../hooks/useDashboard'
import { exportStatsCsv, exportStatsPdf } from '../lib/statsExport'
import { useAuditActions } from '@/modules/admin/hooks/useAdmin'
import { labelAction, labelEntite, labelModule } from '@/config/labels'
import type { UrgenceVisite } from '../api/dashboard.api'
import { getPrimaryRole, ROLE_META } from '@/config/navigation.config'
import { DelegationsWidget } from '../components/DelegationsWidget'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** "2026-05-19" → "19/05" */
function shortDate(iso: string): string {
  const parts = iso.split('-')
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : iso
}

const GRID_AUTO: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
  gap: 'var(--espace-3)',
}

// ── Carte graphique réutilisable (Card + en-tête + corps graphe) ──────────────

function ChartCard({ icon, title, subtitle, actions, loading, empty, emptyLabel, children, minHeight = 240 }: {
  icon: React.ReactNode; title: string; subtitle?: string
  actions?: React.ReactNode; loading?: boolean
  empty?: boolean; emptyLabel?: string
  children: React.ReactNode; minHeight?: number
}) {
  const { t } = useTranslation()
  return (
    <Card>
      <Card.Header icon={icon} title={title} subtitle={subtitle} actions={actions} />
      <Card.Body>
        {loading ? (
          <Skeleton height={minHeight - 40} />
        ) : empty ? (
          <div style={{ minHeight: minHeight - 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-tertiaire)', fontStyle: 'italic' }}>
              {emptyLabel ?? t('dashboard.chartEmpty')}
            </p>
          </div>
        ) : children}
      </Card.Body>
    </Card>
  )
}

// ── Page principale ──────────────────────────────────────────────────────────

export function DashboardPage() {
  const { t } = useTranslation()
  const user = useSessionStore(s => s.user)
  const { hasAny } = usePermissions()
  const compact = useIsCompact()

  const role = user ? getPrimaryRole(user.roles) : null
  const roleMeta = role ? ROLE_META[role] : null

  // Persona = fonction de l'utilisateur. On s'appuie d'abord sur le RÔLE primaire
  // (la fonction réelle), avec repli sur les permissions pour les rôles custom.
  // Ainsi un ADMIN_SYSTEME qui s'est accordé des droits cliniques élargis (pour
  // tester) voit malgré tout SON tableau de bord système — et non la vue clinique.
  // 4 rôles : ADMIN_SYSTEME → vue système ; MEDECIN_CHEF / MEDECIN / INFIRMIER →
  // vue clinique (le médecin-chef = admin médical garde sa vue clinique, la
  // gouvernance se fait via les menus Référentiels/Personnel/Audit). Repli par
  // permissions pour d'éventuels rôles personnalisés.
  const persona: 'clinique' | 'admin-systeme' | 'autre' =
      role === 'ADMIN_SYSTEME'                        ? 'admin-systeme'
    : (role && ['MEDECIN_CHEF', 'INFIRMIER'].includes(role)) ? 'clinique'
    // Rôles personnalisés → déduction par permissions
    : hasAny('visite.read', 'consultation.read')      ? 'clinique'
    : hasAny('utilisateur.read', 'role.read', 'audit.read')         ? 'admin-systeme'
    : 'autre'

  const isClinique = persona === 'clinique'
  const isAdminSys = persona === 'admin-systeme'

  const hour = new Date().getHours()
  const greeting = hour < 6 ? t('dashboard.greetingNight') : hour < 12 ? t('dashboard.greetingMorning') : hour < 18 ? t('dashboard.greetingAfternoon') : t('dashboard.greetingEvening')

  const titre =
      isAdminSys ? t('dashboard.titleAdminSys')
    : t('dashboard.titleClinique')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>

      {/* Hero — salutation contextuelle */}
      <div style={{
        padding: compact ? 'var(--espace-4)' : 'var(--espace-6) var(--espace-6) var(--espace-4)',
        background: 'var(--fond-surface)',
        borderBottom: '1px solid var(--bordure-legere)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-4)' }}>
          {user && <Avatar nom={user.login} size={compact ? 44 : 56} tone={isClinique ? 'accent' : 'gold'} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              margin: 0, fontSize: 'var(--font-size-overline)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--texte-tertiaire)',
            }}>
              {greeting}{roleMeta && ` · ${roleMeta.label}`}
            </p>
            <h1 style={{
              margin: '4px 0 0', fontSize: 'var(--font-size-h1)', fontWeight: 700,
              color: 'var(--texte-primaire)', letterSpacing: '-0.02em',
            }}>
              {titre}
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-tertiaire)' }}>
              {formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding: compact ? 'var(--espace-3)' : 'var(--espace-4) var(--espace-6) var(--espace-6)' }}>
        {isClinique && <ClinicalView />}
        {isAdminSys && <AdminSystemView />}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  VUE CLINIQUE
// ══════════════════════════════════════════════════════════════════════════════

function ClinicalView() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const compact = useIsCompact()
  const { has } = usePermissions()
  const { data: overview, isLoading: lo } = useOverview()
  const { data: urgences = [], isLoading: lu } = useUrgences()
  const { data: motifs = [], isLoading: lm } = useMotifsJour()
  const { data: tendance = [], isLoading: lt } = useTendance()
  const { data: affluence = [], isLoading: la } = useAffluence()

  // Sparkline KPI visites = 7 derniers jours
  const spark7 = useMemo(() => tendance.slice(-7), [tendance])

  // Alerte contextuelle (la plus critique en premier)
  const urgencesAnciennes = urgences.filter(u => elapsedMinutes(u.dateOuverture) > 30).length
  const alerte =
      urgencesAnciennes > 0
        ? { tone: 'warning' as const, icon: <Clock3 size={16} />, msg: t(urgencesAnciennes > 1 ? 'dashboard.alertWaitingOther' : 'dashboard.alertWaitingOne', { count: urgencesAnciennes }) }
    : (overview && overview.tempsAttenteMoyenMin !== null && overview.tempsAttenteMoyenMin > 60)
        ? { tone: 'warning' as const, icon: <Clock size={16} />, msg: t('dashboard.alertAvgWaitHigh', { min: overview.tempsAttenteMoyenMin }) }
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)' }}>

      {alerte && <AlertBanner tone={alerte.tone} icon={alerte.icon} message={alerte.msg} />}

      {/* KPI principaux */}
      <div style={GRID_AUTO}>
        {lo ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={120} />)
        ) : overview ? (
          <>
            <StatCardSpark
              icon={<HeartPulse size={18} />} label={t('dashboard.kpiVisitsToday')} value={overview.visitesAujourdhui}
              tone="accent"
              trend={overview.tendanceVisitesPct !== null ? {
                value: t('dashboard.kpiTrendVsYesterday', { sign: overview.tendanceVisitesPct > 0 ? '+' : '', pct: overview.tendanceVisitesPct }),
                direction: overview.tendanceVisitesPct > 0 ? 'up' : overview.tendanceVisitesPct < 0 ? 'down' : 'flat',
                tone: overview.tendanceVisitesPct > 0 ? 'positive' : overview.tendanceVisitesPct < 0 ? 'negative' : 'neutral',
              } : undefined}
              hint={t('dashboard.kpiVisitsHint', { enCours: overview.visitesEnCours, attente: overview.visitesAttente })}
              spark={spark7} sparkColor="var(--ap-400)"
              onClick={has('visite.read') ? () => navigate('/triage') : undefined}
            />
            <StatCard
              icon={<ClipboardList size={18} />} label={t('dashboard.kpiVisitsWaiting')} value={overview.visitesAttente}
              tone={overview.visitesAttente > 0 ? 'warning' : 'success'}
              hint={overview.visitesAttente > 0 ? t('dashboard.kpiInQueue') : t('dashboard.kpiQueueEmpty')}
              onClick={has('visite.read') ? () => navigate('/triage') : undefined}
            />
            <StatCard
              icon={<Clock size={18} />} label={t('dashboard.kpiAvgWaitTime')}
              value={overview.tempsAttenteMoyenMin !== null ? t('dashboard.kpiMinUnit', { min: overview.tempsAttenteMoyenMin }) : '—'}
              tone={overview.tempsAttenteMoyenMin === null ? 'neutral' : overview.tempsAttenteMoyenMin < 30 ? 'success' : overview.tempsAttenteMoyenMin < 60 ? 'warning' : 'error'}
              hint={t('dashboard.kpiClosedVisitsHint')}
            />
            <StatCard
              icon={<Stethoscope size={18} />} label={t('dashboard.kpiActiveConsultations')} value={overview.consultationsActives}
              tone="accent" hint={t('dashboard.kpiClosedTodayHint', { count: overview.consultationsClotureesJour })}
              onClick={has('consultation.read') ? () => navigate('/consultations') : undefined}
            />
          </>
        ) : null}
      </div>

      {/* Tendance 14j + Affluence horaire */}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1.5fr 1fr', gap: 'var(--espace-4)' }}>
        <ChartCard
          icon={<TrendingUp size={15} />} title={t('dashboard.chartTrendTitle')} subtitle={t('dashboard.chartTrendSubtitle')}
          loading={lt} empty={tendance.every(t => t.visites === 0)} emptyLabel={t('dashboard.chartTrendEmpty')}
        >
          <AreaTrend
            data={tendance} xKey="date" xTickFormatter={shortDate}
            series={[
              { key: 'visites',   label: t('dashboard.seriesVisits'),   color: 'var(--ap-400)' },
              { key: 'cloturees', label: t('dashboard.seriesClosed'), color: 'var(--succes-accent)' },
            ]}
          />
        </ChartCard>

        <ChartCard
          icon={<BarChart3 size={15} />} title={t('dashboard.chartAffluenceTitle')} subtitle={t('dashboard.chartAffluenceSubtitle')}
          loading={la} empty={affluence.every(a => a.count === 0)} emptyLabel={t('dashboard.chartAffluenceEmpty')}
        >
          <MiniBars data={affluence} xKey="label" yKey="count" unit={t('dashboard.affluenceUnit')} color="var(--ap-400)" />
        </ChartCard>
      </div>

      {/* Urgences + Motifs (donut) */}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1.4fr 1fr', gap: 'var(--espace-4)' }}>
        <Card>
          <Card.Header
            icon={<ClipboardList size={15} />} title={t('dashboard.queueTitle')} subtitle={t('dashboard.queueSubtitle')}
            actions={has('visite.read') ? (
              <Button variant="ghost" size="sm" onClick={() => navigate('/triage')}>{t('dashboard.seeAll')} <ChevronRight size={14} /></Button>
            ) : null}
          />
          <Card.Body padding="none">
            {lu ? (
              <div style={{ padding: 'var(--espace-3)' }}>
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={56} style={{ marginBottom: 6 }} />)}
              </div>
            ) : urgences.length === 0 ? (
              <EmptyState title={t('dashboard.queueEmptyTitle')} description={t('dashboard.queueEmptyDescription')} variant="subtle" icon={<ClipboardList size={20} />} />
            ) : (
              urgences.map((u, i) => <UrgenceRow key={u.id} u={u} rank={i + 1} striped={i % 2 === 1} />)
            )}
          </Card.Body>
        </Card>

        <ChartCard
          icon={<TrendingUp size={15} />} title={t('dashboard.topMotifsTitle')} subtitle={t('dashboard.topMotifsSubtitle')}
          loading={lm} empty={motifs.length === 0} emptyLabel={t('dashboard.motifsEmpty')}
          minHeight={220}
        >
          <DonutChart
            height={180} centerLabel={t('dashboard.donutVisits')}
            data={motifs.map((m, i): DonutSlice => ({
              name: m.libelle, value: m.count,
              color: CHART_PALETTE[i % CHART_PALETTE.length],
            }))}
          />
        </ChartCard>
      </div>

      {/* Suivis & sorties critiques */}
      {overview && (
        <div style={GRID_AUTO}>
          <StatCard icon={<Pill size={16} />} label={t('dashboard.kpiValidatedPrescriptions')} value={overview.ordonnancesValideesJour} tone="success" hint={t('dashboard.today')} />
          <StatCard icon={<FileWarning size={16} />} label={t('dashboard.kpiExamFormsPending')} value={overview.bonsExamenAttente} tone={overview.bonsExamenAttente > 0 ? 'warning' : 'neutral'} hint={t('dashboard.examFormsHint')} />
          <StatCard icon={<Ambulance size={16} />} label={t('dashboard.kpiEvacuationsInProgress')} value={overview.evacuationsEnCours} tone={overview.evacuationsEnCours > 0 ? 'error' : 'neutral'} />
          <StatCard icon={<HardHat size={16} />} label={t('dashboard.kpiWorkAccidents')} value={overview.accidentsTravailOuverts} tone={overview.accidentsTravailOuverts > 0 ? 'warning' : 'neutral'} hint={t('dashboard.workAccidentsHint')} />
          <StatCard icon={<Activity size={16} />} label={t('dashboard.kpiChronicFollowups')} value={overview.suivisChroniquesActifs} tone="accent" hint={t('dashboard.chronicFollowupsHint')} />
        </div>
      )}

      <StatistiquesSection />

      {has('delegation.read') && <DelegationsWidget />}
    </div>
  )
}

// ── StatCard avec sparkline (composition autour de StatCard) ──────────────────

function StatCardSpark({
  spark, sparkColor, ...props
}: React.ComponentProps<typeof StatCard> & {
  spark: Array<{ date: string; visites: number }>; sparkColor: string
}) {
  const hasSpark = spark.length > 1 && spark.some(s => s.visites > 0)
  return (
    <div style={{ position: 'relative' }}>
      <StatCard {...props} />
      {hasSpark && (
        <div style={{ position: 'absolute', left: 'var(--espace-4)', right: 'var(--espace-4)', bottom: 8, height: 28, opacity: 0.55, pointerEvents: 'none' }}>
          <SparkLine data={spark} dataKey="visites" color={sparkColor} height={28} />
        </div>
      )}
    </div>
  )
}

// ── Bannière d'alerte contextuelle ────────────────────────────────────────────

function AlertBanner({ tone, icon, message }: { tone: 'error' | 'warning'; icon: React.ReactNode; message: string }) {
  const c = tone === 'error'
    ? { bg: 'var(--erreur-fond)', bd: 'var(--erreur-bordure)', fg: 'var(--erreur-texte)', ac: 'var(--erreur-accent)' }
    : { bg: 'var(--avert-fond)', bd: 'var(--avert-bordure)', fg: 'var(--avert-texte)', ac: 'var(--avert-accent)' }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--espace-3)',
      padding: 'var(--espace-3) var(--espace-4)', borderRadius: 'var(--radius-lg)',
      background: c.bg, border: `1px solid ${c.bd}`,
    }}>
      <span style={{ color: c.ac, flexShrink: 0, display: 'flex' }}>{icon}</span>
      <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', fontWeight: 500, color: c.fg }}>{message}</p>
    </div>
  )
}

// ── Item urgence ──────────────────────────────────────────────────────────────

function UrgenceRow({ u, rank, striped }: { u: UrgenceVisite; rank: number; striped: boolean }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate('/triage')}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--espace-3)',
        padding: 'var(--espace-3) var(--espace-4)',
        background: striped ? 'var(--fond-surface-2)' : 'transparent',
        border: 'none', borderBottom: '1px solid var(--bordure-legere)',
        cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 0.12s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--ap-50)')}
      onMouseLeave={e => (e.currentTarget.style.background = striped ? 'var(--fond-surface-2)' : 'transparent')}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 'var(--radius-md)',
        background: 'var(--ap-50)', color: 'var(--ap-600)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: 'var(--font-size-body-sm)', flexShrink: 0,
      }}>
        {rank}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', fontWeight: 600, color: 'var(--texte-primaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {u.patient.identite ? `${u.patient.identite.prenom} ${u.patient.identite.nom}` : u.patient.numeroPatient}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {u.motifPrincipal.libelle}
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        <span style={{
          fontSize: 'var(--font-size-body-sm)', fontWeight: 700,
          color: (() => { const m = elapsedMinutes(u.dateOuverture); return m > 60 ? 'var(--erreur-accent)' : m > 30 ? 'var(--avert-accent)' : 'var(--texte-secondaire)' })(),
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <Clock3 size={12} /> {formatDuree(u.dateOuverture)}
        </span>
        <span style={{ fontSize: 'var(--font-size-overline)', color: 'var(--texte-tertiaire)' }}>
          {t('dashboard.arrivedAt', { time: formatTime(u.dateOuverture) })}
        </span>
      </div>
      <ChevronRight size={14} style={{ color: 'var(--texte-tertiaire)' }} />
    </button>
  )
}

// ── Statistiques d'activité (type × pathologie × catégorie + repos) ───────────

function StatBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ margin: '0 0 10px', fontSize: 'var(--font-size-overline)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, color: 'var(--texte-tertiaire)' }}>{title}</p>
      {children}
    </div>
  )
}

function RankedBars({ data }: { data: { libelle: string; count: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.count))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-primaire)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.libelle}</span>
          <div style={{ width: 160, height: 8, borderRadius: 9999, background: 'var(--fond-surface-2)', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ width: `${(d.count / max) * 100}%`, height: '100%', background: 'var(--ap-400)', borderRadius: 9999 }} />
          </div>
          <span style={{ minWidth: 28, textAlign: 'right', fontSize: 'var(--font-size-body-sm)', fontVariantNumeric: 'tabular-nums', color: 'var(--texte-secondaire)', flexShrink: 0, fontWeight: 700 }}>{d.count}</span>
        </div>
      ))}
    </div>
  )
}

function StatistiquesSection() {
  const [days, setDays] = useState(30)
  const { from, to } = useMemo(() => {
    const t = new Date()
    const f = new Date(); f.setDate(f.getDate() - (days - 1))
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { from: fmt(f), to: fmt(t) }
  }, [days])
  const { data: stats, isLoading } = useStatistiques(true, { from, to })
  const empty = !stats || stats.totalConsultations === 0
  const PRESETS = [{ d: 7, l: '7 j' }, { d: 30, l: '30 j' }, { d: 90, l: '90 j' }, { d: 365, l: '1 an' }]

  return (
    <Card>
      <Card.Header
        icon={<BarChart3 size={15} />}
        title="Statistiques d'activité"
        subtitle={`${days} derniers jours — type × pathologie × catégorie`}
      />
      <Card.Body>
        {/* Période + exports (remplace le comptage Excel « Jeannette ») */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 'var(--espace-4)' }}>
          <div style={{ display: 'flex', gap: 4 }} role="group" aria-label="Période">
            {PRESETS.map(p => {
              const active = days === p.d
              return (
                <button key={p.d} type="button" onClick={() => setDays(p.d)}
                  style={{ height: 30, padding: '0 12px', borderRadius: 7, fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer',
                    background: active ? 'var(--ap-50)' : 'var(--fond-surface)', color: active ? 'var(--ap-700)' : 'var(--texte-secondaire)',
                    border: `1px solid ${active ? 'var(--ap-200)' : 'var(--bordure-normale)'}` }}>
                  {p.l}
                </button>
              )
            })}
          </div>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={() => stats && exportStatsCsv(stats)} disabled={empty} style={statExportBtn(empty)} title="Exporter en CSV (Excel)">
            <Download size={13} /> Excel
          </button>
          <button type="button" onClick={() => stats && exportStatsPdf(stats)} disabled={empty} style={statExportBtn(empty)} title="Exporter / imprimer en PDF">
            <Printer size={13} /> PDF
          </button>
        </div>

        {isLoading ? (
          <Skeleton height={260} />
        ) : empty || !stats ? (
          <div style={{ minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-tertiaire)', fontStyle: 'italic' }}>
              Aucune consultation clôturée sur la période.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-5)' }}>
            <div style={GRID_AUTO}>
              <StatCard icon={<Stethoscope size={18} />} label={`Consultations (${days} j)`} value={stats.totalConsultations} tone="accent" />
              <StatCard icon={<Activity size={18} />} label="Jours de repos prescrits" value={stats.repos.totalJours} tone="gold" hint={`${stats.repos.consultationsAvecRepos} consultation(s) avec repos`} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 'var(--espace-5)' }}>
              <StatBlock title="Par type de consultation">
                {stats.parType.length ? (
                  <DonutChart height={170} centerLabel="actes" data={stats.parType.slice(0, 6).map((s): DonutSlice => ({ name: s.libelle, value: s.count }))} />
                ) : <EmptyMini />}
              </StatBlock>
              <StatBlock title="Par catégorie de patient">
                {stats.parCategorie.length ? (
                  <DonutChart height={170} centerLabel="actes" data={stats.parCategorie.slice(0, 6).map((s): DonutSlice => ({ name: s.libelle, value: s.count }))} />
                ) : <EmptyMini />}
              </StatBlock>
            </div>

            <StatBlock title="Top pathologies (diagnostic principal)">
              {stats.parPathologie.length ? <RankedBars data={stats.parPathologie.slice(0, 8)} /> : <EmptyMini />}
            </StatBlock>
          </div>
        )}
      </Card.Body>
    </Card>
  )
}

function statExportBtn(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, padding: '0 11px', borderRadius: 7,
    fontSize: 12, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
    background: 'var(--fond-surface)', color: disabled ? 'var(--texte-tertiaire)' : 'var(--texte-secondaire)',
    border: '1px solid var(--bordure-normale)', opacity: disabled ? 0.5 : 1,
  }
}

function EmptyMini() {
  return (
    <p style={{ margin: '8px 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', fontStyle: 'italic' }}>
      Aucune donnée.
    </p>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  VUE ADMIN SYSTÈME
// ══════════════════════════════════════════════════════════════════════════════

function AdminSystemView() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const compact = useIsCompact()
  const { has } = usePermissions()
  const { data: stats, isLoading } = useAdminSystemStats(true)
  const canAudit = has('audit.read')
  const { data: recentRes } = useAuditActions({ limit: '8' }, canAudit)
  const recentActions = recentRes?.data ?? []

  const comptes = stats?.comptes
  const authEmpty = !stats || stats.authTrend.every(a => a.succes === 0 && a.echecs === 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)' }}>
      {/* Alerte sécurité si échecs de connexion */}
      {stats && stats.echecsConnexion24h >= 5 && (
        <AlertBanner tone="warning" icon={<ShieldAlert size={16} />}
          message={t('dashboard.securityAlert', { count: stats.echecsConnexion24h })} />
      )}

      {/* KPI */}
      <div style={GRID_AUTO}>
        <StatCard icon={<Users size={18} />} label={t('dashboard.kpiActiveAccounts')} value={isLoading ? '—' : comptes?.actifs ?? 0} tone="success" hint={t('dashboard.activeAccountsHint', { count: comptes?.total ?? 0 })} onClick={has('utilisateur.read') ? () => navigate('/admin/utilisateurs') : undefined} />
        <StatCard icon={<ShieldAlert size={18} />} label={t('dashboard.kpiLoginFailures')} value={isLoading ? '—' : stats?.echecsConnexion24h ?? 0} tone={(stats?.echecsConnexion24h ?? 0) > 0 ? 'warning' : 'neutral'} hint={t('dashboard.loginFailuresHint')} />
        <StatCard icon={<KeyRound size={18} />} label={t('dashboard.kpiActiveSessions')} value={isLoading ? '—' : stats?.sessionsActives ?? 0} tone="accent" hint={t('dashboard.activeSessionsHint')} />
        <StatCard icon={<ShieldCheck size={18} />} label={t('dashboard.kpiConfiguredRoles')} value={isLoading ? '—' : stats?.totalRoles ?? 0} tone="gold" hint={t('dashboard.rolesHint')} onClick={has('role.read') ? () => navigate('/admin/roles') : undefined} />
      </div>

      {/* Auth trend + Comptes donut */}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1.5fr 1fr', gap: 'var(--espace-4)' }}>
        <ChartCard
          icon={<TrendingUp size={15} />} title={t('dashboard.authTitle')} subtitle={t('dashboard.authSubtitle')}
          loading={isLoading} empty={authEmpty} emptyLabel={t('dashboard.authEmpty')}
          actions={has('audit.read') ? <Button variant="ghost" size="sm" onClick={() => navigate('/admin/audit')}>{t('dashboard.logs')} <ChevronRight size={14} /></Button> : null}
        >
          {stats && (
            <AreaTrend
              data={stats.authTrend} xKey="date" xTickFormatter={shortDate}
              series={[
                { key: 'succes', label: t('dashboard.seriesSuccess'), color: 'var(--succes-accent)' },
                { key: 'echecs', label: t('dashboard.seriesFailure'), color: 'var(--erreur-accent)' },
              ]}
            />
          )}
        </ChartCard>

        <ChartCard icon={<Users size={15} />} title={t('dashboard.accountsTitle')} subtitle={t('dashboard.accountsSubtitle')} loading={isLoading} empty={!comptes || comptes.total === 0} minHeight={220}>
          {comptes && (
            <DonutChart
              height={180} centerLabel={t('dashboard.donutAccounts')} centerValue={comptes.total}
              data={[
                { name: t('dashboard.accountsActive'),     value: comptes.actifs,     color: 'var(--succes-accent)' },
                { name: t('dashboard.accountsBlocked'),    value: comptes.bloques,    color: 'var(--erreur-accent)' },
                { name: t('dashboard.accountsDisabled'), value: comptes.desactives, color: 'var(--texte-tertiaire)' },
              ]}
            />
          )}
        </ChartCard>
      </div>

      {/* Activité récente du système (audit, temps réel) */}
      {canAudit && (
        <Card padding="none">
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--bordure-legere)',
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'color-mix(in srgb, var(--fond-surface-2) 80%, transparent)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          }}>
            <ClipboardList size={15} style={{ color: 'var(--ap-600)' }} />
            <span style={{ fontSize: 'var(--font-size-h4)', fontWeight: 600, color: 'var(--texte-primaire)' }}>{t('dashboard.recentActivityTitle')}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--texte-tertiaire)' }}>
              {t('dashboard.actionsPer7Days', { count: stats?.auditActions7j ?? 0 })}
            </span>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/audit')}>{t('dashboard.seeAllShort')} <ChevronRight size={14} /></Button>
          </div>
          <div>
            {recentActions.length === 0 ? (
              <p style={{ padding: '20px', textAlign: 'center', fontSize: 13, color: 'var(--texte-tertiaire)', margin: 0, fontStyle: 'italic' }}>
                {t('dashboard.noRecentActivity')}
              </p>
            ) : recentActions.slice(0, 8).map((e, i) => (
              <div key={e.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px',
                borderTop: i === 0 ? 'none' : '1px solid var(--bordure-legere)',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 'var(--radius-md)', flexShrink: 0,
                  background: e.statut === 'ECHEC' ? 'var(--erreur-fond)' : 'var(--ap-50)',
                  color: e.statut === 'ECHEC' ? 'var(--erreur-texte)' : 'var(--ap-600)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                }}>
                  {(e.utilisateur?.login ?? 'S').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--texte-primaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 600 }}>{e.utilisateur?.login ?? t('dashboard.systemActor')}</span>
                    {' · '}{labelAction(e.action)}
                    <span style={{ color: 'var(--texte-tertiaire)' }}> {labelEntite(e.entiteType) || labelModule(e.module)}</span>
                  </p>
                </div>
                <span style={{ fontSize: 11, color: 'var(--texte-tertiaire)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {formatTime(e.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

