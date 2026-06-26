import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MoreVertical, Pencil, PowerOff, Power, Trash2, Pill } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { Button } from '@workspace/ui/components/button'
import { Input }  from '@workspace/ui/components/input'
import { Label }  from '@workspace/ui/components/label'
import type { MedicamentReference } from '@cms-saris/types'
import { useMedicaments, useCreateMedicament, useUpdateMedicament, useToggleMedicamentStatut, useDeleteMedicament } from '../hooks/useReferentiels'
import { usePagination } from '../hooks/usePagination'
import { isActif }          from '../api/referentiels.api'
import { TabToolbar }       from '../components/TabToolbar'
import { StatutBadge }      from '../components/badges/StatutBadge'
import { SkeletonRows }     from '../components/SkeletonRows'
import { EmptyState }       from '../components/EmptyState'
import { ConfirmDialog }    from '../components/ConfirmDialog'
import { DrawerShell }      from '../components/DrawerShell'
import { PaginationBar }    from '../components/PaginationBar'
import { DataTableHead, dataRowStyle, DATA_TABLE_CARD, useColumnResize } from '@/components/saris'
import { libelle as libelleSchema, texteOpt } from '@/lib/validation'

const medSchema = z.object({
  nomGenerique:  libelleSchema('Nom générique', 2, 150),
  nomCommercial: texteOpt(150),
  familleThera:  texteOpt(100),
})
type MedForm = z.infer<typeof medSchema>

function MedFormFields({ form }: { form: ReturnType<typeof useForm<MedForm>> }) {
  const { t } = useTranslation()
  const { register, formState: { errors } } = form
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <Label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', marginBottom: '6px', display: 'block' }}>
          {t('referentiels.medFieldGeneric')} <span style={{ color: 'var(--erreur-texte)' }}>*</span>
        </Label>
        <Input {...register('nomGenerique')} placeholder={t('referentiels.medGenericPlaceholder')} style={{ fontSize: '13px' }} />
        {errors.nomGenerique && <p style={{ fontSize: '12px', color: 'var(--erreur-texte)', marginTop: '4px' }}>{errors.nomGenerique.message}</p>}
      </div>
      <div>
        <Label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', marginBottom: '6px', display: 'block' }}>
          {t('referentiels.medFieldCommercial')}
          <span style={{ fontSize: '11px', fontWeight: '400', color: 'var(--texte-tertiaire)', marginLeft: '6px' }}>{t('referentiels.optional')}</span>
        </Label>
        <Input {...register('nomCommercial')} placeholder={t('referentiels.medCommercialPlaceholder')} style={{ fontSize: '13px' }} />
      </div>
      <div>
        <Label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', marginBottom: '6px', display: 'block' }}>
          {t('referentiels.medFieldFamily')}
          <span style={{ fontSize: '11px', fontWeight: '400', color: 'var(--texte-tertiaire)', marginLeft: '6px' }}>{t('referentiels.optional')}</span>
        </Label>
        <Input {...register('familleThera')} placeholder={t('referentiels.medFamilyPlaceholder')} style={{ fontSize: '13px' }} />
      </div>
    </div>
  )
}

export function MedicamentsTab({ canCreate, canUpdate, canDelete }: { canCreate: boolean; canUpdate: boolean; canDelete: boolean }) {
  const { t } = useTranslation()
  const { data: medicaments = [], isLoading } = useMedicaments()
  const createMed  = useCreateMedicament()
  const updateMed  = useUpdateMedicament()
  const toggleStatut = useToggleMedicamentStatut()
  const deleteMed  = useDeleteMedicament()

  const [search, setSearch]     = useState('')
  const [statut, setStatut]     = useState('all')
  const [drawerOpen, setDrawer] = useState(false)
  const [editTarget, setEdit]   = useState<MedicamentReference | null>(null)
  const [confirm, setConfirm]   = useState<MedicamentReference | null>(null)
  const [confirmDel, setConfirmDel] = useState<MedicamentReference | null>(null)

  const form = useForm<MedForm>({ resolver: zodResolver(medSchema) })

  const filtered = useMemo(() => medicaments.filter(m => {
    if (statut === 'actif'   && !isActif(m.statut)) return false
    if (statut === 'inactif' &&  isActif(m.statut)) return false
    if (search) {
      const q = search.toLowerCase()
      return m.nomGenerique.toLowerCase().includes(q) || (m.nomCommercial ?? '').toLowerCase().includes(q) || (m.familleThera ?? '').toLowerCase().includes(q)
    }
    return true
  }), [medicaments, search, statut])

  const pagination = usePagination(filtered, 5)
  const rz = useColumnResize({ storageKey: 'ref-medicaments', ready: !isLoading && filtered.length > 0, cellsSelector: 'thead th' })

  function openCreate() { setEdit(null); form.reset({ nomGenerique: '', nomCommercial: '', familleThera: '' }); setDrawer(true) }
  function openEdit(m: MedicamentReference) { setEdit(m); form.reset({ nomGenerique: m.nomGenerique, nomCommercial: m.nomCommercial ?? '', familleThera: m.familleThera ?? '' }); setDrawer(true) }
  function closeDrawer() { setDrawer(false); setEdit(null); form.reset() }

  async function handleSave() {
    const ok = await form.trigger(); if (!ok) return
    const raw = form.getValues()
    const data = { ...raw, nomCommercial: raw.nomCommercial || undefined, familleThera: raw.familleThera || undefined }
    if (editTarget) { await updateMed.mutateAsync({ id: editTarget.id, data }) }
    else { await createMed.mutateAsync(data) }
    closeDrawer()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, paddingBottom: '16px' }}>
      <div style={{ flexShrink: 0 }}>
        <TabToolbar search={search} onSearchChange={setSearch} statut={statut} onStatutChange={setStatut}
          onNew={openCreate} newLabel={t('referentiels.medNew')} placeholder={t('referentiels.medSearchPlaceholder')} canCreate={canCreate} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingBottom: '8px' }}>
        <div style={DATA_TABLE_CARD}>
          <table ref={rz.containerRef} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: rz.tableLayout }}>
            <DataTableHead resize={rz} columns={[
              { label: t('referentiels.medColGeneric') },
              { label: t('referentiels.medColCommercial') },
              { label: t('referentiels.medColFamily') },
              { label: t('referentiels.medColStatus') },
              { label: '', align: 'right' },
            ]} />
            <tbody>
              {isLoading ? (
                <SkeletonRows rows={6} cols={5} widths={[0.3, 0.2, 0.22, 0.12, 0.05]} />
              ) : filtered.length === 0 ? (
                <EmptyState icon={Pill}
                  title={search ? t('referentiels.medEmptySearch') : t('referentiels.medEmpty')}
                  description={!search ? t('referentiels.medEmptyHint') : undefined}
                  action={!search && canCreate ? <Button size="sm" onClick={openCreate} style={{ background: 'var(--ap-400)', color: '#fff', fontSize: '12px' }}>{t('referentiels.medNew')}</Button> : undefined} />
              ) : (
                pagination.pageData.map((m, i) => (
                  <MedRow key={m.id} med={m} striped={i % 2 === 1}
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

      <DrawerShell open={drawerOpen} onClose={closeDrawer} icon={<Pill size={18} />}
        title={editTarget ? t('referentiels.editPrefix', { value: editTarget.nomGenerique }) : t('referentiels.medNew')}
        onSave={handleSave} isSaving={createMed.isPending || updateMed.isPending} isDirty={form.formState.isDirty}>
        <MedFormFields form={form} />
      </DrawerShell>

      <ConfirmDialog open={!!confirm} onCancel={() => setConfirm(null)}
        onConfirm={async () => { if (confirm) { await toggleStatut.mutateAsync(confirm); setConfirm(null) } }}
        loading={toggleStatut.isPending}
        title={confirm && isActif(confirm.statut) ? t('referentiels.medToggleOffTitle') : t('referentiels.medToggleOnTitle')}
        description={confirm && isActif(confirm.statut)
          ? t('referentiels.medToggleOffDesc')
          : t('referentiels.medToggleOnDesc')}
        confirmLabel={confirm && isActif(confirm.statut) ? t('referentiels.deactivate') : t('referentiels.activate')} />

      <ConfirmDialog open={!!confirmDel} onCancel={() => setConfirmDel(null)}
        onConfirm={async () => { if (confirmDel) { await deleteMed.mutateAsync(confirmDel.id); setConfirmDel(null) } }}
        loading={deleteMed.isPending}
        title={t('referentiels.medDeleteTitle')}
        description={t('referentiels.medDeleteDesc')}
        confirmLabel={t('referentiels.delete')} />
    </div>
  )
}

function MedRow({ med, striped, onEdit, onToggle, onDelete, canUpdate, canDelete }: {
  med: MedicamentReference; striped: boolean; onEdit: (m: MedicamentReference) => void; onToggle: () => void; onDelete: () => void; canUpdate: boolean; canDelete: boolean
}) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)
  const showMenu = canUpdate || canDelete
  return (
    <tr onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={dataRowStyle(striped, hovered)}>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)' }}>
        <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)' }}>{med.nomGenerique}</span>
      </td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)' }}>
        <span style={{ fontSize: '13px', color: med.nomCommercial ? 'var(--texte-secondaire)' : 'var(--texte-tertiaire)', fontStyle: med.nomCommercial ? 'normal' : 'italic' }}>
          {med.nomCommercial ?? '—'}
        </span>
      </td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)' }}>
        {med.familleThera ? (
          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500', background: 'var(--info-fond)', color: 'var(--info-texte)' }}>
            {med.familleThera}
          </span>
        ) : <span style={{ color: 'var(--texte-tertiaire)', fontSize: '13px' }}>—</span>}
      </td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)' }}><StatutBadge statut={med.statut} /></td>
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
                <DropdownMenuItem onClick={() => onEdit(med)} style={{ gap: '8px', cursor: 'pointer' }}><Pencil size={13} /> {t('referentiels.actionEdit')}</DropdownMenuItem>
              )}
              {canUpdate && canDelete && <DropdownMenuSeparator />}
              {canDelete && (
                <DropdownMenuItem onClick={onToggle} style={{ gap: '8px', cursor: 'pointer', color: isActif(med.statut) ? 'var(--erreur-texte)' : 'var(--succes-texte)' }}>
                  {isActif(med.statut) ? <PowerOff size={13} /> : <Power size={13} />}
                  {isActif(med.statut) ? t('referentiels.deactivate') : t('referentiels.activate')}
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
