/**
 * RapportsPage — rapports statistiques générés automatiquement (recueil §6.1).
 *
 * Remplace la production manuelle des rapports hebdo/mensuel/annuel du Médecin
 * Chef : un cron serveur (RapportsService) produit un snapshot par période et
 * par site ; cette page les liste et permet de les consulter/exporter sans
 * ressaisie, comme demandé (§6.1 : « rapports produits par le CMS »).
 */
import { useState } from 'react'
import { FileBarChart, Download, Printer, Calendar, Stethoscope, BedSingle } from 'lucide-react'
import { Card, Skeleton, EmptyState, StatCard, DonutChart, RankedBars, type DonutSlice } from '@/components/saris'
import { formatDate } from '@/lib/intl'
import { useRapports, useRapport } from '../hooks/useRapports'
import { exportStatsXlsx, exportStatsPdf } from '@/modules/dashboard/lib/statsExport'
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

export function RapportsPage() {
  const [filtreType, setFiltreType] = useState<TypeRapport | undefined>(undefined)
  const { data: rapports = [], isLoading } = useRapports(filtreType)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { data: detail, isLoading: loadingDetail } = useRapport(selectedId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <FileBarChart size={18} style={{ color: 'var(--ap-600)' }} />
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--texte-primaire)', margin: 0 }}>Rapports</h1>
          <p style={{ fontSize: 12, color: 'var(--texte-tertiaire)', margin: '2px 0 0' }}>
            Générés automatiquement — hebdomadaire, mensuel, annuel
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) 1fr', gap: 'var(--espace-4)', flex: 1, minHeight: 0 }}>
        {/* Liste */}
        <Card style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Card.Header
            title="Générés"
            subtitle={`${rapports.length} rapport${rapports.length > 1 ? 's' : ''}`}
          />
          <div style={{ padding: '0 12px 8px', display: 'flex', gap: 4 }}>
            {(['HEBDOMADAIRE', 'MENSUEL', 'ANNUEL'] as TypeRapport[]).map(t => {
              const active = filtreType === t
              return (
                <button key={t} type="button" onClick={() => setFiltreType(active ? undefined : t)}
                  style={{ height: 26, padding: '0 9px', borderRadius: 7, fontSize: 11, fontWeight: active ? 700 : 500, cursor: 'pointer',
                    background: active ? 'var(--ap-50)' : 'var(--fond-surface)', color: active ? 'var(--ap-700)' : 'var(--texte-secondaire)',
                    border: `1px solid ${active ? 'var(--ap-200)' : 'var(--bordure-normale)'}` }}>
                  {TYPE_LABEL[t]}
                </button>
              )
            })}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 8px' }}>
            {isLoading ? (
              <Skeleton height={200} />
            ) : rapports.length === 0 ? (
              <EmptyState icon={<FileBarChart size={24} />} title="Aucun rapport" description="Le premier rapport apparaîtra après la prochaine génération planifiée." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {rapports.map(r => {
                  const tint = TYPE_TINT[r.type]
                  const selected = r.id === selectedId
                  return (
                    <button key={r.id} type="button" onClick={() => setSelectedId(r.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8,
                        border: `1px solid ${selected ? 'var(--ap-300)' : 'transparent'}`,
                        background: selected ? 'var(--ap-50)' : 'transparent',
                        cursor: 'pointer', textAlign: 'left',
                      }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: tint.bg, color: tint.text, flexShrink: 0 }}>
                        {TYPE_LABEL[r.type]}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--texte-primaire)' }}>
                          {formatDate(r.periodeDebut, { day: '2-digit', month: 'short', year: 'numeric' })} → {formatDate(r.periodeFin, { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--texte-tertiaire)' }}>
                          Généré le {formatDate(r.genereLe, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </Card>

        {/* Détail */}
        <Card style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          {!selectedId ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EmptyState icon={<Calendar size={24} />} title="Sélectionnez un rapport" description="Choisissez un rapport dans la liste pour en voir le contenu." />
            </div>
          ) : loadingDetail || !detail ? (
            <Card.Body><Skeleton height={300} /></Card.Body>
          ) : (
            <>
              <Card.Header
                title={`${TYPE_LABEL[detail.type]} — ${formatDate(detail.periodeDebut, { day: '2-digit', month: 'long', year: 'numeric' })} → ${formatDate(detail.periodeFin, { day: '2-digit', month: 'long', year: 'numeric' })}`}
                subtitle={`${detail.contenu.totalConsultations} consultation${detail.contenu.totalConsultations > 1 ? 's' : ''} · ${detail.contenu.repos.totalJours} jour(s) de repos prescrits`}
                actions={
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" onClick={() => void exportStatsXlsx(detail.contenu)} style={rapportExportBtn}>
                      <Download size={12} /> Excel
                    </button>
                    <button type="button" onClick={() => exportStatsPdf(detail.contenu)} style={rapportExportBtn}>
                      <Printer size={12} /> PDF
                    </button>
                  </div>
                }
              />
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 var(--espace-5) var(--espace-5)', display: 'flex', flexDirection: 'column', gap: 'var(--espace-5)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--espace-3)' }}>
                  <StatCard icon={<Stethoscope size={18} />} label="Consultations" value={detail.contenu.totalConsultations} tone="accent" />
                  <StatCard icon={<BedSingle size={18} />} label="Jours de repos prescrits" value={detail.contenu.repos.totalJours} tone="gold"
                    hint={`${detail.contenu.repos.consultationsAvecRepos} consultation(s) avec repos`} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 'var(--espace-5)' }}>
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
        </Card>
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
      <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--texte-tertiaire)' }}>{title}</p>
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
