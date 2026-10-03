import { useState }            from 'react'
import { useNavigate }         from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { useTranslation }      from 'react-i18next'
import { DatePicker }          from '@/components/saris'
import { zodResolver }         from '@hookform/resolvers/zod'
import { z }                   from 'zod'
import { Users, MoreVertical, Trash2 , Ban } from 'lucide-react'
import { Button }              from '@workspace/ui/components/button'
import { Label }               from '@workspace/ui/components/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@workspace/ui/components/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { DrawerShell }         from '@/modules/referentiels/components/DrawerShell'
import { ConfirmDeleteModal }  from './ConfirmDeleteModal'
import { usePermissions }      from '@/hooks/usePermissions'
import { useUpdateRattachementAD, useDeleteRattachementAD, usePatientAyantsDroits } from '../../hooks/usePatients'
import type { PatientDossier, RattachementAyantDroitCdi } from '@cms-saris/types'
import { humanizeCode } from '@/config/labels'
import { formatDate as intlFormatDate } from '@/lib/intl'

function formatDate(iso: string) {
  return intlFormatDate(iso, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ── Schémas ───────────────────────────────────────────────────────────────────
// Création retirée (le rattachement se crée automatiquement à la visite) — seule
// l'édition du type de lien / des dates d'un rattachement AD existant reste possible.

const dateOk = (v: string) => !Number.isNaN(Date.parse(v))
const finApresDebut = (d: { dateDebut: string; dateFin?: string }) =>
  !d.dateFin || !d.dateDebut || d.dateFin > d.dateDebut

function makeAdEditSchema(t: (k: string) => string) {
  return z.object({
    typeLien:  z.enum(['CONJOINT', 'ENFANT', 'PARENT', 'AUTRE']),
    dateDebut: z.string().min(1, t('patients.validationRequired')).refine(dateOk, t('patients.validationDateInvalid')),
    dateFin:   z.string().optional().refine(v => !v || dateOk(v), t('patients.validationDateInvalid')),
  }).refine(finApresDebut, { message: t('patients.validationEndAfterStart'), path: ['dateFin'] })
}
type ADEditForm = z.infer<ReturnType<typeof makeAdEditSchema>>

// ── Cards ─────────────────────────────────────────────────────────────────────

function RattachementADCard({ ratt, canWrite, patientId }: { ratt: RattachementAyantDroitCdi; canWrite: boolean; patientId: string }) {
  const { t } = useTranslation()
  const update = useUpdateRattachementAD(patientId)
  const remove = useDeleteRattachementAD(patientId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmCloturer, setConfirmCloturer] = useState(false)
  // Supprimer (au lieu de clôturer) : droit dédié, l'historique est conservé.
  const { has } = usePermissions()
  const peutSupprimer = has('patient.rattachement.delete')
  const [editOpen, setEditOpen] = useState(false)
  const editForm = useForm<ADEditForm>({
    resolver: zodResolver(makeAdEditSchema(t)),
    values: { typeLien: ratt.typeLien as ADEditForm['typeLien'], dateDebut: ratt.dateDebut.substring(0, 10), dateFin: ratt.dateFin?.substring(0, 10) },
  })
  const editTypeLienVal = editForm.watch('typeLien')
  const LIEN_LABELS: Record<string, string> = { CONJOINT: t('patients.relLabelConjoint'), ENFANT: t('patients.relLabelEnfant'), PARENT: t('patients.relLabelParent'), AUTRE: t('patients.relLabelAutre') }
  const navigate = useNavigate()
  const actif = ratt.statut === 'ACTIF'
  // Échu : statut encore ACTIF mais date de fin dépassée (constat 53). Il était affiché
  // et compté « Actif » ; les droits, eux, sont déjà suspendus (couverturePatient).
  const [maintenant] = useState(() => Date.now())
  const echu = actif && !!ratt.dateFin && new Date(ratt.dateFin).getTime() <= maintenant
  const enVigueur = actif && !echu
  return (
    <div style={{ background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)', borderRadius: 8, padding: '12px 14px', opacity: enVigueur ? 1 : 0.6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--ap-50)', border: '1px solid var(--ap-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Users size={14} style={{ color: 'var(--ap-600)' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--texte-primaire)' }}>
              {LIEN_LABELS[ratt.typeLien] ?? humanizeCode(ratt.typeLien)}
            </span>
            <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: 99, background: enVigueur ? 'var(--succes-fond)' : echu ? 'var(--avert-fond)' : 'var(--fond-surface-2)', color: enVigueur ? 'var(--succes-texte)' : echu ? 'var(--avert-texte)' : 'var(--texte-tertiaire)', fontWeight: '600' }}>
              {enVigueur ? t('patients.attachActive') : echu ? t('patients.attachExpired') : t('patients.attachClosed')}
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--texte-secondaire)', margin: '3px 0 0' }}>
            {ratt.cdi
              ? (ratt.cdi.patientId
                  ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/patients/${ratt.cdi!.patientId}`)}
                      title={t('patients.openRecord')}
                      style={{ padding: 0, background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', color: 'var(--ap-600)', textDecoration: 'underline', textAlign: 'left' }}
                    >
                      {t('patients.attachCdiOf', { name: `${ratt.cdi.prenom} ${ratt.cdi.nom}`, numero: ratt.cdi.identifiant })}
                    </button>
                  )
                  : t('patients.attachCdiOf', { name: `${ratt.cdi.prenom} ${ratt.cdi.nom}`, numero: ratt.cdi.identifiant }))
              : t('patients.attachCdiUnknown')}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--texte-tertiaire)', margin: '2px 0 0' }}>
            {ratt.dateFin
              ? t('patients.attachPeriod', { start: formatDate(ratt.dateDebut), end: formatDate(ratt.dateFin) })
              : actif
                ? t('patients.attachPeriodOngoing', { start: formatDate(ratt.dateDebut) })
                : t('patients.attachPeriodClosedNoDate', { start: formatDate(ratt.dateDebut) })}
          </p>
        </div>
        {canWrite && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" style={{ width: 28, height: 28 }}><MoreVertical size={13} /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ fontSize: '13px' }}>
              <DropdownMenuItem onClick={() => setEditOpen(true)} style={{ cursor: 'pointer' }}>
                {t('patients.editAttachment')}
              </DropdownMenuItem>
              {/* Clôturer suspend les droits de l'ayant droit (médicaments, examens) :
                  confirmation obligatoire, la clôture n'est plus un clic de trop. */}
              <DropdownMenuItem onClick={() => actif ? setConfirmCloturer(true) : update.mutate({ rId: ratt.id, data: { statut: 'ACTIF' } })} style={{ cursor: 'pointer', color: actif ? 'var(--erreur-texte)' : 'var(--succes-texte)' }}>
                {actif ? t('patients.close') : t('patients.reactivate')}
              </DropdownMenuItem>
              {peutSupprimer && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setConfirmDelete(true)} style={{ cursor: 'pointer', color: 'var(--erreur-texte)', display: 'flex', alignItems: 'center', gap: 8 }}>
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
          title={t('patients.deleteAttachmentTitle')}
          subtitle={LIEN_LABELS[ratt.typeLien] ?? humanizeCode(ratt.typeLien)}
          message={t('patients.deleteAttachmentAdBody')}
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => { await remove.mutateAsync(ratt.id) }}
        />
      )}
      {confirmCloturer && (
        <ConfirmDeleteModal
          icon={<Ban size={17} />}
          title={t('patients.closeAttachmentTitle')}
          subtitle={LIEN_LABELS[ratt.typeLien] ?? humanizeCode(ratt.typeLien)}
          message={t('patients.closeAttachmentBody')}
          confirmLabel={t('patients.close')}
          busyLabel={t('patients.closing')}
          onClose={() => setConfirmCloturer(false)}
          onConfirm={async () => { await update.mutateAsync({ rId: ratt.id, data: { statut: 'INACTIF' } }) }}
        />
      )}

      <DrawerShell
        open={editOpen}
        onClose={() => setEditOpen(false)}
        icon={<Users size={18} />}
        title={t('patients.editAttachment')}
        description={t('patients.editAttachmentAdDesc')}
        onSave={async () => {
          const ok = await editForm.trigger()
          if (!ok) return
          const v = editForm.getValues()
          await update.mutateAsync({ rId: ratt.id, data: { typeLien: v.typeLien, dateDebut: v.dateDebut, dateFin: v.dateFin || undefined } })
          setEditOpen(false)
        }}
        isSaving={update.isPending}
        isDirty={editForm.formState.isDirty}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <Label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--texte-secondaire)' }}>{t('patients.fieldRelationshipReqAd')}</Label>
            <Select value={editTypeLienVal} onValueChange={v => editForm.setValue('typeLien', v as ADEditForm['typeLien'], { shouldDirty: true })}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <Label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--texte-secondaire)' }}>{t('patients.fieldStart')}</Label>
              <Controller
                control={editForm.control}
                name="dateDebut"
                render={({ field }) => (
                  <DatePicker value={field.value} onChange={v => field.onChange(v ?? '')} placeholder={t('patients.startPlaceholder')} max={editForm.watch('dateFin') || undefined} />
                )}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <Label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--texte-secondaire)' }}>{t('patients.fieldEndOptional')}</Label>
              <Controller
                control={editForm.control}
                name="dateFin"
                render={({ field }) => (
                  <DatePicker value={field.value} onChange={v => field.onChange(v ?? '')} placeholder={t('patients.endPlaceholder')} clearable min={editForm.watch('dateDebut') || undefined} />
                )}
              />
            </div>
          </div>
        </div>
      </DrawerShell>
    </div>
  )
}

// ── Ayants droit (dépendants) du travailleur — traçabilité ─────────────────────
// Affiche les ayants droits RATTACHÉS À CE PATIENT (par cdiId, donc ce patient est le
// travailleur/assuré) + leur activité médicale récente. Masqué s'il n'en a aucun.

function AyantsDroitsDependants({ patientId }: { patientId: string }) {
  const { t } = useTranslation()
  const { data: liens = [] } = usePatientAyantsDroits(patientId)
  const navigate = useNavigate()
  const [maintenant] = useState(() => Date.now())
  if (liens.length === 0) return null
  const enVigueur = (l: (typeof liens)[number]) =>
    l.statut === 'ACTIF' && (!l.dateFin || new Date(l.dateFin).getTime() > maintenant)
  const nbActifs = liens.filter(enVigueur).length
  const LIEN_LABELS: Record<string, string> = { CONJOINT: t('patients.relLabelConjoint'), ENFANT: t('patients.relLabelEnfant'), PARENT: t('patients.relLabelParent'), AUTRE: t('patients.relLabelAutre') }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Users size={15} style={{ color: 'var(--ap-600)' }} />
        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--texte-primaire)' }}>{t('patients.dependentsTitle')}</span>
        <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', background: 'var(--fond-surface-2)', padding: '1px 7px', borderRadius: 99 }}>{nbActifs}</span>
        {liens.length > nbActifs && (
          <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)' }}>{t('patients.dependentsClosedCount', { count: liens.length - nbActifs })}</span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {liens.map(l => {
          const ident = l.patient.identite
          const nom   = ident ? `${ident.prenom} ${ident.nom}` : l.patient.numeroPatient
          const lastV = l.patient.visites[0]
          const actif = enVigueur(l)
          return (
            <div key={l.id} style={{ background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)', borderRadius: 8, padding: '12px 14px', opacity: actif ? 1 : 0.7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--ap-50)', border: '1px solid var(--ap-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Users size={14} style={{ color: 'var(--ap-600)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => navigate(`/patients/${l.patient.id}`)}
                      title={t('patients.openRecord')}
                      style={{ padding: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: 'var(--ap-600)', textDecoration: 'underline' }}
                    >
                      {nom}
                    </button>
                    <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: 99, background: 'var(--ap-50)', color: 'var(--ap-700)', fontWeight: '600' }}>{LIEN_LABELS[l.typeLien] ?? humanizeCode(l.typeLien)}</span>
                    <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', fontFamily: 'monospace' }}>{l.patient.numeroPatient}</span>
                    {actif ? (
                      <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)' }}>{t('patients.attachSince', { date: formatDate(l.dateDebut) })}</span>
                    ) : (
                      <>
                        <span style={{ fontSize: '10px', color: 'var(--texte-tertiaire)', border: '1px solid var(--bordure-normale)', padding: '1px 6px', borderRadius: 99 }}>
                          {l.statut === 'ACTIF' ? t('patients.attachExpired') : t('patients.attachClosed')}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)' }}>
                          {l.dateFin
                            ? t('patients.attachPeriod', { start: formatDate(l.dateDebut), end: formatDate(l.dateFin) })
                            : t('patients.attachPeriodClosedNoDate', { start: formatDate(l.dateDebut) })}
                        </span>
                      </>
                    )}
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--texte-tertiaire)', margin: '3px 0 0' }}>
                    {/* Trois cas, et non deux : une activite MASQUEE n'est pas une activite
                        ABSENTE. Les confondre ferait ecrire « aucune activite recente » sur le
                        dossier d'un ayant droit verrouille — une affirmation fausse. */}
                    {l.patient.activiteMasquee
                      ? t('patients.activityHidden')
                      : lastV
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
// Purement automatique : les rattachements (ayant droit ↔ CDI, sous-traitant ↔
// société) se créent à la visite (recueil), pas depuis le dossier. Cet onglet
// n'est d'ailleurs affiché que pour les catégories CDI/CDD et ayant droit
// (DossierPage.tsx) — un sous-traitant ou un patient externe ne l'a pas du tout.

export function RattementsTab({ dossier, canWrite }: { dossier: PatientDossier; canWrite: boolean }) {
  const { t } = useTranslation()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* Ayants droit (dépendants) du travailleur + activité récente — traçabilité */}
      <AyantsDroitsDependants patientId={dossier.id} />

      {/* Rattachement à l'assuré CDI (côté ayant droit) — créé automatiquement à la visite.
          Sans objet pour un travailleur CDI (un employé n'est jamais l'ayant droit d'un
          autre) : la section n'affichait que « 0 — rattaché à aucun assuré CDI ». Elle reste
          visible s'il garde des rattachements passés (ancien ayant droit devenu CDI). */}
      {(dossier.categoriePatient.code === 'AYANT_DROIT_CDI' || dossier.rattachementsAD.length > 0) && (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Users size={15} style={{ color: 'var(--ap-600)' }} />
          <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--texte-primaire)' }}>{t('patients.beneficiariesCdi')}</span>
          <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', background: 'var(--fond-surface-2)', padding: '1px 7px', borderRadius: 99 }}>
            {dossier.rattachementsAD.filter(r => r.statut === 'ACTIF').length}
          </span>
        </div>
        {dossier.rattachementsAD.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--texte-tertiaire)', fontStyle: 'italic' }}>{t('patients.emptyBeneficiariesCdi')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {dossier.rattachementsAD.map(r => <RattachementADCard key={r.id} ratt={r} canWrite={canWrite} patientId={dossier.id} />)}
          </div>
        )}
      </div>
      )}
    </div>
  )
}
