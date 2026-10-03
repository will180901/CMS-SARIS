/**
 * BonExamenCard — affichage (lecture) des bons d'examen d'une consultation, dans l'onglet
 * "Bons" (Documents). Un bon naît exclusivement de « Générer un bon » sur une ordonnance
 * PRESCRIPTION_EXAMEN validée (OrdonnanceCard) — plus de création directe ici.
 * Cycle : EN_ATTENTE (généré) → VALIDE (transmis labo) → résultat reçu → CONSULTÉ
 *       ou EN_ATTENTE → ANNULE
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FileWarning, FlaskConical, ShieldCheck, FileText,
  Printer, Ban,
} from 'lucide-react'
import {
  Card, Button, StatusPill, EmptyState, MotifDialog,
} from '@/components/saris'
import { usePatientCouverture } from '@/modules/patients/hooks/usePatients'
import {
  useBonsExamen, useValiderBonExamen,
  useAnnulerBonExamen,
} from '../hooks/useBonExamen'
import { ResultatsParExamen, SaisieResultatsModal, ComptesRendus, ListeExamensPrescrits, examensManquants } from './ResultatsBon'
import { usePermissions } from '@/hooks/usePermissions'
import { BonExamenPrintModal } from './BonExamenPrintModal'
import type { BonExamen } from '../api/bon-examen.api'
import type { PrintSoignant } from '@/components/print/MedicalPrintSheet'

interface Props {
  consultationId:   string
  readonly?:        boolean
  soignant?:        PrintSoignant | null
  categorieLibelle?: string
  /** Patient de la consultation — ses droits RÉELS (catégorie + rattachement) décident du bon. */
  patientId?: string
  /** Résultats affichés ailleurs (onglet Résultats) : ne montrer que les examens prescrits. */
  sansResultats?: boolean
}

export function BonExamenCard({ consultationId, readonly, soignant, categorieLibelle, patientId, sansResultats }: Props) {
  const { t } = useTranslation()
  const { has } = usePermissions()
  // RÈGLE CENTRALE (recueil) : bon d'examens réservé au personnel CDI + ayants droit.
  // Dérivé de la même matrice de droits (DroitCategoriePatient, clé sur categorieId)
  // que le backend applique réellement à la création — jamais un code/libellé qui
  // pourrait être renommé (le backend reste de toute façon l'arbitre final).
  // FAIL-CLOSED par défaut (même logique que assertPrestationCouverte côté backend,
  // qui rejette si aucune ligne couvert=true n'existe) : une catégorie SANS aucun
  // droit configuré (ex. tout juste créée, jamais couverte par le seed) doit être
  // NON éligible, pas éligible par défaut — sinon le bouton s'affiche pour une
  // catégorie que le backend refusera systématiquement (403 à la soumission).
  const { data: couverture, isLoading: droitsLoading } = usePatientCouverture(patientId ?? '', !!patientId)
  // Droits suspendus (rattachement clôturé, CDI sorti des effectifs) : on dit POURQUOI,
  // au lieu du message générique « cette catégorie n'ouvre pas droit », faux ici.
  const suspension = couverture?.suspension ?? null
  const eligible = !patientId || (!droitsLoading && couverture?.couvert.EXAMEN === true)
  const canValidate  = has('bon_examen.validate') && !readonly
  const canCancel    = has('bon_examen.cancel') && !readonly
  const canResult    = has('bon_examen.result')

  const { data: bons = [], isLoading } = useBonsExamen({ consultationId })

  return (
    <Card>
      <Card.Header
        icon={<FileWarning size={14} />}
        title={t('bonExamen.cardTitle')}
        subtitle={isLoading
          ? t('bonExamen.loading')
          : t(bons.length > 1 ? 'bonExamen.countOther' : 'bonExamen.countOne', { count: bons.length })}
      />
      <Card.Body padding="md">
        {!isLoading && bons.length === 0 ? (
          <EmptyState
            icon={<FlaskConical size={18} />}
            title={eligible ? t('bonExamen.emptyTitle') : suspension ? t('patients.droitsSuspendus') : t('bonExamen.notEligibleTitle', { defaultValue: 'Bons d\'examens non couverts' })}
            description={eligible
              ? t('bonExamen.emptyDescriptionGenerated', { defaultValue: 'Aucun bon pour l\'instant — générez-en un depuis une ordonnance de prescription d\'examen validée (onglet Ordonnance).' })
              : (suspension ? t(`patients.suspension_${suspension.motif}`) : t('bonExamen.notEligibleDesc', { defaultValue: 'Cette catégorie de patient n\'ouvre pas droit aux bons d\'examens (réservé au personnel CDI et à leurs ayants droit).' }))}
            variant="subtle"
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
                sansResultats={sansResultats}
              />
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  )
}

// ── Item Bon d'examen ─────────────────────────────────────────────────────────

function BonExamenItem({
  bon, canValidate, canCancel, canResult, soignant, categorieLibelle, sansResultats,
}: {
  sansResultats?: boolean
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

        {/* Examens prescrits et leurs résultats, examen par examen — ou la seule liste des
            examens quand les résultats ont leur propre onglet (consultation clôturée). */}
        {sansResultats ? <ListeExamensPrescrits bon={bon} /> : (
          <>
            <ResultatsParExamen bon={bon} canResult={canResult && bon.statut === 'VALIDE'} />
            {/* Compte rendu du laboratoire (photo ou PDF) */}
            {bon.statut === 'VALIDE' && <ComptesRendus bon={bon} canResult={canResult} />}
          </>
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
            {t('bonExamen.ordonnanceAnnuleeWarning')}
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
              {canResult && !sansResultats && !showResultForm && examensManquants(bon).length > 0 && (
                <Button
                  size="sm"
                  variant="primary"
                  leftIcon={<FileText size={13} />}
                  onClick={() => setShowResultForm(true)}
                >
                  {t('bonExamen.saisirResultats')}
                </Button>
              )}
            </>
          )}
        </div>

        {/* Formulaire résultat */}
        {showResultForm && canResult && (
          <SaisieResultatsModal
            bon={bon}
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
