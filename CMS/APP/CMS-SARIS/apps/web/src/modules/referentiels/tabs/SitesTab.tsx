import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin } from 'lucide-react'
import type { Site } from '@cms-saris/types'
import { useSites } from '../hooks/useReferentiels'
import { usePagination } from '../hooks/usePagination'
import { isActif } from '../api/referentiels.api'
import { TabToolbar }      from '../components/TabToolbar'
import { StatutBadge }     from '../components/badges/StatutBadge'
import { SkeletonRows }    from '../components/SkeletonRows'
import { EmptyState }      from '../components/EmptyState'
import { PaginationBar }   from '../components/PaginationBar'
import { DataTableHead, dataRowStyle, DATA_TABLE_CARD, useColumnResize } from '@/components/saris'

// ── Composant principal ───────────────────────────────────────────────────────
// Lecture seule : les sites sont désormais enregistrés une seule fois, à la
// première installation du poste desktop (cf. configuration du poste) — plus
// de création/modification/suppression depuis l'interface après coup.
export function SitesTab() {
  const { t } = useTranslation()
  const { data: sites = [], isLoading } = useSites()

  const [search, setSearch] = useState('')
  const [statut, setStatut] = useState('all')

  // Filtrage client-side
  const filtered = useMemo(() => sites.filter(s => {
    if (statut === 'actif'   && !isActif(s.statut)) return false
    if (statut === 'inactif' &&  isActif(s.statut)) return false
    if (search) {
      const q = search.toLowerCase()
      return s.code.toLowerCase().includes(q) || s.libelle.toLowerCase().includes(q)
    }
    return true
  }), [sites, search, statut])

  // Pagination
  const pagination = usePagination(filtered, 5)

  // Redimensionnement des colonnes (persistant)
  const rz = useColumnResize({ storageKey: 'ref-sites', ready: !isLoading && filtered.length > 0, cellsSelector: 'thead th' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, paddingBottom: '16px' }}>

      {/* ── Toolbar fixe (pas de bouton « Nouveau » — lecture seule) ────── */}
      <div style={{ flexShrink: 0 }}>
        <TabToolbar
          search={search} onSearchChange={setSearch}
          statut={statut} onStatutChange={setStatut}
          onNew={() => {}} newLabel="" canCreate={false}
          placeholder={t('referentiels.siteSearchPlaceholder')}
        />
      </div>

      {/* ── Zone scrollable ───────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingBottom: '8px' }}>
        <div style={DATA_TABLE_CARD}>
          <table ref={rz.containerRef} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: rz.tableLayout }}>
            <DataTableHead resize={rz} columns={[
              { label: t('referentiels.fieldCode') },
              { label: t('referentiels.fieldLabel') },
              { label: t('referentiels.siteColLocation') },
              { label: t('referentiels.siteColStatus') },
            ]} />
            <tbody>
              {isLoading ? (
                <SkeletonRows rows={5} cols={4} widths={[0.15, 0.35, 0.35, 0.15]} />
              ) : filtered.length === 0 ? (
                <EmptyState icon={MapPin}
                  title={search ? t('referentiels.siteEmptySearch') : t('referentiels.siteEmpty')}
                  description={!search ? t('referentiels.siteEmptyHint') : undefined}
                />
              ) : (
                pagination.pageData.map((site, idx) => (
                  <SiteRow key={site.id} site={site} striped={idx % 2 === 1} />
                ))
              )}
            </tbody>
          </table>

        </div>
      </div>
      {!isLoading && filtered.length > 0 && (
        <div style={{ flexShrink: 0 }}>
          <PaginationBar {...pagination} />
        </div>
      )}
    </div>
  )
}

// ── Ligne ─────────────────────────────────────────────────────────────────────

function SiteRow({ site, striped }: { site: Site; striped: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <tr onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={dataRowStyle(striped, hovered)}>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)', width: '130px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--texte-tertiaire)' }}>{site.code}</span>
      </td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)' }}>
        <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)' }}>{site.libelle}</span>
      </td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)', color: 'var(--texte-secondaire)', fontSize: '13px' }}>{site.localisation ?? '—'}</td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)' }}><StatutBadge statut={site.statut} /></td>
    </tr>
  )
}
