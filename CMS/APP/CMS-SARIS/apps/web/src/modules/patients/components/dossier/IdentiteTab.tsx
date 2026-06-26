import { useState }         from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useTranslation }    from 'react-i18next'
import { DatePicker }        from '@/components/saris'
import { zodResolver }       from '@hookform/resolvers/zod'
import { z }                 from 'zod'
import { Pencil, Check, X, User, Phone, Briefcase } from 'lucide-react'
import { Input }             from '@workspace/ui/components/input'
import { Label }             from '@workspace/ui/components/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@workspace/ui/components/select'
import { useUpdateIdentite } from '../../hooks/usePatients'
import { ModeVieCard } from './ModeVieCard'
import { useIsCompact } from '@/hooks/useMediaQuery'
import type { PatientDossier } from '@cms-saris/types'
import { nomPersonne, dateNaissance as dateNaissanceSchema, telephone, telephoneOpt, texteOpt, todayISO, minBirthISO } from '@/lib/validation'
import { formatDate } from '@/lib/intl'

// Fabrique de schéma : reçoit `t` pour traduire les messages visibles.
function makeSchema(t: (k: string) => string) {
  return z.object({
    nom:           nomPersonne('Nom'),
    prenom:        nomPersonne('Prénom'),
    dateNaissance: dateNaissanceSchema,
    sexe:          z.enum(['M', 'F']),
    telephone:     telephoneOpt,
    adresse:       texteOpt(200),
    matricule:     texteOpt(50),
    fonction:      texteOpt(100),
    sectionPaie:   texteOpt(100),
    service:       texteOpt(100),
    departement:   texteOpt(100),
    contactNom:    nomPersonne('Nom'),
    contactPrenom: nomPersonne('Prénom'),
    contactTel:    telephone,
    contactLien:   z.string().min(1, t('patients.validationRequired')).max(50),
  })
}
type Form = z.infer<ReturnType<typeof makeSchema>>

function toInputDate(iso: string) {
  return iso ? iso.substring(0, 10) : ''
}

// ── Carte info ────────────────────────────────────────────────────────────────

function InfoCard({ title, icon, children, action }: {
  title:    string
  icon:     React.ReactNode
  children: React.ReactNode
  action?:  React.ReactNode
}) {
  return (
    <div style={{ background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bordure-legere)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--fond-surface-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          {icon}
          <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--texte-primaire)' }}>{title}</span>
        </div>
        {action}
      </div>
      <div style={{ padding: '16px' }}>
        {children}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string | null }) {
  const { t } = useTranslation()
  return (
    <div>
      <p style={{ fontSize: '10px', fontWeight: '600', color: 'var(--texte-tertiaire)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 3px' }}>{label}</p>
      <p style={{ fontSize: '13px', color: value ? 'var(--texte-primaire)' : 'var(--texte-tertiaire)', margin: 0, fontStyle: value ? 'normal' : 'italic' }}>
        {value || t('patients.notProvided')}
      </p>
    </div>
  )
}

// ── Onglet Identité ───────────────────────────────────────────────────────────

export function IdentiteTab({ dossier, canWrite }: { dossier: PatientDossier; canWrite: boolean }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const update = useUpdateIdentite(dossier.id)
  const isCompact = useIsCompact()
  const cols2 = isCompact ? '1fr' : '1fr 1fr'
  const cols3 = isCompact ? '1fr 1fr' : 'repeat(3, 1fr)'
  const id = dossier.identite
  const cu = dossier.contactUrgence
  const emp = dossier.donneesEmploi
  // Données professionnelles : uniquement personnel CDI/CDD (recueil).
  const code = dossier.categoriePatient?.code
  const isCdiCdd = code === 'ASSURE_CDI' || code === 'ASSURE_CDD'

  const form = useForm<Form>({
    resolver: zodResolver(makeSchema(t)),
    defaultValues: {
      nom:           id?.nom           ?? '',
      prenom:        id?.prenom        ?? '',
      dateNaissance: toInputDate(id?.dateNaissance ?? ''),
      sexe:          (id?.sexe as 'M' | 'F') ?? 'M',
      telephone:     id?.telephone     ?? '',
      adresse:       id?.adresse       ?? '',
      matricule:     dossier.matricule ?? '',
      fonction:      emp?.fonction     ?? '',
      sectionPaie:   emp?.sectionPaie  ?? '',
      service:       emp?.service      ?? '',
      departement:   emp?.departement  ?? '',
      contactNom:    cu?.nom    ?? '',
      contactPrenom: cu?.prenom ?? '',
      contactTel:    cu?.telephone ?? '',
      contactLien:   cu?.lien ?? '',
    },
  })
  const { register, control, formState: { errors }, watch, setValue, reset } = form

  function handleCancel() { reset(); setEditing(false) }

  async function handleSave() {
    const ok = await form.trigger()
    if (!ok) return
    const v = form.getValues()
    await update.mutateAsync({
      nom: v.nom.trim(), prenom: v.prenom.trim(),
      dateNaissance: v.dateNaissance,
      sexe: v.sexe,
      telephone: v.telephone?.trim() || undefined,
      adresse:   v.adresse?.trim()   || undefined,
      ...(isCdiCdd ? {
        matricule:   v.matricule?.trim()   ?? '',
        fonction:    v.fonction?.trim()    ?? '',
        sectionPaie: v.sectionPaie?.trim() ?? '',
        service:     v.service?.trim()     ?? '',
        departement: v.departement?.trim() ?? '',
      } : {}),
      contactUrgence: { nom: v.contactNom.trim(), prenom: v.contactPrenom.trim(), telephone: v.contactTel.trim(), lien: v.contactLien },
    })
    setEditing(false)
  }

  const sexeVal = watch('sexe')
  const lienVal = watch('contactLien')

  const fld = { display: 'flex', flexDirection: 'column' as const, gap: '5px' }
  const lbl = { fontSize: '11px', fontWeight: '500' as const, color: 'var(--texte-secondaire)' }
  const err = { fontSize: '11px', color: 'var(--erreur-texte)' }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: '16px', alignItems: 'start' }}>

      {/* Carte identité civile */}
      <InfoCard
        title={t('patients.civilIdentity')}
        icon={<User size={13} style={{ color: 'var(--ap-600)' }} />}
        action={canWrite && !editing ? (
          <button onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--ap-600)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}>
            <Pencil size={11} /> {t('patients.edit')}
          </button>
        ) : editing ? (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={handleCancel} style={{ padding: '3px 8px', borderRadius: 5, fontSize: '11px', color: 'var(--texte-secondaire)', background: 'none', border: '1px solid var(--bordure-normale)', cursor: 'pointer' }}>
              <X size={11} />
            </button>
            <button onClick={handleSave} disabled={update.isPending} style={{ padding: '3px 8px', borderRadius: 5, fontSize: '11px', color: '#fff', background: 'var(--ap-500)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Check size={11} /> {update.isPending ? '…' : t('patients.save')}
            </button>
          </div>
        ) : undefined}
      >
        {!editing ? (
          <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: '12px' }}>
            <Field label={t('patients.labelFirstName')}          value={id?.prenom}    />
            <Field label={t('patients.labelLastName')}             value={id?.nom}       />
            <Field label={t('patients.labelBirthDate')}  value={id?.dateNaissance ? formatDate(id.dateNaissance) : undefined} />
            <Field label={t('patients.labelSex')}            value={id?.sexe === 'M' ? t('patients.sexMale') : id?.sexe === 'F' ? t('patients.sexFemale') : undefined} />
            <Field label={t('patients.labelPhone')}       value={id?.telephone ?? undefined} />
            <Field label={t('patients.labelAddress')}         value={id?.adresse   ?? undefined} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: '10px' }}>
              <div style={fld}><Label style={lbl}>{t('patients.fieldFirstNameReq')}</Label><Input {...register('prenom')} style={{ fontSize: '13px', height: 34 }} />{errors.prenom && <p style={err}>{errors.prenom.message}</p>}</div>
              <div style={fld}><Label style={lbl}>{t('patients.fieldLastNameReq')}</Label><Input {...register('nom')} style={{ fontSize: '13px', height: 34 }} />{errors.nom && <p style={err}>{errors.nom.message}</p>}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: '10px' }}>
              <div style={fld}>
                <Label style={lbl}>{t('patients.fieldBirthDateReq')}</Label>
                <Controller
                  control={control}
                  name="dateNaissance"
                  render={({ field }) => (
                    <DatePicker
                      value={field.value}
                      onChange={v => field.onChange(v ?? '')}
                      placeholder={t('patients.birthDatePlaceholder')}
                      min={minBirthISO()}
                      max={todayISO()}
                      invalid={!!errors.dateNaissance}
                      aria-label={t('patients.birthDateAria')}
                    />
                  )}
                />
                {errors.dateNaissance && <p style={err}>{errors.dateNaissance.message}</p>}
              </div>
              <div style={fld}>
                <Label style={lbl}>{t('patients.fieldSexReq')}</Label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['M', 'F'] as const).map(s => (
                    <button key={s} type="button" onClick={() => setValue('sexe', s)} style={{ flex: 1, height: 34, borderRadius: 6, fontSize: '12px', cursor: 'pointer', background: sexeVal === s ? 'var(--ap-500)' : 'var(--fond-surface-2)', color: sexeVal === s ? '#fff' : 'var(--texte-secondaire)', border: sexeVal === s ? 'none' : '1px solid var(--bordure-normale)' }}>
                      {s === 'M' ? 'M' : 'F'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={fld}><Label style={lbl}>{t('patients.labelPhone')}</Label><Input {...register('telephone')} style={{ fontSize: '13px', height: 34 }} /></div>
            <div style={fld}><Label style={lbl}>{t('patients.labelAddress')}</Label><Input {...register('adresse')} style={{ fontSize: '13px', height: 34 }} /></div>
          </div>
        )}
      </InfoCard>

      {/* Carte contact urgence */}
      <InfoCard title={t('patients.emergencyContact')} icon={<Phone size={13} style={{ color: 'var(--ap-600)' }} />}>
        {!editing ? (
          <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: '12px' }}>
            <Field label={t('patients.labelFirstName')}    value={cu?.prenom}    />
            <Field label={t('patients.labelLastName')}       value={cu?.nom}       />
            <Field label={t('patients.labelPhone')} value={cu?.telephone} />
            <Field label={t('patients.labelRelationship')}      value={cu?.lien}      />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: '10px' }}>
              <div style={fld}><Label style={lbl}>{t('patients.fieldFirstNameReq')}</Label><Input {...register('contactPrenom')} style={{ fontSize: '13px', height: 34 }} /></div>
              <div style={fld}><Label style={lbl}>{t('patients.fieldLastNameReq')}</Label><Input {...register('contactNom')} style={{ fontSize: '13px', height: 34 }} /></div>
            </div>
            <div style={fld}><Label style={lbl}>{t('patients.fieldPhoneReq')}</Label><Input {...register('contactTel')} style={{ fontSize: '13px', height: 34 }} />{errors.contactTel && <p style={err}>{errors.contactTel.message}</p>}</div>
            <div style={fld}>
              <Label style={lbl}>{t('patients.fieldRelationshipReq')}</Label>
              <Select value={lienVal} onValueChange={v => setValue('contactLien', v)}>
                <SelectTrigger style={{ height: 34, fontSize: '13px', border: '1px solid var(--bordure-normale)' }}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[
                    { value: 'Conjoint(e)',  label: t('patients.relSpouse')  },
                    { value: 'Père',         label: t('patients.relFather')  },
                    { value: 'Mère',         label: t('patients.relMother')  },
                    { value: 'Frère / Sœur', label: t('patients.relSibling') },
                    { value: 'Enfant',       label: t('patients.relChild')   },
                    { value: 'Autre',        label: t('patients.relOther')   },
                  ].map(l => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </InfoCard>

      {/* Carte données professionnelles — personnel CDI/CDD uniquement (recueil) */}
      {isCdiCdd && (
        <div style={{ gridColumn: '1 / -1' }}>
          <InfoCard title={t('patients.employmentData', { defaultValue: 'Données professionnelles' })} icon={<Briefcase size={13} style={{ color: 'var(--ap-600)' }} />}>
            {!editing ? (
              <div style={{ display: 'grid', gridTemplateColumns: cols3, gap: '12px' }}>
                <Field label={t('patients.fieldMatricule',    { defaultValue: 'Matricule' })}      value={dossier.matricule ?? undefined} />
                <Field label={t('patients.fieldFonction',     { defaultValue: 'Fonction' })}       value={emp?.fonction     ?? undefined} />
                <Field label={t('patients.fieldSectionPaie',  { defaultValue: 'Section de paie' })} value={emp?.sectionPaie  ?? undefined} />
                <Field label={t('patients.fieldService',      { defaultValue: 'Service' })}        value={emp?.service      ?? undefined} />
                <Field label={t('patients.fieldDepartement',  { defaultValue: 'Département' })}     value={emp?.departement  ?? undefined} />
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: cols3, gap: '10px' }}>
                <div style={fld}><Label style={lbl}>{t('patients.fieldMatricule',   { defaultValue: 'Matricule' })}</Label><Input {...register('matricule')} style={{ fontSize: '13px', height: 34 }} />{errors.matricule && <p style={err}>{errors.matricule.message}</p>}</div>
                <div style={fld}><Label style={lbl}>{t('patients.fieldFonction',    { defaultValue: 'Fonction' })}</Label><Input {...register('fonction')} style={{ fontSize: '13px', height: 34 }} /></div>
                <div style={fld}><Label style={lbl}>{t('patients.fieldSectionPaie', { defaultValue: 'Section de paie' })}</Label><Input {...register('sectionPaie')} style={{ fontSize: '13px', height: 34 }} /></div>
                <div style={fld}><Label style={lbl}>{t('patients.fieldService',     { defaultValue: 'Service' })}</Label><Input {...register('service')} style={{ fontSize: '13px', height: 34 }} /></div>
                <div style={fld}><Label style={lbl}>{t('patients.fieldDepartement', { defaultValue: 'Département' })}</Label><Input {...register('departement')} style={{ fontSize: '13px', height: 34 }} /></div>
              </div>
            )}
          </InfoCard>
        </div>
      )}

      {/* Carte mode de vie — toutes catégories (recueil) */}
      <div style={{ gridColumn: '1 / -1' }}>
        <ModeVieCard dossier={dossier} canWrite={canWrite} />
      </div>
    </div>
  )
}
