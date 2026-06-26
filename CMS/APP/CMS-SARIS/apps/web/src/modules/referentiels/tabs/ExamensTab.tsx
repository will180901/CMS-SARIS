import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MoreVertical, Pencil, PowerOff, Power, Trash2, Microscope } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { Button } from '@workspace/ui/components/button'
import { Input }  from '@workspace/ui/components/input'
import { Label }  from '@workspace/ui/components/label'
import type { TypeExamen } from '@cms-saris/types'
import { useTypesExamen, useCreateTypeExamen, useUpdateTypeExamen, useToggleTypeExamenStatut, useDeleteTypeExamen } from '../hooks/useReferentiels'
import { usePagination } from '../hooks/usePagination'
import { isActif }         from '../api/referentiels.api'
import { TabToolbar }      from '../components/TabToolbar'
import { DomaineBadge }    from '../components/badges/DomaineBadge'
import { StatutBadge }     from '../components/badges/StatutBadge'
import { SkeletonRows }    from '../components/SkeletonRows'
import { EmptyState }      from '../components/EmptyState'
import { ConfirmDialog }   from '../components/ConfirmDialog'
import { DrawerShell }     from '../components/DrawerShell'
import { PaginationBar }   from '../components/PaginationBar'
import { DataTableHead, dataRowStyle, DATA_TABLE_CARD, useColumnResize } from '@/components/saris'
import { codeReferentiel, libelle as libelleSchema } from '@/lib/validation'

const examenSchema = z.object({
  code:    codeReferentiel(2, 30),
  libelle: libelleSchema('Libellé', 2, 100),
  domaine: z.enum(['BIOLOGIE', 'IMAGERIE', 'SPECIALISE'], { required_error: 'Domaine requis' }),
})
type ExamenForm = z.infer<typeof examenSchema>

const DOMAINE_OPTIONS: { value: TypeExamen['domaine']; labelKey: string; descKey: string; bg: string; color: string; borderActive: string }[] = [
  { value: 'BIOLOGIE',   labelKey: 'referentiels.domainBiology',     descKey: 'referentiels.examDomainBiologyDesc',     bg: 'var(--ap-50)', color: 'var(--ap-700)', borderActive: 'var(--ap-500)'  },
  { value: 'IMAGERIE',   labelKey: 'referentiels.domainImaging',     descKey: 'referentiels.examDomainImagingDesc',     bg: '#F3EEFF',      color: '#6D28D9',       borderActive: '#7C3AED'        },
  { value: 'SPECIALISE', labelKey: 'referentiels.domainSpecialized', descKey: 'referentiels.examDomainSpecializedDesc', bg: '#E0FDF4',      color: '#0F766E',       borderActive: '#0D9488'        },
]

function ExamenFormFields({ form }: { form: ReturnType<typeof useForm<ExamenForm>> }) {
  const { t } = useTranslation()
  const { register, control, formState: { errors } } = form
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <Label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', marginBottom: '6px', display: 'block' }}>
          {t('referentiels.fieldCode')} <span style={{ color: 'var(--erreur-texte)' }}>*</span>
        </Label>
        <Input {...register('code')} placeholder={t('referentiels.examCodePlaceholder')}
          style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', fontSize: '13px' }} />
        {errors.code && <p style={{ fontSize: '12px', color: 'var(--erreur-texte)', marginTop: '4px' }}>{errors.code.message}</p>}
      </div>
      <div>
        <Label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', marginBottom: '6px', display: 'block' }}>
          {t('referentiels.fieldLabel')} <span style={{ color: 'var(--erreur-texte)' }}>*</span>
        </Label>
        <Input {...register('libelle')} placeholder={t('referentiels.examLabelPlaceholder')} style={{ fontSize: '13px' }} />
        {errors.libelle && <p style={{ fontSize: '12px', color: 'var(--erreur-texte)', marginTop: '4px' }}>{errors.libelle.message}</p>}
      </div>
      <div>
        <Label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', marginBottom: '10px', display: 'block' }}>
          {t('referentiels.examFieldDomain')} <span style={{ color: 'var(--erreur-texte)' }}>*</span>
        </Label>
        <Controller name="domaine" control={control} render={({ field }) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {DOMAINE_OPTIONS.map(opt => (
              <button key={opt.value} type="button" onClick={() => field.onChange(opt.value)}
                style={{
                  padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', textAlign: 'left',
                  border: `2px solid ${field.value === opt.value ? opt.borderActive : 'var(--bordure-legere)'}`,
                  background: field.value === opt.value ? opt.bg : 'var(--fond-surface)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.12s',
                }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: field.value === opt.value ? opt.color : 'var(--texte-primaire)' }}>{t(opt.labelKey)}</span>
                  <span style={{ fontSize: '11px', color: field.value === opt.value ? opt.color : 'var(--texte-tertiaire)', marginLeft: '8px', opacity: 0.8 }}>{t(opt.descKey)}</span>
                </div>
                {field.value === opt.value && (
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: opt.borderActive, flexShrink: 0 }} />
                )}
              </button>
            ))}
          </div>
        )} />
        {errors.domaine && <p style={{ fontSize: '12px', color: 'var(--erreur-texte)', marginTop: '4px' }}>{errors.domaine.message}</p>}
      </div>
    </div>
  )
}

export function ExamensTab({ canCreate, canUpdate, canDelete }: { canCreate: boolean; canUpdate: boolean; canDelete: boolean }) {
  const { t } = useTranslation()
  const { data: examens = [], isLoading } = useTypesExamen()
  const createExamen = useCreateTypeExamen()
  const updateExamen = useUpdateTypeExamen()
  const toggleStatut = useToggleTypeExamenStatut()
  const deleteExamen = useDeleteTypeExamen()

  const [search, setSearch]     = useState('')
  const [statut, setStatut]     = useState('all')
  const [drawerOpen, setDrawer] = useState(false)
  const [editTarget, setEdit]   = useState<TypeExamen | null>(null)
  const [confirm, setConfirm]   = useState<TypeExamen | null>(null)
  const [confirmDel, setConfirmDel] = useState<TypeExamen | null>(null)

  const form = useForm<ExamenForm>({ resolver: zodResolver(examenSchema) })

  const filtered = useMemo(() => examens.filter(e => {
    if (statut === 'actif'   && !isActif(e.statut)) return false
    if (statut === 'inactif' &&  isActif(e.statut)) return false
    if (search) { const q = search.toLowerCase(); return e.code.toLowerCase().includes(q) || e.libelle.toLowerCase().includes(q) || e.domaine.toLowerCase().includes(q) }
    return true
  }), [examens, search, statut])

  const pagination = usePagination(filtered, 5)
  const rz = useColumnResize({ storageKey: 'ref-examens', ready: !isLoading && filtered.length > 0, cellsSelector: 'thead th' })

  function openCreate() { setEdit(null); form.reset({ code: '', libelle: '' } as ExamenForm); setDrawer(true) }
  function openEdit(e: TypeExamen) { setEdit(e); form.reset({ code: e.code, libelle: e.libelle, domaine: e.domaine }); setDrawer(true) }
  function closeDrawer() { setDrawer(false); setEdit(null); form.reset() }

  async function handleSave() {
    const ok = await form.trigger(); if (!ok) return
    const data = form.getValues()
    if (editTarget) { await updateExamen.mutateAsync({ id: editTarget.id, data }) }
    else { await createExamen.mutateAsync(data) }
    closeDrawer()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, paddingBottom: '16px' }}>
      <div style={{ flexShrink: 0 }}>
        <TabToolbar search={search} onSearchChange={setSearch} statut={statut} onStatutChange={setStatut}
          onNew={openCreate} newLabel={t('referentiels.examNew')} placeholder={t('referentiels.examSearchPlaceholder')} canCreate={canCreate} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingBottom: '8px' }}>
        <div style={DATA_TABLE_CARD}>
          <table ref={rz.containerRef} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: rz.tableLayout }}>
            <DataTableHead resize={rz} columns={[
              { label: t('referentiels.examColDomain') },
              { label: t('referentiels.fieldCode') },
              { label: t('referentiels.fieldLabel') },
              { label: t('referentiels.examColStatus') },
              { label: '', align: 'right' },
            ]} />
            <tbody>
              {isLoading ? (
                <SkeletonRows rows={5} cols={5} widths={[0.12, 0.18, 0.45, 0.12, 0.05]} />
              ) : filtered.length === 0 ? (
                <EmptyState icon={Microscope}
                  title={search ? t('referentiels.examEmptySearch') : t('referentiels.examEmpty')}
                  description={!search ? t('referentiels.examEmptyHint') : undefined}
                  action={!search && canCreate ? <Button size="sm" onClick={openCreate} style={{ background: 'var(--ap-400)', color: '#fff', fontSize: '12px' }}>{t('referentiels.examNew')}</Button> : undefined} />
              ) : (
                pagination.pageData.map((e, i) => (
                  <ExamenRow key={e.id} examen={e} striped={i % 2 === 1}
                    onEdit={openEdit} onToggle={() => setConfirm(e)} onDelete={() => setConfirmDel(e)}
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

      <DrawerShell open={drawerOpen} onClose={closeDrawer} icon={<Microscope size={18} />}
        title={editTarget ? t('referentiels.editPrefix', { value: editTarget.code }) : t('referentiels.examDrawerNewTitle')}
        onSave={handleSave} isSaving={createExamen.isPending || updateExamen.isPending} isDirty={form.formState.isDirty}>
        <ExamenFormFields form={form} />
      </DrawerShell>

      <ConfirmDialog open={!!confirm} onCancel={() => setConfirm(null)}
        onConfirm={async () => { if (confirm) { await toggleStatut.mutateAsync(confirm); setConfirm(null) } }}
        loading={toggleStatut.isPending}
        title={confirm && isActif(confirm.statut) ? t('referentiels.examToggleOffTitle') : t('referentiels.examToggleOnTitle')}
        description={confirm && isActif(confirm.statut)
          ? t('referentiels.examToggleOffDesc')
          : t('referentiels.examToggleOnDesc')}
        confirmLabel={confirm && isActif(confirm.statut) ? t('referentiels.deactivate') : t('referentiels.activate')} />

      <ConfirmDialog open={!!confirmDel} onCancel={() => setConfirmDel(null)}
        onConfirm={async () => { if (confirmDel) { await deleteExamen.mutateAsync(confirmDel.id); setConfirmDel(null) } }}
        loading={deleteExamen.isPending}
        title={t('referentiels.examDeleteTitle')}
        description={t('referentiels.examDeleteDesc')}
        confirmLabel={t('referentiels.delete')} />
    </div>
  )
}

function ExamenRow({ examen, striped, onEdit, onToggle, onDelete, canUpdate, canDelete }: {
  examen: TypeExamen; striped: boolean; onEdit: (e: TypeExamen) => void; onToggle: () => void; onDelete: () => void; canUpdate: boolean; canDelete: boolean
}) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)
  const showMenu = canUpdate || canDelete
  return (
    <tr onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={dataRowStyle(striped, hovered)}>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)', width: '120px' }}><DomaineBadge domaine={examen.domaine} /></td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)', width: '160px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--texte-tertiaire)' }}>{examen.code}</span>
      </td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)' }}>
        <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)' }}>{examen.libelle}</span>
      </td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)' }}><StatutBadge statut={examen.statut} /></td>
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
                <DropdownMenuItem onClick={() => onEdit(examen)} style={{ gap: '8px', cursor: 'pointer' }}><Pencil size={13} /> {t('referentiels.actionEdit')}</DropdownMenuItem>
              )}
              {canUpdate && canDelete && <DropdownMenuSeparator />}
              {canDelete && (
                <DropdownMenuItem onClick={onToggle} style={{ gap: '8px', cursor: 'pointer', color: isActif(examen.statut) ? 'var(--erreur-texte)' : 'var(--succes-texte)' }}>
                  {isActif(examen.statut) ? <PowerOff size={13} /> : <Power size={13} />}
                  {isActif(examen.statut) ? t('referentiels.deactivate') : t('referentiels.activate')}
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
