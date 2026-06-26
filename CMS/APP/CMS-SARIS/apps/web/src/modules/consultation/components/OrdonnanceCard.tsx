/**
 * OrdonnanceCard — Gestion des ordonnances dans une consultation.
 *
 * Création PARESSEUSE : tant qu'aucun médicament n'est ajouté, AUCUNE ordonnance
 * n'est persistée. L'ordonnance est créée au moment de l'ajout de la 1ʳᵉ ligne
 * (plus de brouillon vide à annuler). Le formulaire d'ajout (`LigneAddForm`) est
 * partagé entre la création paresseuse et l'ajout de lignes au brouillon existant.
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useIsCompact } from '@/hooks/useMediaQuery'
import { Pill, Plus, X, CheckCircle2, ShieldCheck, Loader2, Printer, Trash2, Ban, AlertTriangle } from 'lucide-react'
import {
  useAddLigne, useRemoveLigne, useValiderOrdonnance,
  useAnnulerOrdonnance, useDeleteOrdonnance, useCreateOrdonnanceAvecLigne,
} from '../hooks/useConsultation'
import { useMedicaments, useCreateMedicament } from '@/modules/referentiels/hooks/useReferentiels'
import { usePermissions } from '@/hooks/usePermissions'
import { SelectBox, Card, Modal, Button } from '@/components/saris'
import { Popover, PopoverAnchor, PopoverContent } from '@workspace/ui/components/popover'
import type { OrdonnanceDetail, LigneOrdonnanceDetail, ConsultationDetail } from '@cms-saris/types'
import type { AddLignePayload } from '../api/consultation.api'
import { ApiError } from '@/lib/api'
import { normaliser } from '@/lib/text'

// ── Config voies d'administration ─────────────────────────────────────────────
const VOIES = ['PO (oral)', 'IV (intraveineux)', 'IM (intramusculaire)', 'SC (sous-cutané)', 'Topique', 'Inhalation', 'Suppositoire']
const VOIE_KEYS = ['routePO', 'routeIV', 'routeIM', 'routeSC', 'routeTopique', 'routeInhalation', 'routeSuppositoire'] as const

type MedRef = { id: string; nomGenerique: string; nomCommercial?: string | null; statut: string }

// ── Composant ─────────────────────────────────────────────────────────────────

interface Props {
  consultationId: string
  consultation:   ConsultationDetail
  ordonnances:    OrdonnanceDetail[]
  readonly?:      boolean
  /** Ouvre l'aperçu imprimable — rendu HORS de la Card par le parent (pleine zone). */
  onPreview?:     (ordId: string) => void
}

export function OrdonnanceCard({ consultationId, consultation, ordonnances, readonly, onPreview }: Props) {
  const { t } = useTranslation()
  const { data: medicaments = [] } = useMedicaments()
  const createAvecLigne = useCreateOrdonnanceAvecLigne(consultationId)

  const brouillon = ordonnances.find(o => o.statut === 'BROUILLON') ?? null
  const validees  = ordonnances.filter(o => o.statut === 'VALIDEE')

  return (
    <Card padding="none">
      {/* Header (pas de bouton « créer » : l'ordonnance naît de sa 1ʳᵉ ligne) */}
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid var(--bordure-legere)',
        background: 'var(--fond-surface-2)', display: 'flex', alignItems: 'center', gap: 7,
      }}>
        <Pill size={14} style={{ color: 'var(--ap-600)' }} />
        <p style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--texte-tertiaire)', margin: 0 }}>
          {t('consultation.prescriptionTitle')}
        </p>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Ordonnances validées */}
        {validees.map(ord => (
          <OrdonnanceBlock key={ord.id} ord={ord} consultationId={consultationId} consultation={consultation} canCancel={!readonly} onPreview={onPreview} readonly />
        ))}

        {/* Brouillon courant (s'il existe déjà) */}
        {brouillon && (
          <OrdonnanceBlock ord={brouillon} consultationId={consultationId} consultation={consultation} medicaments={medicaments} readonly={readonly} onPreview={onPreview} />
        )}

        {/* Pas de brouillon → formulaire direct : l'ordonnance se crée à la 1ʳᵉ ligne */}
        {!brouillon && !readonly && (
          <div style={{ border: '1.5px dashed var(--ap-200)', borderRadius: 8, padding: '12px', background: 'var(--ap-50)' }}>
            <p style={{ fontSize: '12px', color: 'var(--texte-secondaire)', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Pill size={13} style={{ color: 'var(--ap-600)' }} />
              {t('consultation.startPrescriptionHint')}
            </p>
            <LigneAddFormWithGuard
              medicaments={medicaments}
              busy={createAvecLigne.isPending}
              submit={createAvecLigne.mutateAsync}
            />
          </div>
        )}

        {/* État vide en lecture seule */}
        {ordonnances.length === 0 && readonly && (
          <p style={{ fontSize: '12px', color: 'var(--texte-tertiaire)', margin: 0, fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>
            {t('consultation.noPrescription')}
          </p>
        )}
      </div>
    </Card>
  )
}

// ── Bloc ordonnance (validée ou brouillon) ────────────────────────────────────

interface BlockProps {
  ord:            OrdonnanceDetail
  consultationId: string
  consultation:   ConsultationDetail
  medicaments?:   MedRef[]
  readonly?:      boolean
  canCancel?:     boolean
  onPreview?:     (ordId: string) => void
}

function OrdonnanceBlock({ ord, consultationId, medicaments = [], readonly, canCancel, onPreview }: BlockProps) {
  const { t } = useTranslation()
  const [confirmCancel, setConfirmCancel] = useState(false)

  const addLigne    = useAddLigne(consultationId, ord.id)
  const removeLigne = useRemoveLigne(consultationId, ord.id)
  const valider     = useValiderOrdonnance(consultationId, ord.id)
  const annuler     = useAnnulerOrdonnance(consultationId, ord.id)
  const supprimer   = useDeleteOrdonnance(consultationId, ord.id)
  const { has } = usePermissions()
  const canCancelOrd = !!canCancel && has('ordonnance.cancel')
  const canValidate  = has('ordonnance.validate')   // valider ≠ créer (gardes serveur distinctes)

  const isDraft = ord.statut === 'BROUILLON'
  const isValid = ord.statut === 'VALIDEE'

  return (
    <div style={{ border: `1.5px solid ${isValid ? 'var(--succes-bordure)' : 'var(--ap-200)'}`, borderRadius: 8, overflow: 'hidden' }}>
      {/* Header ordonnance */}
      <div style={{ padding: '7px 12px', background: isValid ? 'var(--succes-fond)' : 'var(--ap-50)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isValid ? <ShieldCheck size={13} style={{ color: 'var(--succes-accent)' }} /> : <Pill size={13} style={{ color: 'var(--ap-600)' }} />}
          <span style={{ fontSize: '12px', fontWeight: '600', color: isValid ? 'var(--succes-texte)' : 'var(--ap-700)' }}>
            {isValid ? t('consultation.prescriptionValidated') : t('consultation.prescriptionDraft')}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {isValid && (
            <button onClick={() => onPreview?.(ord.id)} style={miniBtn('var(--ap-700)', 'var(--bordure-normale)')}>
              <Printer size={11} /> {t('consultation.previewPrint')}
            </button>
          )}
          {isValid && canCancelOrd && (
            <button onClick={() => setConfirmCancel(true)} disabled={annuler.isPending} title={t('consultation.cancelValidatedTooltip')} style={miniBtn('var(--erreur-accent)', 'var(--erreur-bordure)')}>
              {annuler.isPending ? <Loader2 size={11} className="animate-spin" /> : <Ban size={11} />} {t('consultation.cancel')}
            </button>
          )}
          {isDraft && !readonly && (
            <button onClick={() => supprimer.mutate()} disabled={supprimer.isPending} title={t('consultation.deleteDraftTooltip')} style={miniBtn('var(--erreur-accent)', 'var(--erreur-bordure)')}>
              {supprimer.isPending ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />} {t('consultation.delete')}
            </button>
          )}
          {isDraft && !readonly && canValidate && (
            <button onClick={() => valider.mutate()} disabled={valider.isPending || ord.lignes.length === 0}
              style={{ ...miniBtn('var(--succes-accent)', 'var(--succes-bordure)'), cursor: ord.lignes.length === 0 ? 'not-allowed' : 'pointer', opacity: ord.lignes.length === 0 ? 0.5 : 1 }}>
              {valider.isPending ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} {t('consultation.validate')}
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Liste à puces des médicaments */}
        <div style={{
          minHeight: 56, borderRadius: 8, border: '1px solid var(--bordure-legere)', background: 'var(--fond-surface-2)',
          padding: ord.lignes.length === 0 ? 0 : '6px 4px', display: 'flex', flexDirection: 'column',
          justifyContent: ord.lignes.length === 0 ? 'center' : 'flex-start',
        }}>
          {ord.lignes.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--texte-tertiaire)', margin: 0, fontStyle: 'italic', textAlign: 'center' }}>
              {isDraft && !readonly ? t('consultation.noMedicationAddBelow') : t('consultation.noMedication')}
            </p>
          ) : (
            ord.lignes.map(ligne => (
              <LigneRow key={ligne.id} ligne={ligne} onRemove={(!readonly && isDraft) ? () => removeLigne.mutate(ligne.id) : undefined} />
            ))
          )}
        </div>


        {confirmCancel && (
          <Modal
            icon={<Ban size={18} style={{ color: 'var(--erreur-accent)' }} />}
            title={t('consultation.cancelPrescriptionTitle')}
            subtitle={t('consultation.cancelPrescriptionSubtitle')}
            width={440}
            onClose={() => setConfirmCancel(false)}
            footer={<>
              <Button variant="ghost" onClick={() => setConfirmCancel(false)}>{t('consultation.goBack')}</Button>
              <Button variant="danger" loading={annuler.isPending} onClick={() => annuler.mutate(undefined, { onSuccess: () => setConfirmCancel(false) })}>
                {t('consultation.cancelPrescriptionConfirm')}
              </Button>
            </>}
          >
            <p style={{ fontSize: 13, color: 'var(--texte-secondaire)', margin: 0, lineHeight: 1.5 }}>{t('consultation.cancelPrescriptionBody')}</p>
          </Modal>
        )}

        {/* Ajout de lignes au brouillon existant */}
        {isDraft && !readonly && (
          <LigneAddFormWithGuard medicaments={medicaments} busy={addLigne.isPending} submit={addLigne.mutateAsync} />
        )}
      </div>
    </div>
  )
}

// ── Formulaire d'ajout de ligne (partagé) ─────────────────────────────────────

function LigneAddForm({ medicaments, busy, onSubmit }: {
  medicaments: MedRef[]
  busy?:       boolean
  onSubmit:    (payload: AddLignePayload) => Promise<void>
}) {
  const { t } = useTranslation()
  const isCompact = useIsCompact()
  const [medInput, setMedInput]       = useState('')
  const [medSelected, setMedSelected] = useState<string | null>(null)
  const [focus, setFocus]             = useState(false)
  const [posologie, setPosologie]     = useState('')
  const [duree, setDuree]             = useState('')
  const [voie, setVoie]               = useState('PO (oral)')
  const [instructions, setInstructions] = useState('')
  const createMedicament = useCreateMedicament()
  const { has } = usePermissions()
  const canCreateMed = has('referentiel.medicament.create')
  const localBusy = !!busy || createMedicament.isPending

  const suggestions = useMemo(() => {
    const q = normaliser(medInput)
    if (q.length < 2) return []
    return medicaments
      .filter(m => m.statut === 'ACTIF')
      .filter(m => normaliser(m.nomGenerique).includes(q) || normaliser(m.nomCommercial ?? '').includes(q))
      .slice(0, 6)
  }, [medInput, medicaments])

  const peutAjouter = medInput.trim().length >= 2 && posologie.trim() !== '' && duree.trim() !== '' && !localBusy

  function reset() {
    setMedInput(''); setMedSelected(null); setPosologie(''); setDuree(''); setVoie('PO (oral)'); setInstructions('')
  }

  async function submitWith(medicamentId: string) {
    await onSubmit({
      medicamentId,
      posologie:    posologie.trim(),
      duree:        duree.trim(),
      voieAdmin:    voie,
      instructions: instructions.trim() || undefined,
    })
    reset()
  }

  async function ajouter() {
    if (!peutAjouter) return
    if (medSelected) { await submitWith(medSelected); return }
    const n = normaliser(medInput)
    const exact = medicaments.find(m => m.statut === 'ACTIF' && normaliser(m.nomGenerique) === n)
    if (exact) { await submitWith(exact.id); return }
    if (!canCreateMed) return
    const newMed = await createMedicament.mutateAsync({ nomGenerique: medInput.trim() })
    await submitWith(newMed.id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Médicament — autocomplétion libre */}
      <Popover open={focus && suggestions.length > 0} onOpenChange={o => { if (!o) setFocus(false) }}>
        <PopoverAnchor asChild>
          <input
            value={medInput}
            maxLength={150}
            onChange={e => { setMedInput(e.target.value); setMedSelected(null) }}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 120)}
            placeholder={t('consultation.medicationPlaceholder')}
            aria-label={t('consultation.medicationPlaceholder')}
            style={{
              width: '100%', height: 34, padding: '0 12px', fontSize: '13px', borderRadius: 8,
              boxSizing: 'border-box', outline: 'none', border: '1px solid var(--bordure-normale)',
              background: 'var(--fond-surface)', color: 'var(--texte-primaire)',
            }}
          />
        </PopoverAnchor>
        <PopoverContent
          align="start" sideOffset={6}
          onOpenAutoFocus={e => e.preventDefault()}
          onCloseAutoFocus={e => e.preventDefault()}
          style={{ width: 'var(--radix-popover-trigger-width)', maxWidth: 'none', padding: 0, maxHeight: 220, overflowY: 'auto', borderRadius: 8, background: 'var(--fond-surface)', border: '1px solid var(--bordure-normale)' }}
        >
          {suggestions.map(m => (
            <button
              key={m.id}
              onMouseDown={e => { e.preventDefault(); setMedSelected(m.id); setMedInput(m.nomGenerique); setFocus(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', textAlign: 'left', cursor: 'pointer', background: 'transparent', border: 'none', borderBottom: '1px solid var(--bordure-legere)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--ap-50)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ flex: 1, fontSize: '13px', color: 'var(--texte-primaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nomGenerique}</span>
              {m.nomCommercial && <span style={{ fontSize: '10px', color: 'var(--texte-tertiaire)', flexShrink: 0 }}>{m.nomCommercial}</span>}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Posologie · durée */}
      <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1fr 1fr', gap: 8 }}>
        <FormField label={t('consultation.dosageLabel')} value={posologie} onChange={setPosologie} placeholder={t('consultation.dosagePlaceholder')} maxLength={500} />
        <FormField label={t('consultation.durationLabel')} value={duree} onChange={setDuree} placeholder={t('consultation.durationPlaceholder')} maxLength={200} />
      </div>

      {/* Voie + bouton ajouter */}
      <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1fr auto', gap: 8, alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--texte-secondaire)', display: 'block', marginBottom: 3 }}>
            {t('consultation.routeLabel')}
          </label>
          <SelectBox size="sm" value={voie} onChange={setVoie} options={VOIES.map((v, i) => ({ value: v, label: t(`consultation.${VOIE_KEYS[i]}`) }))} aria-label={t('consultation.routeLabel')} />
        </div>
        <button
          onClick={ajouter}
          disabled={!peutAjouter}
          style={{
            height: 34, padding: '0 16px', borderRadius: 8, fontSize: '13px', fontWeight: '600',
            background: peutAjouter ? 'var(--ap-500)' : 'var(--fond-surface-2)',
            color: peutAjouter ? '#fff' : 'var(--texte-tertiaire)',
            border: 'none', cursor: peutAjouter ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          {localBusy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} />}
          {t('consultation.add')}
        </button>
      </div>

      <FormField label={t('consultation.instructionsLabel')} value={instructions} onChange={setInstructions} placeholder={t('consultation.instructionsPlaceholder')} maxLength={1000} />
    </div>
  )
}

// ── Formulaire d'ajout + garde-fou contre-indication ─────────────────────────
// Intercepte le 409 « contre-indication bloquante » du backend pour proposer une
// confirmation explicite (« prescrire malgré tout ») au lieu d'un toast d'erreur.

function LigneAddFormWithGuard({ medicaments, busy, submit }: {
  medicaments: MedRef[]
  busy?:       boolean
  submit:      (p: AddLignePayload) => Promise<unknown>
}) {
  const { t } = useTranslation()
  const [warnings, setWarnings]     = useState<{ message: string }[] | null>(null)
  const [pending,  setPending]      = useState<AddLignePayload | null>(null)
  const [confirming, setConfirming] = useState(false)

  async function guarded(p: AddLignePayload) {
    try {
      await submit(p)
    } catch (err) {
      if (err instanceof ApiError && (err.body as { code?: string } | null)?.code === 'CONTRE_INDICATION_BLOCKING') {
        setWarnings((err.body as { warnings?: { message: string }[] }).warnings ?? [])
        setPending(p)
        return
      }
      throw err
    }
  }

  function close() { setWarnings(null); setPending(null) }

  async function prescrireQuandMeme() {
    if (!pending) return
    setConfirming(true)
    try {
      await submit({ ...pending, acknowledgeWarnings: true })
      close()
    } catch {
      close()   // un nouvel échec est déjà signalé par le toast du hook
    } finally {
      setConfirming(false)
    }
  }

  return (
    <>
      <LigneAddForm medicaments={medicaments} busy={busy || confirming} onSubmit={guarded} />
      {warnings && (
        <Modal
          icon={<AlertTriangle size={18} style={{ color: 'var(--erreur-accent)' }} />}
          title={t('consultation.contraIndicationTitle')}
          subtitle={t('consultation.contraIndicationSubtitle')}
          width={460}
          onClose={close}
          footer={<>
            <Button variant="ghost" onClick={close}>{t('consultation.goBack')}</Button>
            <Button variant="danger" loading={confirming} onClick={prescrireQuandMeme}>
              {t('consultation.prescribeAnyway')}
            </Button>
          </>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 13, color: 'var(--texte-secondaire)', margin: 0, lineHeight: 1.5 }}>
              {t('consultation.contraIndicationBody')}
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {warnings.map((w, i) => (
                <li key={i} style={{ fontSize: 13, color: 'var(--erreur-texte)', fontWeight: 500 }}>{w.message}</li>
              ))}
            </ul>
          </div>
        </Modal>
      )}
    </>
  )
}

// ── Ligne médicament (puce) ───────────────────────────────────────────────────

function LigneRow({ ligne, onRemove }: { ligne: LigneOrdonnanceDetail; onRemove?: () => void }) {
  const { t } = useTranslation()
  return (
    <div
      style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '6px 10px' }}
      onMouseEnter={e => { const b = e.currentTarget.querySelector('button'); if (b) (b as HTMLElement).style.opacity = '1' }}
      onMouseLeave={e => { const b = e.currentTarget.querySelector('button'); if (b) (b as HTMLElement).style.opacity = '0' }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ap-500)', flexShrink: 0, marginTop: 6 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--texte-primaire)', lineHeight: 1.35 }}>
          {ligne.medicament.nomGenerique}
        </span>
        {ligne.medicament.nomCommercial && (
          <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', marginLeft: 6 }}>({ligne.medicament.nomCommercial})</span>
        )}
        <div style={{ fontSize: '11px', color: 'var(--texte-secondaire)', marginTop: 1 }}>
          {ligne.posologie} · {ligne.duree} · {ligne.voieAdmin}
          {ligne.instructions && <span style={{ color: 'var(--texte-tertiaire)', fontStyle: 'italic' }}> — {ligne.instructions}</span>}
        </div>
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          title={t('consultation.remove')}
          style={{ width: 22, height: 22, borderRadius: 4, flexShrink: 0, opacity: 0, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--texte-tertiaire)', transition: 'opacity 0.12s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--erreur-fond)'; e.currentTarget.style.color = 'var(--erreur-accent)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--texte-tertiaire)' }}
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function miniBtn(color: string, border: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 4, fontSize: '11px', fontWeight: '600',
    color, background: 'var(--fond-surface)', border: `1px solid ${border}`,
    borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
  }
}

function FormField({ label, value, onChange, placeholder, maxLength }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number }) {
  return (
    <div>
      <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--texte-secondaire)', display: 'block', marginBottom: 3 }}>{label}</label>
      <input
        value={value}
        maxLength={maxLength}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        style={{ width: '100%', height: 34, padding: '0 10px', fontSize: '13px', borderRadius: 8, background: 'var(--fond-surface)', border: '1px solid var(--bordure-normale)', color: 'var(--texte-primaire)', outline: 'none', boxSizing: 'border-box' }}
      />
    </div>
  )
}
