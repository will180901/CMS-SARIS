import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MoreVertical, Pencil, PowerOff, Power, Trash2, Users } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { Button } from '@workspace/ui/components/button'
import { Input }  from '@workspace/ui/components/input'
import { Label }  from '@workspace/ui/components/label'
import type { CategoriePatient } from '@cms-saris/types'
import { useCategoriesPatient, useCreateCategorie, useUpdateCategorie, useToggleCategorieStatut, QUERY_KEYS, useDeleteCategorie } from '../hooks/useReferentiels'
import { usePagination } from '../hooks/usePagination'
import { useRowsPerPage } from '@/hooks/useRowsPerPage'
import { isActif, referentielsApi }         from '../api/referentiels.api'
import { TabToolbar }      from '../components/TabToolbar'
import { StatutBadge }     from '../components/badges/StatutBadge'
import { SkeletonRows }    from '../components/SkeletonRows'
import { EmptyState }      from '../components/EmptyState'
import { ConfirmDialog }   from '../components/ConfirmDialog'
import { DrawerShell }     from '../components/DrawerShell'
import { PaginationBar }   from '../components/PaginationBar'
import { DataTableHead, dataRowStyle, DATA_TABLE_CARD, useColumnResize, useSelectionLot, BarreSelectionLot, CaseSelectionLigne, ActionSelectionner, proprietesLigne, type SelectionLot } from '@/components/saris'
import { codeReferentiel, libelle as libelleSchema } from '@/lib/validation'
import { ListePrintSheet, type ColonneExport } from '@/components/print/ListePrintSheet'

const catSchema = z.object({
  code:    codeReferentiel(2, 30),
  libelle: libelleSchema('Libellé', 2, 100),
})
type CatForm = z.infer<typeof catSchema>

function CatFormFields({ form, isEdit }: { form: ReturnType<typeof useForm<CatForm>>; isEdit: boolean }) {
  const { t } = useTranslation()
  const { register, formState: { errors } } = form
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <Label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', marginBottom: '6px', display: 'block' }}>
          {t('referentiels.fieldCode')} <span style={{ color: 'var(--erreur-texte)' }}>*</span>
        </Label>
        <Input {...register('code')} placeholder={t('referentiels.catCodePlaceholder')} disabled={isEdit}
          style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', fontSize: '13px', opacity: isEdit ? 0.6 : 1, cursor: isEdit ? 'not-allowed' : 'text' }} />
        {isEdit
          ? <p style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', marginTop: '4px' }}>{t('referentiels.catCodeLocked')}</p>
          : errors.code && <p style={{ fontSize: '12px', color: 'var(--erreur-texte)', marginTop: '4px' }}>{errors.code.message}</p>}
      </div>
      <div>
        <Label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', marginBottom: '6px', display: 'block' }}>
          {t('referentiels.fieldLabel')} <span style={{ color: 'var(--erreur-texte)' }}>*</span>
        </Label>
        <Input {...register('libelle')} placeholder={t('referentiels.catLabelPlaceholder')} style={{ fontSize: '13px' }} />
        {errors.libelle && <p style={{ fontSize: '12px', color: 'var(--erreur-texte)', marginTop: '4px' }}>{errors.libelle.message}</p>}
      </div>
      <div style={{ padding: '12px', borderRadius: '6px', background: 'var(--info-fond)', border: '1px solid var(--info-bordure)' }}>
        <p style={{ fontSize: '12px', color: 'var(--info-texte)', margin: 0, lineHeight: '1.5' }}>
          {t('referentiels.catFormHint')}
        </p>
      </div>
    </div>
  )
}

export function CategoriesTab({ canCreate, canUpdate, canDelete }: { canCreate: boolean; canUpdate: boolean; canDelete: boolean }) {
  const { t } = useTranslation()
  const { data: categories = [], isLoading } = useCategoriesPatient()
  const createCat    = useCreateCategorie()
  const updateCat    = useUpdateCategorie()
  const toggleStatut = useToggleCategorieStatut()
  const deleteCat    = useDeleteCategorie()

  const [search, setSearch]     = useState('')
  const [statut, setStatut]     = useState('all')
  const [drawerOpen, setDrawer] = useState(false)
  const [editTarget, setEdit]   = useState<CategoriePatient | null>(null)
  const [confirm, setConfirm]   = useState<CategoriePatient | null>(null)
  const [confirmDel, setConfirmDel] = useState<CategoriePatient | null>(null)

  const form = useForm<CatForm>({ resolver: zodResolver(catSchema) })

  const filtered = useMemo(() => categories.filter(c => {
    if (statut === 'actif'   && !isActif(c.statut)) return false
    if (statut === 'inactif' &&  isActif(c.statut)) return false
    if (search) { const q = search.toLowerCase(); return c.code.toLowerCase().includes(q) || c.libelle.toLowerCase().includes(q) }
    return true
  }), [categories, search, statut])

  const pagination = usePagination(filtered, useRowsPerPage())
  const [openExport, setOpenExport] = useState(false)
  // Mêmes colonnes qu'à l'écran, rendues en texte pour le papier.
  const colonnesExport = useMemo<ColonneExport<CategoriePatient>[]>(() => [
    { libelle: t('referentiels.fieldCode'),        valeur: c => c.code },
    { libelle: t('referentiels.fieldLabel'),       valeur: c => c.libelle },
    { libelle: t('referentiels.catColStatus'),     valeur: c => (isActif(c.statut) ? 'Actif' : 'Inactif') },
  ], [t])
  const rz = useColumnResize({ storageKey: 'ref-categories', ready: !isLoading && filtered.length > 0, cellsSelector: 'thead th' })

  const sel = useSelectionLot<CategoriePatient>({
    idDe: x => x.id,
    supprimer: id => referentielsApi.categories.remove(id),
    invalider: [QUERY_KEYS.categories],
  })

  function openCreate() { setEdit(null); form.reset({ code: '', libelle: '' }); setDrawer(true) }
  function openEdit(c: CategoriePatient) { setEdit(c); form.reset({ code: c.code, libelle: c.libelle }); setDrawer(true) }
  function closeDrawer() { setDrawer(false); setEdit(null); form.reset() }

  async function handleSave() {
    const ok = await form.trigger(); if (!ok) return
    // `form.getValues()` renvoie les valeurs BRUTES saisies — le `.toUpperCase()` de
    // `codeReferentiel()` n'est appliqué par le resolver qu'au moment de la validation,
    // jamais réécrit dans l'état du formulaire. On repasse donc par le schéma pour que
    // le code réellement envoyé au serveur (comparé ensuite en dur par
    // patient.service.ts / droits-categorie.ts) soit bien normalisé en majuscules.
    const data = catSchema.parse(form.getValues())
    // `code` est immuable après création (cf. UpdateCategoriePayload) — on ne renvoie
    // jamais que le libellé à la mise à jour, même si le champ (désactivé) est présent
    // dans le formulaire.
    if (editTarget) { await updateCat.mutateAsync({ id: editTarget.id, data: { libelle: data.libelle } }) }
    else { await createCat.mutateAsync(data) }
    closeDrawer()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, paddingBottom: '16px' }}>
      <div style={{ flexShrink: 0 }}>
        <TabToolbar search={search} onSearchChange={setSearch} statut={statut} onStatutChange={setStatut}
          onNew={openCreate} newLabel={t('referentiels.catNew')} placeholder={t('referentiels.catSearchPlaceholder')} canCreate={canCreate} onExport={() => setOpenExport(true)} />
      </div>
      {canDelete && <BarreSelectionLot sel={sel} lignes={filtered} />}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingBottom: '8px' }}>
        <div style={DATA_TABLE_CARD}>
          <table ref={rz.containerRef} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: rz.tableLayout }}>
            <DataTableHead resize={rz} columns={[
              { label: t('referentiels.fieldCode') },
              { label: t('referentiels.fieldLabel') },
              { label: t('referentiels.catColStatus') },
              { label: '', align: 'right' },
            ]} />
            <tbody>
              {isLoading ? (
                <SkeletonRows rows={5} cols={4} widths={[0.2, 0.55, 0.15, 0.05]} />
              ) : filtered.length === 0 ? (
                <EmptyState icon={Users}
                  title={search ? t('referentiels.catEmptySearch') : t('referentiels.catEmpty')}
                  description={!search ? t('referentiels.catEmptyHint') : undefined}
                  action={!search && canCreate ? <Button size="sm" onClick={openCreate} style={{ background: 'var(--ap-400)', color: '#fff', fontSize: '12px' }}>{t('referentiels.catNew')}</Button> : undefined} />
              ) : (
                pagination.pageData.map((c, i) => (
                  <CatRow key={c.id} cat={c} striped={i % 2 === 1}
                    onEdit={openEdit} onToggle={() => setConfirm(c)} onDelete={() => setConfirmDel(c)}
                    canUpdate={canUpdate} canDelete={canDelete} sel={sel} />
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

      <DrawerShell open={drawerOpen} onClose={closeDrawer} icon={<Users size={18} />}
        title={editTarget ? t('referentiels.editPrefix', { value: editTarget.code }) : t('referentiels.catDrawerNewTitle')}
        onSave={handleSave} isSaving={createCat.isPending || updateCat.isPending} isDirty={form.formState.isDirty}>
        <CatFormFields form={form} isEdit={!!editTarget} />
      </DrawerShell>

      <ConfirmDialog open={!!confirm} onCancel={() => setConfirm(null)}
        onConfirm={async () => { if (confirm) { await toggleStatut.mutateAsync(confirm); setConfirm(null) } }}
        loading={toggleStatut.isPending}
        title={confirm && isActif(confirm.statut) ? t('referentiels.catToggleOffTitle') : t('referentiels.catToggleOnTitle')}
        description={confirm && isActif(confirm.statut)
          ? t('referentiels.catToggleOffDesc')
          : t('referentiels.catToggleOnDesc')}
        confirmLabel={confirm && isActif(confirm.statut) ? t('referentiels.deactivate') : t('referentiels.activate')} />

      <ConfirmDialog open={!!confirmDel} onCancel={() => setConfirmDel(null)}
        onConfirm={async () => { if (confirmDel) { await deleteCat.mutateAsync(confirmDel.id); setConfirmDel(null) } }}
        loading={deleteCat.isPending}
        title={t('referentiels.catDeleteTitle')}
        description={t('referentiels.catDeleteDesc')}
        confirmLabel={t('referentiels.delete')} />

      {openExport && (
        <ListePrintSheet<CategoriePatient>
          rootId="export-categories"
          titre={t('referentiels.printCategories')}
          sousTitre={`${filtered.length} entrée${filtered.length > 1 ? 's' : ''}`}
          lignes={filtered}
          cleDe={x => x.id}
          colonnes={colonnesExport}
          onClose={() => setOpenExport(false)}
        />
      )}

    </div>
  )
}

function CatRow({ cat, striped, onEdit, onToggle, onDelete, canUpdate, canDelete, sel }: {
  cat: CategoriePatient; striped: boolean; onEdit: (c: CategoriePatient) => void; onToggle: () => void; onDelete: () => void; canUpdate: boolean; canDelete: boolean
  sel: SelectionLot<CategoriePatient>
}) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)
  const showMenu = canUpdate || canDelete
  return (
    <tr onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      {...proprietesLigne(sel, cat, dataRowStyle(striped, hovered || sel.estSelectionne(cat)))}>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)', width: '180px' }}>
        <CaseSelectionLigne sel={sel} ligne={cat}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--texte-tertiaire)' }}>{cat.code}</span>
        </CaseSelectionLigne>
      </td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)' }}>
        <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)' }}>{cat.libelle}</span>
      </td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)' }}><StatutBadge statut={cat.statut} /></td>
      <td style={{ padding: 'var(--espace-2) var(--espace-4)', textAlign: 'right', width: '48px' }} onClick={e => e.stopPropagation()}>
        {showMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" style={{ width: '28px', height: '28px', opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}>
                <MoreVertical size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ minWidth: '160px', fontSize: '13px' }}>
              {canDelete && <ActionSelectionner onClick={() => sel.entrer(cat)} />}
              {canDelete && <DropdownMenuSeparator />}
              {canUpdate && (
                <DropdownMenuItem onClick={() => onEdit(cat)} style={{ gap: '8px', cursor: 'pointer' }}><Pencil size={13} /> {t('referentiels.actionEdit')}</DropdownMenuItem>
              )}
              {canUpdate && canDelete && <DropdownMenuSeparator />}
              {canDelete && (
                <DropdownMenuItem onClick={onToggle} style={{ gap: '8px', cursor: 'pointer', color: isActif(cat.statut) ? 'var(--erreur-texte)' : 'var(--succes-texte)' }}>
                  {isActif(cat.statut) ? <PowerOff size={13} /> : <Power size={13} />}
                  {isActif(cat.statut) ? t('referentiels.deactivate') : t('referentiels.activate')}
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
