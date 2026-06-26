/**
 * ConstantesTab — historique des constantes vitales du patient, toutes visites
 * confondues. Cartes de synthèse (dernière valeur + tendance + sparkline) au-dessus
 * d'un tableau chronologique complet, coloré par sévérité clinique.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Activity, Loader2, Thermometer, HeartPulse, Wind, Weight, Ruler, Gauge,
  TrendingUp, TrendingDown, Minus,
} from 'lucide-react'
import { EmptyState } from '@/components/saris'
import { usePatientConstantes } from '../../hooks/usePatients'
import { formatDate, formatTime } from '@/lib/intl'
import type { ConstanteVitale } from '@cms-saris/types'

// ── Sévérité clinique ──────────────────────────────────────────────────────────

type Sev = 'normal' | 'warning' | 'danger'
const SEV_COLOR: Record<Sev, string> = {
  normal:  'var(--texte-primaire)',
  warning: 'var(--avert-texte)',
  danger:  'var(--erreur-texte)',
}
function tempSev(v?: number | null): Sev { if (v == null) return 'normal'; return v >= 38.5 ? 'danger' : v >= 37.5 ? 'warning' : v < 35 ? 'warning' : 'normal' }
function taSev(v?: number | null): Sev { if (v == null) return 'normal'; return v >= 160 ? 'danger' : v >= 140 ? 'warning' : v < 90 ? 'warning' : 'normal' }
function spo2Sev(v?: number | null): Sev { if (v == null) return 'normal'; return v < 90 ? 'danger' : v < 95 ? 'warning' : 'normal' }
function fcSev(v?: number | null): Sev { if (v == null) return 'normal'; return v >= 120 || v < 50 ? 'danger' : v >= 100 || v < 60 ? 'warning' : 'normal' }

// ── Sparkline SVG (aucune dépendance) ──────────────────────────────────────────

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div style={{ height: 28 }} />
  const w = 104, h = 28, pad = 3
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - 2 * pad)
    const y = h - pad - ((v - min) / range) * (h - 2 * pad)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const last = pts[pts.length - 1].split(',')
  return (
    <svg width={w} height={h} style={{ display: 'block' }} aria-hidden>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.2} fill={color} />
    </svg>
  )
}

// ── Carte d'une constante ───────────────────────────────────────────────────────

function VitalCard({
  icon, label, unit, series, sev = 'normal',
}: {
  icon: React.ReactNode
  label: string
  unit: string
  series: number[]   // chronologique (ancien → récent)
  sev?: Sev
}) {
  const latest = series.length ? series[series.length - 1] : null
  const prev   = series.length > 1 ? series[series.length - 2] : null
  const delta  = latest != null && prev != null ? latest - prev : null
  const Trend  = delta == null || Math.abs(delta) < 1e-9 ? Minus : delta > 0 ? TrendingUp : TrendingDown

  return (
    <div style={{
      border: '1px solid var(--bordure-legere)', borderRadius: 10,
      background: 'var(--fond-surface)', padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'var(--texte-tertiaire)', display: 'flex' }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--texte-tertiaire)' }}>
          {label}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: latest == null ? 'var(--texte-tertiaire)' : SEV_COLOR[sev], lineHeight: 1 }}>
          {latest == null ? '—' : latest}
        </span>
        {latest != null && <span style={{ fontSize: 11, color: 'var(--texte-tertiaire)' }}>{unit}</span>}
        {delta != null && (
          <span style={{
            marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 2,
            fontSize: 11, fontWeight: 600,
            color: delta === 0 ? 'var(--texte-tertiaire)' : 'var(--texte-secondaire)',
          }}>
            <Trend size={12} /> {delta === 0 ? '' : `${delta > 0 ? '+' : ''}${Math.round(delta * 10) / 10}`}
          </span>
        )}
      </div>
      <Sparkline values={series} color="var(--ap-400)" />
    </div>
  )
}

// ── Cellule de tableau colorée ──────────────────────────────────────────────────

function Cell({ children, sev = 'normal', mono }: { children: React.ReactNode; sev?: Sev; mono?: boolean }) {
  return (
    <td style={{
      padding: '8px 10px', fontSize: 12, whiteSpace: 'nowrap',
      color: SEV_COLOR[sev], fontWeight: sev === 'normal' ? 500 : 700,
      fontFamily: mono ? 'monospace' : undefined,
      borderBottom: '1px solid var(--bordure-legere)',
    }}>
      {children ?? <span style={{ color: 'var(--texte-quaternaire)' }}>—</span>}
    </td>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{
      padding: '8px 10px', fontSize: 10, textAlign: 'left', whiteSpace: 'nowrap',
      fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
      color: 'var(--texte-tertiaire)', borderBottom: '1px solid var(--bordure-normale)',
      position: 'sticky', top: 0, background: 'var(--fond-surface-2)', zIndex: 1,
    }}>
      {children}
    </th>
  )
}

// ── Composant principal ─────────────────────────────────────────────────────────

export function ConstantesTab({ patientId }: { patientId: string }) {
  const { t } = useTranslation()
  const { data: constantes = [], isLoading } = usePatientConstantes(patientId)

  // Séries chronologiques (API renvoie du plus récent au plus ancien → on inverse).
  const series = useMemo(() => {
    const asc = [...constantes].reverse()
    const pick = (k: keyof ConstanteVitale) =>
      asc.map(c => c[k]).filter((v): v is number => typeof v === 'number')
    return {
      temperature:        pick('temperature'),
      tensionSystolique:  pick('tensionSystolique'),
      frequenceCardiaque: pick('frequenceCardiaque'),
      saturationO2:       pick('saturationO2'),
      poids:              pick('poids'),
      imc:                pick('imc'),
    }
  }, [constantes])

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 8, color: 'var(--texte-tertiaire)' }}>
        <Loader2 size={16} className="animate-spin" />
        <span style={{ fontSize: 13 }}>{t('patients.loading')}</span>
      </div>
    )
  }

  if (constantes.length === 0) {
    return (
      <EmptyState
        icon={<Activity size={20} />}
        title={t('patients.vitalsEmptyTitle')}
        description={t('patients.vitalsEmptyDesc')}
      />
    )
  }

  const last = constantes[0] // le plus récent

  return (
    <div>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <Activity size={15} style={{ color: 'var(--ap-600)' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--texte-primaire)' }}>{t('patients.vitalsTitle')}</span>
        <span style={{ fontSize: 11, color: 'var(--texte-tertiaire)', background: 'var(--fond-surface-2)', padding: '1px 7px', borderRadius: 99 }}>
          {t(constantes.length > 1 ? 'patients.measureCountPlural' : 'patients.measureCountSingular', { count: constantes.length })}
        </span>
      </div>

      {/* Cartes de synthèse */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
        <VitalCard icon={<Thermometer size={13} />} label={t('patients.vitalTemperature')} unit="°C"    series={series.temperature}        sev={tempSev(last.temperature)} />
        <VitalCard icon={<Gauge size={13} />}       label={t('patients.vitalTensionSys')}  unit="mmHg"  series={series.tensionSystolique}  sev={taSev(last.tensionSystolique)} />
        <VitalCard icon={<HeartPulse size={13} />}  label={t('patients.vitalHeartRate')}   unit="bpm"   series={series.frequenceCardiaque} sev={fcSev(last.frequenceCardiaque)} />
        <VitalCard icon={<Wind size={13} />}        label={t('patients.vitalSpo2')}        unit="%"     series={series.saturationO2}       sev={spo2Sev(last.saturationO2)} />
        <VitalCard icon={<Weight size={13} />}      label={t('patients.vitalWeight')}      unit="kg"    series={series.poids} />
        <VitalCard icon={<Ruler size={13} />}       label={t('patients.vitalImc')}         unit="kg/m²" series={series.imc} />
      </div>

      {/* Tableau chronologique complet */}
      <div style={{ border: '1px solid var(--bordure-legere)', borderRadius: 10, overflow: 'auto', maxHeight: 460 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <Th>{t('patients.colDate')}</Th>
              <Th>{t('patients.colTemp')}</Th>
              <Th>{t('patients.colTension')}</Th>
              <Th>{t('patients.colFc')}</Th>
              <Th>{t('patients.colSpo2')}</Th>
              <Th>{t('patients.colWeight')}</Th>
              <Th>{t('patients.colHeight')}</Th>
              <Th>{t('patients.colImc')}</Th>
              <Th>{t('patients.colGlycemie')}</Th>
            </tr>
          </thead>
          <tbody>
            {constantes.map(c => (
              <tr key={c.id}>
                <Cell mono>
                  {formatDate(c.createdAt, { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  {' '}
                  <span style={{ color: 'var(--texte-tertiaire)' }}>
                    {formatTime(c.createdAt, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </Cell>
                <Cell sev={tempSev(c.temperature)}>{c.temperature != null ? `${c.temperature}°` : null}</Cell>
                <Cell sev={taSev(c.tensionSystolique)}>
                  {c.tensionSystolique != null ? `${c.tensionSystolique}/${c.tensionDiastolique ?? '—'}` : null}
                </Cell>
                <Cell sev={fcSev(c.frequenceCardiaque)}>{c.frequenceCardiaque ?? null}</Cell>
                <Cell sev={spo2Sev(c.saturationO2)}>{c.saturationO2 != null ? `${c.saturationO2}%` : null}</Cell>
                <Cell>{c.poids != null ? `${c.poids} kg` : null}</Cell>
                <Cell>{c.taille != null ? `${c.taille} cm` : null}</Cell>
                <Cell>{c.imc != null ? c.imc : null}</Cell>
                <Cell>{c.glycemie != null ? c.glycemie : null}</Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
