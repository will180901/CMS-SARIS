/**
 * BonExamenCard — gestion des bons d'examen d'une consultation.
 *
 * Affiché dans l'onglet "Décision" de la consultation.
 * Cycle : EN_ATTENTE (création) → VALIDE (transmis labo) → résultat reçu → CONSULTÉ
 *       ou EN_ATTENTE → ANNULE
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FileWarning, Plus, X, FlaskConical, ShieldCheck, FileText,
  CheckCircle2, Printer, Ban,
} from 'lucide-react'
import {
  Card, Button, StatusPill, EmptyState,
  Field, Textarea, TextInput, Modal, MotifDialog,
} from '@/components/saris'
import { useTypesExamen } from '@/modules/referentiels/hooks/useReferentiels'
import {
  useBonsExamen, useCreateBonExamen, useValiderBonExamen,
  useAnnulerBonExamen, useSaisirResultat,
} from '../hooks/useBonExamen'
import { usePermissions } from '@/hooks/usePermissions'
import { formatDate } from '@/lib/intl'
import { Popover, PopoverAnchor, PopoverContent } from '@workspace/ui/components/popover'
import { BonExamenPrintModal } from './BonExamenPrintModal'
import { labelDomaine } from '@/config/labels'
import type { BonExamen } from '../api/bon-examen.api'
import type { PrintSoignant } from '@/components/print/MedicalPrintSheet'

interface Props {
  consultationId:   string
  readonly?:        boolean
  soignant?:        PrintSoignant | null
  categorieLibelle?: string
  categorieCode?:   string
}

export function BonExamenCard({ consultationId, readonly, soignant, categorieLibelle, categorieCode }: Props) {
  const { t } = useTranslation()
  const { has } = usePermissions()
  // RÈGLE CENTRALE (recueil) : bon d'examens réservé au personnel CDI + ayants droit.
  // (Le backend reste l'arbitre — ici on masque seulement l'action.)
  const eligible = !categorieCode || categorieCode === 'ASSURE_CDI' || categorieCode === 'AYANT_DROIT_CDI'
  const canCreate    = has('bon_examen.create') && !readonly && eligible
  const canValidate  = has('bon_examen.validate') && !readonly
  const canCancel    = has('bon_examen.cancel') && !readonly
  const canResult    = has('bon_examen.result')

  const { data: bons = [], isLoading } = useBonsExamen({ consultationId })
  const [openNew, setOpenNew] = useState(false)

  return (
    <>
      <Card>
        <Card.Header
          icon={<FileWarning size={14} />}
          title={t('bonExamen.cardTitle')}
          subtitle={isLoading
            ? t('bonExamen.loading')
            : t(bons.length > 1 ? 'bonExamen.countOther' : 'bonExamen.countOne', { count: bons.length })}
          actions={
            canCreate && (
              <Button
                size="sm"
                variant="outline"
                leftIcon={<Plus size={13} />}
                onClick={() => setOpenNew(true)}
              >
                {t('bonExamen.newBon')}
              </Button>
            )
          }
        />
        <Card.Body padding="md">
          {!isLoading && bons.length === 0 ? (
            <EmptyState
              icon={<FlaskConical size={18} />}
              title={eligible ? t('bonExamen.emptyTitle') : t('bonExamen.notEligibleTitle', { defaultValue: 'Bons d\'examens non couverts' })}
              description={eligible
                ? t('bonExamen.emptyDescription')
                : t('bonExamen.notEligibleDesc', { defaultValue: 'Cette catégorie de patient n\'ouvre pas droit aux bons d\'examens (réservé au personnel CDI et à leurs ayants droit).' })}
              variant="subtle"
              action={canCreate && (
                <Button leftIcon={<Plus size={13} />} size="sm" onClick={() => setOpenNew(true)}>
                  {t('bonExamen.createFirst')}
                </Button>
              )}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
              {bons.map(b => (
                <BonExamenItem
                  key={b.id}
                  bon={b}
                  canValidate={canValidate}
                  canCancel={canCancel}
                  canResult={canResult}
                  soignant={soignant}
                  categorieLibelle={categorieLibelle}
                />
              ))}
            </div>
          )}
        </Card.Body>
      </Card>

      {openNew && (
        <CreateBonDialog
          consultationId={consultationId}
          onClose={() => setOpenNew(false)}
        />
      )}
    </>
  )
}

// ── Item Bon d'examen ─────────────────────────────────────────────────────────

function BonExamenItem({
  bon, canValidate, canCancel, canResult, soignant, categorieLibelle,
}: {
  bon: BonExamen
  canValidate: boolean
  canCancel:   boolean
  canResult:   boolean
  soignant?:        PrintSoignant | null
  categorieLibelle?: string
}) {
  const { t } = useTranslation()
  const valider = useValiderBonExamen(bon.id)
  const annuler = useAnnulerBonExamen(bon.id)
  const [showResultForm, setShowResultForm] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [showAnnuler, setShowAnnuler] = useState(false)

  const tone = bon.statut === 'EN_ATTENTE' ? 'warning'
             : bon.statut === 'VALIDE'      ? 'success'
             : 'neutral'

  return (
    <div style={{
      border: `1px solid ${bon.statut === 'VALIDE' ? 'var(--succes-bordure)' : 'var(--bordure-legere)'}`,
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: 'var(--espace-2) var(--espace-3)',
        background: bon.statut === 'VALIDE' ? 'var(--succes-fond)' : 'var(--fond-surface-2)',
        display: 'flex', alignItems: 'center', gap: 'var(--espace-2)',
        borderBottom: '1px solid var(--bordure-legere)',
      }}>
        <FlaskConical size={13} style={{ color: 'var(--ap-600)' }} />
        <p style={{
          margin: 0, fontSize: 'var(--font-size-body-sm)', fontWeight: 600,
          color: 'var(--texte-primaire)', flex: 1,
        }}>
          {t('bonExamen.bonNumber', { numero: bon.id.slice(0, 8).toUpperCase() })}
        </p>
        <StatusPill tone={tone as any}>
          {bon.statut === 'EN_ATTENTE'
            ? t('bonExamen.statusPending')
            : bon.statut === 'VALIDE'
              ? t('bonExamen.statusValidated')
              : t('bonExamen.statusCancelled')}
        </StatusPill>
      </div>

      {/* Corps */}
      <div style={{ padding: 'var(--espace-3)', display: 'flex', flexDirection: 'column', gap: 'var(--espace-2)' }}>
        <div>
          <p style={{
            margin: 0,
            fontSize: 'var(--font-size-overline)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'var(--texte-tertiaire)',
          }}>
            {t('bonExamen.clinicalIndication')}
          </p>
          <p style={{
            margin: '2px 0 0',
            fontSize: 'var(--font-size-body-sm)',
            color: 'var(--texte-primaire)',
            whiteSpace: 'pre-wrap',
          }}>
            {bon.indicationClinik}
          </p>
        </div>

        {/* Lignes examen */}
        <div>
          <p style={{
            margin: 0,
            fontSize: 'var(--font-size-overline)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'var(--texte-tertiaire)',
            marginBottom: 4,
          }}>
            {t('bonExamen.examsRequested', { count: bon.lignes.length })}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {bon.lignes.map(l => (
              <StatusPill key={l.id} tone="accent" dot={false}>
                {l.typeExamen.libelle}
                <span style={{ marginLeft: 4, opacity: 0.6, fontSize: 9 }}>
                  {labelDomaine(l.typeExamen.domaine)}
                </span>
              </StatusPill>
            ))}
          </div>
        </div>

        {/* Résultats */}
        {bon.resultats.length > 0 && (
          <div style={{
            background: 'var(--info-fond)',
            border: '1px solid var(--info-bordure)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--espace-2) var(--espace-3)',
          }}>
            <p style={{
              margin: 0,
              fontSize: 'var(--font-size-overline)',
              fontWeight: 700,
              color: 'var(--info-texte)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <FileText size={11} /> {t('bonExamen.resultsReceived', { count: bon.resultats.length })}
            </p>
            {bon.resultats.map(r => (
              <div key={r.id} style={{ marginTop: 4 }}>
                {r.laboratoire && (
                  <p style={{ margin: 0, fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
                    {r.laboratoire} · {formatDate(r.createdAt)}
                  </p>
                )}
                <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-primaire)', whiteSpace: 'pre-wrap' }}>
                  {r.contenu}
                </p>
                {r.interpretation && (
                  <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-caption)', fontStyle: 'italic', color: 'var(--texte-secondaire)' }}>
                    💡 {r.interpretation}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {bon.motifAnnulation && (
          <div style={{
            fontSize: 'var(--font-size-caption)',
            color: 'var(--erreur-texte)',
            background: 'var(--erreur-fond)',
            padding: 'var(--espace-2)',
            borderRadius: 'var(--radius-md)',
          }}>
            {t('bonExamen.cancellationReason', { motif: bon.motifAnnulation })}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 'var(--espace-2)', justifyContent: 'flex-end', marginTop: 4 }}>
          {bon.statut === 'EN_ATTENTE' && (canValidate || canCancel) && (
            <>
              {canCancel && (
                <Button
                  size="sm" variant="ghost"
                  leftIcon={<Ban size={13} />}
                  onClick={() => setShowAnnuler(true)}
                  disabled={annuler.isPending}
                >
                  {t('bonExamen.cancelBon')}
                </Button>
              )}
              {canValidate && (
                <Button
                  size="sm" variant="success"
                  leftIcon={<ShieldCheck size={13} />}
                  loading={valider.isPending}
                  onClick={() => valider.mutate({ statut: 'VALIDE' })}
                >
                  {t('bonExamen.validate')}
                </Button>
              )}
            </>
          )}
          {bon.statut === 'VALIDE' && (
            <>
              {canCancel && bon.resultats.length === 0 && (
                <Button
                  size="sm" variant="ghost"
                  leftIcon={<Ban size={13} />}
                  onClick={() => setShowAnnuler(true)}
                  disabled={annuler.isPending}
                >
                  {t('bonExamen.cancelBon')}
                </Button>
              )}
              <Button
                size="sm" variant="outline"
                leftIcon={<Printer size={13} />}
                onClick={() => setPrintOpen(true)}
              >
                {t('bonExamen.print')}
              </Button>
              {canResult && !showResultForm && (
                <Button
                  size="sm"
                  variant="primary"
                  leftIcon={<FileText size={13} />}
                  onClick={() => setShowResultForm(true)}
                >
                  {t('bonExamen.addResult')}
                </Button>
              )}
            </>
          )}
        </div>

        {/* Formulaire résultat */}
        {showResultForm && canResult && (
          <ResultatForm
            bonId={bon.id}
            onClose={() => setShowResultForm(false)}
          />
        )}

        {showAnnuler && (
          <MotifDialog
            icon={<Ban size={16} />}
            title={t('bonExamen.cancelDialogTitle')}
            subtitle={bon.statut === 'VALIDE'
              ? t('bonExamen.cancelDialogSubtitleValidated')
              : t('bonExamen.cancelDialogSubtitlePending')}
            label={t('bonExamen.cancelDialogLabel')}
            placeholder={t('bonExamen.cancelDialogPlaceholder')}
            confirmLabel={t('bonExamen.cancelDialogConfirm')}
            confirmIcon={<Ban size={14} />}
            danger
            loading={annuler.isPending}
            onConfirm={(motif) => annuler.mutate(motif, { onSuccess: () => setShowAnnuler(false) })}
            onClose={() => setShowAnnuler(false)}
          />
        )}
      </div>

      {printOpen && (
        <BonExamenPrintModal
          bon={bon}
          soignant={soignant}
          categorieLibelle={categorieLibelle}
          onClose={() => setPrintOpen(false)}
          variant="inline"
        />
      )}
    </div>
  )
}

// ── Modal saisie résultat ──────────────────────────────────────────────────────

function ResultatForm({ bonId, onClose }: { bonId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const saisir = useSaisirResultat(bonId)
  const [laboratoire, setLaboratoire]       = useState('')
  const [contenu, setContenu]                = useState('')
  const [interpretation, setInterpretation] = useState('')

  async function handleSubmit() {
    if (!contenu.trim()) return
    await saisir.mutateAsync({
      contenu: contenu.trim(),
      laboratoire: laboratoire.trim() || undefined,
      interpretation: interpretation.trim() || undefined,
    })
    onClose()
  }

  return (
    <Modal
      icon={<FileText size={16} />}
      title={t('bonExamen.resultModalTitle')}
      subtitle={t('bonExamen.resultModalSubtitle')}
      width={560}
      onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('bonExamen.cancel')}</Button>
        <Button
          variant="primary"
          loading={saisir.isPending}
          disabled={!contenu.trim()}
          leftIcon={<CheckCircle2 size={14} />}
          onClick={handleSubmit}
        >
          {t('bonExamen.saveResult')}
        </Button>
      </>}
    >
      <Field label={t('bonExamen.labLabel')}>
        {(id) => (
          <TextInput id={id} maxLength={500} value={laboratoire} onChange={e => setLaboratoire(e.target.value)} placeholder={t('bonExamen.labPlaceholder')} />
        )}
      </Field>
      <Field label={t('bonExamen.resultLabel')} required>
        {(id) => (
          <Textarea id={id} maxLength={5000} value={contenu} onChange={e => setContenu(e.target.value)} rows={5} placeholder={t('bonExamen.resultPlaceholder')} autoFocus />
        )}
      </Field>
      <Field label={t('bonExamen.interpretationLabel')}>
        {(id) => (
          <Textarea id={id} maxLength={2000} value={interpretation} onChange={e => setInterpretation(e.target.value)} rows={3} placeholder={t('bonExamen.interpretationPlaceholder')} />
        )}
      </Field>
    </Modal>
  )
}

// ── Dialog création bon d'examen ──────────────────────────────────────────────

function CreateBonDialog({
  consultationId, onClose,
}: {
  consultationId: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const create = useCreateBonExamen()
  const { data: types = [] } = useTypesExamen()
  const typesActifs = useMemo(() => types.filter(t => t.statut === 'ACTIF'), [types])

  const [indication, setIndication] = useState('')
  const [selected,   setSelected]   = useState<string[]>([])
  const [examInput,  setExamInput]  = useState('')
  const [examFocus,  setExamFocus]  = useState(false)

  const byId = useMemo(() => new Map(typesActifs.map(t => [t.id, t])), [typesActifs])
  const suggestions = useMemo(() => {
    const q = examInput.trim().toLowerCase()
    if (!q) return []
    return typesActifs
      .filter(t => !selected.includes(t.id))
      .filter(t => t.libelle.toLowerCase().includes(q) || t.code.toLowerCase().includes(q))
      .slice(0, 8)
  }, [examInput, typesActifs, selected])

  function addExam(id: string)    { setSelected(arr => arr.includes(id) ? arr : [...arr, id]); setExamInput(''); setExamFocus(false) }
  function removeExam(id: string) { setSelected(arr => arr.filter(x => x !== id)) }

  const valid = indication.trim().length >= 5 && selected.length > 0

  async function handleSubmit() {
    if (!valid) return
    await create.mutateAsync({
      consultationId,
      indicationClinik: indication.trim(),
      typesExamenIds: selected,
    })
    onClose()
  }

  return (
    <Modal
      icon={<FileWarning size={16} />}
      title={t('bonExamen.createModalTitle')}
      subtitle={t('bonExamen.createModalSubtitle')}
      width={640}
      onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('bonExamen.cancel')}</Button>
        <Button
          variant="primary"
          disabled={!valid}
          loading={create.isPending}
          leftIcon={<FileWarning size={14} />}
          onClick={handleSubmit}
        >
          {t(selected.length > 1 ? 'bonExamen.createButtonOther' : 'bonExamen.createButtonOne', { count: selected.length })}
        </Button>
      </>}
    >
          <Field
            label={t('bonExamen.indicationLabel')}
            required
            hint={t('bonExamen.indicationHint')}
          >
            {(id) => (
              <Textarea
                id={id}
                rows={3}
                maxLength={2000}
                value={indication}
                onChange={e => setIndication(e.target.value)}
                placeholder={t('bonExamen.indicationPlaceholder')}
                autoFocus
              />
            )}
          </Field>

          <Field
            label={t('bonExamen.examsLabel')}
            required
            hint={t(selected.length > 1 ? 'bonExamen.examsHintOther' : 'bonExamen.examsHintOne', { count: selected.length })}
          >
            {(id) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-2)' }}>
                {/* Liste à puces des examens choisis */}
                <div style={{
                  minHeight: 48, borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--bordure-legere)', background: 'var(--fond-surface-2)',
                  padding: selected.length === 0 ? 0 : '6px 4px',
                  display: 'flex', flexDirection: 'column',
                  justifyContent: selected.length === 0 ? 'center' : 'flex-start',
                }}>
                  {selected.length === 0 ? (
                    <p style={{ fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-tertiaire)', fontStyle: 'italic', textAlign: 'center', margin: 0 }}>
                      {t('bonExamen.noExamSelected')}
                    </p>
                  ) : (
                    selected.map(sid => {
                      const ex = byId.get(sid)
                      if (!ex) return null
                      return (
                        <div
                          key={sid}
                          style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '5px 10px' }}
                          onMouseEnter={e => { const b = e.currentTarget.querySelector('button'); if (b) (b as HTMLElement).style.opacity = '1' }}
                          onMouseLeave={e => { const b = e.currentTarget.querySelector('button'); if (b) (b as HTMLElement).style.opacity = '0' }}
                        >
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ap-500)', flexShrink: 0, marginTop: 6 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 'var(--font-size-body)', fontWeight: 600, color: 'var(--texte-primaire)' }}>{ex.libelle}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', marginLeft: 8 }}>{ex.code}</span>
                            <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', marginLeft: 6 }}>· {labelDomaine(ex.domaine)}</span>
                          </div>
                          <button
                            type="button" onClick={() => removeExam(sid)} title={t('bonExamen.removeExam')}
                            style={{
                              width: 22, height: 22, borderRadius: 4, flexShrink: 0, opacity: 0,
                              background: 'transparent', border: 'none', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'var(--texte-tertiaire)', transition: 'opacity 0.12s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--erreur-fond)'; e.currentTarget.style.color = 'var(--erreur-accent)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--texte-tertiaire)' }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Autocomplétion (popover, z-index au-dessus du modal) */}
                <Popover open={examFocus && suggestions.length > 0} onOpenChange={o => { if (!o) setExamFocus(false) }}>
                  <PopoverAnchor asChild>
                    <div>
                      <TextInput
                        id={id}
                        size="sm"
                        value={examInput}
                        onChange={e => setExamInput(e.target.value)}
                        onFocus={() => setExamFocus(true)}
                        onBlur={() => setTimeout(() => setExamFocus(false), 120)}
                        placeholder={t('bonExamen.examSearchPlaceholder')}
                      />
                    </div>
                  </PopoverAnchor>
                  <PopoverContent
                    align="start" sideOffset={6}
                    onOpenAutoFocus={e => e.preventDefault()}
                    onCloseAutoFocus={e => e.preventDefault()}
                    style={{
                      width: 'var(--radix-popover-trigger-width)', maxWidth: 'none', padding: 0, zIndex: 1100,
                      maxHeight: 240, overflowY: 'auto', borderRadius: 'var(--radius-md)',
                      background: 'var(--fond-surface)', border: '1px solid var(--bordure-normale)',
                    }}
                  >
                    {suggestions.map(t => (
                      <button
                        key={t.id} type="button"
                        onMouseDown={e => { e.preventDefault(); addExam(t.id) }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                          padding: '8px 12px', textAlign: 'left', cursor: 'pointer',
                          background: 'transparent', border: 'none',
                          borderBottom: '1px solid var(--bordure-legere)',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--ap-50)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ flex: 1, fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-primaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.libelle}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', flexShrink: 0 }}>{t.code}</span>
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </Field>
    </Modal>
  )
}
