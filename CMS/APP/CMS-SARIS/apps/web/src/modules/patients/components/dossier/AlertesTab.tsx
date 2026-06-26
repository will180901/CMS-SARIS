import { useState }           from 'react'
import { useForm }            from 'react-hook-form'
import { zodResolver }        from '@hookform/resolvers/zod'
import { z }                  from 'zod'
import { useTranslation }     from 'react-i18next'
import { Plus, MoreVertical, AlertTriangle, ShieldAlert, Trash2 } from 'lucide-react'
import { Button }             from '@workspace/ui/components/button'
import { Input }              from '@workspace/ui/components/input'
import { Label }              from '@workspace/ui/components/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@workspace/ui/components/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { DrawerShell }        from '@/modules/referentiels/components/DrawerShell'
import { ConfirmDeleteModal } from './ConfirmDeleteModal'
import { useCreateAllergie, useUpdateAllergie, useDeleteAllergie, useCreateAlerte, useUpdateAlerte, useDeleteAlerte } from '../../hooks/usePatients'
import { formatDate } from '@/lib/intl'
import type { PatientDossier, AllergiePatient, AlerteMedicale } from '@cms-saris/types'
import { humanizeCode } from '@/config/labels'

// ── Config sévérités ──────────────────────────────────────────────────────────

// `labelKey` = clé i18n (résolue dans le composant, jamais au niveau module).
const GRAVITE_ALLERGIE_CFG = {
  SEVERE: { bg: 'var(--erreur-fond)', text: 'var(--erreur-texte)', border: 'var(--erreur-bordure)', labelKey: 'patients.graviteLabelSevere' },
  MODERE: { bg: 'var(--avert-fond)',  text: 'var(--avert-texte)',  border: 'var(--avert-bordure)',  labelKey: 'patients.graviteLabelModere' },
  FAIBLE: { bg: 'var(--succes-fond)', text: 'var(--succes-texte)', border: 'var(--succes-bordure)', labelKey: 'patients.graviteLabelFaible' },
}

const GRAVITE_ALERTE_CFG = {
  CRITIQUE:  { bg: 'var(--erreur-fond)', text: 'var(--erreur-texte)', border: 'var(--erreur-bordure)', labelKey: 'patients.graviteLabelCritique'  },
  IMPORTANT: { bg: 'var(--avert-fond)',  text: 'var(--avert-texte)',  border: 'var(--avert-bordure)',  labelKey: 'patients.graviteLabelImportant' },
  INFO:      { bg: 'var(--info-fond)',   text: 'var(--info-texte)',   border: 'var(--info-bordure)',   labelKey: 'patients.graviteLabelInfo'      },
}

function GraviteBadge({ gravite, type }: { gravite: string; type: 'allergie' | 'alerte' }) {
  const { t } = useTranslation()
  const cfg = type === 'allergie'
    ? GRAVITE_ALLERGIE_CFG[gravite as keyof typeof GRAVITE_ALLERGIE_CFG]
    : GRAVITE_ALERTE_CFG[gravite as keyof typeof GRAVITE_ALERTE_CFG]
  if (!cfg) return null
  return (
    <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: 9999, background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>
      {t(cfg.labelKey)}
    </span>
  )
}

// ── Schémas ───────────────────────────────────────────────────────────────────

// Fabriques de schéma : reçoivent `t` pour traduire les messages visibles.
function makeAllergieSchema(t: (k: string) => string) {
  return z.object({
    substance: z.string().trim().min(2, t('patients.validationMin2')).max(200, t('patients.validationMax200')),
    gravite:   z.enum(['SEVERE', 'MODERE', 'FAIBLE']),
    confirme:  z.boolean().optional(),
  })
}
type AllergieForm = z.infer<ReturnType<typeof makeAllergieSchema>>

function makeAlerteSchema(t: (k: string) => string) {
  return z.object({
    type:    z.enum(['ALLERGIE', 'PATHOLOGIE_CHRONIQUE', 'CONTRE_INDICATION', 'SURVEILLANCE', 'AUTRE']),
    message: z.string().trim().min(5, t('patients.validationMin5')).max(500, t('patients.validationMax500')),
    gravite: z.enum(['CRITIQUE', 'IMPORTANT', 'INFO']),
  })
}
type AlerteForm = z.infer<ReturnType<typeof makeAlerteSchema>>

// ── Card allergie ─────────────────────────────────────────────────────────────

function AllergieCard({ allergie, canWrite, patientId }: { allergie: AllergiePatient; canWrite: boolean; patientId: string }) {
  const { t } = useTranslation()
  const update = useUpdateAllergie(patientId)
  const remove = useDeleteAllergie(patientId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <div style={{ background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)', borderRadius: 8, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: '600', fontSize: '13px', color: 'var(--texte-primaire)' }}>{allergie.substance}</span>
          <GraviteBadge gravite={allergie.gravite} type="allergie" />
          {allergie.confirme && (
            <span style={{ fontSize: '10px', color: 'var(--texte-tertiaire)', background: 'var(--fond-surface-2)', padding: '1px 6px', borderRadius: 99 }}>{t('patients.confirmedBadge')}</span>
          )}
        </div>
      </div>
      {canWrite && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" style={{ width: 28, height: 28, flexShrink: 0 }}><MoreVertical size={13} /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" style={{ fontSize: '13px' }}>
            <DropdownMenuItem onClick={() => update.mutate({ aId: allergie.id, data: { confirme: !allergie.confirme } })} style={{ cursor: 'pointer' }}>
              {allergie.confirme ? t('patients.markUnconfirmed') : t('patients.confirmAllergy')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => update.mutate({ aId: allergie.id, data: { statut: allergie.statut === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } })} style={{ cursor: 'pointer', color: allergie.statut === 'ACTIVE' ? 'var(--erreur-texte)' : 'var(--succes-texte)' }}>
              {allergie.statut === 'ACTIVE' ? t('patients.deactivate') : t('patients.reactivate')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setConfirmDelete(true)} style={{ cursor: 'pointer', color: 'var(--erreur-texte)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Trash2 size={13} /> {t('patients.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {confirmDelete && (
        <ConfirmDeleteModal
          title={t('patients.deleteAllergyTitle')}
          subtitle={allergie.substance}
          message={t('patients.deleteAllergyBody')}
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => { await remove.mutateAsync(allergie.id) }}
        />
      )}
    </div>
  )
}

// ── Card alerte ───────────────────────────────────────────────────────────────

function AlerteCard({ alerte, canWrite, patientId }: { alerte: AlerteMedicale; canWrite: boolean; patientId: string }) {
  const { t } = useTranslation()
  const update = useUpdateAlerte(patientId)
  const remove = useDeleteAlerte(patientId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const TYPE_LABELS: Record<string, string> = {
    ALLERGIE: t('patients.alertTypeAllergie'), PATHOLOGIE_CHRONIQUE: t('patients.alertTypePathologie'),
    CONTRE_INDICATION: t('patients.alertTypeContreIndication'), SURVEILLANCE: t('patients.alertTypeSurveillance'), AUTRE: t('patients.alertTypeAutre'),
  }
  return (
    <div style={{ background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
            <GraviteBadge gravite={alerte.gravite} type="alerte" />
            <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', background: 'var(--fond-surface-2)', padding: '1px 6px', borderRadius: 99 }}>
              {TYPE_LABELS[alerte.type] ?? humanizeCode(alerte.type)}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--texte-primaire)', margin: 0, lineHeight: '1.5' }}>{alerte.message}</p>
          <p style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', margin: '4px 0 0' }}>
            {formatDate(alerte.createdAt)}
          </p>
        </div>
        {canWrite && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" style={{ width: 28, height: 28, flexShrink: 0 }}><MoreVertical size={13} /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ fontSize: '13px' }}>
              <DropdownMenuItem onClick={() => update.mutate({ aId: alerte.id, data: { statut: alerte.statut === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } })} style={{ cursor: 'pointer', color: alerte.statut === 'ACTIVE' ? 'var(--erreur-texte)' : 'var(--succes-texte)' }}>
                {alerte.statut === 'ACTIVE' ? t('patients.resolveDeactivate') : t('patients.reactivate')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setConfirmDelete(true)} style={{ cursor: 'pointer', color: 'var(--erreur-texte)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Trash2 size={13} /> {t('patients.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDeleteModal
          title={t('patients.deleteAlertTitle')}
          message={t('patients.deleteAlertBody')}
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => { await remove.mutateAsync(alerte.id) }}
        />
      )}
    </div>
  )
}

// ── Section générique ─────────────────────────────────────────────────────────

function Section({ title, icon, count, onAdd, canWrite, children, emptyMsg }: {
  title:    string
  icon:     React.ReactNode
  count:    number
  onAdd?:   () => void
  canWrite: boolean
  children: React.ReactNode
  emptyMsg: string
}) {
  const { t } = useTranslation()
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon}
          <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--texte-primaire)' }}>{title}</span>
          <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', background: 'var(--fond-surface-2)', padding: '1px 7px', borderRadius: 99 }}>{count}</span>
        </div>
        {canWrite && onAdd && (
          <Button size="sm" variant="outline" onClick={onAdd} style={{ height: 30, fontSize: '12px', gap: '4px' }}>
            <Plus size={12} /> {t('patients.add')}
          </Button>
        )}
      </div>
      {count === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--texte-tertiaire)', fontStyle: 'italic', padding: '12px 0' }}>{emptyMsg}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{children}</div>
      )}
    </div>
  )
}

// ── Onglet Alertes ────────────────────────────────────────────────────────────

export function AlertesTab({ dossier, canWrite }: { dossier: PatientDossier; canWrite: boolean }) {
  const { t } = useTranslation()
  const [allergieDrawer, setAllergieDrawer] = useState(false)
  const [alerteDrawer,   setAlerteDrawer]   = useState(false)

  const createAllergie = useCreateAllergie(dossier.id)
  const createAlerte   = useCreateAlerte(dossier.id)

  const allergieForm = useForm<AllergieForm>({ resolver: zodResolver(makeAllergieSchema(t)), defaultValues: { gravite: 'MODERE', confirme: false } })
  const alerteForm   = useForm<AlerteForm>({ resolver: zodResolver(makeAlerteSchema(t)),   defaultValues: { type: 'ALLERGIE', gravite: 'IMPORTANT' } })

  const severeFirst = [...dossier.allergies].sort((a, b) => {
    const order = { SEVERE: 0, MODERE: 1, FAIBLE: 2 }
    return (order[a.gravite as keyof typeof order] ?? 3) - (order[b.gravite as keyof typeof order] ?? 3)
  })
  const critiqueFirst = [...dossier.alertesMedicales].sort((a, b) => {
    const order = { CRITIQUE: 0, IMPORTANT: 1, INFO: 2 }
    return (order[a.gravite as keyof typeof order] ?? 3) - (order[b.gravite as keyof typeof order] ?? 3)
  })

  const allergieGravite = allergieForm.watch('gravite')
  const alerteGravite   = alerteForm.watch('gravite')
  const alerteType      = alerteForm.watch('type')

  const fld = { display: 'flex', flexDirection: 'column' as const, gap: '5px' }
  const lbl = { fontSize: '12px', fontWeight: '500' as const, color: 'var(--texte-secondaire)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      <Section
        title={t('patients.sectionAllergies')} icon={<AlertTriangle size={15} style={{ color: '#e11d48' }} />}
        count={dossier.allergies.filter(a => a.statut === 'ACTIVE').length}
        onAdd={() => setAllergieDrawer(true)}
        canWrite={canWrite}
        emptyMsg={t('patients.emptyAllergies')}
      >
        {severeFirst.filter(a => a.statut === 'ACTIVE').map(a => (
          <AllergieCard key={a.id} allergie={a} canWrite={canWrite} patientId={dossier.id} />
        ))}
      </Section>

      <div style={{ height: 1, background: 'var(--bordure-legere)' }} />

      <Section
        title={t('patients.sectionMedicalAlerts')} icon={<ShieldAlert size={15} style={{ color: '#c2410c' }} />}
        count={dossier.alertesMedicales.filter(a => a.statut === 'ACTIVE').length}
        onAdd={() => setAlerteDrawer(true)}
        canWrite={canWrite}
        emptyMsg={t('patients.emptyMedicalAlerts')}
      >
        {critiqueFirst.filter(a => a.statut === 'ACTIVE').map(a => (
          <AlerteCard key={a.id} alerte={a} canWrite={canWrite} patientId={dossier.id} />
        ))}
      </Section>

      {/* Drawer allergie */}
      <DrawerShell
        open={allergieDrawer}
        onClose={() => { setAllergieDrawer(false); allergieForm.reset() }}
        icon={<AlertTriangle size={18} />}
        title={t('patients.drawerNewAllergy')}
        description={t('patients.drawerNewAllergyDesc')}
        onSave={async () => {
          const ok = await allergieForm.trigger()
          if (!ok) return
          await createAllergie.mutateAsync(allergieForm.getValues())
          setAllergieDrawer(false); allergieForm.reset()
        }}
        isSaving={createAllergie.isPending}
        isDirty={allergieForm.formState.isDirty}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={fld}><Label style={lbl}>{t('patients.fieldSubstance')}</Label><Input {...allergieForm.register('substance')} placeholder={t('patients.substancePlaceholder')} style={{ fontSize: '13px' }} /></div>
          <div style={fld}>
            <Label style={lbl}>{t('patients.fieldSeverity')}</Label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['SEVERE', 'MODERE', 'FAIBLE'] as const).map(g => {
                const cfg = GRAVITE_ALLERGIE_CFG[g]
                return (
                  <button key={g} type="button" onClick={() => allergieForm.setValue('gravite', g)} style={{ flex: 1, padding: '8px', borderRadius: 6, fontSize: '12px', fontWeight: '600', cursor: 'pointer', background: allergieGravite === g ? cfg.bg : 'var(--fond-surface-2)', color: allergieGravite === g ? cfg.text : 'var(--texte-secondaire)', border: allergieGravite === g ? `1.5px solid ${cfg.border}` : '1px solid var(--bordure-normale)' }}>
                    {t(cfg.labelKey)}
                  </button>
                )
              })}
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--texte-secondaire)' }}>
            <input type="checkbox" {...allergieForm.register('confirme')} style={{ accentColor: 'var(--ap-500)', width: 14, height: 14 }} />
            {t('patients.allergyConfirmedCheckbox')}
          </label>
        </div>
      </DrawerShell>

      {/* Drawer alerte */}
      <DrawerShell
        open={alerteDrawer}
        onClose={() => { setAlerteDrawer(false); alerteForm.reset() }}
        icon={<ShieldAlert size={18} />}
        title={t('patients.drawerNewAlert')}
        description={t('patients.drawerNewAlertDesc')}
        onSave={async () => {
          const ok = await alerteForm.trigger()
          if (!ok) return
          await createAlerte.mutateAsync(alerteForm.getValues())
          setAlerteDrawer(false); alerteForm.reset()
        }}
        isSaving={createAlerte.isPending}
        isDirty={alerteForm.formState.isDirty}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={fld}>
            <Label style={lbl}>{t('patients.fieldAlertType')}</Label>
            <Select value={alerteType} onValueChange={v => alerteForm.setValue('type', v as any)}>
              <SelectTrigger style={{ height: 36, fontSize: '13px', border: '1px solid var(--bordure-normale)' }}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALLERGIE">{t('patients.alertTypeAllergie')}</SelectItem>
                <SelectItem value="PATHOLOGIE_CHRONIQUE">{t('patients.alertTypePathologie')}</SelectItem>
                <SelectItem value="CONTRE_INDICATION">{t('patients.alertTypeContreIndication')}</SelectItem>
                <SelectItem value="SURVEILLANCE">{t('patients.alertTypeSurveillance')}</SelectItem>
                <SelectItem value="AUTRE">{t('patients.alertTypeAutre')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div style={fld}>
            <Label style={lbl}>{t('patients.fieldMessage')}</Label>
            <textarea {...alerteForm.register('message')} placeholder={t('patients.alertMessagePlaceholder')} style={{ fontSize: '13px', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--bordure-normale)', background: 'var(--fond-surface)', color: 'var(--texte-primaire)', minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          <div style={fld}>
            <Label style={lbl}>{t('patients.fieldSeverityLevel')}</Label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['CRITIQUE', 'IMPORTANT', 'INFO'] as const).map(g => {
                const cfg = GRAVITE_ALERTE_CFG[g]
                return (
                  <button key={g} type="button" onClick={() => alerteForm.setValue('gravite', g)} style={{ flex: 1, padding: '8px', borderRadius: 6, fontSize: '12px', fontWeight: '600', cursor: 'pointer', background: alerteGravite === g ? cfg.bg : 'var(--fond-surface-2)', color: alerteGravite === g ? cfg.text : 'var(--texte-secondaire)', border: alerteGravite === g ? `1.5px solid ${cfg.border}` : '1px solid var(--bordure-normale)' }}>
                    {t(cfg.labelKey)}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </DrawerShell>
    </div>
  )
}
