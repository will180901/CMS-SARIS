import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MoreVertical, Pencil, PowerOff, Power, Trash2, MapPin } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { Button } from '@workspace/ui/components/button'
import { Input }  from '@workspace/ui/components/input'
import { Label }  from '@workspace/ui/components/label'
import type { Site } from '@cms-saris/types'
import { useSites, useCreateSite, useUpdateSite, useToggleSiteStatut, useDeleteSite } from '../hooks/useReferentiels'
import { usePagination } from '../hooks/usePagination'
import { isActif }         from '../api/referentiels.api'
import { TabToolbar }      from '../components/TabToolbar'
import { StatutBadge }     from '../components/badges/StatutBadge'
import { SkeletonRows }    from '../components/SkeletonRows'
import { EmptyState }      from '../components/EmptyState'
import { ConfirmDialog }   from '../components/ConfirmDialog'
import { DrawerShell }     from '../components/DrawerShell'
import { PaginationBar }   from '../components/PaginationBar'
import { DataTableHead, dataRowStyle, DATA_TABLE_CARD, useColumnResize } from '@/components/saris'
import { codeReferentiel, libelle as libelleSchema, texteOpt } from '@/lib/validation'

// ── Schéma ────────────────────────────────────────────────────────────────────

const siteSchema = z.object({
  code:         codeReferentiel(2, 20),
  libelle:      libelleSchema('Libellé', 2, 100),
  localisation: texteOpt(200),
})
type SiteForm = z.infer<typeof siteSchema>

// ── Form ──────────────────────────────────────────────────────────────────────

function SiteFormFields({ form }: { form: ReturnType<typeof useForm<SiteForm>> }) {
  const { t } = useTranslation()
  const { register, formState: { errors } } = form
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <Label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', marginBottom: '6px', display: 'block' }}>
          {t('referentiels.fieldCode')} <span style={{ color: 'var(--erreur-texte)' }}>*</span>
        </Label>
        <Input {...register('code')} placeholder={t('referentiels.siteCodePlaceholder')}
          style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', fontSize: '13px' }} />
        {errors.code && <p style={{ fontSize: '12px', color: 'var(--erreur-texte)', marginTop: '4px' }}>{errors.code.message}</p>}
      </div>
      <div>
        <Label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', marginBottom: '6px', display: 'block' }}>
          {t('referentiels.fieldLabel')} <span style={{ color: 'var(--erreur-texte)' }}>*</span>
        </Label>
        <Input {...register('libelle')} placeholder={t('referentiels.siteLabelPlaceholder')} style={{ fontSize: '13px' }} />
        {errors.libelle && <p style={{ fontSize: '12px', color: 'var(--erreur-texte)', marginTop: '4px' }}>{errors.libelle.message}</p>}
      </div>
      <div>
        <Label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', marginBottom: '6px', display: 'block' }}>
          {t('referentiels.siteFieldLocation')}
        </Label>
        <Input {...register('localisation')} placeholder={t('referentiels.siteLocationPlaceholder')} style={{ fontSize: '13px' }} />
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

export function SitesTab({ canCreate, canUpdate, canDelete }: { canCreate: boolean; canUpdate: boolean; canDelete: boolean }) {
  const { t } = useTranslation()
  const { data: sites = [], isLoading } = useSites()
  const createSite   = useCreateSite()
  const updateSite   = useUpdateSite()
  const toggleStatut = useToggleSiteStatut()
  const deleteSite   = useDeleteSite()

  const [search, setSearch]     = useState('')
  const [statut, setStatut]     = useState('all')
  const [drawerOpen, setDrawer] = useState(false)
  const [editTarget, setEdit]   = useState<Site | null>(null)
  const [confirm, setConfirm]   = useState<Site | null>(null)
  const [confirmDel, setConfirmDel] = useState<Site | null>(null)

  const form = useForm<SiteForm>({ resolver: zodResolver(siteSchema) })

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

  // Handlers
  function openCreate() { setEdit(null); form.reset({ code: '', libelle: '', localisation: '' }); setDrawer(true) }
  function openEdit(site: Site) { setEdit(site); form.reset({ code: site.code, libelle: site.libelle, localisation: site.localisation ?? '' }); setDrawer(true) }
  function closeDrawer() { setDrawer(false); setEdit(null); form.reset() }

  async function handleSave() {
    const ok = await form.trigger(); if (!ok) return
    const data = form.getValues()
    if (editTarget) { await updateSite.mutateAsync({ id: editTarget.id, data }) }
    else { await createSite.mutateAsync(data) }
    closeDrawer()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, paddingBottom: '16px' }}>

      {/* ── Toolbar fixe ─────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0 }}>
        <TabToolbar
          search={search} onSearchChange={setSearch}
          statut={statut} onStatutChange={setStatut}
          onNew={openCreate} newLabel={t('referentiels.siteNew')}
          placeholder={t('referentiels.siteSearchPlaceholder')} canCreate={canCreate}
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
              { label: '', align: 'right' },
            ]} />
            <tbody>
              {isLoading ? (
                <SkeletonRows rows={5} cols={5} widths={[0.15, 0.35, 0.3, 0.12, 0.08]} />
              ) : filtered.length === 0 ? (
                <EmptyState icon={MapPin}
                  title={search ? t('referentiels.siteEmptySearch') : t('referentiels.siteEmpty')}
                  description={!search ? t('referentiels.siteEmptyHint') : undefined}
                  action={!search && canCreate ? (
                    <Button size="sm" onClick={openCreate} style={{ background: 'var(--ap-400)', color: '#fff', fontSize: '12px' }}>{t('referentiels.siteNew')}</Button>
                  ) : undefined}
                />
              ) : (
                pagination.pageData.map((site, idx) => (
                  <SiteRow key={site.id} site={site} striped={idx % 2 === 1}
                    onEdit={openEdit} onToggle={() => setConfirm(site)} onDelete={() => setConfirmDel(site)} canUpdate={canUpdate} canDelete={canDelete} />
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

      {/* Drawer */}
      <DrawerShell open={drawerOpen} onClose={closeDrawer} icon={<MapPin size={18} />}
        title={editTarget ? t('referentiels.editPrefix', { value: editTarget.code }) : t('referentiels.siteNew')}
        description={editTarget ? t('referentiels.siteDrawerEditDesc') : t('referentiels.siteDrawerNewDesc')}
        onSave={handleSave} isSaving={createSite.isPending || updateSite.isPending} isDirty={form.formState.isDirty}>
        <SiteFormFields form={form} />
      </DrawerShell>

      {/* Confirmation */}
      <ConfirmDialog open={!!confirm} onCancel={() => setConfirm(null)}
        onConfirm={async () => { if (confirm) { await toggleStatut.mutateAsync(confirm); setConfirm(null) } }}
        loading={toggleStatut.isPending}
        title={confirm && isActif(confirm.statut) ? t('referentiels.siteToggleOffTitle') : t('referentiels.siteToggleOnTitle')}
        description={confirm && isActif(confirm.statut)
          ? t('referentiels.siteToggleOffDesc')
          : t('referentiels.siteToggleOnDesc')}
        confirmLabel={confirm && isActif(confirm.statut) ? t('referentiels.deactivate') : t('referentiels.activate')} />

      <ConfirmDialog open={!!confirmDel} onCancel={() => setConfirmDel(null)}
        onConfirm={async () => { if (confirmDel) { await deleteSite.mutateAsync(confirmDel.id); setConfirmDel(null) } }}
        loading={deleteSite.isPending}
        title={t('referentiels.siteDeleteTitle')}
        description={t('referentiels.siteDeleteDesc')}
        confirmLabel={t('referentiels.delete')} />
    </div>
  )
}

// ── Ligne ─────────────────────────────────────────────────────────────────────

function SiteRow({ site, striped, onEdit, onToggle, onDelete, canUpdate, canDelete }: {
  site: Site; striped: boolean; onEdit: (s: Site) => void; onToggle: () => void; onDelete: () => void; canUpdate: boolean; canDelete: boolean
}) {
  const { t } = useTranslation()
  const showMenu = canUpdate || canDelete
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
      <td style={{ padding: 'var(--espace-2) var(--espace-4)', textAlign: 'right', width: '48px' }}>
        {showMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" style={{ width: '28px', height: '28px', opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}>
                <MoreVertical size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ minWidth: '160px', fontSize: '13px' }}>
              {canUpdate && (
                <DropdownMenuItem onClick={() => onEdit(site)} style={{ gap: '8px', cursor: 'pointer' }}><Pencil size={13} /> {t('referentiels.actionEdit')}</DropdownMenuItem>
              )}
              {canUpdate && canDelete && <DropdownMenuSeparator />}
              {canDelete && (
                <DropdownMenuItem onClick={onToggle} style={{ gap: '8px', cursor: 'pointer', color: isActif(site.statut) ? 'var(--erreur-texte)' : 'var(--succes-texte)' }}>
                  {isActif(site.statut) ? <PowerOff size={13} /> : <Power size={13} />}
                  {isActif(site.statut) ? t('referentiels.deactivate') : t('referentiels.activate')}
                </DropdownMenuItem>
              )}
              {canDelete && <DropdownMenuSeparator />}
              {canDelete && (
                <DropdownMenuItem onClick={onDelete} style={{ gap: '8px', cursor: 'pointer', color: 'var(--erreur-texte)' }}>
                  <Trash2 size={13} /> {t('referentiels.actionDeletePermanently')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </td>
    </tr>
  )
}
