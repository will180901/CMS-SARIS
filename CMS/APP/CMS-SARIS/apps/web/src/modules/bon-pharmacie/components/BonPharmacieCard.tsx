/**
 * BonPharmacieCard — bon de pharmacie (recueil) d'une consultation.
 * Voucher de retrait de médicaments DISTINCT de l'ordonnance, réservé au personnel
 * CDI + ayants droit (la garde backend reste l'arbitre ; ici on masque seulement l'action).
 *
 * Cycle : EN_ATTENTE → DELIVRE (retiré pharmacie) ou EN_ATTENTE → ANNULE
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pill, Plus, X, PackageCheck, Ban, Trash2, Check, Printer } from 'lucide-react'
import {
  Card, Button, StatusPill, EmptyState, Field, Textarea, TextInput, SelectBox, Modal, MotifDialog,
} from '@/components/saris'
import type { PrintSoignant } from '@/components/print/MedicalPrintSheet'
import { useMedicaments } from '@/modules/referentiels/hooks/useReferentiels'
import { usePermissions } from '@/hooks/usePermissions'
import { useIsCompact } from '@/hooks/useMediaQuery'
import { formatDate } from '@/lib/intl'
import {
  useBonsPharmacie, useCreateBonPharmacie, useDelivrerBonPharmacie,
  useAnnulerBonPharmacie, useDeleteBonPharmacie,
} from '../hooks/useBonPharmacie'
import { BonPharmaciePrintModal } from './BonPharmaciePrintModal'
import type { BonPharmacie } from '../api/bon-pharmacie.api'

interface Props {
  consultationId:    string
  readonly?:         boolean
  categorieCode?:    string
  soignant?:         PrintSoignant | null
  categorieLibelle?: string
}

export function BonPharmacieCard({ consultationId, readonly, categorieCode, soignant, categorieLibelle }: Props) {
  const { t } = useTranslation()
  const { has } = usePermissions()
  // RÈGLE CENTRALE (recueil) : médicaments réservés au personnel CDI + ayants droit.
  const eligible  = !categorieCode || categorieCode === 'ASSURE_CDI' || categorieCode === 'AYANT_DROIT_CDI'
  const canCreate = has('bon_pharmacie.create') && !readonly && eligible

  const { data: bons = [], isLoading } = useBonsPharmacie({ consultationId })
  const [openNew, setOpenNew] = useState(false)

  return (
    <>
      <Card>
        <Card.Header
          icon={<Pill size={14} />}
          title={t('bonPharmacie.cardTitle', { defaultValue: 'Bon de pharmacie' })}
          subtitle={isLoading
            ? t('common.loading', { defaultValue: 'Chargement…' })
            : t('bonPharmacie.count', { count: bons.length, defaultValue: `${bons.length} bon(s)` })}
          actions={canCreate && (
            <Button size="sm" variant="outline" leftIcon={<Plus size={13} />} onClick={() => setOpenNew(true)}>
              {t('bonPharmacie.newBon', { defaultValue: 'Nouveau bon' })}
            </Button>
          )}
        />
        <Card.Body padding="md">
          {!isLoading && bons.length === 0 ? (
            <EmptyState
              icon={<Pill size={18} />}
              title={eligible
                ? t('bonPharmacie.emptyTitle', { defaultValue: 'Aucun bon de pharmacie' })
                : t('bonPharmacie.notEligibleTitle', { defaultValue: 'Médicaments non pris en charge' })}
              description={eligible
                ? t('bonPharmacie.emptyDescription', { defaultValue: 'Aucun médicament délivré pour cette consultation.' })
                : t('bonPharmacie.notEligibleDesc', { defaultValue: 'Cette catégorie de patient n\'ouvre pas droit à la prise en charge des médicaments (réservé au personnel CDI et à leurs ayants droit).' })}
              variant="subtle"
              action={canCreate && (
                <Button leftIcon={<Plus size={13} />} size="sm" onClick={() => setOpenNew(true)}>
                  {t('bonPharmacie.createFirst', { defaultValue: 'Créer un bon' })}
                </Button>
              )}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
              {bons.map(b => (
                <BonPharmacieItem key={b.id} bon={b} consultationId={consultationId} readonly={readonly} soignant={soignant} categorieLibelle={categorieLibelle} />
              ))}
            </div>
          )}
        </Card.Body>
      </Card>

      {openNew && (
        <CreateBonPharmacieDialog consultationId={consultationId} onClose={() => setOpenNew(false)} />
      )}
    </>
  )
}

// ── Item ────────────────────────────────────────────────────────────────────────

function BonPharmacieItem({ bon, consultationId, readonly, soignant, categorieLibelle }: { bon: BonPharmacie; consultationId: string; readonly?: boolean; soignant?: PrintSoignant | null; categorieLibelle?: string }) {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const deliver = useDelivrerBonPharmacie(consultationId)
  const annuler = useAnnulerBonPharmacie(consultationId)
  const remove  = useDeleteBonPharmacie(consultationId)
  const [showAnnuler, setShowAnnuler] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)

  const canDeliver = has('bon_pharmacie.deliver') && !readonly && bon.statut === 'EN_ATTENTE'
  const canCancel  = has('bon_pharmacie.cancel')  && !readonly && bon.statut === 'EN_ATTENTE'
  const canDelete  = has('bon_pharmacie.delete')  && !readonly && bon.statut !== 'DELIVRE'

  const tone = bon.statut === 'EN_ATTENTE' ? 'warning' : bon.statut === 'DELIVRE' ? 'success' : 'neutral'

  return (
    <div style={{ border: `1px solid ${bon.statut === 'DELIVRE' ? 'var(--succes-bordure)' : 'var(--bordure-legere)'}`, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <div style={{ padding: 'var(--espace-2) var(--espace-3)', background: bon.statut === 'DELIVRE' ? 'var(--succes-fond)' : 'var(--fond-surface-2)', display: 'flex', alignItems: 'center', gap: 'var(--espace-2)', borderBottom: '1px solid var(--bordure-legere)' }}>
        <Pill size={13} style={{ color: 'var(--ap-600)' }} />
        <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', fontWeight: 600, color: 'var(--texte-primaire)', flex: 1 }}>
          {t('bonPharmacie.bonNumber', { numero: bon.id.slice(0, 8).toUpperCase(), defaultValue: `Bon ${bon.id.slice(0, 8).toUpperCase()}` })}
        </p>
        <StatusPill tone={tone as any}>
          {bon.statut === 'EN_ATTENTE' ? t('bonPharmacie.statusPending', { defaultValue: 'En attente' })
            : bon.statut === 'DELIVRE' ? t('bonPharmacie.statusDelivered', { defaultValue: 'Délivré' })
            : t('bonPharmacie.statusCancelled', { defaultValue: 'Annulé' })}
        </StatusPill>
      </div>

      <div style={{ padding: 'var(--espace-3)', display: 'flex', flexDirection: 'column', gap: 'var(--espace-2)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {bon.lignes.map(l => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 'var(--font-size-body-sm)' }}>
              <span style={{ fontWeight: 600, color: 'var(--texte-primaire)' }}>{l.medicament?.nomGenerique ?? l.libelle}</span>
              {l.posologie && <span style={{ color: 'var(--texte-secondaire)' }}>· {l.posologie}</span>}
              {l.quantite && <span style={{ color: 'var(--texte-tertiaire)', marginLeft: 'auto' }}>{t('bonPharmacie.qty', { q: l.quantite, defaultValue: `Qté ${l.quantite}` })}</span>}
            </div>
          ))}
        </div>

        {bon.observations && (
          <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)', whiteSpace: 'pre-wrap' }}>{bon.observations}</p>
        )}

        {bon.statut === 'DELIVRE' && bon.delivreLe && (
          <p style={{ margin: 0, fontSize: 'var(--font-size-caption)', color: 'var(--succes-texte)' }}>
            {t('bonPharmacie.deliveredOn', { date: formatDate(bon.delivreLe), defaultValue: `Délivré le ${formatDate(bon.delivreLe)}` })}
          </p>
        )}
        {bon.statut === 'ANNULE' && bon.motifAnnulation && (
          <p style={{ margin: 0, fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', fontStyle: 'italic' }}>
            {t('bonPharmacie.cancelledReason', { motif: bon.motifAnnulation, defaultValue: `Annulé : ${bon.motifAnnulation}` })}
          </p>
        )}

        <div style={{ display: 'flex', gap: 'var(--espace-2)', flexWrap: 'wrap', marginTop: 2 }}>
          <Button size="sm" variant="outline" leftIcon={<Printer size={13} />} onClick={() => setPrintOpen(true)}>
            {t('bonPharmacie.print', { defaultValue: 'Imprimer' })}
          </Button>
          {canDeliver && (
            <Button size="sm" variant="primary" leftIcon={<PackageCheck size={13} />} loading={deliver.isPending} onClick={() => deliver.mutate(bon.id)}>
              {t('bonPharmacie.markDelivered', { defaultValue: 'Marquer délivré' })}
            </Button>
          )}
          {canCancel && (
            <Button size="sm" variant="ghost" leftIcon={<Ban size={13} />} onClick={() => setShowAnnuler(true)}>
              {t('bonPharmacie.cancelBon', { defaultValue: 'Annuler' })}
            </Button>
          )}
          {canDelete && (
            <Button size="sm" variant="ghost" leftIcon={<Trash2 size={13} />} loading={remove.isPending} onClick={() => remove.mutate(bon.id)}>
              {t('common.delete', { defaultValue: 'Supprimer' })}
            </Button>
          )}
        </div>

        {showAnnuler && (
          <MotifDialog
            icon={<Ban size={16} />}
            title={t('bonPharmacie.cancelDialogTitle', { defaultValue: 'Annuler le bon de pharmacie' })}
            label={t('bonPharmacie.cancelDialogLabel', { defaultValue: 'Motif d\'annulation' })}
            placeholder={t('bonPharmacie.cancelDialogPlaceholder', { defaultValue: 'Préciser le motif…' })}
            confirmLabel={t('bonPharmacie.cancelDialogConfirm', { defaultValue: 'Annuler le bon' })}
            confirmIcon={<Ban size={14} />}
            danger
            loading={annuler.isPending}
            onConfirm={(motif) => annuler.mutate({ id: bon.id, motif }, { onSuccess: () => setShowAnnuler(false) })}
            onClose={() => setShowAnnuler(false)}
          />
        )}
      </div>

      {printOpen && (
        <BonPharmaciePrintModal
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

// ── Dialog création ───────────────────────────────────────────────────────────

interface Ligne { medicamentId: string; libelle: string; posologie: string; quantite: string }
const EMPTY_LIGNE: Ligne = { medicamentId: '', libelle: '', posologie: '', quantite: '' }

function CreateBonPharmacieDialog({ consultationId, onClose }: { consultationId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const isCompact = useIsCompact()
  const create = useCreateBonPharmacie()
  const { data: medicaments = [] } = useMedicaments()
  const medsActifs = medicaments.filter((m: { statut: string }) => m.statut === 'ACTIF')
  const [lignes, setLignes] = useState<Ligne[]>([EMPTY_LIGNE])
  const [observations, setObservations] = useState('')

  // Une ligne est valide dès qu'un médicament du référentiel est choisi.
  const valides = lignes.filter(l => l.medicamentId && l.libelle.trim())
  const setLigne = (i: number, patch: Partial<Ligne>) => setLignes(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  const addLigne = () => setLignes(ls => [...ls, EMPTY_LIGNE])
  const removeLigne = (i: number) => setLignes(ls => ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls)
  const pickMed = (i: number, id: string) => {
    const m = medsActifs.find((x: { id: string }) => x.id === id)
    setLigne(i, { medicamentId: id, libelle: m?.nomGenerique ?? '' })
  }

  async function handleSubmit() {
    if (!valides.length) return
    await create.mutateAsync({
      consultationId,
      observations: observations.trim() || undefined,
      lignes: valides.map(l => ({ medicamentId: l.medicamentId, libelle: l.libelle.trim(), posologie: l.posologie.trim() || undefined, quantite: l.quantite.trim() || undefined })),
    })
    onClose()
  }

  return (
    <Modal
      icon={<Pill size={16} />}
      title={t('bonPharmacie.newModalTitle', { defaultValue: 'Nouveau bon de pharmacie' })}
      subtitle={t('bonPharmacie.newModalSubtitle', { defaultValue: 'Médicaments pris en charge (CDI et ayants droit)' })}
      width={620}
      onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel', { defaultValue: 'Annuler' })}</Button>
        <Button variant="primary" loading={create.isPending} disabled={!valides.length} leftIcon={<Check size={14} />} onClick={handleSubmit}>
          {t('bonPharmacie.createBon', { defaultValue: 'Créer le bon' })}
        </Button>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-2)' }}>
          {lignes.map((l, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1.5fr 1fr 70px 28px', gap: 6, alignItems: 'center' }}>
              <SelectBox
                size="sm"
                fullWidth
                value={l.medicamentId}
                onChange={id => pickMed(i, id)}
                placeholder={t('bonPharmacie.medLabel', { defaultValue: 'Médicament' })}
                aria-label={t('bonPharmacie.medLabel', { defaultValue: 'Médicament' })}
                options={medsActifs.map((m: { id: string; nomGenerique: string; nomCommercial?: string | null }) => ({
                  value: m.id,
                  label: m.nomCommercial ? `${m.nomGenerique} (${m.nomCommercial})` : m.nomGenerique,
                }))}
              />
              <TextInput value={l.posologie} maxLength={200} placeholder={t('bonPharmacie.posologie', { defaultValue: 'Posologie' })} onChange={e => setLigne(i, { posologie: e.target.value })} />
              <TextInput value={l.quantite} maxLength={100} placeholder={t('bonPharmacie.qtyShort', { defaultValue: 'Qté' })} onChange={e => setLigne(i, { quantite: e.target.value })} />
              <button type="button" onClick={() => removeLigne(i)} aria-label={t('common.remove', { defaultValue: 'Retirer' })}
                style={{ background: 'transparent', border: 'none', color: 'var(--texte-tertiaire)', cursor: lignes.length > 1 ? 'pointer' : 'not-allowed', padding: 4 }}>
                <X size={14} />
              </button>
            </div>
          ))}
          <Button size="sm" variant="ghost" leftIcon={<Plus size={13} />} onClick={addLigne} style={{ alignSelf: 'flex-start' }}>
            {t('bonPharmacie.addMed', { defaultValue: 'Ajouter un médicament' })}
          </Button>
          {medsActifs.length === 0 && (
            <p style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', margin: 0, fontStyle: 'italic' }}>
              {t('bonPharmacie.noMedHint', { defaultValue: 'Aucun médicament au référentiel — ajoutez-en dans Référentiels.' })}
            </p>
          )}
        </div>
        <Field label={t('bonPharmacie.observations', { defaultValue: 'Observations' })}>
          {(id) => (
            <Textarea id={id} maxLength={1000} rows={2} value={observations} onChange={e => setObservations(e.target.value)} placeholder={t('bonPharmacie.observationsPlaceholder', { defaultValue: 'Remarques (optionnel)' })} />
          )}
        </Field>
      </div>
    </Modal>
  )
}
