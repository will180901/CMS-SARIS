/**
 * BonPharmacieCard — affichage (lecture) des bons de pharmacie d'une consultation, dans
 * l'onglet "Bons" (Documents). Un bon naît exclusivement de « Générer un bon » sur une
 * ordonnance PHARMACEUTIQUE validée (OrdonnanceCard) — plus de création directe ici.
 *
 * Cycle : EN_ATTENTE → DELIVRE (retiré pharmacie) ou EN_ATTENTE → ANNULE
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pill, PackageCheck, Ban, Trash2, Printer, FileWarning } from 'lucide-react'
import {
  Card, Button, StatusPill, EmptyState, MotifDialog,
} from '@/components/saris'
import type { PrintSoignant } from '@/components/print/MedicalPrintSheet'
import { useCategoriesDroits } from '@/modules/referentiels/hooks/useReferentiels'
import { usePermissions } from '@/hooks/usePermissions'
import { formatDate } from '@/lib/intl'
import {
  useBonsPharmacie, useDelivrerBonPharmacie,
  useAnnulerBonPharmacie, useDeleteBonPharmacie,
} from '../hooks/useBonPharmacie'
import { BonPharmaciePrintModal } from './BonPharmaciePrintModal'
import type { BonPharmacie } from '../api/bon-pharmacie.api'

interface Props {
  consultationId:    string
  readonly?:         boolean
  /** Id (stable, jamais le code/libellé) de la catégorie du patient — pour vérifier le droit au bon. */
  categoriePatientId?: string
  soignant?:         PrintSoignant | null
  categorieLibelle?: string
}

export function BonPharmacieCard({ consultationId, readonly, categoriePatientId, soignant, categorieLibelle }: Props) {
  const { t } = useTranslation()
  // RÈGLE CENTRALE (recueil) : médicaments réservés au personnel CDI + ayants droit.
  // Dérivé de la même matrice de droits (DroitCategoriePatient, clé sur categorieId)
  // que le backend applique réellement à la génération — jamais un code/libellé qui
  // pourrait être renommé (le backend reste de toute façon l'arbitre final).
  // FAIL-CLOSED par défaut (même logique que assertPrestationCouverte côté backend,
  // qui rejette si aucune ligne couvert=true n'existe) : une catégorie SANS aucun
  // droit configuré (ex. tout juste créée, jamais couverte par le seed) doit être
  // NON éligible, pas éligible par défaut — sinon un message d'éligibilité trompeur.
  const { data: droits = [], isLoading: droitsLoading } = useCategoriesDroits()
  const droitCategorie = categoriePatientId ? droits.find(d => d.categorieId === categoriePatientId) : undefined
  const eligible = !categoriePatientId || (!droitsLoading && droitCategorie?.bonPharmacie === true)

  const { data: bons = [], isLoading } = useBonsPharmacie({ consultationId })

  return (
    <Card>
      <Card.Header
        icon={<Pill size={14} />}
        title={t('bonPharmacie.cardTitle', { defaultValue: 'Bon de pharmacie' })}
        subtitle={isLoading
          ? t('common.loading', { defaultValue: 'Chargement…' })
          : t('bonPharmacie.count', { count: bons.length, defaultValue: `${bons.length} bon(s)` })}
      />
      <Card.Body padding="md">
        {!isLoading && bons.length === 0 ? (
          <EmptyState
            icon={<Pill size={18} />}
            title={!eligible
              ? t('bonPharmacie.notEligibleTitle', { defaultValue: 'Médicaments non pris en charge' })
              : t('bonPharmacie.emptyTitle', { defaultValue: 'Aucun bon de pharmacie' })}
            description={!eligible
              ? t('bonPharmacie.notEligibleDesc', { defaultValue: 'Cette catégorie de patient n\'ouvre pas droit à la prise en charge des médicaments (réservé au personnel CDI et à leurs ayants droit).' })
              : t('bonPharmacie.emptyDescriptionGenerated', { defaultValue: 'Aucun bon pour l\'instant — générez-en un depuis une ordonnance pharmaceutique validée (onglet Ordonnance).' })}
            variant="subtle"
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

        {bon.ordonnance?.statut === 'ANNULEE' && bon.statut !== 'ANNULE' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 'var(--font-size-caption)',
            fontWeight: 600,
            color: 'var(--avert-texte)',
            background: 'var(--avert-fond)',
            border: '1px solid var(--avert-bordure)',
            padding: 'var(--espace-2)',
            borderRadius: 'var(--radius-md)',
          }}>
            <FileWarning size={13} style={{ flexShrink: 0 }} />
            {t('bonPharmacie.ordonnanceAnnuleeWarning', { defaultValue: 'Attention : l\'ordonnance à l\'origine de ce bon a été annulée depuis.' })}
          </div>
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

