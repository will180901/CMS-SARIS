/**
 * EvacuationCard — affichage (lecture) de l'évacuation d'un patient, dans l'onglet
 * "Évacuation" (Documents). La fiche naît exclusivement de « Générer la fiche » depuis
 * l'étape Décision (sélection « Évacuation médicale », voir DecisionSection dans
 * ConsultationDetail.tsx) — plus d'initiation directe ici.
 *
 * Une consultation ne peut avoir qu'UNE évacuation (relation 1↔1 en BDD).
 * Cycle : EN_COURS → suivi multi-étapes → CLOTURE | ANNULE
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Ambulance, Plus, AlertTriangle, MapPin, Activity, Check, Printer, Ban, XCircle, Trash2,
} from 'lucide-react'
import {
  Card, Button, StatusPill, EmptyState,
  Field, Textarea, SelectBox, Modal, MotifDialog,
} from '@/components/saris'
import { usePermissions } from '@/hooks/usePermissions'
import {
  useEvacuations, useAddSuiviEvacuation, useAnnulerEvacuation, useDeleteEvacuation,
} from '../hooks/useSorties'
import { EvacuationPrintModal } from './EvacuationPrintModal'
import { labelStatut, labelUrgence } from '@/config/labels'
import { formatDateTime } from '@/lib/intl'
import type { Evacuation } from '../api/sorties.api'
import type { PrintPatient, PrintSoignant } from '@/components/print/MedicalPrintSheet'

interface Props {
  consultationId: string
  readonly?:      boolean
  patient?:       PrintPatient
  soignant?:      PrintSoignant | null
}

export function EvacuationCard({ consultationId, readonly, patient, soignant }: Props) {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canUpdate = has('evacuation.update') && !readonly
  const canDelete = has('evacuation.delete')

  const { data: evacuations = [], isLoading } = useEvacuations({ consultationId })

  // Une évacuation ANNULÉE est considérée comme inexistante : la carte reste vide (une
  // nouvelle fiche peut être régénérée depuis l'étape Décision — le backend réactive la
  // ligne annulée à la recréation, contrainte 1↔1).
  const current = evacuations.find(e => e.statut !== 'ANNULE') ?? null

  return (
    <Card>
      <Card.Header
        icon={<Ambulance size={14} />}
        title={t('sorties.evacCardTitle')}
        subtitle={current
          ? t('sorties.evacCardUrgenceLevel', { niveau: labelUrgence(current.niveauUrgence) })
          : isLoading ? t('sorties.loading') : t('sorties.evacCardNone')}
      />
      <Card.Body padding="md">
        {!isLoading && !current ? (
          <EmptyState
            icon={<Ambulance size={18} />}
            title={t('sorties.evacEmptyTitle')}
            description={t('sorties.evacEmptyDescGenerated', { defaultValue: 'Aucune fiche pour l\'instant — générez-la depuis l\'étape Décision (« Évacuation médicale »).' })}
            variant="subtle"
          />
        ) : current ? (
          <EvacuationDetail evacuation={current} canUpdate={canUpdate} canDelete={canDelete} patient={patient} soignant={soignant} />
        ) : null}
      </Card.Body>
    </Card>
  )
}

// ── Détail évacuation ─────────────────────────────────────────────────────────

function EvacuationDetail({ evacuation, canUpdate, canDelete, patient, soignant }: { evacuation: Evacuation; canUpdate: boolean; canDelete: boolean; patient?: PrintPatient; soignant?: PrintSoignant | null }) {
  const { t } = useTranslation()
  const addSuivi = useAddSuiviEvacuation(evacuation.id)
  const annuler  = useAnnulerEvacuation(evacuation.id)
  const del      = useDeleteEvacuation(evacuation.id)
  const [showAddSuivi, setShowAddSuivi] = useState(false)
  const [printOpen, setPrintOpen]       = useState(false)
  const [showAnnuler, setShowAnnuler]   = useState(false)
  const [showDelete, setShowDelete]     = useState(false)
  const [notes, setNotes]               = useState('')
  const [statut, setStatut]             = useState<'EN_TRANSPORT' | 'ADMIS' | 'CLOTURE'>('EN_TRANSPORT')

  const isClosed = evacuation.statut === 'CLOTURE' || evacuation.statut === 'ANNULE'

  const toneByUrg = {
    BASSE:    'neutral',
    MOYENNE:  'info',
    HAUTE:    'warning',
    CRITIQUE: 'error',
  } as const

  async function handleAddSuivi() {
    if (!notes.trim()) return
    await addSuivi.mutateAsync({ notes: notes.trim(), statut })
    setNotes(''); setShowAddSuivi(false)
  }

  function handleAnnuler(motif: string) {
    annuler.mutate(motif, { onSuccess: () => setShowAnnuler(false) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
      {/* Header avec badges */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <StatusPill tone={toneByUrg[evacuation.niveauUrgence] as any}>
          <AlertTriangle size={11} style={{ marginRight: 3 }} /> {t('sorties.urgenceBadge', { niveau: labelUrgence(evacuation.niveauUrgence) })}
        </StatusPill>
        <StatusPill tone={evacuation.statut === 'EN_COURS' ? 'info' : evacuation.statut === 'CLOTURE' ? 'success' : 'neutral'}>
          {labelStatut('evacuation', evacuation.statut)}
        </StatusPill>
        {evacuation.etablissement && (
          <StatusPill tone="accent" dot={false}>
            <MapPin size={11} style={{ marginRight: 3 }} /> {evacuation.etablissement.nom}
          </StatusPill>
        )}
        {patient && (
          <Button
            size="sm" variant="outline"
            leftIcon={<Printer size={13} />}
            onClick={() => setPrintOpen(true)}
            style={{ marginLeft: 'auto' }}
          >
            {t('sorties.printSheet')}
          </Button>
        )}
      </div>

      {/* Infos cliniques */}
      <div>
        <p style={{
          margin: 0, fontSize: 'var(--font-size-overline)',
          fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
          color: 'var(--texte-tertiaire)',
        }}>
          {t('sorties.infosCliniquesTransmises')}
        </p>
        <p style={{
          margin: '4px 0 0', fontSize: 'var(--font-size-body-sm)',
          color: 'var(--texte-primaire)', whiteSpace: 'pre-wrap',
        }}>
          {evacuation.infosCliniques}
        </p>
      </div>

      {evacuation.motifAnnulation && (
        <div style={{
          padding: 'var(--espace-2)',
          background: 'var(--erreur-fond)',
          color: 'var(--erreur-texte)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-caption)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <XCircle size={13} style={{ flexShrink: 0 }} /> {t('sorties.annuleeLabel', { motif: evacuation.motifAnnulation })}
        </div>
      )}

      {/* Timeline suivi */}
      {evacuation.suivi.length > 0 && (
        <div>
          <p style={{
            margin: 0, fontSize: 'var(--font-size-overline)',
            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
            color: 'var(--texte-tertiaire)',
            marginBottom: 'var(--espace-2)',
          }}>
            {t('sorties.suiviEvacuationTitle')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-2)' }}>
            {evacuation.suivi.map(s => (
              <div key={s.id} style={{
                display: 'flex', gap: 'var(--espace-2)',
                padding: 'var(--espace-2)',
                background: 'var(--fond-surface-2)',
                borderRadius: 'var(--radius-md)',
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 'var(--radius-md)',
                  background: 'var(--ap-50)', color: 'var(--ap-600)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Activity size={11} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <StatusPill tone="accent" dot={false} size="sm">{labelStatut('evac_suivi', s.statut)}</StatusPill>
                    <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
                      {formatDateTime(s.createdAt, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p style={{
                    margin: '2px 0 0', fontSize: 'var(--font-size-body-sm)',
                    color: 'var(--texte-primaire)', whiteSpace: 'pre-wrap',
                  }}>
                    {s.notes}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {!isClosed && canUpdate && (
        <>
          {!showAddSuivi ? (
            <div style={{ display: 'flex', gap: 'var(--espace-2)', justifyContent: 'flex-end' }}>
              <Button size="sm" variant="ghost" leftIcon={<Ban size={13} />} onClick={() => setShowAnnuler(true)}>{t('sorties.cancelEvacuation')}</Button>
              <Button
                size="sm" variant="primary"
                leftIcon={<Plus size={13} />}
                onClick={() => setShowAddSuivi(true)}
              >
                {t('sorties.addStep')}
              </Button>
            </div>
          ) : (
            <div style={{
              padding: 'var(--espace-3)',
              background: 'var(--fond-surface)',
              border: '1px solid var(--ap-300)',
              borderRadius: 'var(--radius-md)',
              display: 'flex', flexDirection: 'column', gap: 'var(--espace-2)',
            }}>
              <Field label={t('sorties.newStep')} required>
                {(id) => (
                  <SelectBox
                    id={id} size="sm"
                    value={statut}
                    onChange={(v) => setStatut(v as any)}
                    options={[
                      { value: 'EN_TRANSPORT', label: t('sorties.stepEnTransport') },
                      { value: 'ADMIS',        label: t('sorties.stepAdmis') },
                      { value: 'CLOTURE',      label: t('sorties.stepCloturer') },
                    ]}
                  />
                )}
              </Field>
              <Field label={t('sorties.notes')} required>
                {(id) => (
                  <Textarea
                    id={id}
                    rows={3}
                    maxLength={2000}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder={t('sorties.stepNotesPlaceholder')}
                  />
                )}
              </Field>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--espace-2)' }}>
                <Button size="sm" variant="ghost" onClick={() => { setShowAddSuivi(false); setNotes('') }}>
                  {t('sorties.cancel')}
                </Button>
                <Button
                  size="sm" variant="primary"
                  leftIcon={<Check size={13} />}
                  loading={addSuivi.isPending}
                  disabled={!notes.trim()}
                  onClick={handleAddSuivi}
                >
                  {t('sorties.save')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {printOpen && patient && (
        <EvacuationPrintModal
          evacuation={evacuation}
          patient={patient}
          soignant={soignant}
          onClose={() => setPrintOpen(false)}
          variant="inline"
        />
      )}

      {showAnnuler && (
        <MotifDialog
          icon={<Ban size={16} />}
          title={t('sorties.cancelEvacDialogTitle')}
          subtitle={t('sorties.cancelEvacDialogSubtitle')}
          label={t('sorties.cancelDialogLabel')}
          placeholder={t('sorties.cancelEvacDialogPlaceholder')}
          confirmLabel={t('sorties.cancelDialogConfirm')}
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
            {t('sorties.deletePermanently')}
          </Button>
        </div>
      )}
      {showDelete && (
        <Modal icon={<Trash2 size={16} />} title={t('sorties.deleteTitle')} width={460} onClose={() => setShowDelete(false)}
          footer={<>
            <Button variant="secondary" onClick={() => setShowDelete(false)}>{t('sorties.cancel')}</Button>
            <Button variant="danger" loading={del.isPending} leftIcon={<Trash2 size={14} />} onClick={() => del.mutate(undefined, { onSuccess: () => setShowDelete(false) })}>
              {t('sorties.deleteConfirm')}
            </Button>
          </>}>
          <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)' }}>{t('sorties.deleteEvacBody')}</p>
        </Modal>
      )}
    </div>
  )
}

