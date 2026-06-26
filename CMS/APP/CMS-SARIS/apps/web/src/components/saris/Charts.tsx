/**
 * Charts SARIS — wrappers recharts alignés sur la charte graphique.
 *
 *  - Couleurs via variables CSS SARIS (--ap-*, --chart-*, sémantiques) → le mode
 *    sombre s'applique automatiquement (les variables s'inversent).
 *  - Aucun gradient, coins arrondis ≤ 10px, tooltips thématisés maison.
 *  - Responsive (ResponsiveContainer) ; hauteur pilotée par prop.
 *
 * Composants : AreaTrend · DonutChart · MiniBars · SparkLine.
 */

import type { ReactNode } from 'react'
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'

// Palette de séries (donut / barres multi-catégories) — variables charte.
export const CHART_PALETTE = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
  'var(--chart-4)', 'var(--chart-5)',
]

// ── Tooltip commun (style carte SARIS) ────────────────────────────────────────

interface TooltipRow { name: string; value: number | string; color?: string }

function SarisTooltip({ title, rows }: { title?: string; rows: TooltipRow[] }) {
  return (
    <div style={{
      background: 'var(--fond-surface)',
      border: '1px solid var(--bordure-normale)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--ombre-2)',
      padding: '8px 10px',
      fontSize: 'var(--font-size-caption)',
      minWidth: 120,
    }}>
      {title && (
        <p style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--texte-primaire)' }}>{title}</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--texte-secondaire)' }}>
              {r.color && <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color, flexShrink: 0 }} />}
              {r.name}
            </span>
            <span style={{ fontWeight: 700, color: 'var(--texte-primaire)', fontVariantNumeric: 'tabular-nums' }}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const AXIS_STYLE = { fontSize: 10, fill: 'var(--texte-tertiaire)' } as const

// ════════════════════════════════════════════════════════════════════════════
//  AreaTrend — courbe d'aire (tendance temporelle), 1 ou 2 séries
// ════════════════════════════════════════════════════════════════════════════

export interface AreaSeries { key: string; label: string; color: string }

export function AreaTrend({
  data, xKey, series, height = 220, xTickFormatter,
}: {
  data: object[]
  xKey: string
  series: AreaSeries[]
  height?: number
  xTickFormatter?: (v: string) => string
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--bordure-legere)" vertical={false} />
        <XAxis
          dataKey={xKey} tick={AXIS_STYLE} tickLine={false} axisLine={false}
          tickFormatter={xTickFormatter} minTickGap={16}
        />
        <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
        <Tooltip
          cursor={{ stroke: 'var(--bordure-normale)', strokeWidth: 1 }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <SarisTooltip
                title={xTickFormatter ? xTickFormatter(String(label)) : String(label)}
                rows={payload.map(p => ({
                  name: series.find(s => s.key === p.dataKey)?.label ?? String(p.dataKey),
                  value: p.value as number,
                  color: p.color,
                }))}
              />
            ) : null
          }
        />
        {series.map(s => (
          <Area
            key={s.key} type="monotone" dataKey={s.key}
            stroke={s.color} strokeWidth={2}
            fill={s.color} fillOpacity={0.12}
            dot={false} activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  MiniBars — barres verticales (affluence horaire, comparaisons)
// ════════════════════════════════════════════════════════════════════════════

export function MiniBars({
  data, xKey, yKey, color = 'var(--ap-400)', height = 200, unit,
}: {
  data: object[]
  xKey: string
  yKey: string
  color?: string
  height?: number
  unit?: string
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--bordure-legere)" vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS_STYLE} tickLine={false} axisLine={false} interval={1} />
        <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
        <Tooltip
          cursor={{ fill: 'var(--fond-surface-2)' }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <SarisTooltip
                title={String(label)}
                rows={[{ name: unit ?? 'Total', value: payload[0]!.value as number, color }]}
              />
            ) : null
          }
        />
        <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  DonutChart — répartition (motifs, statuts) avec total au centre + légende
// ════════════════════════════════════════════════════════════════════════════

export interface DonutSlice { name: string; value: number; color?: string }

export function DonutChart({
  data, height = 200, centerLabel, centerValue, legend = true,
}: {
  data: DonutSlice[]
  height?: number
  centerLabel?: string
  centerValue?: ReactNode
  legend?: boolean
}) {
  const total = data.reduce((a, d) => a + d.value, 0)
  const colored = data.map((d, i) => ({ ...d, color: d.color ?? CHART_PALETTE[i % CHART_PALETTE.length]! }))

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-4)', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: height, height, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={colored} dataKey="value" nameKey="name"
              cx="50%" cy="50%" innerRadius="64%" outerRadius="92%"
              paddingAngle={2} strokeWidth={0} startAngle={90} endAngle={-270}
            >
              {colored.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <SarisTooltip rows={[{
                    name: payload[0]!.name as string,
                    value: `${payload[0]!.value} (${total ? Math.round((payload[0]!.value as number) / total * 100) : 0}%)`,
                    color: (payload[0]!.payload as DonutSlice).color,
                  }]} />
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Centre */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 'var(--font-size-h2)', fontWeight: 700, color: 'var(--texte-primaire)', lineHeight: 1 }}>
            {centerValue ?? total}
          </span>
          {centerLabel && (
            <span style={{ fontSize: 'var(--font-size-overline)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--texte-tertiaire)', marginTop: 2 }}>
              {centerLabel}
            </span>
          )}
        </div>
      </div>

      {legend && (
        <div style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {colored.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-body-sm)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
              <span style={{ flex: 1, color: 'var(--texte-secondaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
              <span style={{ fontWeight: 700, color: 'var(--texte-primaire)', fontVariantNumeric: 'tabular-nums' }}>{d.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  SparkLine — mini-courbe sans axes (intégrée dans une StatCard)
// ════════════════════════════════════════════════════════════════════════════

export function SparkLine({
  data, dataKey, color = 'var(--ap-400)', height = 36,
}: {
  data: object[]
  dataKey: string
  color?: string
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
