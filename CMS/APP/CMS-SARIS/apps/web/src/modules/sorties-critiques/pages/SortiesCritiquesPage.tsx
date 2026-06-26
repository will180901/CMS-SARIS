/**
 * SortiesCritiquesPage — vue d'ensemble des Évacuations.
 *
 * Page transversale (pas liée à une consultation) permettant le suivi global des
 * évacuations médicales du centre. L'évacuation est une décision prise en
 * consultation par le médecin (cf. recueil) ; cette page en assure le pilotage.
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Ambulance, Calendar, ChevronRight } from 'lucide-react'
import {
  PageHeader, StatCard, StatusPill, EmptyState, Skeleton, Avatar, PaginationBar, SelectBox, useColumnResize,
  Card, Toolbar,
} from '@/components/saris'
import type { ColumnResize } from '@/components/saris'
import { usePagination } from '@/hooks/usePagination'
import { useRowsPerPage } from '@/hooks/useRowsPerPage'
import { useIsCompact } from '@/hooks/useMediaQuery'
import { usePersistedState } from '@/hooks/usePersistedState'
import { useEvacuations } from '../hooks/useSorties'
import type { Evacuation } from '../api/sorties.api'
import { SortieDetailDrawer, type SortieDetail } from '../components/SortieDetailDrawer'
import { formatDate } from '@/lib/intl'

// ── Libellés humains (codes d'enum → clés i18n du namespace `sorties`) ─────────
const URGENCE_KEY: Record<string, string>     = { BASSE: 'urgenceBasse', MOYENNE: 'urgenceMoyenne', HAUTE: 'urgenceHaute', CRITIQUE: 'urgenceCritique' }
const EVAC_STATUT_KEY: Record<string, string> = { EN_COURS: 'evacStatutEnCours', CLOTURE: 'evacStatutCloture', ANNULE: 'evacStatutAnnule' }
const lbl = (t: TFunction, map: Record<string, string>, v: string) =>
  map[v] ? t(`sorties.${map[v]}`) : v.replace(/_/g, ' ').toLowerCase()

function matchPatient(id: { nom: string; prenom: string } | null | undefined, numero: string | undefined, q: string): boolean {
  if (!q.trim()) return true
  const hay = `${id?.prenom ?? ''} ${id?.nom ?? ''} ${numero ?? ''}`.toLowerCase()
  return hay.includes(q.trim().toLowerCase())
}

function FilterBar({ q, setQ, statut, setStatut, options }: {
  q: string; setQ: (v: string) => void
  statut: string; setStatut: (v: string) => void
  options: { value: string; label: string }[]
}) {
  const { t } = useTranslation()
  return (
    <Card>
      <Toolbar
        search={q}
        onSearchChange={setQ}
        searchPlaceholder={t('sorties.searchPatientPlaceholder')}
        filters={
          <div style={{ minWidth: 180 }}>
            <SelectBox size="sm" value={statut} onChange={setStatut} options={options} aria-label={t('sorties.filterByStatusAria')} />
          </div>
        }
      />
    </Card>
  )
}

export function SortiesCritiquesPage() {
  const { t } = useTranslation()
  const [detail, setDetail] = useState<SortieDetail | null>(null)

  const { data: evacuations = [], isLoading } = useEvacuations(undefined, true)
  const evacEnCours = evacuations.filter(e => e.statut === 'EN_COURS').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>

      <PageHeader
        icon={<Ambulance size={18} />}
        title={t('sorties.tabEvacuations')}
        subtitle={t('sorties.evacPageSubtitle', { defaultValue: 'Suivi des évacuations médicales du centre' })}
      />

      {/* KPI */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 'var(--espace-3)',
        padding: 'var(--espace-4) var(--espace-6) 0',
      }}>
        <StatCard
          icon={<Ambulance size={18} />}
          label={t('sorties.kpiEvacuationsEnCours')}
          value={evacEnCours}
          tone={evacEnCours > 0 ? 'error' : 'success'}
          hint={t('sorties.kpiTotal', { count: evacuations.length })}
        />
      </div>

      <EvacuationsTable evacuations={evacuations} loading={isLoading} onOpen={d => setDetail({ type: 'evacuation', data: d })} />

      <SortieDetailDrawer detail={detail} onClose={() => setDetail(null)} />
    </div>
  )
}

// ── Grille colonnes ─────────────────────────────────────────────────────────────

const EVAC_COLS = '36px 2fr 1fr 1fr 1fr 24px'

// ── Wrapper réutilisable : header sticky + body scrollable + pagination ──────

function TableShell({
  cols, columns, isLoading, isEmpty, emptyIcon, emptyTitle, children, pagination, resize, filters,
}: {
  cols: string
  columns: string[]
  isLoading: boolean
  isEmpty: boolean
  emptyIcon: React.ReactNode
  emptyTitle: string
  children: React.ReactNode
  pagination: any
  resize?: ColumnResize
  filters?: React.ReactNode
}) {
  const { t } = useTranslation()
  const isCompact = useIsCompact()
  const tableMinW = isCompact ? 600 : undefined
  return (
    <div style={{
      flex: isCompact ? 'none' : 1, display: 'flex', flexDirection: 'column', minHeight: isCompact ? undefined : 0,
      padding: 'var(--espace-3) var(--espace-6) var(--espace-6)',
      gap: 'var(--espace-3)',
    }}>
      {filters}
      <div style={{
        flex: isCompact ? 'none' : 1, height: isCompact ? '70vh' : undefined, minHeight: 0, display: 'flex', flexDirection: 'column',
        background: 'var(--fond-surface)',
        border: '1px solid var(--bordure-legere)',
        borderRadius: 'var(--radius-xl)',
        overflowX: isCompact ? 'auto' : 'hidden',
        overflowY: 'hidden',
      }}>
        {/* Header sticky */}
        {!isLoading && !isEmpty && (
          <div ref={resize ? resize.containerRef : undefined} style={{
            display: 'grid',
            gridTemplateColumns: cols,
            minWidth: tableMinW,
            gap: 'var(--espace-3)',
            padding: 'var(--espace-2) var(--espace-4)',
            background: 'var(--fond-surface-2)',
            borderBottom: '1px solid var(--bordure-legere)',
            fontSize: 'var(--font-size-overline)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'var(--texte-tertiaire)',
            flexShrink: 0,
          }}>
            {columns.map((c, i) => (
              <div key={i} style={{ position: 'relative', minWidth: 0 }}>
                {c}
                {resize && i < columns.length - 1 && (
                  <span
                    className="saris-col-resize"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={t('sorties.resizeColumn')}
                    onPointerDown={ev => resize.startDrag(i, ev)}
                    onDoubleClick={resize.reset}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Body scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0, minWidth: tableMinW }} role="table">
          {isLoading ? <ListSkeleton /> :
           isEmpty   ? <EmptyState icon={emptyIcon} title={emptyTitle} variant="subtle" /> :
           children}
        </div>
      </div>

      {!isLoading && !isEmpty && <PaginationBar {...pagination} />}
    </div>
  )
}

function EvacuationsTable({ evacuations, loading, onOpen }: { evacuations: Evacuation[]; loading: boolean; onOpen: (e: Evacuation) => void }) {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const [statut, setStatut] = usePersistedState('sorties', 'evacStatut', 'TOUS')
  const filtered = useMemo(() => evacuations.filter(e =>
    matchPatient(e.consultation.visite.patient.identite, e.consultation.visite.patient.numeroPatient, q)
    && (statut === 'TOUS' || e.statut === statut),
  ), [evacuations, q, statut])
  const pagination = usePagination(filtered, useRowsPerPage())
  const rz = useColumnResize({ storageKey: 'sorties-evacuations', ready: !loading && filtered.length > 0, cellsSelector: ':scope > *' })
  const cols = rz.gridTemplate ?? EVAC_COLS
  return (
    <TableShell
      resize={rz}
      cols={cols}
      columns={['', t('sorties.colPatient'), t('sorties.colUrgence'), t('sorties.colStatut'), t('sorties.colDate'), '']}
      isLoading={loading}
      isEmpty={filtered.length === 0}
      emptyIcon={<Ambulance size={20} />}
      emptyTitle={q || statut !== 'TOUS' ? t('sorties.evacEmptyFiltered') : t('sorties.evacEmpty')}
      pagination={pagination}
      filters={!loading && evacuations.length > 0 && (
        <FilterBar q={q} setQ={setQ} statut={statut} setStatut={setStatut}
          options={[{ value: 'TOUS', label: t('sorties.allStatuses') }, { value: 'EN_COURS', label: t('sorties.evacStatutEnCours') }, { value: 'CLOTURE', label: t('sorties.evacStatutCloture') }, { value: 'ANNULE', label: t('sorties.evacStatutAnnule') }]} />
      )}
    >
      {pagination.pageData.map((e, i) => (
        <EvacuationRow key={e.id} e={e} cols={cols} striped={i % 2 === 1} last={i === pagination.pageData.length - 1} onOpen={onOpen} />
      ))}
    </TableShell>
  )
}

function ListSkeleton() {
  return (
    <div style={{ padding: 'var(--espace-3)' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} height={56} style={{ marginBottom: 6 }} />
      ))}
    </div>
  )
}

// ── Ligne ───────────────────────────────────────────────────────────────────────

function EvacuationRow({ e, cols, striped, last, onOpen }: { e: Evacuation; cols: string; striped: boolean; last: boolean; onOpen: (e: Evacuation) => void }) {
  const { t } = useTranslation()
  const patient = e.consultation.visite.patient
  const id = patient.identite
  const toneByUrg = { BASSE: 'neutral', MOYENNE: 'info', HAUTE: 'warning', CRITIQUE: 'error' } as const
  const toneStatut = e.statut === 'EN_COURS' ? 'info' : e.statut === 'CLOTURE' ? 'success' : 'neutral'

  return (
    <button
      onClick={() => onOpen(e)}
      style={{
        width: '100%',
        display: 'grid',
        gridTemplateColumns: cols,
        gap: 'var(--espace-3)',
        alignItems: 'center',
        padding: 'var(--espace-3) var(--espace-4)',
        background: striped ? 'var(--fond-surface-2)' : 'transparent',
        border: 'none',
        borderBottom: last ? 'none' : '1px solid var(--bordure-legere)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.12s',
      }}
      onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--ap-50)')}
      onMouseLeave={ev => (ev.currentTarget.style.background = striped ? 'var(--fond-surface-2)' : 'transparent')}
    >
      <Avatar nom={id?.nom ?? patient.numeroPatient} prenom={id?.prenom} size={32} />
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', fontWeight: 600, color: 'var(--texte-primaire)' }}>
          {id ? `${id.prenom} ${id.nom}` : patient.numeroPatient}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {patient.numeroPatient}
          {e.etablissement && <span> · → {e.etablissement.nom}</span>}
        </p>
      </div>
      <StatusPill tone={toneByUrg[e.niveauUrgence] as any}>{lbl(t, URGENCE_KEY, e.niveauUrgence)}</StatusPill>
      <StatusPill tone={toneStatut as any}>{lbl(t, EVAC_STATUT_KEY, e.statut)}</StatusPill>
      <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Calendar size={11} /> {formatDate(e.createdAt)}
      </span>
      <ChevronRight size={14} style={{ color: 'var(--texte-tertiaire)' }} />
    </button>
  )
}
