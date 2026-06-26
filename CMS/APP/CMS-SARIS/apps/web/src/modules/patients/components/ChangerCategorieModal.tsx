import { useForm }           from 'react-hook-form'
import { zodResolver }       from '@hookform/resolvers/zod'
import { z }                 from 'zod'
import { useTranslation }    from 'react-i18next'
import { ArrowRight, ArrowRightLeft, AlertCircle, Check } from 'lucide-react'
import { Label }             from '@workspace/ui/components/label'
import { Button }            from '@workspace/ui/components/button'
import { Modal }             from '@/components/saris'
import { useCategoriesPatient } from '@/modules/referentiels/hooks/useReferentiels'
import { CategorieBadge, getCategConfig } from './CategorieBadge'
import { useChangerCategorie } from '../hooks/usePatients'
import type { PatientDossier } from '@cms-saris/types'

// ── Schéma ────────────────────────────────────────────────────────────────────
// Fabrique de schéma : reçoit `t` pour traduire les messages visibles.
// (Jamais de t() au niveau module — les hooks ne tournent que dans un composant.)

function makeSchema(t: (k: string) => string) {
  return z.object({
    nouvelleCategId: z.string().uuid(t('patients.validationSelectCategory')),
    motif:           z.string().trim().min(5, t('patients.validationReasonRequired')).max(300, t('patients.validationMax300')),
  })
}
type Form = z.infer<ReturnType<typeof makeSchema>>

// ── Carte catégorie sélectionnable ────────────────────────────────────────────

function CategCard({
  code, libelle, selected, onClick, disabled,
}: {
  id:       string
  code:     string
  libelle:  string
  selected: boolean
  onClick:  () => void
  disabled: boolean
}) {
  const cfg = getCategConfig(code)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display:       'flex',
        alignItems:    'center',
        gap:           '10px',
        padding:       '10px 12px',
        borderRadius:  8,
        border:        selected ? `2px solid ${cfg.border}` : '1.5px solid var(--bordure-legere)',
        background:    selected ? cfg.bg : 'var(--fond-surface)',
        cursor:        disabled ? 'not-allowed' : 'pointer',
        opacity:       disabled ? 0.45 : 1,
        textAlign:     'left',
        transition:    'all 0.12s',
        width:         '100%',
      }}
    >
      {/* Pastille couleur */}
      <div style={{
        width: 10, height: 10, borderRadius: 5,
        background: cfg.text, flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '13px', fontWeight: selected ? '700' : '500', color: selected ? cfg.text : 'var(--texte-primaire)', margin: 0 }}>
          {libelle}
        </p>
      </div>
      {selected && (
        <div style={{
          width: 18, height: 18, borderRadius: 9,
          background: cfg.text, display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Check size={10} style={{ color: '#fff' }} />
        </div>
      )}
    </button>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function ChangerCategorieModal({
  open,
  onClose,
  dossier,
}: {
  open:    boolean
  onClose: () => void
  dossier: PatientDossier
}) {
  const { t } = useTranslation()
  const { data: categories = [] } = useCategoriesPatient()
  const changer = useChangerCategorie(dossier.id)

  const form = useForm<Form>({
    resolver: zodResolver(makeSchema(t)),
    defaultValues: { nouvelleCategId: '', motif: '' },
  })
  const { register, watch, setValue, reset, formState: { errors } } = form

  const selectedId   = watch('nouvelleCategId')
  const selectedCateg = categories.find(c => c.id === selectedId)

  async function handleSave() {
    const ok = await form.trigger()
    if (!ok) return
    await changer.mutateAsync(form.getValues())
    reset()
    onClose()
  }

  function handleClose() {
    if (changer.isPending) return
    reset()
    onClose()
  }

  if (!open) return null

  const currentCode    = dossier.categoriePatient.code
  const currentLibelle = dossier.categoriePatient.libelle
  const activeCategs   = categories.filter(c => c.statut === 'ACTIVE')
  const lbl            = { fontSize: '11px', fontWeight: '500' as const, color: 'var(--texte-secondaire)' }
  const fld            = { display: 'flex', flexDirection: 'column' as const, gap: '5px' }

  return (
    <Modal
      icon={<ArrowRightLeft size={17} />}
      title={t('patients.changeCategoryTitle')}
      subtitle={t('patients.changeCategorySubtitle')}
      width={520}
      onClose={handleClose}
      footer={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={changer.isPending}
            style={{ fontSize: '13px', height: 34 }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={changer.isPending || !selectedId}
            style={{ fontSize: '13px', height: 34, gap: '5px' }}
          >
            <Check size={13} />
            {changer.isPending ? t('patients.saving') : t('patients.confirmChange')}
          </Button>
        </>
      }
    >
      <div>

          {/* Transition visuelle */}
          <div style={{
            display:      'flex',
            alignItems:   'center',
            gap:          '10px',
            padding:      '12px 14px',
            background:   'var(--fond-surface-2)',
            borderRadius: 8,
            marginBottom: '20px',
            flexWrap:     'wrap',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span style={{ fontSize: '10px', color: 'var(--texte-tertiaire)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('patients.categoryCurrent')}</span>
              <CategorieBadge code={currentCode} libelle={currentLibelle} />
            </div>
            <ArrowRight size={16} style={{ color: 'var(--texte-tertiaire)', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span style={{ fontSize: '10px', color: 'var(--texte-tertiaire)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('patients.categoryNew')}</span>
              {selectedCateg ? (
                <CategorieBadge code={selectedCateg.code} libelle={selectedCateg.libelle} />
              ) : (
                <span style={{ fontSize: '12px', color: 'var(--texte-tertiaire)', fontStyle: 'italic' }}>
                  {t('patients.categoryNotSelected')}
                </span>
              )}
            </div>
          </div>

          {/* Grille de sélection */}
          <div style={fld}>
            <Label style={lbl}>{t('patients.newCategoryLabel')}</Label>
            {errors.nouvelleCategId && (
              <p style={{ fontSize: '11px', color: 'var(--erreur-texte)', margin: '2px 0 0' }}>{errors.nouvelleCategId.message}</p>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: '6px', marginTop: '4px' }}>
              {activeCategs.map(c => (
                <CategCard
                  key={c.id}
                  id={c.id}
                  code={c.code}
                  libelle={c.libelle}
                  selected={selectedId === c.id}
                  disabled={c.code === currentCode}
                  onClick={() => setValue('nouvelleCategId', c.id, { shouldValidate: true })}
                />
              ))}
            </div>
          </div>

          {/* Avertissement impact */}
          {selectedCateg && selectedCateg.code !== currentCode && (
            <div style={{
              display:      'flex',
              gap:          '10px',
              padding:      '10px 12px',
              background:   'var(--avert-fond)',
              border:       '1px solid var(--avert-bordure)',
              borderRadius: 'var(--radius-md)',
              marginTop:    '16px',
            }}>
              <AlertCircle size={14} style={{ color: 'var(--avert-accent)', flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: '12px', color: 'var(--avert-texte)', margin: 0, lineHeight: 1.5 }}>
                {t('patients.changeImpactNotice')}
              </p>
            </div>
          )}

          {/* Motif */}
          <div style={{ ...fld, marginTop: '16px' }}>
            <Label style={lbl}>{t('patients.changeReasonLabel')}</Label>
            <textarea
              {...register('motif')}
              placeholder={t('patients.changeReasonPlaceholder')}
              rows={3}
              style={{
                fontSize:   '13px',
                padding:    '8px 10px',
                borderRadius: 6,
                border:     `1px solid ${errors.motif ? 'var(--erreur-texte)' : 'var(--bordure-normale)'}`,
                background: 'var(--fond-surface)',
                color:      'var(--texte-primaire)',
                resize:     'vertical',
                fontFamily: 'inherit',
                lineHeight: '1.5',
              }}
            />
            {errors.motif && (
              <p style={{ fontSize: '11px', color: 'var(--erreur-texte)' }}>{errors.motif.message}</p>
            )}
          </div>
      </div>
    </Modal>
  )
}
