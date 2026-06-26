import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, XCircle, UserPlus2, UserMinus, AlertCircle, Pencil, Stethoscope, Trash2 } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Modal, Tooltip, SelectBox } from '@/components/saris'
import {
  useUpdateStatutVisite,
  useUpdateSoignantVisite,
  useDeleteVisite,
} from '../hooks/useTriage'
import { useSoignants } from '../hooks/useSoignants'
import { usePermissions } from '@/hooks/usePermissions'
import { SoignantPickerModal, PersonnelAvatar, roleConfig } from './SoignantPickerModal'
import { useCreateConsultation } from '@/modules/consultation/hooks/useConsultation'
import { ApiError } from '@/lib/api'
import type { VisiteDetail } from '@cms-saris/types'

// ── Petit label de section ────────────────────────────────────────────────────

function SLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
      letterSpacing: '0.07em', color: 'var(--texte-tertiaire)', margin: '0 0 8px',
    }}>
      {children}
    </p>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

export function ActionsCard({ visite, onSent }: { visite: VisiteDetail; onSent?: () => void }) {
  const { t } = useTranslation()
  const { has } = usePermissions()

  // Motifs d'annulation proposés : `value` = clé stable, `label` = texte affiché/stocké.
  const MOTIFS_ANNULATION: { value: string; label: string }[] = [
    { value: 'PARTI_AVANT',    label: t('triage.motifPartiAvant') },
    { value: 'ERREUR_SAISIE',  label: t('triage.motifErreurSaisie') },
    { value: 'ORIENTE_AILLEURS', label: t('triage.motifOrienteAilleurs') },
    { value: 'REFUS_SOINS',    label: t('triage.motifRefusSoins') },
    { value: 'AUTRE',          label: t('triage.motifAutre') },
  ]

  // Gating UX aligné sur les gardes backend (le serveur reste l'autorité).
  const canAssign   = has('visite.assign_soignant')
  const canClose    = has('visite.close')
  const canCancel   = has('visite.cancel')
  const canConsult  = has('consultation.create')
  const canDelete   = has('visite.delete')
  // « Prendre en charge » = transition EN_ATTENTE→EN_COURS (route statut : update/cancel/close)
  const canTransition = has('visite.update') || canClose || canCancel

  const [cancelStep,    setCancelStep]    = useState<'idle' | 'choose' | 'autre'>('idle')
  const [motifAnnul,    setMotifAnnul]    = useState<string>('')
  const [motifAutre,    setMotifAutre]    = useState<string>('')
  const [soignantOpen,  setSoignantOpen]  = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const updateStatut      = useUpdateStatutVisite(visite.id)
  const updateSoignant    = useUpdateSoignantVisite(visite.id)
  const deleteVisite      = useDeleteVisite()
  const createConsultation = useCreateConsultation()

  function handleEnvoyerConsultation() {
    createConsultation.mutate(
      { visiteId: visite.id },
      {
        // L'accueil RESTE sur le triage : la visite est clôturée côté serveur (elle
        // quitte la liste de gauche via l'invalidation `['visites']`) et on vide la
        // zone de droite. Le médecin assigné reçoit une notification ciblée. Le hook
        // affiche déjà le toast de confirmation.
        onSuccess: () => { onSent?.() },
        onError:   (err) => { if (err instanceof ApiError && err.status === 409) onSent?.() },
      },
    )
  }

  const { data: personnel = [] } = useSoignants()
  const currentSoignant = personnel.find(p => p.id === visite.soignantId) ?? null

  const isActive   = visite.statut === 'EN_ATTENTE' || visite.statut === 'EN_COURS'
  const isAttente  = visite.statut === 'EN_ATTENTE'
  const isEnCours  = visite.statut === 'EN_COURS'

  function submitCancel() {
    const selected = MOTIFS_ANNULATION.find(m => m.value === motifAnnul)
    const motif = motifAnnul === 'AUTRE' ? motifAutre.trim() : (selected?.label ?? '')
    if (!motif) return
    updateStatut.mutate({ statut: 'ANNULEE', motifAnnulation: motif })
    setCancelStep('idle'); setMotifAnnul(''); setMotifAutre('')
  }

  function cancelClose() {
    setCancelStep('idle'); setMotifAnnul(''); setMotifAutre('')
  }

  return (
    <>
    <div style={{
      background:   'var(--fond-surface)',
      border:       '1px solid var(--bordure-legere)',
      borderRadius: '10px',
      boxShadow:    'var(--ombre-1)',
      overflow:     'hidden',
    }}>
      {/* En-tête */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--bordure-legere)',
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--fond-surface-2)',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: 'var(--ap-50)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <ChevronRight size={14} style={{ color: 'var(--ap-600)' }} />
        </div>
        <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--texte-primaire)', margin: 0 }}>
          {t('triage.decisionsTriage')}
        </p>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* ── Action principale ──────────────────────────────────────────── */}
        {isActive && ((isAttente && canTransition) || (isEnCours && canConsult)) && (
          <div>
            <SLabel>{t('triage.actionPrincipale')}</SLabel>
            {isAttente && canTransition && (
              <Button
                onClick={() => updateStatut.mutate({ statut: 'EN_COURS' })}
                disabled={updateStatut.isPending}
                style={{ width: '100%', height: 40, fontSize: '13px', gap: 6,
                         justifyContent: 'center', background: 'var(--ap-400)', color: '#fff' }}
              >
                <ChevronRight size={14} />
                {t('triage.prendreEnCharge')}
              </Button>
            )}
            {isEnCours && canConsult && (
              <>
              <Button
                onClick={handleEnvoyerConsultation}
                disabled={createConsultation.isPending || !visite.soignantId}
                title={!visite.soignantId ? t('triage.assignSoignantAvantConsultation') : undefined}
                style={{ width: '100%', height: 40, fontSize: '13px', gap: 6,
                         justifyContent: 'center', background: 'var(--ap-400)', color: '#fff',
                         opacity: !visite.soignantId ? 0.6 : 1 }}
              >
                <Stethoscope size={14} />
                {createConsultation.isPending ? t('triage.ouverture') : t('triage.envoyerEnConsultation')}
              </Button>
              {!visite.soignantId && (
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--texte-tertiaire)', textAlign: 'center' }}>
                  {t('triage.assignSoignantAvantConsultation')}
                </p>
              )}
              </>
            )}
          </div>
        )}

        {/* ── Soignant ─────────────────────────────────────────────────────── */}
        <div>
          <SLabel>{t('triage.soignantAssigneLabel')}</SLabel>
          {(() => { const soignantInteractif = isActive && canAssign; return (
          <button
            type="button"
            onClick={() => soignantInteractif && setSoignantOpen(true)}
            disabled={!soignantInteractif || updateSoignant.isPending}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid var(--bordure-normale)',
              background: 'var(--fond-surface)',
              cursor: !soignantInteractif ? 'not-allowed' : updateSoignant.isPending ? 'wait' : 'pointer',
              opacity: !soignantInteractif ? 0.6 : updateSoignant.isPending ? 0.7 : 1,
              textAlign: 'left',
              transition: 'background 0.12s, border-color 0.12s',
            }}
            onMouseEnter={e => { if (soignantInteractif && !updateSoignant.isPending) e.currentTarget.style.background = 'var(--fond-surface-2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--fond-surface)' }}
          >
            {currentSoignant ? (
              <>
                <PersonnelAvatar p={currentSoignant} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--texte-primaire)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentSoignant.prenom} {currentSoignant.nom}
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', margin: '2px 0 0' }}>
                    {t(roleConfig(currentSoignant.role).labelKey)}
                    <span style={{ marginLeft: 6, fontFamily: 'monospace' }}>· {currentSoignant.matricule}</span>
                  </p>
                </div>
              </>
            ) : (
              <>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: 'var(--fond-surface-2)',
                  border: '1.5px dashed var(--bordure-normale)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <UserMinus size={15} style={{ color: 'var(--texte-tertiaire)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-secondaire)', margin: 0 }}>
                    {t('triage.aucunSoignantAssigne')}
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', margin: '2px 0 0' }}>
                    {t('triage.cliquerPourAssigner')}
                  </p>
                </div>
              </>
            )}
            {soignantInteractif && (
              <div style={{
                width: 26, height: 26, borderRadius: 6,
                background: 'var(--ap-50)',
                border: '1px solid var(--ap-200)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {currentSoignant
                  ? <Pencil size={11} style={{ color: 'var(--ap-700)' }} />
                  : <UserPlus2 size={13} style={{ color: 'var(--ap-700)' }} />}
              </div>
            )}
          </button>
        ) })()}
        </div>

        {/* ── Actions secondaires ──────────────────────────────────────────── */}
        {isActive && canCancel && (
          <div>
            <SLabel>{t('triage.autresActions')}</SLabel>

            {/* Bloc annulation multi-étape */}
            {cancelStep !== 'idle' ? (
              <div style={{
                background: 'var(--erreur-fond)',
                border: '1px solid var(--erreur-bordure)',
                borderRadius: 8, padding: '12px',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={13} style={{ color: 'var(--erreur-texte)' }} />
                  <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--erreur-texte)' }}>
                    {t('triage.motifAnnulationRequis')}
                  </span>
                </div>
                <SelectBox
                  size="md"
                  fullWidth
                  value={motifAnnul}
                  onChange={(v) => {
                    setMotifAnnul(v)
                    setCancelStep(v === 'AUTRE' ? 'autre' : 'choose')
                  }}
                  placeholder={t('triage.selectionnerMotif')}
                  aria-label={t('triage.motifAnnulationRequis')}
                  options={MOTIFS_ANNULATION.map(m => ({ value: m.value, label: m.label }))}
                />
                {cancelStep === 'autre' && (
                  <input
                    type="text"
                    value={motifAutre}
                    onChange={e => setMotifAutre(e.target.value)}
                    placeholder={t('triage.preciserMotif')}
                    maxLength={500}
                    autoFocus
                    style={{
                      height: 32, padding: '0 10px', fontSize: '12px',
                      background: 'var(--fond-surface)',
                      border: '1px solid var(--bordure-normale)',
                      borderRadius: 6, outline: 'none',
                      color: 'var(--texte-primaire)',
                    }}
                  />
                )}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button
                    onClick={cancelClose}
                    style={{
                      padding: '5px 12px', borderRadius: 6, fontSize: '12px',
                      background: 'var(--fond-surface)', color: 'var(--texte-secondaire)',
                      border: '1px solid var(--bordure-normale)', cursor: 'pointer',
                    }}
                  >
                    {t('triage.retour')}
                  </button>
                  <button
                    onClick={submitCancel}
                    disabled={!motifAnnul || (motifAnnul === 'AUTRE' && !motifAutre.trim()) || updateStatut.isPending}
                    style={{
                      padding: '5px 12px', borderRadius: 6, fontSize: '12px', fontWeight: '600',
                      background: 'var(--erreur-accent)', color: '#fff', border: 'none',
                      cursor: 'pointer', opacity: !motifAnnul || (motifAnnul === 'AUTRE' && !motifAutre.trim()) ? 0.5 : 1,
                    }}
                  >
                    {t('triage.confirmerAnnulation')}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Annuler la visite (la clôture se fait UNIQUEMENT via une consultation) */}
                {canCancel && (
                  <button
                    onClick={() => setCancelStep('choose')}
                    style={{
                      height: 34, borderRadius: 6, fontSize: '12px', fontWeight: '500',
                      background: 'var(--fond-surface)', cursor: 'pointer',
                      border: '1px solid var(--erreur-bordure)', color: 'var(--erreur-texte)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    }}
                  >
                    <XCircle size={13} />
                    {t('triage.annuler')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* État terminal : info */}
        {!isActive && (
          <div style={{
            padding: '10px 12px', borderRadius: 8,
            background: visite.statut === 'CLOTUREE' ? 'var(--succes-fond)' : 'var(--fond-surface-2)',
            border:     `1px solid ${visite.statut === 'CLOTUREE' ? 'var(--succes-bordure)' : 'var(--bordure-normale)'}`,
            fontSize: '12px',
            color: visite.statut === 'CLOTUREE' ? 'var(--succes-texte)' : 'var(--texte-secondaire)',
          }}>
            {visite.statut === 'CLOTUREE'
              ? t('triage.visiteCloturee')
              : (visite.motifAnnulation
                  ? t('triage.visiteAnnuleeMotif', { motif: visite.motifAnnulation })
                  : t('triage.visiteAnnulee'))}
          </div>
        )}

        {/* ── Zone danger : suppression définitive — INTERDITE si clôturée (= archivée) ── */}
        {canDelete && visite.statut !== 'CLOTUREE' && (
          <div style={{ marginTop: 4, paddingTop: 10, borderTop: '1px dashed var(--bordure-legere)' }}>
            <Tooltip label={t('triage.supprimerTooltip')}>
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={deleteVisite.isPending}
                style={{
                  width: '100%', height: 32, borderRadius: 6, fontSize: '12px', fontWeight: '500',
                  background: 'transparent', cursor: 'pointer',
                  border: '1px solid var(--erreur-bordure)', color: 'var(--erreur-texte)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}
              >
                <Trash2 size={13} /> {t('triage.supprimerDefinitivement')}
              </button>
            </Tooltip>
          </div>
        )}

      </div>
    </div>

    {/* Modal de choix du soignant */}
    <SoignantPickerModal
      open={soignantOpen}
      onClose={() => setSoignantOpen(false)}
      currentId={visite.soignantId ?? null}
      pendingId={updateSoignant.isPending ? updateSoignant.variables ?? null : undefined}
      onSelect={(id) => {
        updateSoignant.mutate(id)
        setSoignantOpen(false)
      }}
    />

    {/* Confirmation de suppression définitive */}
    {confirmDelete && (
      <Modal
        icon={<Trash2 size={16} />}
        title={t('triage.supprimerVisiteTitle')}
        subtitle={t('triage.supprimerVisiteSubtitle')}
        width={440}
        onClose={() => setConfirmDelete(false)}
        footer={<>
          <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleteVisite.isPending}>{t('triage.annuler')}</Button>
          <Button
            onClick={() => deleteVisite.mutate(visite.id, { onSuccess: () => setConfirmDelete(false) })}
            disabled={deleteVisite.isPending}
            style={{ background: 'var(--erreur-accent)', color: '#fff', border: 'none', gap: 5 }}
          >
            <Trash2 size={14} /> {deleteVisite.isPending ? t('triage.suppression') : t('triage.supprimer')}
          </Button>
        </>}
      >
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--texte-secondaire)', lineHeight: 1.6 }}>
          {t('triage.supprimerVisiteBody')}
        </p>
      </Modal>
    )}
    </>
  )
}
