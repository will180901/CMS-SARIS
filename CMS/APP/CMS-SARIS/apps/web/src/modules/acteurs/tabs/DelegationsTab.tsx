import { useState, useMemo }        from 'react'
import { useTranslation }           from 'react-i18next'
import { useForm, Controller }      from 'react-hook-form'
import { zodResolver }              from '@hookform/resolvers/zod'
import { z }                        from 'zod'
import { MoreVertical, Pencil, PauseCircle, PlayCircle, Trash2, GitBranch, Search, X, Plus } from 'lucide-react'
import { DatePicker }                from '@/components/saris'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@workspace/ui/components/select'
import { Button }   from '@workspace/ui/components/button'
import { Input }    from '@workspace/ui/components/input'
import { Label }    from '@workspace/ui/components/label'
import { Textarea } from '@workspace/ui/components/textarea'
import type { DelegationPrescription } from '@cms-saris/types'
import {
  useDelegations,
  useCreateDelegation,
  useUpdateDelegation,
  useToggleDelegationStatut,
  useDeleteDelegation,
} from '../hooks/useDelegations'
import { useSoignants }  from '@/modules/triage/hooks/useSoignants'
import { usePagination }  from '@/modules/referentiels/hooks/usePagination'
import { SkeletonRows }   from '@/modules/referentiels/components/SkeletonRows'
import { EmptyState }     from '@/modules/referentiels/components/EmptyState'
import { ConfirmDialog }  from '@/modules/referentiels/components/ConfirmDialog'
import { DrawerShell }    from '@/modules/referentiels/components/DrawerShell'
import { PaginationBar }  from '@/modules/referentiels/components/PaginationBar'
import { DataTableHead, dataRowStyle, DATA_TABLE_CARD, useColumnResize } from '@/components/saris'
import { useIsCompact } from '@/hooks/useMediaQuery'
import { formatDate } from '@/lib/intl'

// ── Helpers date ──────────────────────────────────────────────────────────────

function toInputDate(iso: string): string {
  // ISO → YYYY-MM-DD (format attendu par <input type="date">)
  return iso.slice(0, 10)
}

function formatPeriod(debut: string, fin: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' }
  const d1 = formatDate(debut, opts)
  const d2 = formatDate(fin, { ...opts, year: 'numeric' })
  return `${d1} → ${d2}`
}

function isExpired(dateFin: string): boolean {
  return new Date(dateFin) < new Date()
}

// ── Badge statut ──────────────────────────────────────────────────────────────

function DelegationStatutBadge({ statut, dateFin }: { statut: string; dateFin: string }) {
  const { t } = useTranslation()
  if (statut === 'INACTIVE') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: 'var(--avert-fond)', color: 'var(--avert-texte)' }}>
        {t('acteurs.delegationSuspendue')}
      </span>
    )
  }
  if (isExpired(dateFin)) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: 'var(--fond-surface-2)', color: 'var(--texte-secondaire)' }}>
        {t('acteurs.delegationExpiree')}
      </span>
    )
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: 'var(--succes-fond)', color: 'var(--succes-texte)' }}>
      {t('acteurs.delegationActive')}
    </span>
  )
}

// ── Schéma Zod ────────────────────────────────────────────────────────────────

const dateValide = (v: string) => !Number.isNaN(Date.parse(v))

// Fabrique de schéma : reçoit `t` pour traduire les messages visibles.
// (Jamais de t() au niveau module — les hooks ne tournent que dans un composant.)
function makeDelegationSchema(t: (k: string) => string) {
  return z.object({
    medecinChefId: z.string().min(1, t('acteurs.validationMedecinRequired')),
    infirmierId:   z.string().min(1, t('acteurs.validationInfirmierRequired')),
    dateDebut:     z.string().min(1, t('acteurs.validationDateDebutRequired')).refine(dateValide, t('acteurs.validationDateInvalide')),
    dateFin:       z.string().min(1, t('acteurs.validationDateFinRequired')).refine(dateValide, t('acteurs.validationDateInvalide')),
    perimetre:     z.string().trim().max(500, t('acteurs.validationPerimetreMax')).optional(),
  }).refine(
    d => !d.dateDebut || !d.dateFin || d.dateFin > d.dateDebut,
    { message: t('acteurs.validationDateFinAfterDebut'), path: ['dateFin'] },
  ).refine(
    d => d.medecinChefId !== d.infirmierId,
    { message: t('acteurs.validationMedecinInfirmierDiff'), path: ['infirmierId'] },
  )
}
type DelegationForm = z.infer<ReturnType<typeof makeDelegationSchema>>

// ── Formulaire ────────────────────────────────────────────────────────────────

function DelegationFormFields({
  form,
  medecins,
  infirmiers,
}: {
  form:       ReturnType<typeof useForm<DelegationForm>>
  medecins:   { id: string; nom: string; prenom: string }[]
  infirmiers: { id: string; nom: string; prenom: string }[]
}) {
  const { t } = useTranslation()
  const isCompact = useIsCompact()
  const { register, control, setValue, watch, formState: { errors } } = form

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Médecin chef */}
      <div>
        <Label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', marginBottom: '6px', display: 'block' }}>
          {t('acteurs.fieldMedecinChef')} <span style={{ color: 'var(--erreur-texte)' }}>*</span>
        </Label>
        <Select
          value={watch('medecinChefId') ?? ''}
          onValueChange={v => setValue('medecinChefId', v, { shouldDirty: true, shouldValidate: true })}
        >
          <SelectTrigger style={{ height: '36px', fontSize: '13px', border: '1px solid var(--bordure-normale)' }}>
            <SelectValue placeholder={t('acteurs.medecinPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {medecins.map(m => (
              <SelectItem key={m.id} value={m.id} style={{ fontSize: '13px' }}>
                {m.nom} {m.prenom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.medecinChefId && (
          <p style={{ fontSize: '12px', color: 'var(--erreur-texte)', marginTop: '4px' }}>{errors.medecinChefId.message}</p>
        )}
      </div>

      {/* Infirmier bénéficiaire */}
      <div>
        <Label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', marginBottom: '6px', display: 'block' }}>
          {t('acteurs.fieldInfirmierBeneficiaire')} <span style={{ color: 'var(--erreur-texte)' }}>*</span>
        </Label>
        <Select
          value={watch('infirmierId') ?? ''}
          onValueChange={v => setValue('infirmierId', v, { shouldDirty: true, shouldValidate: true })}
        >
          <SelectTrigger style={{ height: '36px', fontSize: '13px', border: '1px solid var(--bordure-normale)' }}>
            <SelectValue placeholder={t('acteurs.infirmierPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {infirmiers.map(i => (
              <SelectItem key={i.id} value={i.id} style={{ fontSize: '13px' }}>
                {i.nom} {i.prenom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.infirmierId && (
          <p style={{ fontSize: '12px', color: 'var(--erreur-texte)', marginTop: '4px' }}>{errors.infirmierId.message}</p>
        )}
      </div>

      {/* Dates côte à côte */}
      <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1fr 1fr', gap: '12px' }}>
        <div>
          <Label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', marginBottom: '6px', display: 'block' }}>
            {t('acteurs.fieldDateDebut')} <span style={{ color: 'var(--erreur-texte)' }}>*</span>
          </Label>
          <Controller
            control={control}
            name="dateDebut"
            render={({ field }) => (
              <DatePicker
                value={field.value}
                onChange={(v) => field.onChange(v ?? '')}
                placeholder={t('acteurs.dateDebutPlaceholder')}
                aria-label={t('acteurs.ariaDateDebut')}
                max={watch('dateFin') || undefined}
              />
            )}
          />
          {errors.dateDebut && (
            <p style={{ fontSize: '12px', color: 'var(--erreur-texte)', marginTop: '4px' }}>{errors.dateDebut.message}</p>
          )}
        </div>
        <div>
          <Label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', marginBottom: '6px', display: 'block' }}>
            {t('acteurs.fieldDateFin')} <span style={{ color: 'var(--erreur-texte)' }}>*</span>
          </Label>
          <Controller
            control={control}
            name="dateFin"
            render={({ field }) => (
              <DatePicker
                value={field.value}
                onChange={(v) => field.onChange(v ?? '')}
                placeholder={t('acteurs.dateFinPlaceholder')}
                aria-label={t('acteurs.ariaDateFin')}
                min={watch('dateDebut') || undefined}
              />
            )}
          />
          {errors.dateFin && (
            <p style={{ fontSize: '12px', color: 'var(--erreur-texte)', marginTop: '4px' }}>{errors.dateFin.message}</p>
          )}
        </div>
      </div>

      {/* Périmètre — note textuelle des conditions (recueil §3.2 « cas courants »), pas un filtre */}
      <div>
        <Label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', marginBottom: '6px', display: 'block' }}>
          {t('acteurs.fieldPerimetre')} <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', fontWeight: 400 }}>{t('acteurs.perimetreOptional')}</span>
        </Label>
        <Textarea
          {...register('perimetre')}
          placeholder={t('acteurs.perimetrePlaceholder')}
          rows={3}
          style={{ fontSize: '13px', resize: 'none', border: '1px solid var(--bordure-normale)' }}
        />
        <p style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', marginTop: '4px' }}>
          {t('acteurs.delegationScopeHint', { defaultValue: 'La délégation autorise la consultation et la prescription des cas courants.' })}
        </p>
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

// 4 permissions backend distinctes : delegation.create, .update, .revoke (Suspendre/Réactiver), .delete (suppression définitive).
export function DelegationsTab({ canCreate, canUpdate, canRevoke, canDelete }: { canCreate: boolean; canUpdate: boolean; canRevoke: boolean; canDelete: boolean }) {
  const { t } = useTranslation()
  const { data: delegations = [], isLoading } = useDelegations()
  const { data: personnel = [] }              = useSoignants()
  const createDelegation = useCreateDelegation()
  const updateDelegation = useUpdateDelegation()
  const toggleStatut     = useToggleDelegationStatut()
  const deleteDelegation = useDeleteDelegation()

  const [search,        setSearch]      = useState('')
  const [filterStatut,  setFilterStatut] = useState('all')
  const [drawerOpen,    setDrawer]      = useState(false)
  const [editTarget,    setEdit]        = useState<DelegationPrescription | null>(null)
  const [confirm,       setConfirm]     = useState<DelegationPrescription | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<DelegationPrescription | null>(null)

  const form = useForm<DelegationForm>({ resolver: zodResolver(makeDelegationSchema(t)) })

  // Listes filtrées de personnel pour les selects
  const medecins   = useMemo(() => personnel.filter(p => p.role === 'MEDECIN'   && p.statut === 'ACTIF'), [personnel])
  const infirmiers = useMemo(() => personnel.filter(p => p.role === 'INFIRMIER' && p.statut === 'ACTIF'), [personnel])

  // Filtrage des délégations
  const filtered = useMemo(() => delegations.filter(d => {
    if (filterStatut === 'active'    && (d.statut !== 'ACTIVE' || isExpired(d.dateFin)))  return false
    if (filterStatut === 'expiree'   && !(d.statut === 'ACTIVE' && isExpired(d.dateFin))) return false
    if (filterStatut === 'suspendue' && d.statut !== 'INACTIVE')                          return false
    if (search) {
      const q = search.toLowerCase()
      return (
        d.medecinChef.nom.toLowerCase().includes(q) ||
        d.medecinChef.prenom.toLowerCase().includes(q) ||
        d.infirmier.nom.toLowerCase().includes(q) ||
        d.infirmier.prenom.toLowerCase().includes(q)
      )
    }
    return true
  }), [delegations, search, filterStatut])

  const pagination = usePagination(filtered, 5)
  const rz = useColumnResize({ storageKey: 'act-delegations', ready: !isLoading && filtered.length > 0, cellsSelector: 'thead th' })

  // Handlers
  function openCreate() {
    setEdit(null)
    form.reset({ medecinChefId: '', infirmierId: '', dateDebut: '', dateFin: '', perimetre: '' })
    setDrawer(true)
  }
  function openEdit(d: DelegationPrescription) {
    setEdit(d)
    form.reset({
      medecinChefId: d.medecinChefId,
      infirmierId:   d.infirmierId,
      dateDebut:     toInputDate(d.dateDebut),
      dateFin:       toInputDate(d.dateFin),
      perimetre:     d.perimetre ?? '',
    })
    setDrawer(true)
  }
  function closeDrawer() { setDrawer(false); setEdit(null); form.reset() }

  async function handleSave() {
    const ok = await form.trigger(); if (!ok) return
    const payload = form.getValues()

    if (editTarget) {
      await updateDelegation.mutateAsync({ id: editTarget.id, data: payload })
    } else {
      await createDelegation.mutateAsync(payload)
    }
    closeDrawer()
  }

  const isSaving = createDelegation.isPending || updateDelegation.isPending

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, paddingBottom: '16px' }}>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px', padding: 'var(--espace-3) 0 var(--espace-2)', flexWrap: 'wrap' }}>

        {/* Recherche */}
        <div style={{ position: 'relative', flex: '1', minWidth: '180px', maxWidth: '300px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--texte-tertiaire)', pointerEvents: 'none' }} />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('acteurs.searchDelegationPlaceholder')}
            style={{ paddingLeft: '32px', paddingRight: search ? '32px' : '12px', height: '34px', fontSize: '13px', background: 'var(--fond-surface)', border: '1px solid var(--bordure-normale)', borderRadius: '6px' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--texte-tertiaire)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }}>
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filtre statut */}
        <Select value={filterStatut} onValueChange={setFilterStatut}>
          <SelectTrigger style={{ height: '34px', width: '168px', fontSize: '13px', border: '1px solid var(--bordure-normale)', background: 'var(--fond-surface)', borderRadius: '6px' }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('acteurs.filterAllStatuts')}</SelectItem>
            <SelectItem value="active">{t('acteurs.filterActives')}</SelectItem>
            <SelectItem value="expiree">{t('acteurs.filterExpirees')}</SelectItem>
            <SelectItem value="suspendue">{t('acteurs.filterSuspendues')}</SelectItem>
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
            {t('acteurs.newDelegation')}
          </Button>
        )}
      </div>

      {/* ── Zone scrollable ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingBottom: '8px' }}>
        <div style={DATA_TABLE_CARD}>
          <table ref={rz.containerRef} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: rz.tableLayout }}>
            <DataTableHead resize={rz} columns={[
              { label: t('acteurs.colMedecinChef') },
              { label: t('acteurs.colInfirmier') },
              { label: t('acteurs.colPeriode') },
              { label: t('acteurs.colStatut') },
              { label: '', align: 'right' },
            ]} />
            <tbody>
              {isLoading ? (
                <SkeletonRows rows={5} cols={5} widths={[0.26, 0.26, 0.24, 0.14, 0.06]} />
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={GitBranch}
                  title={search ? t('acteurs.emptyDelegationSearch') : t('acteurs.emptyDelegation')}
                  description={!search ? t('acteurs.emptyDelegationHint') : undefined}
                  action={!search && canCreate ? (
                    <Button size="sm" onClick={openCreate} style={{ background: 'var(--ap-400)', color: '#fff', fontSize: '12px' }}>
                      {t('acteurs.newDelegation')}
                    </Button>
                  ) : undefined}
                />
              ) : (
                pagination.pageData.map((d, idx) => (
                  <DelegationRow
                    key={d.id}
                    delegation={d}
                    striped={idx % 2 === 1}
                    onEdit={openEdit}
                    onToggle={() => setConfirm(d)}
                    onDelete={() => setConfirmDelete(d)}
                    canUpdate={canUpdate}
                    canRevoke={canRevoke}
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

      {/* Drawer */}
      <DrawerShell
        open={drawerOpen}
        onClose={closeDrawer}
        icon={<GitBranch size={18} />}
        title={editTarget ? t('acteurs.editDelegationTitle') : t('acteurs.newDelegationTitle')}
        description={
          editTarget
            ? `${editTarget.medecinChef.nom} → ${editTarget.infirmier.nom}`
            : t('acteurs.newDelegationDescription')
        }
        onSave={handleSave}
        isSaving={isSaving}
        isDirty={form.formState.isDirty}
      >
        <DelegationFormFields
          form={form}
          medecins={medecins}
          infirmiers={infirmiers}
        />
      </DrawerShell>

      {/* Confirmation toggle statut */}
      <ConfirmDialog
        open={!!confirm}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => { if (confirm) { await toggleStatut.mutateAsync(confirm); setConfirm(null) } }}
        loading={toggleStatut.isPending}
        title={confirm?.statut === 'ACTIVE' ? t('acteurs.confirmSuspendDelegationTitle') : t('acteurs.confirmReactivateDelegationTitle')}
        description={
          confirm?.statut === 'ACTIVE'
            ? t('acteurs.confirmSuspendDelegationDesc')
            : t('acteurs.confirmReactivateDelegationDesc')
        }
        confirmLabel={confirm?.statut === 'ACTIVE' ? t('acteurs.suspend') : t('acteurs.reactivate')}
      />

      {/* Confirmation suppression définitive */}
      <ConfirmDialog
        open={!!confirmDelete}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => { if (confirmDelete) { await deleteDelegation.mutateAsync(confirmDelete.id); setConfirmDelete(null) } }}
        loading={deleteDelegation.isPending}
        variant="destructive"
        title={t('acteurs.confirmDeleteDelegationTitle')}
        description={t('acteurs.confirmDeleteDelegationDesc')}
        confirmLabel={t('acteurs.deletePermanently')}
      />
    </div>
  )
}

// ── Ligne ─────────────────────────────────────────────────────────────────────

function DelegationRow({
  delegation, striped, onEdit, onToggle, onDelete, canUpdate, canRevoke, canDelete,
}: {
  delegation: DelegationPrescription
  striped:    boolean
  onEdit:     (d: DelegationPrescription) => void
  onToggle:   () => void
  onDelete:   () => void
  canUpdate:  boolean
  canRevoke:  boolean
  canDelete:  boolean
}) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)
  const isCompact = useIsCompact()
  const showMenu = canUpdate || canRevoke || canDelete

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={dataRowStyle(striped, hovered)}
    >
      {/* Médecin */}
      <td style={{ padding: 'var(--espace-2) var(--espace-4)' }}>
        <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', textTransform: 'uppercase' }}>
          {delegation.medecinChef.nom}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--texte-tertiaire)', marginLeft: '4px' }}>
          {delegation.medecinChef.prenom}
        </span>
      </td>

      {/* Infirmier */}
      <td style={{ padding: 'var(--espace-2) var(--espace-4)' }}>
        <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', textTransform: 'uppercase' }}>
          {delegation.infirmier.nom}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--texte-tertiaire)', marginLeft: '4px' }}>
          {delegation.infirmier.prenom}
        </span>
      </td>

      {/* Période */}
      <td style={{ padding: 'var(--espace-2) var(--espace-4)', fontSize: '12px', color: 'var(--texte-secondaire)', whiteSpace: 'nowrap' }}>
        {formatPeriod(delegation.dateDebut, delegation.dateFin)}
      </td>

      {/* Statut */}
      <td style={{ padding: 'var(--espace-2) var(--espace-4)' }}>
        <DelegationStatutBadge statut={delegation.statut} dateFin={delegation.dateFin} />
      </td>

      {/* Actions */}
      <td style={{ padding: 'var(--espace-2) var(--espace-4)', textAlign: 'right', width: '48px' }}>
        {showMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                style={{ width: '28px', height: '28px', opacity: (hovered || isCompact) ? 1 : 0, transition: 'opacity 0.15s' }}
              >
                <MoreVertical size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ minWidth: '168px', fontSize: '13px' }}>
              {canUpdate && (
                <DropdownMenuItem onClick={() => onEdit(delegation)} style={{ gap: '8px', cursor: 'pointer' }}>
                  <Pencil size={13} /> {t('acteurs.edit')}
                </DropdownMenuItem>
              )}
              {canUpdate && canRevoke && <DropdownMenuSeparator />}
              {canRevoke && (
                <DropdownMenuItem
                  onClick={onToggle}
                  style={{ gap: '8px', cursor: 'pointer', color: delegation.statut === 'ACTIVE' ? 'var(--erreur-texte)' : 'var(--succes-texte)' }}
                >
                  {delegation.statut === 'ACTIVE'
                    ? <><PauseCircle size={13} /> {t('acteurs.suspend')}</>
                    : <><PlayCircle  size={13} /> {t('acteurs.reactivate')}</>
                  }
                </DropdownMenuItem>
              )}
              {(canUpdate || canRevoke) && canDelete && <DropdownMenuSeparator />}
              {canDelete && (
                <DropdownMenuItem
                  onClick={onDelete}
                  style={{ gap: '8px', cursor: 'pointer', color: 'var(--erreur-texte)' }}
                >
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
