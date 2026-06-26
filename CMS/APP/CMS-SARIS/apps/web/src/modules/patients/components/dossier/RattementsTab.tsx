import { useState }            from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useTranslation }      from 'react-i18next'
import { DatePicker }          from '@/components/saris'
import { zodResolver }         from '@hookform/resolvers/zod'
import { z }                   from 'zod'
import { Plus, Building2, Users, MoreVertical, Trash2 } from 'lucide-react'
import { Button }              from '@workspace/ui/components/button'
import { Input }               from '@workspace/ui/components/input'
import { Label }               from '@workspace/ui/components/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@workspace/ui/components/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { DrawerShell }         from '@/modules/referentiels/components/DrawerShell'
import { patientsApi }         from '../../api/patients.api'
import { ConfirmDeleteModal }  from './ConfirmDeleteModal'
import { useCreateRattachementAD, useUpdateRattachementAD, useDeleteRattachementAD, useCreateRattachementST, useUpdateRattachementST, useDeleteRattachementST, usePatientAyantsDroits } from '../../hooks/usePatients'
import { useSousTraitants }    from '@/modules/referentiels/hooks/useSousTraitants'
import type { PatientDossier, RattachementAyantDroitCdi, RattachementSousTraitant } from '@cms-saris/types'
import { humanizeCode } from '@/config/labels'
import { formatDate as intlFormatDate } from '@/lib/intl'

function formatDate(iso: string) {
  return intlFormatDate(iso, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ── Schémas ───────────────────────────────────────────────────────────────────

const dateOk = (v: string) => !Number.isNaN(Date.parse(v))
const finApresDebut = (d: { dateDebut: string; dateFin?: string }) =>
  !d.dateFin || !d.dateDebut || d.dateFin > d.dateDebut

// Fabriques de schéma : reçoivent `t` pour traduire les messages visibles.
function makeAdSchema(t: (k: string) => string) {
  return z.object({
    matricule: z.string().min(1, t('patients.validationRequired')),
    typeLien: z.enum(['CONJOINT', 'ENFANT', 'PARENT', 'AUTRE']),
    dateDebut: z.string().min(1, t('patients.validationRequired')).refine(dateOk, t('patients.validationDateInvalid')),
    dateFin:   z.string().optional().refine(v => !v || dateOk(v), t('patients.validationDateInvalid')),
  }).refine(finApresDebut, { message: t('patients.validationEndAfterStart'), path: ['dateFin'] })
}
type ADForm = z.infer<ReturnType<typeof makeAdSchema>>

function makeStSchema(t: (k: string) => string) {
  return z.object({
    societeId: z.string().uuid(t('patients.validationRequired')),
    dateDebut: z.string().min(1, t('patients.validationRequired')).refine(dateOk, t('patients.validationDateInvalid')),
    dateFin:   z.string().optional().refine(v => !v || dateOk(v), t('patients.validationDateInvalid')),
  }).refine(finApresDebut, { message: t('patients.validationEndAfterStart'), path: ['dateFin'] })
}
type STForm = z.infer<ReturnType<typeof makeStSchema>>

// ── Cards ─────────────────────────────────────────────────────────────────────

function RattachementADCard({ ratt, canWrite, patientId }: { ratt: RattachementAyantDroitCdi; canWrite: boolean; patientId: string }) {
  const { t } = useTranslation()
  const update = useUpdateRattachementAD(patientId)
  const remove = useDeleteRattachementAD(patientId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const LIEN_LABELS: Record<string, string> = { CONJOINT: t('patients.relLabelConjoint'), ENFANT: t('patients.relLabelEnfant'), PARENT: t('patients.relLabelParent'), AUTRE: t('patients.relLabelAutre') }
  const actif = ratt.statut === 'ACTIF'
  return (
    <div style={{ background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)', borderRadius: 8, padding: '12px 14px', opacity: actif ? 1 : 0.6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--ap-50)', border: '1px solid var(--ap-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Users size={14} style={{ color: 'var(--ap-600)' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--texte-primaire)' }}>
              {LIEN_LABELS[ratt.typeLien] ?? humanizeCode(ratt.typeLien)}
            </span>
            <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: 99, background: actif ? 'var(--succes-fond)' : 'var(--fond-surface-2)', color: actif ? 'var(--succes-texte)' : 'var(--texte-tertiaire)', fontWeight: '600' }}>
              {actif ? t('patients.attachActive') : t('patients.attachClosed')}
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--texte-tertiaire)', margin: '2px 0 0' }}>
            {ratt.dateFin
              ? t('patients.attachPeriod', { start: formatDate(ratt.dateDebut), end: formatDate(ratt.dateFin) })
              : t('patients.attachPeriodOngoing', { start: formatDate(ratt.dateDebut) })}
          </p>
        </div>
        {canWrite && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" style={{ width: 28, height: 28 }}><MoreVertical size={13} /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ fontSize: '13px' }}>
              <DropdownMenuItem onClick={() => update.mutate({ rId: ratt.id, data: { statut: actif ? 'INACTIF' : 'ACTIF' } })} style={{ cursor: 'pointer', color: actif ? 'var(--erreur-texte)' : 'var(--succes-texte)' }}>
                {actif ? t('patients.close') : t('patients.reactivate')}
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
          title={t('patients.deleteAttachmentTitle')}
          subtitle={LIEN_LABELS[ratt.typeLien] ?? humanizeCode(ratt.typeLien)}
          message={t('patients.deleteAttachmentAdBody')}
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => { await remove.mutateAsync(ratt.id) }}
        />
      )}
    </div>
  )
}

function RattachementSTCard({ ratt, canWrite, patientId }: { ratt: RattachementSousTraitant; canWrite: boolean; patientId: string }) {
  const { t } = useTranslation()
  const update = useUpdateRattachementST(patientId)
  const remove = useDeleteRattachementST(patientId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const actif = ratt.statut === 'ACTIF'
  return (
    <div style={{ background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)', borderRadius: 8, padding: '12px 14px', opacity: actif ? 1 : 0.6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--avert-fond)', border: '1px solid var(--avert-bordure)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Building2 size={14} style={{ color: 'var(--avert-texte)' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--texte-primaire)' }}>{ratt.societe.nom}</span>
            <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: 99, background: actif ? 'var(--succes-fond)' : 'var(--fond-surface-2)', color: actif ? 'var(--succes-texte)' : 'var(--texte-tertiaire)', fontWeight: '600' }}>
              {actif ? t('patients.attachActive') : t('patients.attachClosed')}
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--texte-tertiaire)', margin: '2px 0 0' }}>
            {ratt.dateFin
              ? t('patients.attachPeriod', { start: formatDate(ratt.dateDebut), end: formatDate(ratt.dateFin) })
              : t('patients.attachPeriodOngoing', { start: formatDate(ratt.dateDebut) })}
          </p>
        </div>
        {canWrite && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" style={{ width: 28, height: 28 }}><MoreVertical size={13} /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ fontSize: '13px' }}>
              <DropdownMenuItem onClick={() => update.mutate({ rId: ratt.id, data: { statut: actif ? 'INACTIF' : 'ACTIF' } })} style={{ cursor: 'pointer', color: actif ? 'var(--erreur-texte)' : 'var(--succes-texte)' }}>
                {actif ? t('patients.close') : t('patients.reactivate')}
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
          title={t('patients.deleteAttachmentTitle')}
          subtitle={ratt.societe.nom}
          message={t('patients.deleteAttachmentStBody')}
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => { await remove.mutateAsync(ratt.id) }}
        />
      )}
    </div>
  )
}

// ── Ayants droit (dépendants) du travailleur — traçabilité ─────────────────────
// Affiche les ayants droits RATTACHÉS À CE PATIENT (par cdiId, donc ce patient est le
// travailleur/assuré) + leur activité médicale récente. Masqué s'il n'en a aucun.

function AyantsDroitsDependants({ patientId }: { patientId: string }) {
  const { t } = useTranslation()
  const { data: liens = [] } = usePatientAyantsDroits(patientId)
  if (liens.length === 0) return null
  const LIEN_LABELS: Record<string, string> = { CONJOINT: t('patients.relLabelConjoint'), ENFANT: t('patients.relLabelEnfant'), PARENT: t('patients.relLabelParent'), AUTRE: t('patients.relLabelAutre') }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Users size={15} style={{ color: 'var(--ap-600)' }} />
        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--texte-primaire)' }}>{t('patients.dependentsTitle')}</span>
        <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', background: 'var(--fond-surface-2)', padding: '1px 7px', borderRadius: 99 }}>{liens.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {liens.map(l => {
          const ident = l.patient.identite
          const nom   = ident ? `${ident.prenom} ${ident.nom}` : l.patient.numeroPatient
          const lastV = l.patient.visites[0]
          return (
            <div key={l.id} style={{ background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--ap-50)', border: '1px solid var(--ap-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Users size={14} style={{ color: 'var(--ap-600)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--texte-primaire)' }}>{nom}</span>
                    <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: 99, background: 'var(--ap-50)', color: 'var(--ap-700)', fontWeight: '600' }}>{LIEN_LABELS[l.typeLien] ?? humanizeCode(l.typeLien)}</span>
                    <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', fontFamily: 'monospace' }}>{l.patient.numeroPatient}</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--texte-tertiaire)', margin: '3px 0 0' }}>
                    {lastV
                      ? t('patients.lastVisitOn', { date: formatDate(lastV.dateOuverture), motif: lastV.motifPrincipal.libelle })
                      : t('patients.noRecentActivity')}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Onglet ────────────────────────────────────────────────────────────────────

export function RattementsTab({ dossier, canWrite }: { dossier: PatientDossier; canWrite: boolean }) {
  const { t } = useTranslation()
  const [adDrawer, setADDrawer] = useState(false)
  const [stDrawer, setSTDrawer] = useState(false)

  const createAD = useCreateRattachementAD(dossier.id)
  const createST = useCreateRattachementST(dossier.id)
  const { data: societes = [] } = useSousTraitants()
  const societesActives = societes.filter(s => s.statut === 'ACTIVE')

  const adForm = useForm<ADForm>({ resolver: zodResolver(makeAdSchema(t)), defaultValues: { typeLien: 'ENFANT', dateDebut: new Date().toISOString().substring(0, 10) } })
  const stForm = useForm<STForm>({ resolver: zodResolver(makeStSchema(t)), defaultValues: { dateDebut: new Date().toISOString().substring(0, 10) } })

  const typeLienVal = adForm.watch('typeLien')
  const societeVal  = stForm.watch('societeId')

  const fld = { display: 'flex', flexDirection: 'column' as const, gap: '5px' }
  const lbl = { fontSize: '12px', fontWeight: '500' as const, color: 'var(--texte-secondaire)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* Ayants droit (dépendants) du travailleur + activité récente — traçabilité */}
      <AyantsDroitsDependants patientId={dossier.id} />

      {/* Rattachements Ayant Droit CDI */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={15} style={{ color: 'var(--ap-600)' }} />
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--texte-primaire)' }}>{t('patients.beneficiariesCdi')}</span>
            <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', background: 'var(--fond-surface-2)', padding: '1px 7px', borderRadius: 99 }}>
              {dossier.rattachementsAD.filter(r => r.statut === 'ACTIF').length}
            </span>
          </div>
          {canWrite && (
            <Button size="sm" variant="outline" onClick={() => setADDrawer(true)} style={{ height: 30, fontSize: '12px', gap: '4px' }}>
              <Plus size={12} /> {t('patients.add')}
            </Button>
          )}
        </div>
        {dossier.rattachementsAD.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--texte-tertiaire)', fontStyle: 'italic' }}>{t('patients.emptyBeneficiariesCdi')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {dossier.rattachementsAD.map(r => <RattachementADCard key={r.id} ratt={r} canWrite={canWrite} patientId={dossier.id} />)}
          </div>
        )}
      </div>

      <div style={{ height: 1, background: 'var(--bordure-legere)' }} />

      {/* Rattachements Sous-Traitant */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={15} style={{ color: 'var(--avert-texte)' }} />
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--texte-primaire)' }}>{t('patients.subcontractorAttachments')}</span>
            <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', background: 'var(--fond-surface-2)', padding: '1px 7px', borderRadius: 99 }}>
              {dossier.rattachementsST.filter(r => r.statut === 'ACTIF').length}
            </span>
          </div>
          {canWrite && (
            <Button size="sm" variant="outline" onClick={() => setSTDrawer(true)} style={{ height: 30, fontSize: '12px', gap: '4px' }}>
              <Plus size={12} /> {t('patients.add')}
            </Button>
          )}
        </div>
        {dossier.rattachementsST.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--texte-tertiaire)', fontStyle: 'italic' }}>{t('patients.emptySubcontractorAttachments')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {dossier.rattachementsST.map(r => <RattachementSTCard key={r.id} ratt={r} canWrite={canWrite} patientId={dossier.id} />)}
          </div>
        )}
      </div>

      {/* Drawer Ayant droit */}
      <DrawerShell
        open={adDrawer}
        onClose={() => { setADDrawer(false); adForm.reset() }}
        icon={<Users size={18} />}
        title={t('patients.drawerAttachAd')}
        description={t('patients.drawerAttachAdDesc')}
        onSave={async () => {
          const ok = await adForm.trigger()
          if (!ok) return
          const v = adForm.getValues()
          // Rapprochement intelligent : matricule → travailleur CDI → lien automatique.
          const worker = await patientsApi.byMatricule(v.matricule.trim()).catch(() => null)
          if (!worker) { adForm.setError('matricule', { message: t('patients.matriculeNotFound') }); return }
          await createAD.mutateAsync({ cdiId: worker.id, typeLien: v.typeLien, dateDebut: v.dateDebut, dateFin: v.dateFin || undefined })
          setADDrawer(false); adForm.reset()
        }}
        isSaving={createAD.isPending}
        isDirty={adForm.formState.isDirty}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={fld}>
            <Label style={lbl}>{t('patients.fieldMatricule')}</Label>
            <Input {...adForm.register('matricule')} placeholder={t('patients.matriculePlaceholder')} style={{ fontSize: '13px' }} />
            <p style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', marginTop: 2 }}>{t('patients.matriculeHint')}</p>
            {adForm.formState.errors.matricule && <p style={{ fontSize: '11px', color: 'var(--erreur-texte)', marginTop: 2 }}>{adForm.formState.errors.matricule.message}</p>}
          </div>
          <div style={fld}>
            <Label style={lbl}>{t('patients.fieldRelationshipReqAd')}</Label>
            <Select value={typeLienVal} onValueChange={v => adForm.setValue('typeLien', v as any)}>
              <SelectTrigger style={{ height: 36, fontSize: '13px', border: '1px solid var(--bordure-normale)' }}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CONJOINT">{t('patients.relLabelConjoint')}</SelectItem>
                <SelectItem value="ENFANT">{t('patients.relLabelEnfant')}</SelectItem>
                <SelectItem value="PARENT">{t('patients.relLabelParent')}</SelectItem>
                <SelectItem value="AUTRE">{t('patients.relLabelAutre')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: '10px' }}>
            <div style={fld}>
              <Label style={lbl}>{t('patients.fieldStart')}</Label>
              <Controller
                control={adForm.control}
                name="dateDebut"
                render={({ field }) => (
                  <DatePicker value={field.value} onChange={v => field.onChange(v ?? '')} placeholder={t('patients.startPlaceholder')} max={adForm.watch('dateFin') || undefined} />
                )}
              />
            </div>
            <div style={fld}>
              <Label style={lbl}>{t('patients.fieldEndOptional')}</Label>
              <Controller
                control={adForm.control}
                name="dateFin"
                render={({ field }) => (
                  <DatePicker value={field.value} onChange={v => field.onChange(v ?? '')} placeholder={t('patients.endPlaceholder')} clearable min={adForm.watch('dateDebut') || undefined} />
                )}
              />
            </div>
          </div>
        </div>
      </DrawerShell>

      {/* Drawer Sous-traitant */}
      <DrawerShell
        open={stDrawer}
        onClose={() => { setSTDrawer(false); stForm.reset() }}
        icon={<Building2 size={18} />}
        title={t('patients.drawerAttachSt')}
        description={t('patients.drawerAttachStDesc')}
        onSave={async () => {
          const ok = await stForm.trigger()
          if (!ok) return
          const v = stForm.getValues()
          await createST.mutateAsync({ ...v, dateFin: v.dateFin || undefined })
          setSTDrawer(false); stForm.reset()
        }}
        isSaving={createST.isPending}
        isDirty={stForm.formState.isDirty}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={fld}>
            <Label style={lbl}>{t('patients.fieldSubcontractorCompany')}</Label>
            <Select value={societeVal} onValueChange={v => stForm.setValue('societeId', v)}>
              <SelectTrigger style={{ height: 36, fontSize: '13px', border: '1px solid var(--bordure-normale)' }}><SelectValue placeholder={t('patients.selectPlaceholder')} /></SelectTrigger>
              <SelectContent>
                {societesActives.map(s => <SelectItem key={s.id} value={s.id}>{s.nom}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: '10px' }}>
            <div style={fld}>
              <Label style={lbl}>{t('patients.fieldStart')}</Label>
              <Controller
                control={stForm.control}
                name="dateDebut"
                render={({ field }) => (
                  <DatePicker value={field.value} onChange={v => field.onChange(v ?? '')} placeholder={t('patients.startPlaceholder')} max={stForm.watch('dateFin') || undefined} />
                )}
              />
            </div>
            <div style={fld}>
              <Label style={lbl}>{t('patients.fieldEndOptional')}</Label>
              <Controller
                control={stForm.control}
                name="dateFin"
                render={({ field }) => (
                  <DatePicker value={field.value} onChange={v => field.onChange(v ?? '')} placeholder={t('patients.endPlaceholder')} clearable min={stForm.watch('dateDebut') || undefined} />
                )}
              />
            </div>
          </div>
        </div>
      </DrawerShell>
    </div>
  )
}
