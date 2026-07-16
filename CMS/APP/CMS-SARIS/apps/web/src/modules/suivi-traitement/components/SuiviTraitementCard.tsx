/**
 * SuiviTraitementCard — gestion d'un épisode de suivi de traitement (contrôle
 * d'état de santé, évolution d'une maladie, traitement en cours).
 *
 * Une consultation ne peut avoir qu'UN épisode de suivi (relation 1↔1 en BDD).
 * Cycle : EN_COURS → fiches datées (constantes + évolution + médicaments +
 * résultat, chacune optionnelle) → CLÔTURÉ | ANNULÉ.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Activity, Plus, Thermometer, HeartPulse, Wind, Weight, Gauge,
  Check, Ban, XCircle, Trash2, CircleCheck,
} from 'lucide-react'
import {
  Card, Button, StatusPill, EmptyState,
  Field, Textarea, TextInput, Modal, MotifDialog,
} from '@/components/saris'
import { usePermissions } from '@/hooks/usePermissions'
import {
  useSuivisTraitement, useCreateSuiviTraitement, useAddFicheSuivi,
  useCloturerSuiviTraitement, useAnnulerSuiviTraitement, useDeleteSuiviTraitement,
} from '../hooks/useSuiviTraitement'
import { formatDateTime } from '@/lib/intl'
import type { SuiviTraitement } from '../api/suivi-traitement.api'

interface Props {
  consultationId: string
  readonly?:      boolean
}

export function SuiviTraitementCard({ consultationId, readonly }: Props) {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canCreate = has('suivi_traitement.create') && !readonly
  const canUpdate = has('suivi_traitement.update') && !readonly
  const canClose  = has('suivi_traitement.close')
  const canCancel = has('suivi_traitement.cancel')
  const canDelete = has('suivi_traitement.delete')

  const { data: suivis = [], isLoading } = useSuivisTraitement({ consultationId })
  const [openNew, setOpenNew] = useState(false)

  // Un suivi ANNULÉ est considéré comme inexistant : on libère la carte
  // (état vide + « Ouvrir ») pour permettre une nouvelle saisie.
  const current = suivis.find(s => s.statut !== 'ANNULE') ?? null

  return (
    <>
      <Card>
        <Card.Header
          icon={<Activity size={14} />}
          title={t('suiviTraitement.cardTitle')}
          subtitle={current ? current.motif : isLoading ? t('suiviTraitement.loading') : t('suiviTraitement.cardNone')}
          actions={
            !current && canCreate && (
              <Button size="sm" variant="outline" leftIcon={<Plus size={13} />} onClick={() => setOpenNew(true)}>
                {t('suiviTraitement.initiate')}
              </Button>
            )
          }
        />
        <Card.Body padding="md">
          {!isLoading && !current ? (
            <EmptyState
              icon={<Activity size={18} />}
              title={t('suiviTraitement.emptyTitle')}
              description={t('suiviTraitement.emptyDesc')}
              variant="subtle"
              action={canCreate && (
                <Button leftIcon={<Plus size={13} />} size="sm" onClick={() => setOpenNew(true)}>
                  {t('suiviTraitement.initiate')}
                </Button>
              )}
            />
          ) : current ? (
            <SuiviDetail suivi={current} canUpdate={canUpdate} canClose={canClose} canCancel={canCancel} canDelete={canDelete} />
          ) : null}
        </Card.Body>
      </Card>

      {openNew && (
        <CreateSuiviDialog consultationId={consultationId} onClose={() => setOpenNew(false)} />
      )}
    </>
  )
}

// ── Détail suivi ──────────────────────────────────────────────────────────────

// Mêmes plages réalistes que le formulaire Constantes du triage (ConstantesForm.tsx).
const CONST_FIELDS: { key: keyof typeof EMPTY_FICHE; label: string; unit: string; icon: React.ReactNode; min: number; max: number }[] = [
  { key: 'temperature',        label: 'suiviTraitement.fieldTemperature', unit: '°C',  icon: <Thermometer size={11} />, min: 30,  max: 45  },
  { key: 'tensionSystolique',  label: 'suiviTraitement.fieldTensionSys',  unit: 'mmHg', icon: <Gauge size={11} />,       min: 50,  max: 300 },
  { key: 'tensionDiastolique', label: 'suiviTraitement.fieldTensionDia',  unit: 'mmHg', icon: <Gauge size={11} />,       min: 30,  max: 200 },
  { key: 'frequenceCardiaque', label: 'suiviTraitement.fieldFc',          unit: 'bpm', icon: <HeartPulse size={11} />,  min: 20,  max: 300 },
  { key: 'saturationO2',       label: 'suiviTraitement.fieldSpo2',        unit: '%',   icon: <Wind size={11} />,        min: 50,  max: 100 },
  { key: 'poids',              label: 'suiviTraitement.fieldPoids',       unit: 'kg',  icon: <Weight size={11} />,      min: 0.5, max: 300 },
]

const EMPTY_FICHE = {
  temperature: '', tensionSystolique: '', tensionDiastolique: '', frequenceCardiaque: '',
  frequenceRespiratoire: '', saturationO2: '', poids: '',
  noteEvolution: '', medicamentsAdministres: '', resultatExamen: '',
}

function SuiviDetail({ suivi, canUpdate, canClose, canCancel, canDelete }: {
  suivi: SuiviTraitement; canUpdate: boolean; canClose: boolean; canCancel: boolean; canDelete: boolean
}) {
  const { t } = useTranslation()
  const addFiche  = useAddFicheSuivi(suivi.id)
  const cloturer  = useCloturerSuiviTraitement(suivi.id)
  const annuler   = useAnnulerSuiviTraitement(suivi.id)
  const del       = useDeleteSuiviTraitement(suivi.id)

  const [showAddFiche, setShowAddFiche] = useState(false)
  const [showCloturer, setShowCloturer] = useState(false)
  const [showAnnuler, setShowAnnuler]   = useState(false)
  const [showDelete, setShowDelete]     = useState(false)
  const [motifCloture, setMotifCloture] = useState('')
  const [fiche, setFiche] = useState(EMPTY_FICHE)

  const isClosed = suivi.statut === 'CLOTURE' || suivi.statut === 'ANNULE'
  const ficheDirty = Object.values(fiche).some(v => v.trim() !== '')

  function setF<K extends keyof typeof EMPTY_FICHE>(key: K, value: string) {
    setFiche(f => ({ ...f, [key]: value }))
  }

  async function handleAddFiche() {
    if (!ficheDirty) return
    const num = (v: string) => (v.trim() === '' ? undefined : Number(v))
    await addFiche.mutateAsync({
      temperature:            num(fiche.temperature),
      tensionSystolique:      num(fiche.tensionSystolique),
      tensionDiastolique:     num(fiche.tensionDiastolique),
      frequenceCardiaque:     num(fiche.frequenceCardiaque),
      frequenceRespiratoire:  num(fiche.frequenceRespiratoire),
      saturationO2:           num(fiche.saturationO2),
      poids:                  num(fiche.poids),
      noteEvolution:          fiche.noteEvolution.trim() || undefined,
      medicamentsAdministres: fiche.medicamentsAdministres.trim() || undefined,
      resultatExamen:         fiche.resultatExamen.trim() || undefined,
    })
    setFiche(EMPTY_FICHE); setShowAddFiche(false)
  }

  function handleAnnuler(motif: string) {
    annuler.mutate(motif, { onSuccess: () => setShowAnnuler(false) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
      {/* Header avec badges */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <StatusPill tone={suivi.statut === 'EN_COURS' ? 'info' : suivi.statut === 'CLOTURE' ? 'success' : 'neutral'}>
          {t(`suiviTraitement.statut${suivi.statut === 'EN_COURS' ? 'EnCours' : suivi.statut === 'CLOTURE' ? 'Cloture' : 'Annule'}`)}
        </StatusPill>
      </div>

      {/* Motif */}
      <div>
        <p style={{
          margin: 0, fontSize: 'var(--font-size-overline)', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.07em', color: 'var(--texte-tertiaire)',
        }}>
          {t('suiviTraitement.motifTitle')}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-primaire)', whiteSpace: 'pre-wrap' }}>
          {suivi.motif}
        </p>
      </div>

      {suivi.motifCloture && (
        <div style={{ padding: 'var(--espace-2)', background: 'var(--succes-fond)', color: 'var(--succes-texte)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-caption)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <CircleCheck size={13} style={{ flexShrink: 0 }} /> {t('suiviTraitement.clotureLabel', { motif: suivi.motifCloture })}
        </div>
      )}
      {suivi.motifAnnulation && (
        <div style={{ padding: 'var(--espace-2)', background: 'var(--erreur-fond)', color: 'var(--erreur-texte)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-caption)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <XCircle size={13} style={{ flexShrink: 0 }} /> {t('suiviTraitement.annuleLabel', { motif: suivi.motifAnnulation })}
        </div>
      )}

      {/* Fiches de suivi */}
      {suivi.fiches.length > 0 && (
        <div>
          <p style={{ margin: 0, fontSize: 'var(--font-size-overline)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--texte-tertiaire)', marginBottom: 'var(--espace-2)' }}>
            {t('suiviTraitement.fichesTitle')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-2)' }}>
            {suivi.fiches.map(f => (
              <div key={f.id} style={{ display: 'flex', gap: 'var(--espace-2)', padding: 'var(--espace-2)', background: 'var(--fond-surface-2)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ width: 24, height: 24, borderRadius: 'var(--radius-md)', background: 'var(--ap-50)', color: 'var(--ap-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Activity size={11} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
                    {formatDateTime(f.createdAt, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {f.temperature != null && <FicheChip label={t('suiviTraitement.fieldTemperature')} value={`${f.temperature}°C`} />}
                    {f.tensionSystolique != null && <FicheChip label={t('suiviTraitement.fieldTensionSys')} value={`${f.tensionSystolique}/${f.tensionDiastolique ?? '—'}`} />}
                    {f.frequenceCardiaque != null && <FicheChip label={t('suiviTraitement.fieldFc')} value={`${f.frequenceCardiaque} bpm`} />}
                    {f.saturationO2 != null && <FicheChip label={t('suiviTraitement.fieldSpo2')} value={`${f.saturationO2}%`} />}
                    {f.poids != null && <FicheChip label={t('suiviTraitement.fieldPoids')} value={`${f.poids} kg`} />}
                  </div>
                  {f.noteEvolution && <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-primaire)', whiteSpace: 'pre-wrap' }}>{f.noteEvolution}</p>}
                  {f.medicamentsAdministres && (
                    <p style={{ margin: 0, fontSize: 'var(--font-size-caption)', color: 'var(--texte-secondaire)' }}>
                      <strong>{t('suiviTraitement.fieldMedicaments')} :</strong> {f.medicamentsAdministres}
                    </p>
                  )}
                  {f.resultatExamen && (
                    <p style={{ margin: 0, fontSize: 'var(--font-size-caption)', color: 'var(--texte-secondaire)' }}>
                      <strong>{t('suiviTraitement.fieldResultat')} :</strong> {f.resultatExamen}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {!isClosed && canUpdate && (
        <>
          {!showAddFiche ? (
            <div style={{ display: 'flex', gap: 'var(--espace-2)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {canCancel && <Button size="sm" variant="ghost" leftIcon={<Ban size={13} />} onClick={() => setShowAnnuler(true)}>{t('suiviTraitement.cancel')}</Button>}
              {canClose && <Button size="sm" variant="outline" leftIcon={<CircleCheck size={13} />} onClick={() => setShowCloturer(true)}>{t('suiviTraitement.close')}</Button>}
              <Button size="sm" variant="primary" leftIcon={<Plus size={13} />} onClick={() => setShowAddFiche(true)}>{t('suiviTraitement.addFiche')}</Button>
            </div>
          ) : (
            <div style={{ padding: 'var(--espace-3)', background: 'var(--fond-surface)', border: '1px solid var(--ap-300)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 'var(--espace-2)' }}>
              <p style={{ margin: 0, fontSize: 'var(--font-size-caption)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--texte-tertiaire)' }}>
                {t('suiviTraitement.newFicheConstantes')}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 'var(--espace-2)' }}>
                {CONST_FIELDS.map(cf => (
                  <Field key={cf.key} label={<span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{cf.icon}{t(cf.label)}</span>}>
                    {(id) => (
                      <TextInput id={id} type="number" size="sm" min={cf.min} max={cf.max} value={fiche[cf.key]} onChange={e => setF(cf.key, e.target.value)} placeholder={cf.unit} />
                    )}
                  </Field>
                ))}
              </div>
              <Field label={t('suiviTraitement.fieldEvolution')}>
                {(id) => <Textarea id={id} rows={2} maxLength={2000} value={fiche.noteEvolution} onChange={e => setF('noteEvolution', e.target.value)} placeholder={t('suiviTraitement.evolutionPlaceholder')} />}
              </Field>
              <Field label={t('suiviTraitement.fieldMedicaments')}>
                {(id) => <Textarea id={id} rows={2} maxLength={1000} value={fiche.medicamentsAdministres} onChange={e => setF('medicamentsAdministres', e.target.value)} placeholder={t('suiviTraitement.medicamentsPlaceholder')} />}
              </Field>
              <Field label={t('suiviTraitement.fieldResultat')}>
                {(id) => <Textarea id={id} rows={2} maxLength={1000} value={fiche.resultatExamen} onChange={e => setF('resultatExamen', e.target.value)} placeholder={t('suiviTraitement.resultatPlaceholder')} />}
              </Field>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--espace-2)' }}>
                <Button size="sm" variant="ghost" onClick={() => { setShowAddFiche(false); setFiche(EMPTY_FICHE) }}>{t('suiviTraitement.cancelForm')}</Button>
                <Button size="sm" variant="primary" leftIcon={<Check size={13} />} loading={addFiche.isPending} disabled={!ficheDirty} onClick={handleAddFiche}>{t('suiviTraitement.save')}</Button>
              </div>
            </div>
          )}
        </>
      )}

      {showCloturer && (
        <Modal
          icon={<CircleCheck size={16} />}
          title={t('suiviTraitement.closeDialogTitle')}
          width={460}
          onClose={() => setShowCloturer(false)}
          footer={<>
            <Button variant="secondary" onClick={() => setShowCloturer(false)} disabled={cloturer.isPending}>{t('suiviTraitement.cancelForm')}</Button>
            <Button variant="success" leftIcon={<CircleCheck size={14} />} loading={cloturer.isPending}
              onClick={() => cloturer.mutate(motifCloture.trim() || undefined, { onSuccess: () => setShowCloturer(false) })}>
              {t('suiviTraitement.close')}
            </Button>
          </>}
        >
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--texte-secondaire)', lineHeight: 1.6 }}>{t('suiviTraitement.closeDialogBody')}</p>
          <Textarea value={motifCloture} onChange={e => setMotifCloture(e.target.value)} maxLength={500} rows={2} placeholder={t('suiviTraitement.closeDialogPlaceholder')} />
        </Modal>
      )}

      {showAnnuler && (
        <MotifDialog
          icon={<Ban size={16} />}
          title={t('suiviTraitement.cancelDialogTitle')}
          subtitle={t('suiviTraitement.cancelDialogSubtitle')}
          label={t('suiviTraitement.cancelDialogLabel')}
          placeholder={t('suiviTraitement.cancelDialogPlaceholder')}
          confirmLabel={t('suiviTraitement.cancelDialogConfirm')}
          confirmIcon={<Ban size={14} />}
          danger
          loading={annuler.isPending}
          onConfirm={handleAnnuler}
          onClose={() => setShowAnnuler(false)}
        />
      )}

      {canDelete && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--bordure-legere)', paddingTop: 'var(--espace-2)' }}>
          <Button size="sm" variant="ghost" leftIcon={<Trash2 size={13} />} onClick={() => setShowDelete(true)} style={{ color: 'var(--erreur-accent)' }}>
            {t('suiviTraitement.deletePermanently')}
          </Button>
        </div>
      )}
      {showDelete && (
        <Modal icon={<Trash2 size={16} />} title={t('suiviTraitement.deleteTitle')} width={460} onClose={() => setShowDelete(false)}
          footer={<>
            <Button variant="secondary" onClick={() => setShowDelete(false)}>{t('suiviTraitement.cancelForm')}</Button>
            <Button variant="danger" loading={del.isPending} leftIcon={<Trash2 size={14} />} onClick={() => del.mutate(undefined, { onSuccess: () => setShowDelete(false) })}>
              {t('suiviTraitement.deleteConfirm')}
            </Button>
          </>}>
          <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)' }}>{t('suiviTraitement.deleteBody')}</p>
        </Modal>
      )}
    </div>
  )
}

function FicheChip({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ fontSize: 11, color: 'var(--texte-secondaire)', background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)', borderRadius: 9999, padding: '2px 8px' }}>
      {label} : <strong style={{ color: 'var(--texte-primaire)' }}>{value}</strong>
    </span>
  )
}

// ── Dialog création suivi ─────────────────────────────────────────────────────

function CreateSuiviDialog({ consultationId, onClose }: { consultationId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const create = useCreateSuiviTraitement()
  const [motif, setMotif] = useState('')
  const valid = motif.trim().length >= 5

  async function handleSubmit() {
    if (!valid) return
    await create.mutateAsync({ consultationId, motif: motif.trim() })
    onClose()
  }

  return (
    <Modal
      icon={<Activity size={16} />}
      title={t('suiviTraitement.createTitle')}
      subtitle={t('suiviTraitement.createSubtitle')}
      width={520}
      onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('suiviTraitement.cancelForm')}</Button>
        <Button variant="primary" disabled={!valid} loading={create.isPending} leftIcon={<Activity size={14} />} onClick={handleSubmit}>
          {t('suiviTraitement.createConfirm')}
        </Button>
      </>}
    >
      <Field label={t('suiviTraitement.fieldMotifSuivi')} required hint={t('suiviTraitement.fieldMotifSuiviHint')}>
        {(id) => (
          <Textarea id={id} rows={4} maxLength={500} value={motif} onChange={e => setMotif(e.target.value)}
            placeholder={t('suiviTraitement.createMotifPlaceholder')} autoFocus />
        )}
      </Field>
    </Modal>
  )
}
