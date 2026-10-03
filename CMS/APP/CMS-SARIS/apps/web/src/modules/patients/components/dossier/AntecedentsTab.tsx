import { useState }           from 'react'
import { useForm }            from 'react-hook-form'
import { zodResolver }        from '@hookform/resolvers/zod'
import { z }                  from 'zod'
import { useTranslation }     from 'react-i18next'
import { Plus, MoreVertical, ClipboardList, Trash2 } from 'lucide-react'
import { Button }             from '@workspace/ui/components/button'
import { Label }              from '@workspace/ui/components/label'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { DrawerShell }        from '@/modules/referentiels/components/DrawerShell'
import { SelectBox, Textarea } from '@/components/saris'
import { ConfirmDeleteModal } from './ConfirmDeleteModal'
import { useCreateAntecedent, useUpdateAntecedent, useDeleteAntecedent } from '../../hooks/usePatients'
import { usePathologies }     from '@/modules/referentiels/hooks/useReferentiels'
import { isActif }            from '@/modules/referentiels/api/referentiels.api'
import { usePermissions }     from '@/hooks/usePermissions'
import type { PatientDossier, AntecedentPatient, TypeAntecedent } from '@cms-saris/types'

// ── Config types ──────────────────────────────────────────────────────────────

// `labelKey` = clé i18n (résolue dans le composant, jamais au niveau module).
// Couleurs = tons décoratifs du thème (ils ont leur variante sombre) : les codes
// hexadécimaux d'avant restaient clairs en thème sombre.
const TYPE_CFG: Record<TypeAntecedent, { labelKey: string; bg: string; text: string; border: string }> = {
  MEDICAL:             { labelKey: 'patients.antecedentMedical',  bg: 'var(--ton-bleu-fond)',     text: 'var(--ton-bleu-icone)',     border: 'var(--ton-bleu-bordure)' },
  CHIRURGICAL:         { labelKey: 'patients.antecedentSurgical', bg: 'var(--ton-violet-fond)',   text: 'var(--ton-violet-icone)',   border: 'var(--ton-violet-bordure)' },
  FAMILIAL:            { labelKey: 'patients.antecedentFamilial', bg: 'var(--ton-emeraude-fond)', text: 'var(--ton-emeraude-icone)', border: 'var(--ton-emeraude-bordure)' },
  GYNECO_OBSTETRICAL:  { labelKey: 'patients.antecedentGyneco',   bg: 'var(--ton-rose-fond)',     text: 'var(--ton-rose-icone)',     border: 'var(--ton-rose-bordure)' },
  AUTRE:               { labelKey: 'patients.antecedentOther',    bg: 'var(--fond-surface-2)', text: 'var(--texte-secondaire)', border: 'var(--bordure-normale)' },
}

function TypeBadge({ type }: { type: string }) {
  const { t } = useTranslation()
  const cfg = TYPE_CFG[type as TypeAntecedent] ?? TYPE_CFG.AUTRE
  return (
    <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: 9999, background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`, whiteSpace: 'nowrap' }}>
      {t(cfg.labelKey)}
    </span>
  )
}

// ── Schéma ────────────────────────────────────────────────────────────────────
// Fabrique de schéma : reçoit `t` pour traduire les messages visibles.

function makeSchema(t: (k: string) => string) {
  return z.object({
    type:        z.enum(['MEDICAL', 'CHIRURGICAL', 'FAMILIAL', 'GYNECO_OBSTETRICAL', 'AUTRE']),
    description: z.string().trim().min(5, t('patients.validationMin5')).max(500, t('patients.validationMax500')),
    pathologieId: z.string().optional(),
  })
}

// ── Sélecteur de pathologie (liste fermée du référentiel, recueil §3.1) ──────

function PathologiePicker({ value, onChange }: { value: string | undefined; onChange: (v: string) => void }) {
  const { t } = useTranslation()
  const { data: pathologies = [] } = usePathologies()
  const actives = pathologies.filter(p => isActif(p.statut))
  return (
    <SelectBox
      size="md"
      fullWidth
      value={value ?? ''}
      onChange={onChange}
      placeholder={t('patients.pathologieNonListeePlaceholder')}
      aria-label={t('patients.fieldPathologie')}
      options={[
        { value: '', label: t('patients.pathologieNonListee') },
        ...actives.map(p => ({ value: p.id, label: p.libelle })),
      ]}
    />
  )
}
type Form = z.infer<ReturnType<typeof makeSchema>>

// ── Card antécédent ───────────────────────────────────────────────────────────

function AntecedentCard({ ant, canWrite, patientId }: { ant: AntecedentPatient; canWrite: boolean; patientId: string }) {
  const { t } = useTranslation()
  const update = useUpdateAntecedent(patientId)
  const remove = useDeleteAntecedent(patientId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Supprimer (définitif) ≠ marquer résolu : droit dédié patient.medical.delete.
  const { has } = usePermissions()
  const peutSupprimer = has('patient.medical.delete')
  const [editOpen, setEditOpen] = useState(false)
  const editForm = useForm<Form>({ resolver: zodResolver(makeSchema(t)), values: { type: ant.type, description: ant.description, pathologieId: ant.pathologieId ?? undefined } })
  const editTypeVal = editForm.watch('type')
  const editPathologieId = editForm.watch('pathologieId')
  const resolved = ant.statut === 'RESOLU'
  return (
    <div style={{
      background: resolved ? 'var(--fond-surface-2)' : 'var(--fond-surface)',
      border:     `1px solid var(--bordure-legere)`,
      borderRadius: 8, padding: '12px 14px',
      opacity: resolved ? 0.65 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <TypeBadge type={ant.type} />
            {ant.pathologie && (
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ap-700)', background: 'var(--ap-50)', border: '1px solid var(--ap-200)', padding: '1px 8px', borderRadius: 99 }}>
                {ant.pathologie.libelle}
              </span>
            )}
            {resolved && (
              <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', background: 'var(--fond-surface-2)', padding: '1px 6px', borderRadius: 99 }}>{t('patients.resolvedBadge')}</span>
            )}
          </div>
          <p style={{ fontSize: '13px', color: 'var(--texte-primaire)', margin: 0, lineHeight: '1.6' }}>{ant.description}</p>
        </div>
        {canWrite && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" style={{ width: 28, height: 28, flexShrink: 0 }}><MoreVertical size={13} /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ fontSize: '13px' }}>
              <DropdownMenuItem onClick={() => setEditOpen(true)} style={{ cursor: 'pointer' }}>
                {t('patients.editAntecedent')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => update.mutate({ aId: ant.id, data: { statut: ant.statut === 'ACTIF' ? 'RESOLU' : 'ACTIF' } })}
                style={{ cursor: 'pointer' }}
              >
                {ant.statut === 'ACTIF' ? t('patients.markResolved') : t('patients.reactivate')}
              </DropdownMenuItem>
              {peutSupprimer && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setConfirmDelete(true)}
                    style={{ cursor: 'pointer', color: 'var(--erreur-texte)', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <Trash2 size={13} /> {t('patients.delete')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDeleteModal
          title={t('patients.deleteAntecedentTitle')}
          subtitle={ant.pathologie?.libelle ?? ant.description}
          message={t('patients.deleteAntecedentBody')}
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => { await remove.mutateAsync(ant.id) }}
        />
      )}

      <DrawerShell
        open={editOpen}
        onClose={() => setEditOpen(false)}
        icon={<ClipboardList size={18} />}
        title={t('patients.editAntecedent')}
        description={t('patients.editAntecedentDesc')}
        onSave={async () => {
          const ok = await editForm.trigger()
          if (!ok) return
          const v = editForm.getValues()
          // null (et non undefined) : « Pathologie non listée » DÉLIE la pathologie. Omise,
          // l'ancienne restait — et, si elle était confidentielle, masquait encore
          // l'antécédent à l'infirmier.
          await update.mutateAsync({ aId: ant.id, data: { type: v.type, description: v.description, pathologieId: v.pathologieId || null } })
          setEditOpen(false)
        }}
        isSaving={update.isPending}
        isDirty={editForm.formState.isDirty}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <Label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--texte-secondaire)' }}>{t('patients.fieldType')}</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(Object.entries(TYPE_CFG) as [TypeAntecedent, typeof TYPE_CFG[TypeAntecedent]][]).map(([k, cfg]) => (
                <button key={k} type="button" onClick={() => editForm.setValue('type', k, { shouldDirty: true })} style={{ padding: '5px 12px', borderRadius: 99, fontSize: '12px', fontWeight: '600', cursor: 'pointer', background: editTypeVal === k ? cfg.bg : 'var(--fond-surface-2)', color: editTypeVal === k ? cfg.text : 'var(--texte-tertiaire)', border: editTypeVal === k ? `1.5px solid ${cfg.border}` : '1px solid var(--bordure-legere)', transition: 'all 0.1s' }}>
                  {t(cfg.labelKey)}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <Label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--texte-secondaire)' }}>{t('patients.fieldPathologie')}</Label>
            <PathologiePicker value={editPathologieId} onChange={v => editForm.setValue('pathologieId', v, { shouldDirty: true })} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <Label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--texte-secondaire)' }}>{t('patients.fieldDescription')}</Label>
            <Textarea {...editForm.register('description')} placeholder={t('patients.antecedentDescriptionPlaceholder')} invalid={!!editForm.formState.errors.description} style={{ minHeight: 100 }} />
            {editForm.formState.errors.description && (
              <p style={{ fontSize: '11px', color: 'var(--erreur-texte)' }}>{editForm.formState.errors.description.message}</p>
            )}
          </div>
        </div>
      </DrawerShell>
    </div>
  )
}

// ── Onglet ────────────────────────────────────────────────────────────────────

export function AntecedentsTab({ dossier, canWrite }: { dossier: PatientDossier; canWrite: boolean }) {
  const { t } = useTranslation()
  const [drawerOpen, setDrawer] = useState(false)
  const createAnt = useCreateAntecedent(dossier.id)
  const form = useForm<Form>({ resolver: zodResolver(makeSchema(t)), defaultValues: { type: 'MEDICAL' } })
  const typeVal = form.watch('type')
  const pathologieIdVal = form.watch('pathologieId')

  const actifs  = dossier.antecedents.filter(a => a.statut === 'ACTIF')
  const resolus = dossier.antecedents.filter(a => a.statut === 'RESOLU')
  // Sans `patient.confidentiel.read`, le serveur retire les antécédents liés à une
  // pathologie à confidentialité renforcée. On le DIT, toujours (qu'il y en ait ou non :
  // n'afficher l'avertissement que s'il en existe révélerait leur existence). Sinon
  // « Aucun antécédent documenté » serait affirmé là où il y en a peut-être.
  const { has } = usePermissions()
  const vueFiltree = !has('patient.confidentiel.read')

  const fld = { display: 'flex', flexDirection: 'column' as const, gap: '5px' }
  const lbl = { fontSize: '12px', fontWeight: '500' as const, color: 'var(--texte-secondaire)' }

  return (
    <div>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ClipboardList size={15} style={{ color: 'var(--ap-600)' }} />
          <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--texte-primaire)' }}>{t('patients.antecedentsTitle')}</span>
          <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', background: 'var(--fond-surface-2)', padding: '1px 7px', borderRadius: 99 }}>
            {t(actifs.length > 1 ? 'patients.activeCountPlural' : 'patients.activeCountSingular', { count: actifs.length })}
          </span>
        </div>
        {canWrite && (
          <Button size="sm" variant="outline" onClick={() => setDrawer(true)} style={{ height: 30, fontSize: '12px', gap: '4px' }}>
            <Plus size={12} /> {t('patients.add')}
          </Button>
        )}
      </div>

      {vueFiltree && (
        <p style={{ fontSize: '12px', color: 'var(--texte-tertiaire)', margin: '-6px 0 14px', lineHeight: 1.45 }}>
          {t('patients.antecedentsConfidentielsMasques')}
        </p>
      )}

      {/* Actifs */}
      {actifs.length === 0 && resolus.length === 0 && (
        <p style={{ fontSize: '13px', color: 'var(--texte-tertiaire)', fontStyle: 'italic' }}>{t('patients.emptyAntecedents')}</p>
      )}
      {actifs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: resolus.length > 0 ? '20px' : 0 }}>
          {actifs.map(a => <AntecedentCard key={a.id} ant={a} canWrite={canWrite} patientId={dossier.id} />)}
        </div>
      )}

      {/* Résolus (section repliable simulée) */}
      {resolus.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <p style={{ fontSize: '11px', fontWeight: '600', color: 'var(--texte-tertiaire)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            {t('patients.resolvedSection', { count: resolus.length })}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {resolus.map(a => <AntecedentCard key={a.id} ant={a} canWrite={canWrite} patientId={dossier.id} />)}
          </div>
        </div>
      )}

      {/* Drawer */}
      <DrawerShell
        open={drawerOpen}
        onClose={() => { setDrawer(false); form.reset() }}
        icon={<ClipboardList size={18} />}
        title={t('patients.drawerNewAntecedent')}
        description={t('patients.drawerNewAntecedentDesc')}
        onSave={async () => {
          const ok = await form.trigger()
          if (!ok) return
          const v = form.getValues()
          await createAnt.mutateAsync({ ...v, pathologieId: v.pathologieId || undefined })
          setDrawer(false); form.reset()
        }}
        isSaving={createAnt.isPending}
        isDirty={form.formState.isDirty}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={fld}>
            <Label style={lbl}>{t('patients.fieldType')}</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(Object.entries(TYPE_CFG) as [TypeAntecedent, typeof TYPE_CFG[TypeAntecedent]][]).map(([k, cfg]) => (
                <button key={k} type="button" onClick={() => form.setValue('type', k)} style={{ padding: '5px 12px', borderRadius: 99, fontSize: '12px', fontWeight: '600', cursor: 'pointer', background: typeVal === k ? cfg.bg : 'var(--fond-surface-2)', color: typeVal === k ? cfg.text : 'var(--texte-tertiaire)', border: typeVal === k ? `1.5px solid ${cfg.border}` : '1px solid var(--bordure-legere)', transition: 'all 0.1s' }}>
                  {t(cfg.labelKey)}
                </button>
              ))}
            </div>
          </div>
          <div style={fld}>
            <Label style={lbl}>{t('patients.fieldPathologie')}</Label>
            <PathologiePicker value={pathologieIdVal} onChange={v => form.setValue('pathologieId', v)} />
          </div>
          <div style={fld}>
            <Label style={lbl}>{t('patients.fieldDescription')}</Label>
            <Textarea {...form.register('description')} placeholder={t('patients.antecedentDescriptionPlaceholder')} invalid={!!form.formState.errors.description} style={{ minHeight: 100 }} />
            {form.formState.errors.description && (
              <p style={{ fontSize: '11px', color: 'var(--erreur-texte)' }}>{form.formState.errors.description.message}</p>
            )}
          </div>
        </div>
      </DrawerShell>
    </div>
  )
}
