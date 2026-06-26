import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MoreVertical, Pencil, PowerOff, Power, Trash2, ClipboardList } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { Button } from '@workspace/ui/components/button'
import { Input }  from '@workspace/ui/components/input'
import { Label }  from '@workspace/ui/components/label'
import type { MotifConsultation } from '@cms-saris/types'
import { useMotifs, useCreateMotif, useUpdateMotif, useToggleMotifStatut, useDeleteMotif } from '../hooks/useReferentiels'
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
import { codeReferentiel, libelle as libelleSchema } from '@/lib/validation'

const motifSchema = z.object({
  code:     codeReferentiel(2, 30),
  libelle:  libelleSchema('Libellé', 2, 100),
})
type MotifForm = z.infer<typeof motifSchema>

function MotifFormFields({ form }: { form: ReturnType<typeof useForm<MotifForm>> }) {
  const { t } = useTranslation()
  const { register, formState: { errors } } = form
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <Label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', marginBottom: '6px', display: 'block' }}>
          {t('referentiels.fieldCode')} <span style={{ color: 'var(--erreur-texte)' }}>*</span>
        </Label>
        <Input {...register('code')} placeholder={t('referentiels.motifCodePlaceholder')}
          style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', fontSize: '13px' }} />
        {errors.code && <p style={{ fontSize: '12px', color: 'var(--erreur-texte)', marginTop: '4px' }}>{errors.code.message}</p>}
      </div>
      <div>
        <Label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', marginBottom: '6px', display: 'block' }}>
          {t('referentiels.fieldLabel')} <span style={{ color: 'var(--erreur-texte)' }}>*</span>
        </Label>
        <Input {...register('libelle')} placeholder={t('referentiels.motifLabelPlaceholder')} style={{ fontSize: '13px' }} />
        {errors.libelle && <p style={{ fontSize: '12px', color: 'var(--erreur-texte)', marginTop: '4px' }}>{errors.libelle.message}</p>}
      </div>
    </div>
  )
}

export function MotifsTab({ canCreate, canUpdate, canDelete }: { canCreate: boolean; canUpdate: boolean; canDelete: boolean }) {
  const { t } = useTranslation()
  const { data: motifs = [], isLoading } = useMotifs()
  const createMotif  = useCreateMotif()
  const updateMotif  = useUpdateMotif()
  const toggleStatut = useToggleMotifStatut()
  const deleteMotif  = useDeleteMotif()

  const [search, setSearch]     = useState('')
  const [statut, setStatut]     = useState('all')
  const [drawerOpen, setDrawer] = useState(false)
  const [editTarget, setEdit]   = useState<MotifConsultation | null>(null)
  const [confirm, setConfirm]   = useState<MotifConsultation | null>(null)
  const [confirmDel, setConfirmDel] = useState<MotifConsultation | null>(null)

  const form = useForm<MotifForm>({ resolver: zodResolver(motifSchema), defaultValues: { code: '', libelle: '' } })

  const filtered = useMemo(() => motifs.filter(m => {
    if (statut === 'actif'   && !isActif(m.statut)) return false
    if (statut === 'inactif' &&  isActif(m.statut)) return false
    if (search) { const q = search.toLowerCase(); return m.code.toLowerCase().includes(q) || m.libelle.toLowerCase().includes(q) }
    return true
  }), [motifs, search, statut])

  const pagination = usePagination(filtered, 5)
  const rz = useColumnResize({ storageKey: 'ref-motifs', ready: !isLoading && filtered.length > 0, cellsSelector: 'thead th' })

  function openCreate() { setEdit(null); form.reset({ code: '', libelle: '' }); setDrawer(true) }
  function openEdit(m: MotifConsultation) { setEdit(m); form.reset({ code: m.code, libelle: m.libelle }); setDrawer(true) }
  function closeDrawer() { setDrawer(false); setEdit(null); form.reset() }

  async function handleSave() {
    const ok = await form.trigger(); if (!ok) return
    const data = form.getValues()
    if (editTarget) { await updateMotif.mutateAsync({ id: editTarget.id, data }) }
    else { await createMotif.mutateAsync(data) }
    closeDrawer()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, paddingBottom: '16px' }}>
      {/* Toolbar fixe */}
      <div style={{ flexShrink: 0 }}>
        <TabToolbar search={search} onSearchChange={setSearch} statut={statut} onStatutChange={setStatut}
          onNew={openCreate} newLabel={t('referentiels.motifNew')} placeholder={t('referentiels.motifSearchPlaceholder')} canCreate={canCreate} />
      </div>

      {/* Zone scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingBottom: '8px' }}>
        <div style={DATA_TABLE_CARD}>
          <table ref={rz.containerRef} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: rz.tableLayout }}>
            <DataTableHead resize={rz} columns={[
              { label: t('referentiels.fieldCode') },
              { label: t('referentiels.fieldLabel') },
              { label: t('referentiels.motifColStatus') },
              { label: '', align: 'right' },
            ]} />
            <tbody>
              {isLoading ? (
                <SkeletonRows rows={6} cols={4} widths={[0.24, 0.5, 0.18, 0.08]} />
              ) : filtered.length === 0 ? (
                <EmptyState icon={ClipboardList}
                  title={search ? t('referentiels.motifEmptySearch') : t('referentiels.motifEmpty')}
                  description={!search ? t('referentiels.motifEmptyHint') : undefined}
                  action={!search && canCreate ? <Button size="sm" onClick={openCreate} style={{ background: 'var(--ap-400)', color: '#fff', fontSize: '12px' }}>{t('referentiels.motifNew')}</Button> : undefined} />
              ) : (
                pagination.pageData.map((m, i) => (
                  <MotifRow key={m.id} motif={m} striped={i % 2 === 1}
                    onEdit={openEdit} onToggle={() => setConfirm(m)} onDelete={() => setConfirmDel(m)}
                    canUpdate={canUpdate} canDelete={canDelete} />
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

      <DrawerShell open={drawerOpen} onClose={closeDrawer} icon={<ClipboardList size={18} />}
        title={editTarget ? t('referentiels.editPrefix', { value: editTarget.code }) : t('referentiels.motifDrawerNewTitle')}
        description={editTarget ? undefined : t('referentiels.motifDrawerNewDesc')}
        onSave={handleSave} isSaving={createMotif.isPending || updateMotif.isPending} isDirty={form.formState.isDirty}>
        <MotifFormFields form={form} />
      </DrawerShell>

      <ConfirmDialog open={!!confirm} onCancel={() => setConfirm(null)}
        onConfirm={async () => { if (confirm) { await toggleStatut.mutateAsync(confirm); setConfirm(null) } }}
        loading={toggleStatut.isPending}
        title={confirm && isActif(confirm.statut) ? t('referentiels.motifToggleOffTitle') : t('referentiels.motifToggleOnTitle')}
        description={confirm && isActif(confirm.statut)
          ? t('referentiels.motifToggleOffDesc')
          : t('referentiels.motifToggleOnDesc')}
        confirmLabel={confirm && isActif(confirm.statut) ? t('referentiels.deactivate') : t('referentiels.activate')} />

      <ConfirmDialog open={!!confirmDel} onCancel={() => setConfirmDel(null)}
        onConfirm={async () => { if (confirmDel) { await deleteMotif.mutateAsync(confirmDel.id); setConfirmDel(null) } }}
        loading={deleteMotif.isPending}
        title={t('referentiels.motifDeleteTitle')}
        description={t('referentiels.motifDeleteDesc')}
        confirmLabel={t('referentiels.delete')} />
    </div>
  )
}

function MotifRow({ motif, striped, onEdit, onToggle, onDelete, canUpdate, canDelete }: {
  motif: MotifConsultation; striped: boolean; onEdit: (m: MotifConsultation) => void; onToggle: () => void; onDelete: () => void; canUpdate: boolean; canDelete: boolean
}) {
  const { t } = useTranslation()
  const showMenu = canUpdate || canDelete
  const [hovered, setHovered] = useState(false)
  return (
    <tr onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={dataRowStyle(striped, hovered)}>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)', width: '200px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--texte-tertiaire)' }}>{motif.code}</span>
      </td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)' }}>
        <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)' }}>{motif.libelle}</span>
      </td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)' }}><StatutBadge statut={motif.statut} /></td>
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
                <DropdownMenuItem onClick={() => onEdit(motif)} style={{ gap: '8px', cursor: 'pointer' }}><Pencil size={13} /> {t('referentiels.actionEdit')}</DropdownMenuItem>
              )}
              {canUpdate && canDelete && <DropdownMenuSeparator />}
              {canDelete && (
                <DropdownMenuItem onClick={onToggle} style={{ gap: '8px', cursor: 'pointer', color: isActif(motif.statut) ? 'var(--erreur-texte)' : 'var(--succes-texte)' }}>
                  {isActif(motif.statut) ? <PowerOff size={13} /> : <Power size={13} />}
                  {isActif(motif.statut) ? t('referentiels.deactivate') : t('referentiels.activate')}
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
