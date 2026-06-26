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
import { ConfirmDeleteModal } from './ConfirmDeleteModal'
import { useCreateAntecedent, useUpdateAntecedent, useDeleteAntecedent } from '../../hooks/usePatients'
import type { PatientDossier, AntecedentPatient, TypeAntecedent } from '@cms-saris/types'

// ── Config types ──────────────────────────────────────────────────────────────

// `labelKey` = clé i18n (résolue dans le composant, jamais au niveau module).
const TYPE_CFG: Record<TypeAntecedent, { labelKey: string; bg: string; text: string; border: string }> = {
  MEDICAL:             { labelKey: 'patients.antecedentMedical',  bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' },
  CHIRURGICAL:         { labelKey: 'patients.antecedentSurgical', bg: '#ede9fe', text: '#6d28d9', border: '#ddd6fe' },
  FAMILIAL:            { labelKey: 'patients.antecedentFamilial', bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
  GYNECO_OBSTETRICAL:  { labelKey: 'patients.antecedentGyneco',   bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
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
  })
}
type Form = z.infer<ReturnType<typeof makeSchema>>

// ── Card antécédent ───────────────────────────────────────────────────────────

function AntecedentCard({ ant, canWrite, patientId }: { ant: AntecedentPatient; canWrite: boolean; patientId: string }) {
  const { t } = useTranslation()
  const update = useUpdateAntecedent(patientId)
  const remove = useDeleteAntecedent(patientId)
  const [confirmDelete, setConfirmDelete] = useState(false)
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
              <DropdownMenuItem
                onClick={() => update.mutate({ aId: ant.id, data: { statut: ant.statut === 'ACTIF' ? 'RESOLU' : 'ACTIF' } })}
                style={{ cursor: 'pointer' }}
              >
                {ant.statut === 'ACTIF' ? t('patients.markResolved') : t('patients.reactivate')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setConfirmDelete(true)}
                style={{ cursor: 'pointer', color: 'var(--erreur-texte)', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <Trash2 size={13} /> {t('patients.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDeleteModal
          title={t('patients.deleteAntecedentTitle')}
          message={t('patients.deleteAntecedentBody')}
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => { await remove.mutateAsync(ant.id) }}
        />
      )}
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

  const actifs  = dossier.antecedents.filter(a => a.statut === 'ACTIF')
  const resolus = dossier.antecedents.filter(a => a.statut === 'RESOLU')

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
          await createAnt.mutateAsync(form.getValues())
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
            <Label style={lbl}>{t('patients.fieldDescription')}</Label>
            <textarea {...form.register('description')} placeholder={t('patients.antecedentDescriptionPlaceholder')} style={{ fontSize: '13px', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--bordure-normale)', background: 'var(--fond-surface)', color: 'var(--texte-primaire)', minHeight: 100, resize: 'vertical', fontFamily: 'inherit' }} />
            {form.formState.errors.description && (
              <p style={{ fontSize: '11px', color: 'var(--erreur-texte)' }}>{form.formState.errors.description.message}</p>
            )}
          </div>
        </div>
      </DrawerShell>
    </div>
  )
}
