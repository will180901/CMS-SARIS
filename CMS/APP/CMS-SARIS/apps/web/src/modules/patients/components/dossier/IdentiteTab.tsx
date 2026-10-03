import { useState }         from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useTranslation }    from 'react-i18next'
import { DatePicker, Button } from '@/components/saris'
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
import { usePermissions } from '@/hooks/usePermissions'
import { useIsCompact } from '@/hooks/useMediaQuery'
import type { PatientDossier } from '@cms-saris/types'
import { nomPersonne, dateNaissance as dateNaissanceSchema, telephone, telephoneOpt, texteOpt, todayISO, minBirthISO } from '@/lib/validation'
import { formatDate } from '@/lib/intl'

// Fabrique de schéma : reçoit `t` pour traduire les messages visibles.
//
// Contact d'urgence FACULTATIF EN BLOC : entièrement vide = pas de contact ; dès qu'un
// champ est rempli, tous sont exigés. Avant, il était obligatoire : un dossier créé sans
// contact (dossier CDI ouvert à l'enregistrement d'un ayant droit) ne pouvait plus être
// corrigé — on devait inventer un contact pour simplement rectifier une date. Un contact
// DÉJÀ enregistré reste complet (pas de suppression silencieuse par champs vidés).
function makeSchema(t: (k: string) => string, contactExiste: boolean) {
  const contact: [keyof Form, z.ZodTypeAny][] = [
    ['contactNom', nomPersonne('Nom')],
    ['contactPrenom', nomPersonne('Prénom')],
    ['contactTel', telephone],
    ['contactLien', z.string().min(1, t('patients.validationRequired')).max(50)],
  ]
  return z.object({
    nom:           nomPersonne('Nom'),
    prenom:        nomPersonne('Prénom'),
    dateNaissance: dateNaissanceSchema,
    // Aucun sexe présélectionné : un sexe inconnu restait affiché « M » et s'enregistrait
    // tel quel au premier « Modifier » (dossier CDI auto-créé, sexe vide).
    sexe:          z.string().refine(v => v === 'M' || v === 'F', t('patients.validationSexRequired')),
    telephone:     telephoneOpt,
    adresse:       texteOpt(200),
    matricule:     texteOpt(50),
    fonction:      texteOpt(100),
    sectionPaie:   texteOpt(100),
    service:       texteOpt(100),
    departement:   texteOpt(100),
    contactNom:    z.string(),
    contactPrenom: z.string(),
    contactTel:    z.string(),
    contactLien:   z.string(),
  }).superRefine((v, ctx) => {
    const rempli = [v.contactNom, v.contactPrenom, v.contactTel, v.contactLien].some(x => x.trim() !== '')
    if (!rempli && !contactExiste) return
    for (const [champ, regle] of contact) {
      const r = regle.safeParse(v[champ] ?? '')
      if (!r.success) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [champ], message: r.error.issues[0]?.message ?? '' })
    }
  })
}
type Form = {
  nom: string; prenom: string; dateNaissance: string; sexe: string
  telephone?: string; adresse?: string
  matricule?: string; fonction?: string; sectionPaie?: string; service?: string; departement?: string
  contactNom: string; contactPrenom: string; contactTel: string; contactLien: string
}

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
  const { has } = usePermissions()
  const canViewClinique = has('consultation.read')
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
  // Ayant droit : son occupation, obligatoire à l'accueil, n'était réaffichée nulle part.
  const isAyantDroit = code === 'AYANT_DROIT_CDI'

  // Valeurs du dossier TEL QU'IL EST MAINTENANT. Avant, le formulaire gardait celles du
  // premier affichage : après une modification puis « Annuler », il réaffichait l'ancien
  // téléphone — et l'enregistrement suivant le rétablissait sans prévenir.
  const valeursDossier = (): Form => ({
    nom:           id?.nom           ?? '',
    prenom:        id?.prenom        ?? '',
    dateNaissance: toInputDate(id?.dateNaissance ?? ''),
    sexe:          id?.sexe === 'M' || id?.sexe === 'F' ? id.sexe : '',
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
  })
  const form = useForm<Form>({
    resolver: zodResolver(makeSchema(t, !!cu)),
    defaultValues: valeursDossier(),
  })
  const { register, control, formState: { errors }, watch, setValue, reset } = form

  function handleEdit() { reset(valeursDossier()); setEditing(true) }
  function handleCancel() { reset(valeursDossier()); setEditing(false) }

  async function handleSave() {
    const ok = await form.trigger()
    if (!ok) return
    const v = form.getValues()
    await update.mutateAsync({
      nom: v.nom.trim(), prenom: v.prenom.trim(),
      dateNaissance: v.dateNaissance,
      sexe: v.sexe as 'M' | 'F',
      // Chaîne vide ENVOYÉE (et non omise) : c'est elle qui efface. Omise, l'ancienne
      // valeur restait en base — l'ancien numéro revenait, et serait appelé en urgence.
      telephone: v.telephone?.trim() ?? '',
      adresse:   v.adresse?.trim()   ?? '',
      ...(isCdiCdd ? {
        matricule:   v.matricule?.trim()   ?? '',
        fonction:    v.fonction?.trim()    ?? '',
        sectionPaie: v.sectionPaie?.trim() ?? '',
        service:     v.service?.trim()     ?? '',
        departement: v.departement?.trim() ?? '',
      } : isAyantDroit ? {
        fonction:    v.fonction?.trim()    ?? '',
      } : {}),
      ...([v.contactNom, v.contactPrenom, v.contactTel, v.contactLien].some(x => x.trim() !== '')
        ? { contactUrgence: { nom: v.contactNom.trim(), prenom: v.contactPrenom.trim(), telephone: v.contactTel.trim(), lien: v.contactLien } }
        : {}),
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
          <button onClick={handleEdit} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--ap-600)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}>
            <Pencil size={11} /> {t('patients.edit')}
          </button>
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
                    <button key={s} type="button" onClick={() => setValue('sexe', s, { shouldValidate: true })} style={{ flex: 1, height: 34, borderRadius: 6, fontSize: '12px', cursor: 'pointer', background: sexeVal === s ? 'var(--ap-500)' : 'var(--fond-surface-2)', color: sexeVal === s ? '#fff' : 'var(--texte-secondaire)', border: sexeVal === s ? 'none' : `1px solid ${errors.sexe ? 'var(--erreur-accent)' : 'var(--bordure-normale)'}` }}>
                      {s === 'M' ? 'M' : 'F'}
                    </button>
                  ))}
                </div>
                {errors.sexe && <p style={err}>{errors.sexe.message}</p>}
              </div>
            </div>
            <div style={fld}><Label style={lbl}>{t('patients.labelPhone')}</Label><Input {...register('telephone')} style={{ fontSize: '13px', height: 34 }} />{errors.telephone && <p style={err}>{errors.telephone.message}</p>}</div>
            <div style={fld}><Label style={lbl}>{t('patients.labelAddress')}</Label><Input {...register('adresse')} style={{ fontSize: '13px', height: 34 }} />{errors.adresse && <p style={err}>{errors.adresse.message}</p>}</div>
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
            {!cu && (
              <p style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', margin: 0, lineHeight: 1.45 }}>
                {t('patients.emergencyContactOptionalHint')}
              </p>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: '10px' }}>
              <div style={fld}><Label style={lbl}>{t('patients.fieldFirstNameReq')}</Label><Input {...register('contactPrenom')} style={{ fontSize: '13px', height: 34 }} />{errors.contactPrenom && <p style={err}>{errors.contactPrenom.message}</p>}</div>
              <div style={fld}><Label style={lbl}>{t('patients.fieldLastNameReq')}</Label><Input {...register('contactNom')} style={{ fontSize: '13px', height: 34 }} />{errors.contactNom && <p style={err}>{errors.contactNom.message}</p>}</div>
            </div>
            <div style={fld}><Label style={lbl}>{t('patients.fieldPhoneReq')}</Label><Input {...register('contactTel')} style={{ fontSize: '13px', height: 34 }} />{errors.contactTel && <p style={err}>{errors.contactTel.message}</p>}</div>
            <div style={fld}>
              <Label style={lbl}>{t('patients.fieldRelationshipReq')}</Label>
              <Select value={lienVal} onValueChange={v => setValue('contactLien', v, { shouldValidate: true })}>
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
              {errors.contactLien && <p style={err}>{errors.contactLien.message}</p>}
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

      {/* Ayant droit : son occupation (saisie à l'accueil) */}
      {isAyantDroit && (
        <div style={{ gridColumn: '1 / -1' }}>
          <InfoCard title={t('patients.situationAyantDroit')} icon={<Briefcase size={13} style={{ color: 'var(--ap-600)' }} />}>
            {!editing ? (
              <div style={{ display: 'grid', gridTemplateColumns: cols3, gap: '12px' }}>
                <Field label={t('patients.fieldOccupation')} value={emp?.fonction ?? undefined} />
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: cols3, gap: '10px' }}>
                <div style={fld}><Label style={lbl}>{t('patients.fieldOccupation')}</Label><Input {...register('fonction')} maxLength={100} placeholder={t('patients.occupationPlaceholder')} style={{ fontSize: '13px', height: 34 }} /></div>
              </div>
            )}
          </InfoCard>
        </div>
      )}

      {/* Une seule barre d'actions, SOUS les cartes qu'elle enregistre (constat 46) :
          avant, un petit bouton en haut de la première carte enregistrait aussi le
          contact d'urgence et les données professionnelles, sans le dire. */}
      {editing && (
        <div style={{
          gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          padding: '10px 14px', borderRadius: 10,
          background: 'var(--fond-surface)', border: '1px solid var(--bordure-normale)',
          // Collée en bas de la zone qui défile : visible sans avoir à la chercher.
          position: 'sticky', bottom: 8, zIndex: 2, boxShadow: 'var(--ombre-2)',
        }}>
          <span style={{ marginRight: 'auto', fontSize: 12, color: 'var(--texte-secondaire)', lineHeight: 1.4 }}>
            {isCdiCdd ? t('patients.identiteSaveHintCdi') : isAyantDroit ? t('patients.identiteSaveHintAd') : t('patients.identiteSaveHint')}
          </span>
          <Button variant="secondary" leftIcon={<X size={14} />} onClick={handleCancel} disabled={update.isPending}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" leftIcon={<Check size={14} />} loading={update.isPending} onClick={handleSave}>
            {t('patients.identiteSaveAll')}
          </Button>
        </div>
      )}

      {/* Carte mode de vie — toutes catégories (recueil) */}
      <div style={{ gridColumn: '1 / -1' }}>
        {/* Mode de vie = donnée clinique : réservé aux profils à lecture clinique (le
            serveur ne l'envoie pas aux autres — l'afficher « Non renseigné » serait faux). */}
        {canViewClinique && <ModeVieCard dossier={dossier} canWrite={canWrite} />}
      </div>
    </div>
  )
}
