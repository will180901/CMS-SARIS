import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MoreVertical, Pencil, PowerOff, Power, Trash2, Activity } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { Button } from '@workspace/ui/components/button'
import { Input }  from '@workspace/ui/components/input'
import { Label }  from '@workspace/ui/components/label'
import type { PathologieReference } from '@cms-saris/types'
import { usePathologies, useCreatePathologie, useUpdatePathologie, useTogglePathologieStatut, useDeletePathologie } from '../hooks/useReferentiels'
import { usePagination } from '../hooks/usePagination'
import { isActif }          from '../api/referentiels.api'
import { TabToolbar }       from '../components/TabToolbar'
import { ChroniqueBadge }   from '../components/badges/ChroniqueBadge'
import { StatutBadge }      from '../components/badges/StatutBadge'
import { SkeletonRows }     from '../components/SkeletonRows'
import { EmptyState }       from '../components/EmptyState'
import { ConfirmDialog }    from '../components/ConfirmDialog'
import { DrawerShell }      from '../components/DrawerShell'
import { PaginationBar }    from '../components/PaginationBar'
import { DataTableHead, dataRowStyle, DATA_TABLE_CARD, useColumnResize } from '@/components/saris'
import { codeReferentiel, libelle as libelleSchema } from '@/lib/validation'

const pathoSchema = z.object({
  code:      codeReferentiel(2, 30),
  libelle:   libelleSchema('Libellé', 2, 150),
  chronique: z.boolean(),
})
type PathoForm = z.infer<typeof pathoSchema>

function PathoFormFields({ form }: { form: ReturnType<typeof useForm<PathoForm>> }) {
  const { t } = useTranslation()
  const { register, control, formState: { errors } } = form
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <Label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', marginBottom: '6px', display: 'block' }}>
          {t('referentiels.fieldCode')} <span style={{ color: 'var(--erreur-texte)' }}>*</span>
        </Label>
        <Input {...register('code')} placeholder={t('referentiels.pathoCodePlaceholder')}
          style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', fontSize: '13px' }} />
        {errors.code && <p style={{ fontSize: '12px', color: 'var(--erreur-texte)', marginTop: '4px' }}>{errors.code.message}</p>}
      </div>
      <div>
        <Label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', marginBottom: '6px', display: 'block' }}>
          {t('referentiels.fieldLabel')} <span style={{ color: 'var(--erreur-texte)' }}>*</span>
        </Label>
        <Input {...register('libelle')} placeholder={t('referentiels.pathoLabelPlaceholder')} style={{ fontSize: '13px' }} />
        {errors.libelle && <p style={{ fontSize: '12px', color: 'var(--erreur-texte)', marginTop: '4px' }}>{errors.libelle.message}</p>}
      </div>
      <div>
        <Label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', marginBottom: '10px', display: 'block' }}>
          {t('referentiels.pathoFieldType')} <span style={{ color: 'var(--erreur-texte)' }}>*</span>
        </Label>
        <Controller name="chronique" control={control} render={({ field }) => (
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { value: false, label: t('referentiels.pathoTypeAcuteLabel'),    desc: t('referentiels.pathoTypeAcuteDesc'), bg: 'var(--fond-surface-2)', color: 'var(--texte-secondaire)', borderActive: 'var(--bordure-forte)' },
              { value: true,  label: t('referentiels.pathoTypeChronicLabel'), desc: t('referentiels.pathoTypeChronicDesc'),      bg: 'var(--avert-fond)',     color: 'var(--avert-texte)',      borderActive: 'var(--avert-texte)'  },
            ].map(opt => (
              <button key={String(opt.value)} type="button" onClick={() => field.onChange(opt.value)}
                style={{
                  flex: '1', padding: '12px', borderRadius: '6px', cursor: 'pointer', textAlign: 'left',
                  border: `2px solid ${field.value === opt.value ? opt.borderActive : 'var(--bordure-legere)'}`,
                  background: field.value === opt.value ? opt.bg : 'var(--fond-surface)',
                  color: field.value === opt.value ? opt.color : 'var(--texte-tertiaire)',
                  transition: 'all 0.12s',
                }}>
                <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '2px' }}>{opt.label}</div>
                <div style={{ fontSize: '11px', opacity: 0.85 }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        )} />
      </div>
    </div>
  )
}

export function PathologiesTab({ canCreate, canUpdate, canDelete }: { canCreate: boolean; canUpdate: boolean; canDelete: boolean }) {
  const { t } = useTranslation()
  const { data: pathologies = [], isLoading } = usePathologies()
  const createPathologie = useCreatePathologie()
  const updatePathologie = useUpdatePathologie()
  const toggleStatut     = useTogglePathologieStatut()
  const deletePatho      = useDeletePathologie()

  const [search, setSearch]     = useState('')
  const [statut, setStatut]     = useState('all')
  const [drawerOpen, setDrawer] = useState(false)
  const [editTarget, setEdit]   = useState<PathologieReference | null>(null)
  const [confirm, setConfirm]   = useState<PathologieReference | null>(null)
  const [confirmDel, setConfirmDel] = useState<PathologieReference | null>(null)

  const form = useForm<PathoForm>({ resolver: zodResolver(pathoSchema), defaultValues: { chronique: false } })

  const filtered = useMemo(() => pathologies.filter(p => {
    if (statut === 'actif'   && !isActif(p.statut)) return false
    if (statut === 'inactif' &&  isActif(p.statut)) return false
    if (search) { const q = search.toLowerCase(); return p.code.toLowerCase().includes(q) || p.libelle.toLowerCase().includes(q) }
    return true
  }), [pathologies, search, statut])

  const pagination = usePagination(filtered, 5)
  const rz = useColumnResize({ storageKey: 'ref-pathologies', ready: !isLoading && filtered.length > 0, cellsSelector: 'thead th' })

  function openCreate() { setEdit(null); form.reset({ code: '', libelle: '', chronique: false }); setDrawer(true) }
  function openEdit(p: PathologieReference) { setEdit(p); form.reset({ code: p.code, libelle: p.libelle, chronique: p.chronique }); setDrawer(true) }
  function closeDrawer() { setDrawer(false); setEdit(null); form.reset() }

  async function handleSave() {
    const ok = await form.trigger(); if (!ok) return
    const data = form.getValues()
    if (editTarget) { await updatePathologie.mutateAsync({ id: editTarget.id, data }) }
    else { await createPathologie.mutateAsync(data) }
    closeDrawer()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, paddingBottom: '16px' }}>
      <div style={{ flexShrink: 0 }}>
        <TabToolbar search={search} onSearchChange={setSearch} statut={statut} onStatutChange={setStatut}
          onNew={openCreate} newLabel={t('referentiels.pathoNew')} placeholder={t('referentiels.pathoSearchPlaceholder')} canCreate={canCreate} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingBottom: '8px' }}>
        <div style={DATA_TABLE_CARD}>
          <table ref={rz.containerRef} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: rz.tableLayout }}>
            <DataTableHead resize={rz} columns={[
              { label: t('referentiels.fieldCode') },
              { label: t('referentiels.fieldLabel') },
              { label: t('referentiels.pathoColType') },
              { label: t('referentiels.pathoColStatus') },
              { label: '', align: 'right' },
            ]} />
            <tbody>
              {isLoading ? (
                <SkeletonRows rows={6} cols={5} widths={[0.18, 0.42, 0.12, 0.12, 0.05]} />
              ) : filtered.length === 0 ? (
                <EmptyState icon={Activity}
                  title={search ? t('referentiels.pathoEmptySearch') : t('referentiels.pathoEmpty')}
                  description={!search ? t('referentiels.pathoEmptyHint') : undefined}
                  action={!search && canCreate ? <Button size="sm" onClick={openCreate} style={{ background: 'var(--ap-400)', color: '#fff', fontSize: '12px' }}>{t('referentiels.pathoNew')}</Button> : undefined} />
              ) : (
                pagination.pageData.map((p, i) => (
                  <PathoRow key={p.id} patho={p} striped={i % 2 === 1}
                    onEdit={openEdit} onToggle={() => setConfirm(p)} onDelete={() => setConfirmDel(p)}
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

      <DrawerShell open={drawerOpen} onClose={closeDrawer} icon={<Activity size={18} />}
        title={editTarget ? t('referentiels.editPrefix', { value: editTarget.code }) : t('referentiels.pathoNew')}
        onSave={handleSave} isSaving={createPathologie.isPending || updatePathologie.isPending} isDirty={form.formState.isDirty}>
        <PathoFormFields form={form} />
      </DrawerShell>

      <ConfirmDialog open={!!confirm} onCancel={() => setConfirm(null)}
        onConfirm={async () => { if (confirm) { await toggleStatut.mutateAsync(confirm); setConfirm(null) } }}
        loading={toggleStatut.isPending}
        title={confirm && isActif(confirm.statut) ? t('referentiels.pathoToggleOffTitle') : t('referentiels.pathoToggleOnTitle')}
        description={confirm && isActif(confirm.statut)
          ? t('referentiels.pathoToggleOffDesc')
          : t('referentiels.pathoToggleOnDesc')}
        confirmLabel={confirm && isActif(confirm.statut) ? t('referentiels.deactivate') : t('referentiels.activate')} />

      <ConfirmDialog open={!!confirmDel} onCancel={() => setConfirmDel(null)}
        onConfirm={async () => { if (confirmDel) { await deletePatho.mutateAsync(confirmDel.id); setConfirmDel(null) } }}
        loading={deletePatho.isPending}
        title={t('referentiels.pathoDeleteTitle')}
        description={t('referentiels.pathoDeleteDesc')}
        confirmLabel={t('referentiels.delete')} />
    </div>
  )
}

function PathoRow({ patho, striped, onEdit, onToggle, onDelete, canUpdate, canDelete }: {
  patho: PathologieReference; striped: boolean; onEdit: (p: PathologieReference) => void; onToggle: () => void; onDelete: () => void; canUpdate: boolean; canDelete: boolean
}) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)
  const showMenu = canUpdate || canDelete
  return (
    <tr onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={dataRowStyle(striped, hovered)}>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)', width: '160px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--texte-tertiaire)' }}>{patho.code}</span>
      </td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)' }}>
        <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)' }}>{patho.libelle}</span>
      </td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)' }}><ChroniqueBadge chronique={patho.chronique} /></td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)' }}><StatutBadge statut={patho.statut} /></td>
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
                <DropdownMenuItem onClick={() => onEdit(patho)} style={{ gap: '8px', cursor: 'pointer' }}><Pencil size={13} /> {t('referentiels.actionEdit')}</DropdownMenuItem>
              )}
              {canUpdate && canDelete && <DropdownMenuSeparator />}
              {canDelete && (
                <DropdownMenuItem onClick={onToggle} style={{ gap: '8px', cursor: 'pointer', color: isActif(patho.statut) ? 'var(--erreur-texte)' : 'var(--succes-texte)' }}>
                  {isActif(patho.statut) ? <PowerOff size={13} /> : <Power size={13} />}
                  {isActif(patho.statut) ? t('referentiels.deactivate') : t('referentiels.activate')}
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
