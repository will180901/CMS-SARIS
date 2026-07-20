/**
 * RapportsPage — rapports statistiques générés automatiquement (recueil §6.1).
 *
 * Remplace la production manuelle des rapports hebdo/mensuel/annuel du Médecin
 * Chef : un cron serveur (RapportsService) produit un snapshot par période et
 * par site ; cette page les liste et permet de les consulter/exporter sans
 * ressaisie, comme demandé (§6.1 : « rapports produits par le CMS »).
 *
 * Gabarit calqué sur Triage/Patients : en-tête plein, panneau liste ↔ détail
 * redimensionnable (poignée glissable), filtres en pastilles arrondies.
 */
import { useEffect, useRef, useState } from 'react'
import { FileBarChart, Download, Calendar, Stethoscope, BedSingle, ChevronRight, ChevronLeft } from 'lucide-react'
import { Card, Skeleton, EmptyState, StatCard, DonutChart, RankedBars, TILE_TONE_MAP, type DonutSlice } from '@/components/saris'
import { useIsCompact } from '@/hooks/useMediaQuery'
import { usePersistedState } from '@/hooks/usePersistedState'
import { formatDate } from '@/lib/intl'
import { useRapports, useRapport } from '../hooks/useRapports'
import { exportStatsXlsx } from '@/modules/dashboard/lib/statsExport'
import type { TypeRapport } from '../api/rapports.api'

const TYPE_LABEL: Record<TypeRapport, string> = {
  HEBDOMADAIRE: 'Hebdomadaire',
  MENSUEL:      'Mensuel',
  ANNUEL:       'Annuel',
}

const TYPE_TINT: Record<TypeRapport, { bg: string; text: string }> = {
  HEBDOMADAIRE: { bg: 'var(--info-fond)',   text: 'var(--info-texte)'   },
  MENSUEL:      { bg: 'var(--ap-50)',       text: 'var(--ap-700)'      },
  ANNUEL:       { bg: 'var(--succes-fond)', text: 'var(--succes-texte)' },
}

const LIST_MIN = 260, LIST_MAX = 420, LIST_DEFAULT = 320

export function RapportsPage() {
  const isCompact = useIsCompact()
  const [filtreType, setFiltreType] = usePersistedState<TypeRapport | 'ALL'>('rapports', 'filtreType', 'ALL')
  const { data: rapports = [], isLoading } = useRapports()
  const [selectedId, setSelectedId] = usePersistedState<string | null>('rapports', 'selectedId', null)
  const { data: detail, isLoading: loadingDetail } = useRapport(selectedId)

  const filtered = filtreType === 'ALL' ? rapports : rapports.filter(r => r.type === filtreType)

  /* Redimensionnement panneau liste (même mécanisme que Triage) */
  const splitRef = useRef<HTMLDivElement>(null)
  const [listWidth, setListWidth] = usePersistedState('rapports', 'listWidth', LIST_DEFAULT)
  const [isResizing, setIsResizing] = useState(false)

  useEffect(() => {
    if (!isResizing) return
    function onMove(e: MouseEvent) {
      if (!splitRef.current) return
      const rect = splitRef.current.getBoundingClientRect()
      setListWidth(Math.max(LIST_MIN, Math.min(LIST_MAX, e.clientX - rect.left)))
    }
    function onUp() { setIsResizing(false) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <style>{`
        .rap-resize:hover           { background: var(--ap-50) !important; }
        .rap-resize:hover > div     { background: var(--ap-400) !important; }
      `}</style>

      {/* ── En-tête (calque Triage/Patients) ───────────────────────────── */}
      <div style={{ padding: 'var(--espace-4) var(--espace-6) 0', flexShrink: 0, borderBottom: '1px solid var(--bordure-legere)', background: 'var(--fond-surface)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: TILE_TONE_MAP.violet.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
              <FileBarChart size={16} style={{ color: TILE_TONE_MAP.violet.color }} />
            </div>
            <div>
              <h1 style={{ fontSize: 'var(--font-size-h2)', fontWeight: 600, color: 'var(--texte-primaire)', margin: 0 }}>Rapports</h1>
              <p style={{ fontSize: 13, color: 'var(--texte-tertiaire)', margin: '2px 0 0' }}>
                {isLoading ? '…' : `${rapports.length} rapport${rapports.length > 1 ? 's' : ''}`} · Générés automatiquement
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Corps split panel ─────────────────────────────────────────── */}
      <div ref={splitRef} style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

        {/* Panneau liste */}
        {(!isCompact || !selectedId) && (
        <div style={{ width: isCompact ? '100%' : `${listWidth}px`, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--fond-surface)' }}>

          {/* Filtres — pastilles arrondies (même style que Triage) */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--bordure-legere)', flexShrink: 0, background: 'var(--fond-surface)' }}>
            <div role="tablist" aria-label="Type de rapport" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
              {(['ALL', 'HEBDOMADAIRE', 'MENSUEL', 'ANNUEL'] as const).map(key => {
                const active = filtreType === key
                const count  = key === 'ALL' ? rapports.length : rapports.filter(r => r.type === key).length
                return (
                  <button key={key} type="button" role="tab" aria-selected={active}
                    onClick={() => setFiltreType(key)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
                      height: 28, padding: '0 10px', borderRadius: 9999, cursor: 'pointer',
                      fontSize: 12, fontWeight: active ? 600 : 500, whiteSpace: 'nowrap',
                      background: active ? 'var(--ap-50)' : 'var(--fond-surface)',
                      color: active ? 'var(--ap-700)' : 'var(--texte-secondaire)',
                      border: `1px solid ${active ? 'var(--ap-200)' : 'var(--bordure-normale)'}`,
                      transition: 'all 0.1s',
                    }}>
                    {key === 'ALL' ? 'Tous' : TYPE_LABEL[key]}
                    <span style={{
                      minWidth: 16, height: 16, borderRadius: 8, padding: '0 4px',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700,
                      background: active ? 'var(--ap-400)' : 'var(--fond-surface-2)',
                      color: active ? '#fff' : 'var(--texte-tertiaire)',
                    }}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Liste scrollable */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {isLoading ? (
              <div style={{ padding: 12 }}><Skeleton height={200} /></div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '60px 32px' }}>
                <EmptyState icon={<FileBarChart size={24} />} title="Aucun rapport" description="Le premier rapport apparaîtra après la prochaine génération planifiée." />
              </div>
            ) : (
              filtered.map(r => {
                const tint = TYPE_TINT[r.type]
                const selected = r.id === selectedId
                return (
                  <div key={r.id} role="button" tabIndex={0} aria-pressed={selected}
                    onClick={() => setSelectedId(r.id)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(r.id) } }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer',
                      borderBottom: '1px solid var(--bordure-legere)',
                      background: selected ? 'var(--ap-50)' : 'transparent',
                      borderLeft: `3px solid ${selected ? 'var(--ap-500)' : 'transparent'}`,
                      transition: 'background 0.1s',
                    }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: tint.bg, color: tint.text, flexShrink: 0 }}>
                      {TYPE_LABEL[r.type]}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--texte-primaire)' }}>
                        {formatDate(r.periodeDebut, { day: '2-digit', month: 'short', year: 'numeric' })} → {formatDate(r.periodeFin, { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                      <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--texte-tertiaire)' }}>
                        Généré le {formatDate(r.genereLe, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </p>
                    </div>
                    <ChevronRight size={13} style={{ color: 'var(--texte-tertiaire)', flexShrink: 0 }} />
                  </div>
                )
              })
            )}
          </div>
        </div>
        )}

        {/* Poignée de redimensionnement — bureau uniquement */}
        {!isCompact && (
        <div
          onMouseDown={() => setIsResizing(true)}
          onDoubleClick={() => setListWidth(LIST_DEFAULT)}
          title="Glisser pour redimensionner — double-clic pour réinitialiser"
          className="rap-resize"
          style={{
            width: 5, flexShrink: 0, cursor: 'col-resize', position: 'relative',
            background: isResizing ? 'var(--ap-50)' : 'transparent',
            transition: 'background 0.15s',
          }}
        >
          <div style={{
            position: 'absolute', left: 2, top: 0, bottom: 0, width: 1,
            background: isResizing ? 'var(--ap-400)' : 'var(--bordure-legere)',
            transition: 'background 0.15s',
          }} />
        </div>
        )}

        {/* Panneau détail */}
        {(!isCompact || selectedId) && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--fond-page)' }}>
          {isCompact && selectedId && (
            <button onClick={() => setSelectedId(null)}
              style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderBottom: '1px solid var(--bordure-legere)', background: 'var(--fond-surface)', border: 'none', cursor: 'pointer', color: 'var(--texte-secondaire)', fontSize: 13, fontWeight: 600, textAlign: 'left' }}>
              <ChevronLeft size={18} /> Retour
            </button>
          )}

          {!selectedId ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EmptyState icon={<Calendar size={24} />} title="Sélectionnez un rapport" description="Choisissez un rapport dans la liste pour en voir le contenu." />
            </div>
          ) : loadingDetail || !detail ? (
            <div style={{ padding: 'var(--espace-6)' }}><Skeleton height={300} /></div>
          ) : (
            <>
              <Card.Header
                title={`${TYPE_LABEL[detail.type]} — ${formatDate(detail.periodeDebut, { day: '2-digit', month: 'long', year: 'numeric' })} → ${formatDate(detail.periodeFin, { day: '2-digit', month: 'long', year: 'numeric' })}`}
                subtitle={`${detail.contenu.totalConsultations} consultation${detail.contenu.totalConsultations > 1 ? 's' : ''} · ${detail.contenu.repos.totalJours} jour(s) de repos prescrits`}
                actions={
                  <button type="button" onClick={() => void exportStatsXlsx(detail.contenu)} style={rapportExportBtn}>
                    <Download size={12} /> Excel
                  </button>
                }
              />
              <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--espace-6)', display: 'flex', flexDirection: 'column', gap: 'var(--espace-6)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--espace-4)' }}>
                  <StatCard icon={<Stethoscope size={18} />} label="Consultations" value={detail.contenu.totalConsultations} tone="accent" />
                  <StatCard icon={<BedSingle size={18} />} label="Jours de repos prescrits" value={detail.contenu.repos.totalJours} tone="gold"
                    hint={`${detail.contenu.repos.consultationsAvecRepos} consultation(s) avec repos`} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 'var(--espace-6)' }}>
                  <RapportDonutBlock title="Par type de consultation" rows={detail.contenu.parType} />
                  <RapportDonutBlock title="Par catégorie de patient" rows={detail.contenu.parCategorie} />
                  <RapportDonutBlock title="Par département / direction" rows={detail.contenu.parDepartement} />
                </div>

                <RapportBlock title="Top pathologies (diagnostic principal)" empty={detail.contenu.parPathologie.length === 0}>
                  <RankedBars data={detail.contenu.parPathologie.slice(0, 10)} />
                </RapportBlock>
              </div>
            </>
          )}
        </div>
        )}
      </div>
    </div>
  )
}

const rapportExportBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 10px', borderRadius: 7,
  fontSize: 11, fontWeight: 600, cursor: 'pointer',
  background: 'var(--fond-surface)', color: 'var(--texte-secondaire)',
  border: '1px solid var(--bordure-normale)',
}

function RapportBlock({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--texte-tertiaire)' }}>{title}</p>
      {empty ? (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--texte-tertiaire)', fontStyle: 'italic' }}>Aucune donnée sur la période.</p>
      ) : children}
    </div>
  )
}

function RapportDonutBlock({ title, rows }: { title: string; rows: { libelle: string; count: number }[] }) {
  return (
    <RapportBlock title={title} empty={rows.length === 0}>
      <DonutChart height={170} centerLabel="actes" data={rows.slice(0, 6).map((r): DonutSlice => ({ name: r.libelle, value: r.count }))} />
    </RapportBlock>
  )
}
