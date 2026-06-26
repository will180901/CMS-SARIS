import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MoreVertical, Pencil, PowerOff, Power, Trash2, Stethoscope } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { Button } from '@workspace/ui/components/button'
import { Input }  from '@workspace/ui/components/input'
import { Label }  from '@workspace/ui/components/label'
import type { TypeConsultation } from '@cms-saris/types'
import { useTypesConsultation, useCreateTypeConsultation, useUpdateTypeConsultation, useToggleTypeConsultationStatut, useDeleteTypeConsultation } from '../hooks/useReferentiels'
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

const schema = z.object({
  code:    codeReferentiel(2, 30),
  libelle: libelleSchema('Libellé', 2, 100),
})
type FormVals = z.infer<typeof schema>

function FormFields({ form }: { form: ReturnType<typeof useForm<FormVals>> }) {
  const { t } = useTranslation()
  const { register, formState: { errors } } = form
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <Label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', marginBottom: '6px', display: 'block' }}>
          {t('referentiels.fieldCode')} <span style={{ color: 'var(--erreur-texte)' }}>*</span>
        </Label>
        <Input {...register('code')} placeholder={t('referentiels.typeConsultationCodePlaceholder', { defaultValue: 'ex. CONSULT_GEN' })}
          style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', fontSize: '13px' }} />
        {errors.code && <p style={{ fontSize: '12px', color: 'var(--erreur-texte)', marginTop: '4px' }}>{errors.code.message}</p>}
      </div>
      <div>
        <Label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', marginBottom: '6px', display: 'block' }}>
          {t('referentiels.fieldLabel')} <span style={{ color: 'var(--erreur-texte)' }}>*</span>
        </Label>
        <Input {...register('libelle')} placeholder={t('referentiels.typeConsultationLabelPlaceholder', { defaultValue: 'ex. Consultation générale' })} style={{ fontSize: '13px' }} />
        {errors.libelle && <p style={{ fontSize: '12px', color: 'var(--erreur-texte)', marginTop: '4px' }}>{errors.libelle.message}</p>}
      </div>
    </div>
  )
}

export function TypesConsultationTab({ canCreate, canUpdate, canDelete }: { canCreate: boolean; canUpdate: boolean; canDelete: boolean }) {
  const { t } = useTranslation()
  const { data: items = [], isLoading } = useTypesConsultation()
  const create = useCreateTypeConsultation()
  const update = useUpdateTypeConsultation()
  const toggle = useToggleTypeConsultationStatut()
  const remove = useDeleteTypeConsultation()

  const [search, setSearch]   = useState('')
  const [statut, setStatut]   = useState('all')
  const [drawerOpen, setDrawer] = useState(false)
  const [editTarget, setEdit] = useState<TypeConsultation | null>(null)
  const [confirm, setConfirm] = useState<TypeConsultation | null>(null)
  const [confirmDel, setConfirmDel] = useState<TypeConsultation | null>(null)

  const form = useForm<FormVals>({ resolver: zodResolver(schema), defaultValues: { code: '', libelle: '' } })

  const filtered = useMemo(() => items.filter(m => {
    if (statut === 'actif'   && !isActif(m.statut)) return false
    if (statut === 'inactif' &&  isActif(m.statut)) return false
    if (search) { const q = search.toLowerCase(); return m.code.toLowerCase().includes(q) || m.libelle.toLowerCase().includes(q) }
    return true
  }), [items, search, statut])

  const pagination = usePagination(filtered, 5)
  const rz = useColumnResize({ storageKey: 'ref-types-consultation', ready: !isLoading && filtered.length > 0, cellsSelector: 'thead th' })

  function openCreate() { setEdit(null); form.reset({ code: '', libelle: '' }); setDrawer(true) }
  function openEdit(m: TypeConsultation) { setEdit(m); form.reset({ code: m.code, libelle: m.libelle }); setDrawer(true) }
  function closeDrawer() { setDrawer(false); setEdit(null); form.reset() }

  async function handleSave() {
    const ok = await form.trigger(); if (!ok) return
    const data = form.getValues()
    if (editTarget) { await update.mutateAsync({ id: editTarget.id, data }) }
    else { await create.mutateAsync(data) }
    closeDrawer()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, paddingBottom: '16px' }}>
      <div style={{ flexShrink: 0 }}>
        <TabToolbar search={search} onSearchChange={setSearch} statut={statut} onStatutChange={setStatut}
          onNew={openCreate} newLabel={t('referentiels.typeConsultationNew', { defaultValue: 'Nouveau type' })}
          placeholder={t('referentiels.typeConsultationSearchPlaceholder', { defaultValue: 'Rechercher un type de consultation…' })} canCreate={canCreate} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingBottom: '8px' }}>
        <div style={DATA_TABLE_CARD}>
          <table ref={rz.containerRef} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: rz.tableLayout }}>
            <DataTableHead resize={rz} columns={[
              { label: t('referentiels.fieldCode') },
              { label: t('referentiels.fieldLabel') },
              { label: t('referentiels.motifColStatus', { defaultValue: 'Statut' }) },
              { label: '', align: 'right' },
            ]} />
            <tbody>
              {isLoading ? (
                <SkeletonRows rows={6} cols={4} widths={[0.24, 0.5, 0.18, 0.08]} />
              ) : filtered.length === 0 ? (
                <EmptyState icon={Stethoscope}
                  title={search ? t('referentiels.typeConsultationEmptySearch', { defaultValue: 'Aucun résultat' }) : t('referentiels.typeConsultationEmpty', { defaultValue: 'Aucun type de consultation' })}
                  description={!search ? t('referentiels.typeConsultationEmptyHint', { defaultValue: 'Créez les types de consultation utilisés au centre.' }) : undefined}
                  action={!search && canCreate ? <Button size="sm" onClick={openCreate} style={{ background: 'var(--ap-400)', color: '#fff', fontSize: '12px' }}>{t('referentiels.typeConsultationNew', { defaultValue: 'Nouveau type' })}</Button> : undefined} />
              ) : (
                pagination.pageData.map((m, i) => (
                  <Row key={m.id} item={m} striped={i % 2 === 1}
                    onEdit={openEdit} onToggle={() => setConfirm(m)} onDelete={() => setConfirmDel(m)}
                    canUpdate={canUpdate} canDelete={canDelete} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {!isLoading && filtered.length > 0 && (
        <div style={{ flexShrink: 0 }}><PaginationBar {...pagination} /></div>
      )}

      <DrawerShell open={drawerOpen} onClose={closeDrawer} icon={<Stethoscope size={18} />}
        title={editTarget ? t('referentiels.editPrefix', { value: editTarget.code }) : t('referentiels.typeConsultationDrawerNewTitle', { defaultValue: 'Nouveau type de consultation' })}
        description={editTarget ? undefined : t('referentiels.typeConsultationDrawerNewDesc', { defaultValue: 'Catégorise les consultations (statistiques, flux).' })}
        onSave={handleSave} isSaving={create.isPending || update.isPending} isDirty={form.formState.isDirty}>
        <FormFields form={form} />
      </DrawerShell>

      <ConfirmDialog open={!!confirm} onCancel={() => setConfirm(null)}
        onConfirm={async () => { if (confirm) { await toggle.mutateAsync(confirm); setConfirm(null) } }}
        loading={toggle.isPending}
        title={confirm && isActif(confirm.statut) ? t('referentiels.typeConsultationToggleOffTitle', { defaultValue: 'Désactiver ce type ?' }) : t('referentiels.typeConsultationToggleOnTitle', { defaultValue: 'Réactiver ce type ?' })}
        description={confirm && isActif(confirm.statut)
          ? t('referentiels.typeConsultationToggleOffDesc', { defaultValue: 'Il ne sera plus proposé à la sélection.' })
          : t('referentiels.typeConsultationToggleOnDesc', { defaultValue: 'Il redeviendra sélectionnable.' })}
        confirmLabel={confirm && isActif(confirm.statut) ? t('referentiels.deactivate') : t('referentiels.activate')} />

      <ConfirmDialog open={!!confirmDel} onCancel={() => setConfirmDel(null)}
        onConfirm={async () => { if (confirmDel) { await remove.mutateAsync(confirmDel.id); setConfirmDel(null) } }}
        loading={remove.isPending}
        title={t('referentiels.typeConsultationDeleteTitle', { defaultValue: 'Supprimer ce type ?' })}
        description={t('referentiels.typeConsultationDeleteDesc', { defaultValue: 'Suppression définitive. Refusée s’il est déjà utilisé par des consultations.' })}
        confirmLabel={t('referentiels.delete')} />
    </div>
  )
}

function Row({ item, striped, onEdit, onToggle, onDelete, canUpdate, canDelete }: {
  item: TypeConsultation; striped: boolean; onEdit: (m: TypeConsultation) => void; onToggle: () => void; onDelete: () => void; canUpdate: boolean; canDelete: boolean
}) {
  const { t } = useTranslation()
  const showMenu = canUpdate || canDelete
  const [hovered, setHovered] = useState(false)
  return (
    <tr onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={dataRowStyle(striped, hovered)}>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)', width: '200px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--texte-tertiaire)' }}>{item.code}</span>
      </td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)' }}>
        <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)' }}>{item.libelle}</span>
      </td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)' }}><StatutBadge statut={item.statut} /></td>
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
                <DropdownMenuItem onClick={() => onEdit(item)} style={{ gap: '8px', cursor: 'pointer' }}><Pencil size={13} /> {t('referentiels.actionEdit')}</DropdownMenuItem>
              )}
              {canUpdate && canDelete && <DropdownMenuSeparator />}
              {canDelete && (
                <DropdownMenuItem onClick={onToggle} style={{ gap: '8px', cursor: 'pointer', color: isActif(item.statut) ? 'var(--erreur-texte)' : 'var(--succes-texte)' }}>
                  {isActif(item.statut) ? <PowerOff size={13} /> : <Power size={13} />}
                  {isActif(item.statut) ? t('referentiels.deactivate') : t('referentiels.activate')}
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
