import { useState, useMemo }   from 'react'
import { useTranslation }      from 'react-i18next'
import { useForm }             from 'react-hook-form'
import { zodResolver }         from '@hookform/resolvers/zod'
import { z }                   from 'zod'
import { MoreVertical, Pencil, PowerOff, Power, Trash2, Building2, Search, X, Plus } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@workspace/ui/components/select'
import { Button } from '@workspace/ui/components/button'
import { Input }  from '@workspace/ui/components/input'
import { Label }  from '@workspace/ui/components/label'
import type { SocieteSousTraitante } from '@cms-saris/types'
import {
  useSousTraitants,
  useCreateSousTraitant,
  useUpdateSousTraitant,
  useToggleSousTraitantStatut,
  useDeleteSousTraitant,
} from '../hooks/useSousTraitants'
import { usePagination } from '../hooks/usePagination'
import { StatutBadge }   from '../components/badges/StatutBadge'
import { SkeletonRows }  from '../components/SkeletonRows'
import { EmptyState }    from '../components/EmptyState'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DrawerShell }   from '../components/DrawerShell'
import { PaginationBar } from '../components/PaginationBar'
import { DataTableHead, dataRowStyle, DATA_TABLE_CARD, useColumnResize } from '@/components/saris'
import { isActif }       from '../api/referentiels.api'

// ── Schéma ────────────────────────────────────────────────────────────────────

// Fabrique de schéma : reçoit `t` pour traduire les messages visibles.
// (Jamais de t() au niveau module — les hooks ne tournent que dans un composant.)
function makeSchema(t: (k: string) => string) {
  return z.object({
    nom: z.string().trim().min(2, t('acteurs.validationNomSocieteMin')).max(200, t('acteurs.validationNomSocieteMax')),
  })
}
type SousTraitantForm = z.infer<ReturnType<typeof makeSchema>>

// ── Formulaire ────────────────────────────────────────────────────────────────

function SousTraitantFormFields({ form }: { form: ReturnType<typeof useForm<SousTraitantForm>> }) {
  const { t } = useTranslation()
  const { register, formState: { errors } } = form
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <Label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', marginBottom: '6px', display: 'block' }}>
          {t('acteurs.fieldNomSociete')} <span style={{ color: 'var(--erreur-texte)' }}>*</span>
        </Label>
        <Input
          {...register('nom')}
          placeholder={t('acteurs.societePlaceholder')}
          style={{ fontSize: '13px' }}
        />
        {errors.nom && (
          <p style={{ fontSize: '12px', color: 'var(--erreur-texte)', marginTop: '4px' }}>{errors.nom.message}</p>
        )}
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

// 3 permissions backend dédiées (sous_traitant.create / update / delete).
export function SousTraitantsTab({ canCreate, canUpdate, canDelete }: { canCreate: boolean; canUpdate: boolean; canDelete: boolean }) {
  const { t } = useTranslation()
  const { data: societes = [], isLoading } = useSousTraitants()
  const createSociete = useCreateSousTraitant()
  const updateSociete = useUpdateSousTraitant()
  const toggleStatut  = useToggleSousTraitantStatut()
  const deleteSociete = useDeleteSousTraitant()

  const [search,        setSearch]   = useState('')
  const [statut,        setStatut]   = useState('all')
  const [drawerOpen,    setDrawer]   = useState(false)
  const [editTarget,    setEdit]     = useState<SocieteSousTraitante | null>(null)
  const [confirm,       setConfirm]  = useState<SocieteSousTraitante | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<SocieteSousTraitante | null>(null)

  const form = useForm<SousTraitantForm>({ resolver: zodResolver(makeSchema(t)) })

  const filtered = useMemo(() => societes.filter(s => {
    if (statut === 'actif'   && !isActif(s.statut)) return false
    if (statut === 'inactif' &&  isActif(s.statut)) return false
    if (search) return s.nom.toLowerCase().includes(search.toLowerCase())
    return true
  }), [societes, search, statut])

  const pagination = usePagination(filtered, 5)
  const rz = useColumnResize({ storageKey: 'ref-soustraitants', ready: !isLoading && filtered.length > 0, cellsSelector: 'thead th' })

  function openCreate() { setEdit(null); form.reset({ nom: '' }); setDrawer(true) }
  function openEdit(s: SocieteSousTraitante) { setEdit(s); form.reset({ nom: s.nom }); setDrawer(true) }
  function closeDrawer() { setDrawer(false); setEdit(null); form.reset() }

  async function handleSave() {
    const ok = await form.trigger(); if (!ok) return
    const data = form.getValues()
    if (editTarget) { await updateSociete.mutateAsync({ id: editTarget.id, data }) }
    else            { await createSociete.mutateAsync(data) }
    closeDrawer()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, paddingBottom: '16px' }}>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px', padding: 'var(--espace-3) 0 var(--espace-2)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '180px', maxWidth: '360px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--texte-tertiaire)', pointerEvents: 'none' }} />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('acteurs.searchSocietePlaceholder')}
            style={{ paddingLeft: '32px', paddingRight: search ? '32px' : '12px', height: '34px', fontSize: '13px', background: 'var(--fond-surface)', border: '1px solid var(--bordure-normale)', borderRadius: '6px' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--texte-tertiaire)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }}>
              <X size={13} />
            </button>
          )}
        </div>

        <Select value={statut} onValueChange={setStatut}>
          <SelectTrigger style={{ height: '34px', width: '168px', fontSize: '13px', border: '1px solid var(--bordure-normale)', background: 'var(--fond-surface)', borderRadius: '6px' }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('acteurs.filterAllStatuts')}</SelectItem>
            <SelectItem value="actif">{t('acteurs.filterActivesOnly')}</SelectItem>
            <SelectItem value="inactif">{t('acteurs.filterInactivesOnly')}</SelectItem>
          </SelectContent>
        </Select>

        <div style={{ flex: 1 }} />

        {canCreate && (
          <Button
            size="sm"
            onClick={openCreate}
            style={{ background: 'var(--ap-400)', color: '#fff', fontSize: '13px', height: '34px', gap: '6px', paddingLeft: '12px', paddingRight: '14px' }}
          >
            <Plus size={14} />
            {t('acteurs.newSociete')}
          </Button>
        )}
      </div>

      {/* ── Zone scrollable ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingBottom: '8px' }}>
        <div style={DATA_TABLE_CARD}>
          <table ref={rz.containerRef} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: rz.tableLayout }}>
            <DataTableHead resize={rz} columns={[
              { label: t('acteurs.colNomSociete') },
              { label: t('acteurs.colStatut') },
              { label: '', align: 'right' },
            ]} />
            <tbody>
              {isLoading ? (
                <SkeletonRows rows={5} cols={3} widths={[0.75, 0.16, 0.09]} />
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title={search ? t('acteurs.emptySocieteSearch') : t('acteurs.emptySociete')}
                  description={!search ? t('acteurs.emptySocieteHint') : undefined}
                  action={!search && canCreate ? (
                    <Button size="sm" onClick={openCreate} style={{ background: 'var(--ap-400)', color: '#fff', fontSize: '12px' }}>{t('acteurs.newSociete')}</Button>
                  ) : undefined}
                />
              ) : (
                pagination.pageData.map((s, idx) => (
                  <SousTraitantRow
                    key={s.id}
                    societe={s}
                    striped={idx % 2 === 1}
                    onEdit={openEdit}
                    onToggle={() => setConfirm(s)}
                    onDelete={() => setConfirmDelete(s)}
                    canUpdate={canUpdate}
                    canDelete={canDelete}
                  />
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

      <DrawerShell
        open={drawerOpen}
        onClose={closeDrawer}
        icon={<Building2 size={18} />}
        title={editTarget ? t('acteurs.editSocieteTitle', { nom: editTarget.nom }) : t('acteurs.newSocieteTitle')}
        description={editTarget ? t('acteurs.editSocieteDescription') : t('acteurs.newSocieteDescription')}
        onSave={handleSave}
        isSaving={createSociete.isPending || updateSociete.isPending}
        isDirty={form.formState.isDirty}
      >
        <SousTraitantFormFields form={form} />
      </DrawerShell>

      <ConfirmDialog
        open={!!confirm}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => { if (confirm) { await toggleStatut.mutateAsync(confirm); setConfirm(null) } }}
        loading={toggleStatut.isPending}
        title={confirm && isActif(confirm.statut) ? t('acteurs.confirmDeactivateSocieteTitle') : t('acteurs.confirmActivateSocieteTitle')}
        description={
          confirm && isActif(confirm.statut)
            ? t('acteurs.confirmDeactivateSocieteDesc')
            : t('acteurs.confirmActivateSocieteDesc')
        }
        confirmLabel={confirm && isActif(confirm.statut) ? t('acteurs.deactivate') : t('acteurs.activate')}
      />

      {/* Confirmation suppression définitive */}
      <ConfirmDialog
        open={!!confirmDelete}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => { if (confirmDelete) { await deleteSociete.mutateAsync(confirmDelete.id); setConfirmDelete(null) } }}
        loading={deleteSociete.isPending}
        variant="destructive"
        title={t('acteurs.confirmDeleteSocieteTitle')}
        description={t('acteurs.confirmDeleteSocieteDesc')}
        confirmLabel={t('acteurs.deletePermanently')}
      />
    </div>
  )
}

// ── Ligne ─────────────────────────────────────────────────────────────────────

function SousTraitantRow({
  societe, striped, onEdit, onToggle, onDelete, canUpdate, canDelete,
}: {
  societe:  SocieteSousTraitante
  striped:  boolean
  onEdit:   (s: SocieteSousTraitante) => void
  onToggle: () => void
  onDelete: () => void
  canUpdate: boolean
  canDelete: boolean
}) {
  const { t } = useTranslation()
  const showMenu = canUpdate || canDelete
  const [hovered, setHovered] = useState(false)
  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={dataRowStyle(striped, hovered)}
    >
      <td style={{ padding: 'var(--espace-2) var(--espace-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--fond-surface-2)', border: '1px solid var(--bordure-legere)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Building2 size={13} style={{ color: 'var(--texte-tertiaire)' }} />
          </div>
          <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)' }}>{societe.nom}</span>
        </div>
      </td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)' }}>
        <StatutBadge statut={societe.statut} />
      </td>
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
                <DropdownMenuItem onClick={() => onEdit(societe)} style={{ gap: '8px', cursor: 'pointer' }}>
                  <Pencil size={13} /> {t('acteurs.edit')}
                </DropdownMenuItem>
              )}
              {canUpdate && canDelete && <DropdownMenuSeparator />}
              {canDelete && (
                <DropdownMenuItem onClick={onToggle} style={{ gap: '8px', cursor: 'pointer', color: isActif(societe.statut) ? 'var(--erreur-texte)' : 'var(--succes-texte)' }}>
                  {isActif(societe.statut) ? <PowerOff size={13} /> : <Power size={13} />}
                  {isActif(societe.statut) ? t('acteurs.deactivate') : t('acteurs.activate')}
                </DropdownMenuItem>
              )}
              {canDelete && <DropdownMenuSeparator />}
              {canDelete && (
                <DropdownMenuItem onClick={onDelete} style={{ gap: '8px', cursor: 'pointer', color: 'var(--erreur-texte)' }}>
                  <Trash2 size={13} /> {t('acteurs.deletePermanently')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </td>
    </tr>
  )
}
