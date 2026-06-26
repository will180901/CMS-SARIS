import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { DatePicker }      from '@/components/saris'
import { zodResolver }    from '@hookform/resolvers/zod'
import { z }              from 'zod'
import { ChevronLeft, ChevronRight, Check, User, Phone, X, UserPlus } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@workspace/ui/components/sheet'
import { Button as SButton }  from '@/components/saris'
import { Input }   from '@workspace/ui/components/input'
import { Label }   from '@workspace/ui/components/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@workspace/ui/components/select'
import { useCreatePatient } from '../hooks/usePatients'
import { useCategoriesPatient, useSites } from '@/modules/referentiels/hooks/useReferentiels'
import { useSousTraitants } from '@/modules/referentiels/hooks/useSousTraitants'
import { useEmployeLookup } from '@/modules/referentiels/hooks/useEmployes'
import { useIsCompact } from '@/hooks/useMediaQuery'
import { useSessionStore }  from '@/stores/session.store'
import { nomPersonne, dateNaissance, telephone, telephoneOpt, texteOpt, todayISO, minBirthISO } from '@/lib/validation'

// ── Schéma ─────────────────────────────────────────────────────────────────────
// Fabrique de schéma : reçoit `t` pour traduire les messages visibles.
// (Jamais de t() au niveau module — les hooks ne tournent que dans un composant.)

function makeStep1Schema(t: (k: string) => string) {
  return z.object({
    nom:               nomPersonne('Nom'),
    prenom:            nomPersonne('Prénom'),
    dateNaissance:     dateNaissance,
    sexe:              z.enum(['M', 'F'], { required_error: t('patients.validationRequired') }),
    categoriePatientId: z.string().uuid(t('patients.validationCategoryRequired')),
    siteCreationId:    z.string().uuid(t('patients.validationSiteRequired')),
    telephone:         telephoneOpt,
    adresse:           texteOpt(200),
    // Données admin pilotées par la catégorie (recueil §5) — exigées conditionnellement
    matricule:         texteOpt(50),
    fonction:          texteOpt(100),
    sectionPaie:       texteOpt(100),
    service:           texteOpt(100),
    departement:       texteOpt(100),
    cdiMatricule:      texteOpt(50),   // ayant droit : matricule du CDI rattaché
    typeLien:          z.string().optional(),
    societeId:         z.string().optional(),
    // Ayant droit : identité du CDI à enregistrer si son matricule est inconnu au registre
    cdiNom:            texteOpt(100),
    cdiPrenom:         texteOpt(100),
    cdiFonction:       texteOpt(100),
    cdiSectionPaie:    texteOpt(100),
    cdiService:        texteOpt(100),
    cdiDepartement:    texteOpt(100),
  })
}

function makeStep2Schema(t: (k: string) => string) {
  return z.object({
    contactNom:        nomPersonne('Nom'),
    contactPrenom:     nomPersonne('Prénom'),
    contactTelephone:  telephone,
    contactLien:       z.string().min(1, t('patients.validationRequired')).max(50),
  })
}

function makeFullSchema(t: (k: string) => string) {
  return makeStep1Schema(t).merge(makeStep2Schema(t))
}
type PatientForm = z.infer<ReturnType<typeof makeFullSchema>>

// ── Styles helpers ─────────────────────────────────────────────────────────────

const field = { display: 'flex', flexDirection: 'column' as const, gap: '6px' }
const err   = { fontSize: '11px', color: 'var(--erreur-texte)', marginTop: '2px' }
const lbl   = { fontSize: '12px', fontWeight: '500', color: 'var(--texte-secondaire)' }

// ── Composant Drawer ──────────────────────────────────────────────────────────

interface Props {
  open:      boolean
  onClose:   () => void
  onCreated: (id: string) => void
}

export function CreerPatientDrawer({ open, onClose, onCreated }: Props) {
  const { t } = useTranslation()
  const [step, setStep] = useState(1)
  const createPatient   = useCreatePatient()
  const siteId                    = useSessionStore(s => s.user?.siteId ?? '')
  const { data: categories = [] } = useCategoriesPatient()
  const { data: sites      = [] } = useSites()
  const { data: societes   = [] } = useSousTraitants()
  const isCompact = useIsCompact()
  // Grille 2-colonnes qui s'empile en 1 colonne sur mobile (shadow du const module).
  const grid2 = { display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1fr 1fr', gap: '14px' }

  const form = useForm<PatientForm>({
    resolver: zodResolver(makeFullSchema(t)),
    defaultValues: { siteCreationId: siteId },
  })
  const { register, control, formState: { errors }, trigger, getValues, setValue, watch, reset } = form

  function handleClose() {
    reset()
    setStep(1)
    onClose()
  }

  async function goNext() {
    const ok = await trigger(['nom', 'prenom', 'dateNaissance', 'sexe', 'categoriePatientId', 'siteCreationId'])
    // Données admin obligatoires selon la catégorie (recueil §5)
    const catOk = validateCategorie()
    if (ok && catOk) setStep(2)
  }

  async function handleSubmit() {
    const ok = await trigger()
    if (!ok) return
    const v = getValues()
    const result = await createPatient.mutateAsync({
      nom:               v.nom.trim(),
      prenom:            v.prenom.trim(),
      dateNaissance:     v.dateNaissance,
      sexe:              v.sexe,
      categoriePatientId: v.categoriePatientId,
      siteCreationId:    v.siteCreationId,
      telephone:         v.telephone?.trim() || undefined,
      adresse:           v.adresse?.trim()   || undefined,
      ...(isCdiCdd ? {
        matricule:   v.matricule?.trim()   || undefined,
        fonction:    v.fonction?.trim()    || undefined,
        sectionPaie: v.sectionPaie?.trim() || undefined,
        service:     v.service?.trim()     || undefined,
        departement: v.departement?.trim() || undefined,
      } : {}),
      ...(isAyantDroit ? {
        fonction:     v.fonction?.trim()     || undefined,
        cdiMatricule: v.cdiMatricule?.trim() || undefined,
        typeLien:     v.typeLien || undefined,
        ...(!employeReconnu ? {
          nouvelEmploye: {
            nom:         v.cdiNom?.trim()         || '',
            prenom:      v.cdiPrenom?.trim()      || '',
            fonction:    v.cdiFonction?.trim()    || undefined,
            sectionPaie: v.cdiSectionPaie?.trim() || undefined,
            service:     v.cdiService?.trim()     || undefined,
            departement: v.cdiDepartement?.trim() || undefined,
          },
        } : {}),
      } : {}),
      ...(isSousTrait ? { societeId: v.societeId || undefined } : {}),
      contactUrgence: {
        nom:       v.contactNom.trim(),
        prenom:    v.contactPrenom.trim(),
        telephone: v.contactTelephone.trim(),
        lien:      v.contactLien,
      },
    })
    onCreated(result.id)
  }

  const sexeVal     = watch('sexe')
  const categVal    = watch('categoriePatientId')
  const siteVal     = watch('siteCreationId')
  const contactLien = watch('contactLien')
  const typeLienVal = watch('typeLien')
  const societeVal  = watch('societeId')

  // Profil de saisie piloté par la CATÉGORIE (recueil §5).
  const selectedCat  = categories.find(c => c.id === categVal)
  const code         = selectedCat?.code
  const isCdiCdd     = code === 'ASSURE_CDI' || code === 'ASSURE_CDD'
  const isAyantDroit = code === 'AYANT_DROIT_CDI'
  const isSousTrait  = code === 'SOUS_TRAITANT'
  const societesActives = societes.filter((s: { statut: string }) => s.statut === 'ACTIVE')

  const LIENS = [
    { value: 'CONJOINT', label: t('patients.lienConjoint', { defaultValue: 'Conjoint(e)' }) },
    { value: 'ENFANT',   label: t('patients.lienEnfant',   { defaultValue: 'Enfant' }) },
    { value: 'PARENT',   label: t('patients.lienParent',   { defaultValue: 'Parent' }) },
    { value: 'AUTRE',    label: t('patients.lienAutre',    { defaultValue: 'Autre' }) },
  ]

  // Reconnaissance dynamique de l'employé par matricule (registre SARIS) — debounce 400 ms.
  const cdiMatVal    = watch('cdiMatricule') ?? ''
  const matVal       = watch('matricule') ?? ''
  const matRecherche = isAyantDroit ? cdiMatVal : isCdiCdd ? matVal : ''
  const [lookupMat, setLookupMat] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setLookupMat(matRecherche.trim()), 400)
    return () => clearTimeout(id)
  }, [matRecherche])
  const { data: employeTrouve, isFetching: lookupLoading } = useEmployeLookup(lookupMat)
  const employeReconnu = !!employeTrouve && employeTrouve.matricule === matRecherche.trim() && matRecherche.trim().length >= 3
  // CDI/CDD reconnu → auto-remplissage des données pro depuis le registre.
  useEffect(() => {
    if (employeReconnu && isCdiCdd && employeTrouve) {
      if (employeTrouve.fonction)    setValue('fonction',    employeTrouve.fonction)
      if (employeTrouve.sectionPaie) setValue('sectionPaie', employeTrouve.sectionPaie)
      if (employeTrouve.service)     setValue('service',     employeTrouve.service)
      if (employeTrouve.departement) setValue('departement', employeTrouve.departement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeReconnu, isCdiCdd, employeTrouve?.id])

  // Validation des données admin EXIGÉES par la catégorie (recueil §5). Renvoie true si OK.
  function validateCategorie(): boolean {
    const v = getValues()
    let ok = true
    const req = (key: keyof PatientForm, cond: boolean) => {
      if (cond && !String(v[key] ?? '').trim()) {
        form.setError(key as any, { message: t('patients.validationRequired') })
        ok = false
      }
    }
    if (isCdiCdd) {
      req('matricule', true); req('fonction', true); req('sectionPaie', true)
      req('service', true);   req('departement', true)
    }
    if (isAyantDroit) {
      req('fonction', true); req('cdiMatricule', true)
      if (!v.typeLien) { form.setError('typeLien' as any, { message: t('patients.validationRequired') }); ok = false }
      // CDI inconnu au registre → identité du travailleur obligatoire pour l'enregistrer.
      if (!employeReconnu) { req('cdiNom', true); req('cdiPrenom', true) }
    }
    if (isSousTrait) {
      if (!v.societeId) { form.setError('societeId' as any, { message: t('patients.validationRequired') }); ok = false }
    }
    return ok
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <SheetContent
        side="right"
        style={{
          width: '480px', maxWidth: '95vw',
          display: 'flex', flexDirection: 'column', padding: 0, gap: 0,
          height: '100vh', maxHeight: '100vh',
          background: 'var(--fond-surface)',
        }}
      >
        {/* ── Hero header ────────────────────────────────────────────────── */}
        <SheetHeader style={{
          position: 'relative',
          padding: 'var(--espace-5) var(--espace-6) var(--espace-4)',
          borderBottom: '1px solid var(--bordure-legere)',
          flexShrink: 0,
          display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 'var(--espace-3)',
          textAlign: 'left',
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 'var(--radius-lg)',
            background: 'var(--ap-50)', color: 'var(--ap-600)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <UserPlus size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 28 }}>
            <SheetTitle style={{
              margin: 0, fontSize: 'var(--font-size-h4)', fontWeight: 700,
              color: 'var(--texte-primaire)', lineHeight: 1.25,
            }}>
              {t('patients.drawerNewPatient')}
            </SheetTitle>
            <SheetDescription style={{
              margin: '3px 0 0', fontSize: 'var(--font-size-caption)',
              color: 'var(--texte-tertiaire)', lineHeight: 1.4,
            }}>
              {step === 1 ? t('patients.drawerStep1Subtitle') : t('patients.drawerStep2Subtitle')}
            </SheetDescription>
          </div>
          <button
            aria-label={t('patients.closePanel')}
            onClick={handleClose}
            style={{
              position: 'absolute', top: 14, right: 14,
              background: 'transparent', border: 'none', padding: 6,
              borderRadius: 'var(--radius-md)', color: 'var(--texte-tertiaire)',
              cursor: 'pointer', transition: 'background 0.12s, color 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--fond-surface-2)'; e.currentTarget.style.color = 'var(--texte-primaire)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--texte-tertiaire)' }}
          >
            <X size={16} />
          </button>
        </SheetHeader>

        {/* Stepper */}
        <div style={{ padding: '16px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
            {[
              { n: 1, label: t('patients.stepIdentity'), icon: <User size={13} /> },
              { n: 2, label: t('patients.stepEmergencyContact'), icon: <Phone size={13} /> },
            ].map((s, i) => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i === 0 ? '0 0 auto' : '1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: step > s.n ? 'var(--ap-500)' : step === s.n ? 'var(--ap-500)' : 'var(--fond-surface-2)',
                    color:      step >= s.n ? '#fff' : 'var(--texte-tertiaire)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: '700', flexShrink: 0,
                    transition: 'background 0.2s',
                  }}>
                    {step > s.n ? <Check size={12} /> : s.n}
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: step === s.n ? '600' : '400', color: step >= s.n ? 'var(--texte-primaire)' : 'var(--texte-tertiaire)', whiteSpace: 'nowrap' }}>
                    {s.label}
                  </span>
                </div>
                {i === 0 && (
                  <div style={{ flex: 1, height: 1, background: step > 1 ? 'var(--ap-300)' : 'var(--bordure-legere)', margin: '0 10px', transition: 'background 0.2s' }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contenu scrollable */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '0 24px' }}>

          {/* ── Étape 1 — Identité ──────────────────────────────────────── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '24px' }}>
              <div style={grid2}>
                <div style={field}>
                  <Label style={lbl}>{t('patients.fieldFirstName')} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
                  <Input {...register('prenom')} placeholder={t('patients.firstNamePlaceholder')} style={{ fontSize: '13px' }} />
                  {errors.prenom && <p style={err}>{errors.prenom.message}</p>}
                </div>
                <div style={field}>
                  <Label style={lbl}>{t('patients.fieldLastName')} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
                  <Input {...register('nom')} placeholder={t('patients.lastNamePlaceholder')} style={{ fontSize: '13px' }} />
                  {errors.nom && <p style={err}>{errors.nom.message}</p>}
                </div>
              </div>

              <div style={grid2}>
                <div style={field}>
                  <Label style={lbl}>{t('patients.fieldBirthDate')} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
                  <Controller
                    control={control}
                    name="dateNaissance"
                    render={({ field: f }) => (
                      <DatePicker
                        value={f.value}
                        onChange={v => f.onChange(v ?? '')}
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
                <div style={field}>
                  <Label style={lbl}>{t('patients.fieldSex')} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                    {(['M', 'F'] as const).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setValue('sexe', s)}
                        style={{
                          flex: 1, height: 36, borderRadius: 6, fontSize: '13px', fontWeight: '500',
                          cursor: 'pointer',
                          background: sexeVal === s ? 'var(--ap-500)' : 'var(--fond-surface-2)',
                          color:      sexeVal === s ? '#fff' : 'var(--texte-secondaire)',
                          border:     sexeVal === s ? '1.5px solid var(--ap-500)' : '1px solid var(--bordure-normale)',
                          transition: 'all 0.15s',
                        }}
                      >
                        {s === 'M' ? t('patients.sexMale') : t('patients.sexFemale')}
                      </button>
                    ))}
                  </div>
                  {errors.sexe && <p style={err}>{errors.sexe.message}</p>}
                </div>
              </div>

              <div style={field}>
                <Label style={lbl}>{t('patients.fieldPatientCategory')} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
                <Select value={categVal} onValueChange={v => setValue('categoriePatientId', v)}>
                  <SelectTrigger style={{ height: 36, fontSize: '13px', border: '1px solid var(--bordure-normale)', background: 'var(--fond-surface)' }}>
                    <SelectValue placeholder={t('patients.selectPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.libelle}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.categoriePatientId && <p style={err}>{errors.categoriePatientId.message}</p>}
              </div>

              <div style={field}>
                <Label style={lbl}>{t('patients.fieldCareSite')} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
                <Select value={siteVal} onValueChange={v => setValue('siteCreationId', v)}>
                  <SelectTrigger style={{ height: 36, fontSize: '13px', border: '1px solid var(--bordure-normale)', background: 'var(--fond-surface)' }}>
                    <SelectValue placeholder={t('patients.selectPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((s: { id: string; libelle: string }) => (
                      <SelectItem key={s.id} value={s.id}>{s.libelle}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.siteCreationId && <p style={err}>{errors.siteCreationId.message}</p>}
              </div>

              <div style={grid2}>
                <div style={field}>
                  <Label style={lbl}>{t('patients.fieldPhone')}</Label>
                  <Input {...register('telephone')} inputMode="tel" maxLength={20} placeholder={t('patients.phonePlaceholder')} style={{ fontSize: '13px' }} />
                  {errors.telephone && <p style={err}>{errors.telephone.message}</p>}
                </div>
                <div style={field}>
                  <Label style={lbl}>{t('patients.fieldAddress')}</Label>
                  <Input {...register('adresse')} maxLength={200} placeholder={t('patients.addressPlaceholder')} style={{ fontSize: '13px' }} />
                  {errors.adresse && <p style={err}>{errors.adresse.message}</p>}
                </div>
              </div>

              {/* Données professionnelles — personnel CDI/CDD (recueil §5, obligatoires) */}
              {isCdiCdd && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid var(--bordure-legere)', paddingTop: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--texte-secondaire)' }}>
                    {t('patients.sectionEmployment', { defaultValue: 'Données professionnelles' })}
                  </div>
                  <div style={grid2}>
                    <div style={field}>
                      <Label style={lbl}>{t('patients.fieldMatriculeCdi', { defaultValue: 'Matricule' })} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
                      <Input {...register('matricule')} maxLength={50} placeholder={t('patients.matriculeCdiPlaceholder', { defaultValue: 'N° matricule employeur' })} style={{ fontSize: '13px' }} />
                      {errors.matricule && <p style={err}>{errors.matricule.message}</p>}
                    </div>
                    <div style={field}>
                      <Label style={lbl}>{t('patients.fieldFonction', { defaultValue: 'Fonction' })} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
                      <Input {...register('fonction')} maxLength={100} style={{ fontSize: '13px' }} />
                      {errors.fonction && <p style={err}>{errors.fonction.message}</p>}
                    </div>
                  </div>
                  <div style={grid2}>
                    <div style={field}>
                      <Label style={lbl}>{t('patients.fieldSectionPaie', { defaultValue: 'Section de paie' })} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
                      <Input {...register('sectionPaie')} maxLength={100} style={{ fontSize: '13px' }} />
                      {errors.sectionPaie && <p style={err}>{errors.sectionPaie.message}</p>}
                    </div>
                    <div style={field}>
                      <Label style={lbl}>{t('patients.fieldService', { defaultValue: 'Service' })} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
                      <Input {...register('service')} maxLength={100} style={{ fontSize: '13px' }} />
                      {errors.service && <p style={err}>{errors.service.message}</p>}
                    </div>
                  </div>
                  <div style={field}>
                    <Label style={lbl}>{t('patients.fieldDepartement', { defaultValue: 'Département' })} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
                    <Input {...register('departement')} maxLength={100} style={{ fontSize: '13px' }} />
                    {errors.departement && <p style={err}>{errors.departement.message}</p>}
                  </div>
                </div>
              )}

              {/* Ayant droit CDI — fonction + rattachement au CDI par matricule (recueil §5) */}
              {isAyantDroit && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid var(--bordure-legere)', paddingTop: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--texte-secondaire)' }}>
                    {t('patients.sectionAyantDroit', { defaultValue: 'Rattachement ayant droit' })}
                  </div>
                  <div style={grid2}>
                    <div style={field}>
                      <Label style={lbl}>{t('patients.fieldCdiMatricule', { defaultValue: 'Matricule du CDI rattaché' })} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
                      <Input {...register('cdiMatricule')} maxLength={50} placeholder={t('patients.cdiMatriculePlaceholder', { defaultValue: 'Matricule du travailleur CDI' })} style={{ fontSize: '13px' }} />
                      {errors.cdiMatricule && <p style={err}>{errors.cdiMatricule.message}</p>}
                      {cdiMatVal.trim().length >= 3 && (
                        lookupLoading
                          ? <p style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', marginTop: 2 }}>{t('employes.checking', { defaultValue: 'Vérification…' })}</p>
                          : employeReconnu
                            ? <p style={{ fontSize: '11px', color: 'var(--succes-texte)', fontWeight: 600, marginTop: 2 }}>✓ {t('employes.recognized', { defaultValue: 'CDI reconnu' })}{employeTrouve ? ` : ${employeTrouve.prenom} ${employeTrouve.nom}` : ''}</p>
                            : <p style={{ fontSize: '11px', color: 'var(--avert-texte)', fontWeight: 600, marginTop: 2 }}>{t('employes.unknown', { defaultValue: 'Matricule inconnu — enregistrez le travailleur ci-dessous' })}</p>
                      )}
                    </div>
                    <div style={field}>
                      <Label style={lbl}>{t('patients.fieldLien', { defaultValue: 'Lien de parenté' })} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
                      <Select value={typeLienVal ?? ''} onValueChange={v => setValue('typeLien', v)}>
                        <SelectTrigger style={{ height: 36, fontSize: '13px', border: '1px solid var(--bordure-normale)', background: 'var(--fond-surface)' }}>
                          <SelectValue placeholder={t('patients.selectPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {LIENS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {(errors as any).typeLien && <p style={err}>{(errors as any).typeLien.message}</p>}
                    </div>
                  </div>
                  <div style={field}>
                    <Label style={lbl}>{t('patients.fieldFonction', { defaultValue: 'Fonction' })} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
                    <Input {...register('fonction')} maxLength={100} style={{ fontSize: '13px' }} />
                    {errors.fonction && <p style={err}>{errors.fonction.message}</p>}
                  </div>

                  {/* CDI inconnu → enregistrement du travailleur au registre (recueil §5) */}
                  {cdiMatVal.trim().length >= 3 && !lookupLoading && !employeReconnu && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '1px dashed var(--bordure-normale)', paddingTop: '14px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ap-700)' }}>
                        {t('employes.registerWorker', { defaultValue: 'Enregistrer le travailleur CDI' })}
                      </div>
                      <div style={grid2}>
                        <div style={field}>
                          <Label style={lbl}>{t('patients.fieldFirstName', { defaultValue: 'Prénom' })} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
                          <Input {...register('cdiPrenom')} maxLength={100} style={{ fontSize: '13px' }} />
                          {(errors as any).cdiPrenom && <p style={err}>{(errors as any).cdiPrenom.message}</p>}
                        </div>
                        <div style={field}>
                          <Label style={lbl}>{t('patients.fieldLastName', { defaultValue: 'Nom' })} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
                          <Input {...register('cdiNom')} maxLength={100} style={{ fontSize: '13px' }} />
                          {(errors as any).cdiNom && <p style={err}>{(errors as any).cdiNom.message}</p>}
                        </div>
                      </div>
                      <div style={grid2}>
                        <div style={field}><Label style={lbl}>{t('patients.fieldFonction', { defaultValue: 'Fonction' })}</Label><Input {...register('cdiFonction')} maxLength={100} style={{ fontSize: '13px' }} /></div>
                        <div style={field}><Label style={lbl}>{t('patients.fieldSectionPaie', { defaultValue: 'Section de paie' })}</Label><Input {...register('cdiSectionPaie')} maxLength={100} style={{ fontSize: '13px' }} /></div>
                        <div style={field}><Label style={lbl}>{t('patients.fieldService', { defaultValue: 'Service' })}</Label><Input {...register('cdiService')} maxLength={100} style={{ fontSize: '13px' }} /></div>
                        <div style={field}><Label style={lbl}>{t('patients.fieldDepartement', { defaultValue: 'Département' })}</Label><Input {...register('cdiDepartement')} maxLength={100} style={{ fontSize: '13px' }} /></div>
                      </div>
                    </div>
                  )}

                  <p style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', margin: 0 }}>
                    {t('patients.ayantDroitHint', { defaultValue: 'Section de paie, service et département sont hérités du CDI rattaché.' })}
                  </p>
                </div>
              )}

              {/* Sous-traitant — société (recueil §5) */}
              {isSousTrait && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid var(--bordure-legere)', paddingTop: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--texte-secondaire)' }}>
                    {t('patients.sectionSousTraitant', { defaultValue: 'Société sous-traitante' })}
                  </div>
                  <div style={field}>
                    <Label style={lbl}>{t('patients.fieldSociete', { defaultValue: 'Société' })} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
                    <Select value={societeVal ?? ''} onValueChange={v => setValue('societeId', v)}>
                      <SelectTrigger style={{ height: 36, fontSize: '13px', border: '1px solid var(--bordure-normale)', background: 'var(--fond-surface)' }}>
                        <SelectValue placeholder={t('patients.selectPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {societesActives.map((s: { id: string; nom: string }) => (
                          <SelectItem key={s.id} value={s.id}>{s.nom}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(errors as any).societeId && <p style={err}>{(errors as any).societeId.message}</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Étape 2 — Contact urgence ────────────────────────────────── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '24px' }}>
              <div style={{ background: 'var(--fond-surface-2)', borderRadius: 8, padding: '12px', fontSize: '12px', color: 'var(--texte-secondaire)' }}>
                {t('patients.emergencyNotice')}
              </div>

              <div style={grid2}>
                <div style={field}>
                  <Label style={lbl}>{t('patients.fieldFirstName')} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
                  <Input {...register('contactPrenom')} placeholder={t('patients.contactFirstNamePlaceholder')} style={{ fontSize: '13px' }} />
                  {errors.contactPrenom && <p style={err}>{errors.contactPrenom.message}</p>}
                </div>
                <div style={field}>
                  <Label style={lbl}>{t('patients.fieldLastName')} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
                  <Input {...register('contactNom')} placeholder={t('patients.contactLastNamePlaceholder')} style={{ fontSize: '13px' }} />
                  {errors.contactNom && <p style={err}>{errors.contactNom.message}</p>}
                </div>
              </div>

              <div style={field}>
                <Label style={lbl}>{t('patients.fieldPhone')} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
                <Input {...register('contactTelephone')} inputMode="tel" maxLength={20} placeholder={t('patients.contactPhonePlaceholder')} style={{ fontSize: '13px' }} />
                {errors.contactTelephone && <p style={err}>{errors.contactTelephone.message}</p>}
              </div>

              <div style={field}>
                <Label style={lbl}>{t('patients.fieldRelationship')} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
                <Select value={contactLien} onValueChange={v => setValue('contactLien', v)}>
                  <SelectTrigger style={{ height: 36, fontSize: '13px', border: '1px solid var(--bordure-normale)', background: 'var(--fond-surface)' }}>
                    <SelectValue placeholder={t('patients.selectPlaceholder')} />
                  </SelectTrigger>
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
        </div>

        {/* Footer navigation */}
        <div style={{
          padding: 'var(--espace-3) var(--espace-6)',
          borderTop: '1px solid var(--bordure-legere)',
          background: 'var(--fond-surface)',
          display: 'flex', justifyContent: 'space-between', flexShrink: 0,
        }}>
          {step === 1 ? (
            <SButton variant="secondary" size="sm" onClick={handleClose}>{t('common.cancel')}</SButton>
          ) : (
            <SButton variant="secondary" size="sm" leftIcon={<ChevronLeft size={14} />} onClick={() => setStep(1)}>
              {t('patients.btnBack')}
            </SButton>
          )}

          {step === 1 ? (
            <SButton variant="primary" size="sm" onClick={goNext}>
              {t('patients.btnNext')} <ChevronRight size={14} style={{ marginLeft: 4 }} />
            </SButton>
          ) : (
            <SButton
              variant="primary" size="sm"
              leftIcon={<Check size={14} />}
              loading={createPatient.isPending}
              disabled={createPatient.isPending}
              onClick={handleSubmit}
              style={{ minWidth: 140 }}
            >
              {t('patients.btnCreateRecord')}
            </SButton>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
