import { useState, useMemo }   from 'react'
import { useTranslation }      from 'react-i18next'
import { MoreVertical, Pencil, PowerOff, Power, Trash2, IdCard, Search, X, Plus } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@workspace/ui/components/select'
import { Button } from '@workspace/ui/components/button'
import { Input }  from '@workspace/ui/components/input'
import { Label }  from '@workspace/ui/components/label'
import { useEmployes, useCreateEmploye, useUpdateEmploye, useDeleteEmploye } from '../hooks/useEmployes'
import type { EmployeSaris, EmployePayload } from '../api/employes.api'
import { usePagination } from '../hooks/usePagination'
import { StatutBadge }   from '../components/badges/StatutBadge'
import { SkeletonRows }  from '../components/SkeletonRows'
import { EmptyState }    from '../components/EmptyState'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DrawerShell }   from '../components/DrawerShell'
import { PaginationBar } from '../components/PaginationBar'
import { DataTableHead, dataRowStyle, DATA_TABLE_CARD, useColumnResize } from '@/components/saris'
import { useIsCompact }  from '@/hooks/useMediaQuery'
import { isActif }       from '../api/referentiels.api'

const CAT_LABEL: Record<string, string> = { ASSURE_CDI: 'CDI', ASSURE_CDD: 'CDD' }
const EMPTY: EmployePayload = { matricule: '', nom: '', prenom: '', categorie: 'ASSURE_CDI', fonction: '', sectionPaie: '', service: '', departement: '', dateNaissance: '', sexe: '' }

const lbl = { fontSize: '13px', fontWeight: 500 as const, color: 'var(--texte-primaire)', marginBottom: '6px', display: 'block' }

export function EmployesTab({ canCreate, canUpdate, canDelete }: { canCreate: boolean; canUpdate: boolean; canDelete: boolean }) {
  const { t } = useTranslation()
  const { data: employes = [], isLoading } = useEmployes()
  const isCompact = useIsCompact()
  const cols2 = isCompact ? '1fr' : '1fr 1fr'
  const createEmploye = useCreateEmploye()
  const updateEmploye = useUpdateEmploye()
  const deleteEmploye = useDeleteEmploye()

  const [search,        setSearch]   = useState('')
  const [catFilter,     setCatFilter] = useState('all')
  const [statut,        setStatut]   = useState('all')
  const [drawerOpen,    setDrawer]   = useState(false)
  const [editTarget,    setEdit]     = useState<EmployeSaris | null>(null)
  const [form,          setForm]     = useState<EmployePayload>(EMPTY)
  const [confirm,       setConfirm]  = useState<EmployeSaris | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<EmployeSaris | null>(null)

  const patch = (p: Partial<EmployePayload>) => setForm(f => ({ ...f, ...p }))

  const filtered = useMemo(() => employes.filter(e => {
    if (catFilter !== 'all' && e.categorie !== catFilter) return false
    if (statut === 'actif'   && !isActif(e.statut)) return false
    if (statut === 'inactif' &&  isActif(e.statut)) return false
    if (search) {
      const q = search.toLowerCase()
      return e.matricule.toLowerCase().includes(q) || e.nom.toLowerCase().includes(q) || e.prenom.toLowerCase().includes(q)
    }
    return true
  }), [employes, search, catFilter, statut])

  const pagination = usePagination(filtered, 6)
  const rz = useColumnResize({ storageKey: 'ref-employes', ready: !isLoading && filtered.length > 0, cellsSelector: 'thead th' })

  function openCreate() { setEdit(null); setForm(EMPTY); setDrawer(true) }
  function openEdit(e: EmployeSaris) {
    setEdit(e)
    setForm({ matricule: e.matricule, nom: e.nom, prenom: e.prenom, categorie: e.categorie, fonction: e.fonction ?? '', sectionPaie: e.sectionPaie ?? '', service: e.service ?? '', departement: e.departement ?? '', dateNaissance: e.dateNaissance ? e.dateNaissance.slice(0, 10) : '', sexe: e.sexe ?? '' })
    setDrawer(true)
  }
  function closeDrawer() { setDrawer(false); setEdit(null); setForm(EMPTY) }

  const formValid = !!(form.matricule.trim() && form.nom.trim() && form.prenom.trim() && form.categorie)

  async function handleSave() {
    if (!formValid) return
    const data: EmployePayload = {
      matricule: form.matricule.trim(), nom: form.nom.trim(), prenom: form.prenom.trim(), categorie: form.categorie,
      fonction: form.fonction?.trim() || undefined, sectionPaie: form.sectionPaie?.trim() || undefined,
      service: form.service?.trim() || undefined, departement: form.departement?.trim() || undefined,
      dateNaissance: form.dateNaissance || undefined, sexe: form.sexe || undefined,
    }
    if (editTarget) await updateEmploye.mutateAsync({ id: editTarget.id, data })
    else            await createEmploye.mutateAsync(data)
    closeDrawer()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, paddingBottom: '16px' }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px', padding: 'var(--espace-3) 0 var(--espace-2)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '180px', maxWidth: '320px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--texte-tertiaire)', pointerEvents: 'none' }} />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('employes.searchPlaceholder', { defaultValue: 'Matricule, nom, prénom…' })}
            style={{ paddingLeft: '32px', paddingRight: search ? '32px' : '12px', height: '34px', fontSize: '13px', background: 'var(--fond-surface)', border: '1px solid var(--bordure-normale)', borderRadius: '6px' }} />
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--texte-tertiaire)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }}><X size={13} /></button>}
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger style={{ height: '34px', width: '130px', fontSize: '13px', border: '1px solid var(--bordure-normale)', background: 'var(--fond-surface)', borderRadius: '6px' }}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('employes.allCategories', { defaultValue: 'Toutes' })}</SelectItem>
            <SelectItem value="ASSURE_CDI">CDI</SelectItem>
            <SelectItem value="ASSURE_CDD">CDD</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statut} onValueChange={setStatut}>
          <SelectTrigger style={{ height: '34px', width: '150px', fontSize: '13px', border: '1px solid var(--bordure-normale)', background: 'var(--fond-surface)', borderRadius: '6px' }}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('acteurs.filterAllStatuts', { defaultValue: 'Tous statuts' })}</SelectItem>
            <SelectItem value="actif">{t('acteurs.filterActivesOnly', { defaultValue: 'Actifs' })}</SelectItem>
            <SelectItem value="inactif">{t('acteurs.filterInactivesOnly', { defaultValue: 'Inactifs' })}</SelectItem>
          </SelectContent>
        </Select>
        <div style={{ flex: 1 }} />
        {canCreate && (
          <Button size="sm" onClick={openCreate} style={{ background: 'var(--ap-400)', color: '#fff', fontSize: '13px', height: '34px', gap: '6px', paddingLeft: '12px', paddingRight: '14px' }}>
            <Plus size={14} /> {t('employes.newEmploye', { defaultValue: 'Nouvel employé' })}
          </Button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingBottom: '8px' }}>
        <div style={DATA_TABLE_CARD}>
          <table ref={rz.containerRef} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: rz.tableLayout }}>
            <DataTableHead resize={rz} columns={[
              { label: t('employes.colMatricule', { defaultValue: 'Matricule' }) },
              { label: t('employes.colNom', { defaultValue: 'Nom complet' }) },
              { label: t('employes.colCategorie', { defaultValue: 'Catégorie' }) },
              { label: t('employes.colFonction', { defaultValue: 'Fonction' }) },
              { label: t('acteurs.colStatut', { defaultValue: 'Statut' }) },
              { label: '', align: 'right' },
            ]} />
            <tbody>
              {isLoading ? (
                <SkeletonRows rows={6} cols={6} widths={[0.18, 0.26, 0.12, 0.22, 0.14, 0.08]} />
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={IdCard}
                  title={search ? t('employes.emptySearch', { defaultValue: 'Aucun employé trouvé' }) : t('employes.empty', { defaultValue: 'Registre employé vide' })}
                  description={!search ? t('employes.emptyHint', { defaultValue: 'Les employés sont enregistrés automatiquement à l\'accueil, ou ajoutés ici.' }) : undefined}
                  action={!search && canCreate ? <Button size="sm" onClick={openCreate} style={{ background: 'var(--ap-400)', color: '#fff', fontSize: '12px' }}>{t('employes.newEmploye', { defaultValue: 'Nouvel employé' })}</Button> : undefined}
                />
              ) : (
                pagination.pageData.map((e, idx) => (
                  <EmployeRow key={e.id} employe={e} striped={idx % 2 === 1} onEdit={openEdit} onToggle={() => setConfirm(e)} onDelete={() => setConfirmDelete(e)} canUpdate={canUpdate} canDelete={canDelete} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!isLoading && filtered.length > 0 && <div style={{ flexShrink: 0 }}><PaginationBar {...pagination} /></div>}

      <DrawerShell
        open={drawerOpen}
        onClose={closeDrawer}
        icon={<IdCard size={18} />}
        title={editTarget ? t('employes.editTitle', { defaultValue: 'Modifier l\'employé' }) : t('employes.newTitle', { defaultValue: 'Nouvel employé SARIS' })}
        description={editTarget ? `${editTarget.prenom} ${editTarget.nom}` : t('employes.newDescription', { defaultValue: 'Travailleur CDI/CDD du registre' })}
        onSave={handleSave}
        isSaving={createEmploye.isPending || updateEmploye.isPending}
        isDirty={formValid}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: '12px' }}>
            <div>
              <Label style={lbl}>{t('employes.colMatricule', { defaultValue: 'Matricule' })} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
              <Input value={form.matricule} onChange={e => patch({ matricule: e.target.value })} style={{ fontSize: '13px' }} />
            </div>
            <div>
              <Label style={lbl}>{t('employes.colCategorie', { defaultValue: 'Catégorie' })} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
              <Select value={form.categorie} onValueChange={v => patch({ categorie: v })}>
                <SelectTrigger style={{ height: 36, fontSize: '13px', border: '1px solid var(--bordure-normale)' }}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASSURE_CDI">CDI</SelectItem>
                  <SelectItem value="ASSURE_CDD">CDD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: '12px' }}>
            <div>
              <Label style={lbl}>{t('triage.prenom', { defaultValue: 'Prénom' })} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
              <Input value={form.prenom} onChange={e => patch({ prenom: e.target.value })} style={{ fontSize: '13px' }} />
            </div>
            <div>
              <Label style={lbl}>{t('triage.nom', { defaultValue: 'Nom' })} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
              <Input value={form.nom} onChange={e => patch({ nom: e.target.value })} style={{ fontSize: '13px' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: '12px' }}>
            <div>
              <Label style={lbl}>{t('patients.fieldFonction', { defaultValue: 'Fonction' })}</Label>
              <Input value={form.fonction} onChange={e => patch({ fonction: e.target.value })} style={{ fontSize: '13px' }} />
            </div>
            <div>
              <Label style={lbl}>{t('patients.fieldSectionPaie', { defaultValue: 'Section de paie' })}</Label>
              <Input value={form.sectionPaie} onChange={e => patch({ sectionPaie: e.target.value })} style={{ fontSize: '13px' }} />
            </div>
            <div>
              <Label style={lbl}>{t('patients.fieldService', { defaultValue: 'Service' })}</Label>
              <Input value={form.service} onChange={e => patch({ service: e.target.value })} style={{ fontSize: '13px' }} />
            </div>
            <div>
              <Label style={lbl}>{t('patients.fieldDepartement', { defaultValue: 'Département' })}</Label>
              <Input value={form.departement} onChange={e => patch({ departement: e.target.value })} style={{ fontSize: '13px' }} />
            </div>
          </div>
        </div>
      </DrawerShell>

      <ConfirmDialog
        open={!!confirm}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => { if (confirm) { await updateEmploye.mutateAsync({ id: confirm.id, data: { statut: isActif(confirm.statut) ? 'INACTIF' : 'ACTIF' } }); setConfirm(null) } }}
        loading={updateEmploye.isPending}
        title={confirm && isActif(confirm.statut) ? t('employes.confirmDeactivateTitle', { defaultValue: 'Désactiver l\'employé' }) : t('employes.confirmActivateTitle', { defaultValue: 'Réactiver l\'employé' })}
        description={t('employes.confirmToggleDesc', { defaultValue: 'L\'employé restera au registre ; vous pourrez le réactiver à tout moment.' })}
        confirmLabel={confirm && isActif(confirm.statut) ? t('acteurs.deactivate', { defaultValue: 'Désactiver' }) : t('acteurs.activate', { defaultValue: 'Réactiver' })}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => { if (confirmDelete) { await deleteEmploye.mutateAsync(confirmDelete.id); setConfirmDelete(null) } }}
        loading={deleteEmploye.isPending}
        variant="destructive"
        title={t('employes.confirmDeleteTitle', { defaultValue: 'Supprimer l\'employé' })}
        description={t('employes.confirmDeleteDesc', { defaultValue: 'Suppression définitive (impossible s\'il est rattaché à des dossiers patients).' })}
        confirmLabel={t('acteurs.deletePermanently', { defaultValue: 'Supprimer définitivement' })}
      />
    </div>
  )
}

function EmployeRow({ employe, striped, onEdit, onToggle, onDelete, canUpdate, canDelete }: {
  employe: EmployeSaris; striped: boolean; onEdit: (e: EmployeSaris) => void; onToggle: () => void; onDelete: () => void; canUpdate: boolean; canDelete: boolean
}) {
  const { t } = useTranslation()
  const showMenu = canUpdate || canDelete
  const [hovered, setHovered] = useState(false)
  const isCompact = useIsCompact()
  return (
    <tr onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={dataRowStyle(striped, hovered)}>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)', fontSize: '12px', fontFamily: 'monospace', color: 'var(--texte-secondaire)' }}>{employe.matricule}</td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)' }}>
        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--texte-primaire)', textTransform: 'uppercase' }}>{employe.nom}</span>
        <span style={{ fontSize: '12px', color: 'var(--texte-tertiaire)', marginLeft: 4 }}>{employe.prenom}</span>
      </td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)', fontSize: '12px', color: 'var(--texte-secondaire)' }}>{CAT_LABEL[employe.categorie] ?? employe.categorie}</td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)', fontSize: '12px', color: 'var(--texte-secondaire)' }}>{employe.fonction ?? '—'}</td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)' }}><StatutBadge statut={employe.statut} /></td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)', textAlign: 'right', width: '48px' }}>
        {showMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" style={{ width: '28px', height: '28px', opacity: (hovered || isCompact) ? 1 : 0, transition: 'opacity 0.15s' }}><MoreVertical size={14} /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ minWidth: '160px', fontSize: '13px' }}>
              {canUpdate && <DropdownMenuItem onClick={() => onEdit(employe)} style={{ gap: '8px', cursor: 'pointer' }}><Pencil size={13} /> {t('acteurs.edit', { defaultValue: 'Modifier' })}</DropdownMenuItem>}
              {canUpdate && canDelete && <DropdownMenuSeparator />}
              {canDelete && (
                <DropdownMenuItem onClick={onToggle} style={{ gap: '8px', cursor: 'pointer', color: isActif(employe.statut) ? 'var(--erreur-texte)' : 'var(--succes-texte)' }}>
                  {isActif(employe.statut) ? <PowerOff size={13} /> : <Power size={13} />}
                  {isActif(employe.statut) ? t('acteurs.deactivate', { defaultValue: 'Désactiver' }) : t('acteurs.activate', { defaultValue: 'Réactiver' })}
                </DropdownMenuItem>
              )}
              {canDelete && <DropdownMenuSeparator />}
              {canDelete && <DropdownMenuItem onClick={onDelete} style={{ gap: '8px', cursor: 'pointer', color: 'var(--erreur-texte)' }}><Trash2 size={13} /> {t('acteurs.deletePermanently', { defaultValue: 'Supprimer définitivement' })}</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </td>
    </tr>
  )
}
