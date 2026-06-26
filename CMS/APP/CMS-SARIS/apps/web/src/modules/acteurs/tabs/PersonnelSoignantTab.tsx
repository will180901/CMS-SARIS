/**
 * PersonnelSoignantTab — gestion du PERSONNEL SOIGNANT (PersonnelMedical) : agents
 * cliniques du centre, assignables au triage / consultation. Onglet d'« Accès &
 * habilitations » (médecin-chef / admin). CRUD complet câblé sur /personnel.
 */
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MoreVertical, Pencil, PowerOff, Power, Trash2, Stethoscope, Search, X, Plus } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@workspace/ui/components/select'
import { Button } from '@workspace/ui/components/button'
import { Input }  from '@workspace/ui/components/input'
import { Label }  from '@workspace/ui/components/label'
import { usePersonnel, useCreatePersonnel, useUpdatePersonnel, useSetStatutPersonnel, useDeletePersonnel } from '../hooks/usePersonnel'
import type { PersonnelMedical, PersonnelPayload } from '../api/personnel.api'
import { usePagination } from '@/modules/referentiels/hooks/usePagination'
import { StatutBadge }   from '@/modules/referentiels/components/badges/StatutBadge'
import { SkeletonRows }  from '@/modules/referentiels/components/SkeletonRows'
import { EmptyState }    from '@/modules/referentiels/components/EmptyState'
import { ConfirmDialog } from '@/modules/referentiels/components/ConfirmDialog'
import { DrawerShell }   from '@/modules/referentiels/components/DrawerShell'
import { PaginationBar } from '@/modules/referentiels/components/PaginationBar'
import { DataTableHead, dataRowStyle, DATA_TABLE_CARD, useColumnResize } from '@/components/saris'
import { useIsCompact }  from '@/hooks/useMediaQuery'
import { useSessionStore } from '@/stores/session.store'
import { labelMetier } from '@/config/labels'

const ROLES = ['MEDECIN', 'INFIRMIER', 'SAGE_FEMME', 'TECHNICIEN_LAB', 'ADMINISTRATIF'] as const
const isActif = (s: string) => s === 'ACTIF'
const lbl = { fontSize: '13px', fontWeight: 500 as const, color: 'var(--texte-primaire)', marginBottom: '6px', display: 'block' }

interface FormState { matricule: string; nom: string; prenom: string; role: string }
const EMPTY: FormState = { matricule: '', nom: '', prenom: '', role: 'INFIRMIER' }

export function PersonnelSoignantTab({ canCreate, canUpdate, canDelete }: { canCreate: boolean; canUpdate: boolean; canDelete: boolean }) {
  const { t } = useTranslation()
  const siteId = useSessionStore(s => s.user?.siteId)
  const { data: personnel = [], isLoading } = usePersonnel()
  const isCompact = useIsCompact()
  const cols2 = isCompact ? '1fr' : '1fr 1fr'
  const create = useCreatePersonnel()
  const update = useUpdatePersonnel()
  const setStatut = useSetStatutPersonnel()
  const remove = useDeletePersonnel()

  const [search, setSearch]   = useState('')
  const [roleF, setRoleF]     = useState('all')
  const [statutF, setStatutF] = useState('all')
  const [drawerOpen, setDrawer] = useState(false)
  const [editTarget, setEdit] = useState<PersonnelMedical | null>(null)
  const [form, setForm]       = useState<FormState>(EMPTY)
  const [confirmToggle, setConfirmToggle] = useState<PersonnelMedical | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<PersonnelMedical | null>(null)

  const patch = (p: Partial<FormState>) => setForm(f => ({ ...f, ...p }))

  const filtered = useMemo(() => personnel.filter(p => {
    if (roleF !== 'all' && p.role !== roleF) return false
    if (statutF === 'actif'   && !isActif(p.statut)) return false
    if (statutF === 'inactif' &&  isActif(p.statut)) return false
    if (search) {
      const q = search.toLowerCase()
      return p.matricule.toLowerCase().includes(q) || p.nom.toLowerCase().includes(q) || p.prenom.toLowerCase().includes(q)
    }
    return true
  }), [personnel, search, roleF, statutF])

  const pagination = usePagination(filtered, 6)
  const rz = useColumnResize({ storageKey: 'acteurs-personnel', ready: !isLoading && filtered.length > 0, cellsSelector: 'thead th' })

  function openCreate() { setEdit(null); setForm(EMPTY); setDrawer(true) }
  function openEdit(p: PersonnelMedical) {
    setEdit(p); setForm({ matricule: p.matricule, nom: p.nom, prenom: p.prenom, role: p.role }); setDrawer(true)
  }
  function closeDrawer() { setDrawer(false); setEdit(null); setForm(EMPTY) }

  const formValid = !!(form.matricule.trim() && form.nom.trim() && form.prenom.trim() && form.role)

  async function handleSave() {
    if (!formValid) return
    if (editTarget) {
      await update.mutateAsync({ id: editTarget.id, data: { matricule: form.matricule.trim(), nom: form.nom.trim(), prenom: form.prenom.trim(), role: form.role } })
    } else {
      const data: PersonnelPayload = { matricule: form.matricule.trim(), nom: form.nom.trim(), prenom: form.prenom.trim(), role: form.role, ...(siteId ? { siteId } : {}) }
      await create.mutateAsync(data)
    }
    closeDrawer()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, paddingBottom: '16px' }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px', padding: 'var(--espace-3) 0 var(--espace-2)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '180px', maxWidth: '320px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--texte-tertiaire)', pointerEvents: 'none' }} />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('personnelSoignant.searchPlaceholder', { defaultValue: 'Matricule, nom, prénom…' })}
            style={{ paddingLeft: '32px', paddingRight: search ? '32px' : '12px', height: '34px', fontSize: '13px', background: 'var(--fond-surface)', border: '1px solid var(--bordure-normale)', borderRadius: '6px' }} />
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--texte-tertiaire)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }}><X size={13} /></button>}
        </div>
        <Select value={roleF} onValueChange={setRoleF}>
          <SelectTrigger style={{ height: '34px', width: '160px', fontSize: '13px', border: '1px solid var(--bordure-normale)', background: 'var(--fond-surface)', borderRadius: '6px' }}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('personnelSoignant.allRoles', { defaultValue: 'Tous les rôles' })}</SelectItem>
            {ROLES.map(r => <SelectItem key={r} value={r}>{labelMetier(r)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statutF} onValueChange={setStatutF}>
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
            <Plus size={14} /> {t('personnelSoignant.newAgent', { defaultValue: 'Nouvel agent' })}
          </Button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingBottom: '8px' }}>
        <div style={DATA_TABLE_CARD}>
          <table ref={rz.containerRef} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: rz.tableLayout }}>
            <DataTableHead resize={rz} columns={[
              { label: t('personnelSoignant.colMatricule', { defaultValue: 'Matricule' }) },
              { label: t('personnelSoignant.colNom', { defaultValue: 'Nom complet' }) },
              { label: t('personnelSoignant.colRole', { defaultValue: 'Rôle' }) },
              { label: t('acteurs.colStatut', { defaultValue: 'Statut' }) },
              { label: '', align: 'right' },
            ]} />
            <tbody>
              {isLoading ? (
                <SkeletonRows rows={6} cols={5} widths={[0.2, 0.34, 0.22, 0.16, 0.08]} />
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={Stethoscope}
                  title={search ? t('personnelSoignant.emptySearch', { defaultValue: 'Aucun agent trouvé' }) : t('personnelSoignant.empty', { defaultValue: 'Aucun agent soignant' })}
                  description={!search ? t('personnelSoignant.emptyHint', { defaultValue: 'Ajoutez les soignants du centre (assignables au triage).' }) : undefined}
                  action={!search && canCreate ? <Button size="sm" onClick={openCreate} style={{ background: 'var(--ap-400)', color: '#fff', fontSize: '12px' }}>{t('personnelSoignant.newAgent', { defaultValue: 'Nouvel agent' })}</Button> : undefined}
                />
              ) : (
                pagination.pageData.map((p, idx) => (
                  <PersonnelRow key={p.id} agent={p} striped={idx % 2 === 1} onEdit={openEdit} onToggle={() => setConfirmToggle(p)} onDelete={() => setConfirmDelete(p)} canUpdate={canUpdate} canDelete={canDelete} />
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
        icon={<Stethoscope size={18} />}
        title={editTarget ? t('personnelSoignant.editTitle', { defaultValue: 'Modifier l\'agent' }) : t('personnelSoignant.newTitle', { defaultValue: 'Nouvel agent soignant' })}
        description={editTarget ? `${editTarget.prenom} ${editTarget.nom}` : t('personnelSoignant.newDescription', { defaultValue: 'Soignant du centre (triage / consultation)' })}
        onSave={handleSave}
        isSaving={create.isPending || update.isPending}
        isDirty={formValid}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: '12px' }}>
            <div>
              <Label style={lbl}>{t('personnelSoignant.colMatricule', { defaultValue: 'Matricule' })} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
              <Input value={form.matricule} onChange={e => patch({ matricule: e.target.value })} style={{ fontSize: '13px' }} placeholder="MED-001" />
            </div>
            <div>
              <Label style={lbl}>{t('personnelSoignant.colRole', { defaultValue: 'Rôle' })} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
              <Select value={form.role} onValueChange={v => patch({ role: v })}>
                <SelectTrigger style={{ height: 36, fontSize: '13px', border: '1px solid var(--bordure-normale)' }}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r} value={r}>{labelMetier(r)}</SelectItem>)}
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
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--texte-tertiaire)' }}>
            {t('personnelSoignant.accountHint', { defaultValue: 'Le compte de connexion (login / mot de passe) se crée séparément dans l\'onglet Utilisateurs et se lie à cet agent.' })}
          </p>
        </div>
      </DrawerShell>

      <ConfirmDialog
        open={!!confirmToggle}
        onCancel={() => setConfirmToggle(null)}
        onConfirm={async () => { if (confirmToggle) { await setStatut.mutateAsync({ id: confirmToggle.id, statut: isActif(confirmToggle.statut) ? 'INACTIF' : 'ACTIF' }); setConfirmToggle(null) } }}
        loading={setStatut.isPending}
        title={confirmToggle && isActif(confirmToggle.statut) ? t('personnelSoignant.confirmDeactivateTitle', { defaultValue: 'Désactiver l\'agent' }) : t('personnelSoignant.confirmActivateTitle', { defaultValue: 'Réactiver l\'agent' })}
        description={t('personnelSoignant.confirmToggleDesc', { defaultValue: 'Un agent inactif n\'est plus assignable au triage.' })}
        confirmLabel={confirmToggle && isActif(confirmToggle.statut) ? t('acteurs.deactivate', { defaultValue: 'Désactiver' }) : t('acteurs.activate', { defaultValue: 'Réactiver' })}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => { if (confirmDelete) { await remove.mutateAsync(confirmDelete.id); setConfirmDelete(null) } }}
        loading={remove.isPending}
        variant="destructive"
        title={t('personnelSoignant.confirmDeleteTitle', { defaultValue: 'Supprimer l\'agent' })}
        description={t('personnelSoignant.confirmDeleteDesc', { defaultValue: 'Suppression définitive (impossible si l\'agent a un compte ou des actes liés).' })}
        confirmLabel={t('acteurs.deletePermanently', { defaultValue: 'Supprimer définitivement' })}
      />
    </div>
  )
}

function PersonnelRow({ agent, striped, onEdit, onToggle, onDelete, canUpdate, canDelete }: {
  agent: PersonnelMedical; striped: boolean; onEdit: (p: PersonnelMedical) => void; onToggle: () => void; onDelete: () => void; canUpdate: boolean; canDelete: boolean
}) {
  const { t } = useTranslation()
  const showMenu = canUpdate || canDelete
  const [hovered, setHovered] = useState(false)
  const isCompact = useIsCompact()
  return (
    <tr onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={dataRowStyle(striped, hovered)}>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)', fontSize: '12px', fontFamily: 'monospace', color: 'var(--texte-secondaire)' }}>{agent.matricule}</td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)' }}>
        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--texte-primaire)', textTransform: 'uppercase' }}>{agent.nom}</span>
        <span style={{ fontSize: '12px', color: 'var(--texte-tertiaire)', marginLeft: 4 }}>{agent.prenom}</span>
      </td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)', fontSize: '12px', color: 'var(--texte-secondaire)' }}>{labelMetier(agent.role)}</td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)' }}><StatutBadge statut={agent.statut} /></td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)', textAlign: 'right', width: '48px' }}>
        {showMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" style={{ width: '28px', height: '28px', opacity: (hovered || isCompact) ? 1 : 0, transition: 'opacity 0.15s' }}><MoreVertical size={14} /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ minWidth: '160px', fontSize: '13px' }}>
              {canUpdate && <DropdownMenuItem onClick={() => onEdit(agent)} style={{ gap: '8px', cursor: 'pointer' }}><Pencil size={13} /> {t('acteurs.edit', { defaultValue: 'Modifier' })}</DropdownMenuItem>}
              {canUpdate && canDelete && <DropdownMenuSeparator />}
              {canDelete && (
                <DropdownMenuItem onClick={onToggle} style={{ gap: '8px', cursor: 'pointer', color: isActif(agent.statut) ? 'var(--erreur-texte)' : 'var(--succes-texte)' }}>
                  {isActif(agent.statut) ? <PowerOff size={13} /> : <Power size={13} />}
                  {isActif(agent.statut) ? t('acteurs.deactivate', { defaultValue: 'Désactiver' }) : t('acteurs.activate', { defaultValue: 'Réactiver' })}
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
