/**
 * ConsultationArchiveSummary — vue de fin de vie d'une consultation CLÔTURÉE ou
 * ANNULÉE, en lecture seule, rangée en 5 ONGLETS horizontaux (Résumé · Examen ·
 * Prescriptions · Résultats · Décision) — calqués sur le déroulé de la consultation
 * active. Avant : onze blocs empilés qu'il fallait faire défiler.
 *
 * Réutilise les cartes documents existantes (déjà lecture-seule-capables) plutôt
 * que de réinventer leur affichage — seule la présentation d'ensemble change.
 * Les résultats d'examens, qui arrivent APRÈS la clôture, restent saisissables.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, XCircle, Trash2, ArrowUpRight, FileText, Stethoscope, Pill, FlaskConical, Flag } from 'lucide-react'
import { Button, Modal, InfoSection, InfoRow, StatusPill, SegmentedTabs, EmptyState } from '@/components/saris'
import { usePersistedState } from '@/hooks/usePersistedState'
import { useBonsExamen } from '@/modules/bon-examen/hooks/useBonExamen'
import { ResultatsDesBons, examensManquants } from '@/modules/bon-examen/components/ResultatsBon'
import { usePermissions } from '@/hooks/usePermissions'
import { useDeleteConsultation } from '../hooks/useConsultation'
import { formatDateTime, formatDate } from '@/lib/intl'
import { nomSoignant } from '@/lib/soignant'
import { labelDecision } from '@/config/labels'
import { DiagnosticsCard } from './DiagnosticsCard'
import { OrdonnanceCard } from './OrdonnanceCard'
import { OrdonnancePrintModal } from './OrdonnancePrintModal'
import { CertificatReposPrintModal } from './CertificatReposPrintModal'
import { CertificatCard } from './CertificatCard'
import { BonExamenCard } from '@/modules/bon-examen/components/BonExamenCard'
import { BonPharmacieCard } from '@/modules/bon-pharmacie/components/BonPharmacieCard'
import { EvacuationCard } from '@/modules/sorties-critiques/components/EvacuationCard'
import { SuiviTraitementCard } from '@/modules/suivi-traitement/components/SuiviTraitementCard'
import type { useConsultation } from '../hooks/useConsultation'

type Onglet = 'resume' | 'examen' | 'prescriptions' | 'resultats' | 'decision'

interface Props {
  consultationId: string
  consultation:   NonNullable<ReturnType<typeof useConsultation>['data']>
  /** Appelé après suppression définitive — défaut : navigation vers /consultations.
   *  (Le dossier patient passe un retour à l'onglet courant pour ne pas quitter la page.) */
  onDeleted?:     () => void
  /** Ouvre la visite d'origine (dossier patient) — absent ailleurs, le bouton aussi. */
  onOuvrirVisite?: (visiteId: string) => void
}

export function ConsultationArchiveSummary({ consultationId, consultation, onDeleted, onOuvrirVisite }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { has } = usePermissions()
  const [previewOrdId, setPreviewOrdId] = useState<string | null>(null)
  const [previewRepos, setPreviewRepos] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const deleteConsult = useDeleteConsultation(consultationId)
  const [onglet, setOnglet] = usePersistedState<Onglet>('consultation', 'archiveOnglet', 'resume')
  const { data: bons = [] } = useBonsExamen({ consultationId })
  const bonsActifs = bons.filter(b => b.statut !== 'ANNULE')
  const totalExamens = bonsActifs.reduce((n, b) => n + b.lignes.length, 0)
  const totalRecus = bonsActifs.reduce((n, b) => n + b.lignes.length - examensManquants(b).length, 0)
  const aEvacuation = consultation.decisionMedicale === 'EVACUATION' || (!!consultation.evacuation && consultation.evacuation.statut !== 'ANNULE')
  const aSuivi = consultation.decisionMedicale === 'SUIVI_TRAITEMENT' || (!!consultation.suiviTraitement && consultation.suiviTraitement.statut !== 'ANNULE')
  const aRepos = (consultation.reposJours ?? 0) > 0 || consultation._count.certificats > 0

  const { patient } = consultation.visite
  const cloturee = consultation.statut === 'CLOTUREE'
  const canDelete = has('consultation.delete')

  const impact = [
    consultation.diagnostics.length > 0 && t('consultation.archiveImpactDiagnostics', { count: consultation.diagnostics.length }),
    consultation.ordonnances.length > 0 && t('consultation.archiveImpactOrdonnances', { count: consultation.ordonnances.length }),
    consultation._count.bonsExamen > 0 && t('consultation.archiveImpactBonsExamen', { count: consultation._count.bonsExamen }),
    consultation._count.bonsPharmacie > 0 && t('consultation.archiveImpactBonsPharmacie', { count: consultation._count.bonsPharmacie }),
    consultation._count.certificats > 0 && t('consultation.archiveImpactCertificats', { count: consultation._count.certificats }),
    consultation.evacuation && consultation.evacuation.statut !== 'ANNULE' && t('consultation.archiveImpactEvacuation'),
  ].filter((x): x is string => !!x)

  return (
    <div className="cons-archive" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Sans ça, les enfants (flex-shrink:1 par défaut) se COMPRESSENT pour tenir dans
          la hauteur disponible au lieu de déborder + faire défiler le conteneur — chaque
          carte se retrouve alors tronquée par son propre `overflow:hidden` (Card.tsx),
          sans qu'aucun défilement ne puisse jamais révéler le contenu coupé. */}
      <style>{`.cons-archive > * { flex-shrink: 0; }`}</style>

      {/* Onglets : chaque bloc à sa place, compteurs à l'appui. */}
      <div style={{ overflowX: 'auto', flexShrink: 0 }}>
        <SegmentedTabs
          value={onglet}
          onChange={k => setOnglet(k as Onglet)}
          tabs={[
            { key: 'resume',        label: t('consultation.ongletResume'),        icon: <FileText size={13} /> },
            { key: 'examen',        label: t('consultation.ongletExamen'),        icon: <Stethoscope size={13} />, badge: consultation.diagnostics.length || undefined },
            { key: 'prescriptions', label: t('consultation.ongletPrescriptions'), icon: <Pill size={13} />, badge: consultation.ordonnances.length || undefined },
            { key: 'resultats',     label: t('consultation.ongletResultats'),     icon: <FlaskConical size={13} />, badge: totalExamens ? `${totalRecus}/${totalExamens}` : undefined },
            { key: 'decision',      label: t('consultation.ongletDecision'),      icon: <Flag size={13} /> },
          ]}
        />
      </div>

      {onglet === 'resume' && (
        <>
        {/* Qui, quand, où, pourquoi (constat 80) : le résumé ne disait ni la date de la
            consultation, ni le soignant, ni le site, ni le motif — seulement l'issue. */}
        <InfoSection title={t('consultation.archiveContexteTitle')}>
          <InfoRow
            label={t('consultation.archiveDateLabel')}
            value={formatDateTime(consultation.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          />
          {consultation.soignant && (
            <InfoRow label={t('consultation.archiveSoignantLabel')} value={nomSoignant(consultation.soignant, t)} />
          )}
          {consultation.visite.site?.libelle && (
            <InfoRow label={t('consultation.archiveSiteLabel')} value={consultation.visite.site.libelle} />
          )}
          {consultation.visite.motifPrincipal?.libelle && (
            <InfoRow label={t('consultation.archiveMotifLabel')} value={consultation.visite.motifPrincipal.libelle} />
          )}
          {/* Retour à la visite d'origine (constat 80) : triage, constantes, notes d'accueil. */}
          {onOuvrirVisite && (
            <div style={{ marginTop: 8 }}>
              <Button variant="outline" size="sm" leftIcon={<ArrowUpRight size={13} />} onClick={() => onOuvrirVisite(consultation.visiteId)}>
                {t('consultation.archiveVoirVisite')}
              </Button>
            </div>
          )}
        </InfoSection>
        <InfoSection
          title={t('consultation.archiveDecisionTitle')}
          icon={cloturee ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
        >
          <InfoRow
            label={t('consultation.archiveStatusLabel')}
            valueNode={
              <StatusPill tone={cloturee ? 'success' : 'error'}>
                {cloturee ? t('consultation.consultationClosed') : t('consultation.consultationCancelled')}
              </StatusPill>
            }
          />
          <InfoRow
            label={cloturee ? t('consultation.archiveClosedAtLabel') : t('consultation.archiveCancelledAtLabel')}
            value={consultation.closedAt ? formatDateTime(consultation.closedAt, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null}
          />
          {cloturee && (
            <InfoRow label={t('consultation.archiveDecisionLabel')} value={labelDecision(consultation.decisionMedicale)} />
          )}
          {!cloturee && (
            <InfoRow label={t('consultation.archiveCancelReasonLabel')} value={consultation.motifAnnulation} full />
          )}
          {consultation.conclusion && (
            <InfoRow label={t('consultation.conclusionTitle')} value={consultation.conclusion} full />
          )}
        </InfoSection>
        </>
      )}

      {onglet === 'examen' && (
        <>
        {/* Anamnèse en lecture seule : elle n'existait que dans le stepper actif, et
            disparaissait donc à la clôture. */}
        {(consultation.anamneseSymptomes || consultation.anamneseDateDebut || consultation.anamneseDuree || consultation.anamneseModeDebut) && (
          <InfoSection title={t('consultation.anamneseTitle')}>
            {consultation.anamneseSymptomes && <InfoRow label={t('consultation.anamneseSymptomes')} value={consultation.anamneseSymptomes} full />}
            {consultation.anamneseDateDebut && <InfoRow label={t('consultation.anamneseDateDebut')} value={formatDate(consultation.anamneseDateDebut)} />}
            {consultation.anamneseDuree && <InfoRow label={t('consultation.anamneseDuree')} value={consultation.anamneseDuree} />}
            {consultation.anamneseModeDebut && <InfoRow label={t('consultation.anamneseModeDebut')} value={consultation.anamneseModeDebut} />}
          </InfoSection>
        )}
        <InfoSection title={t('consultation.stepExamen')}>
          <InfoRow label={t('consultation.archiveTypeConsultationLabel')} value={consultation.typeConsultation?.libelle} full />
          <InfoRow label={t('consultation.examenClinicalLabel', { defaultValue: 'Examen clinique' })} value={consultation.examenClinique} full />
        </InfoSection>
        <DiagnosticsCard consultationId={consultationId} diagnostics={consultation.diagnostics} readonly />
        </>
      )}

      {onglet === 'prescriptions' && (
        <>
        <OrdonnanceCard
          consultationId={consultationId}
          consultation={consultation}
          ordonnances={consultation.ordonnances}
          readonly
          onPreview={setPreviewOrdId}
        />
        <BonExamenCard
          consultationId={consultationId}
          readonly
          soignant={consultation.soignant}
          categorieLibelle={patient.categoriePatient.libelle}
          patientId={patient.id}
          sansResultats
        />
        <BonPharmacieCard
          consultationId={consultationId}
          readonly
          patientId={patient.id}
          soignant={consultation.soignant}
          categorieLibelle={patient.categoriePatient.libelle}
        />
        </>
      )}

      {onglet === 'resultats' && <ResultatsDesBons consultationId={consultationId} />}

      {/* Décision : seulement la suite RÉELLEMENT donnée — plus de carte « aucune
          évacuation » vide sous un suivi, ni de repos à 0 jour. */}
      {onglet === 'decision' && (
        <>
        {!aEvacuation && !aSuivi && !aRepos && (
          <EmptyState icon={<Flag size={18} />} title={t('consultation.aucuneSuiteTitre')} description={t('consultation.aucuneSuiteDescription')} variant="subtle" />
        )}
        {aEvacuation && (
          <EvacuationCard
            consultationId={consultationId}
            readonly
            patient={{ identite: patient.identite, numeroPatient: patient.numeroPatient, categorieLibelle: patient.categoriePatient.libelle }}
            soignant={consultation.soignant}
          />
        )}
        {aSuivi && <SuiviTraitementCard consultationId={consultationId} readonly />}
        {aRepos && (
          <CertificatCard
            consultationId={consultationId}
            reposJours={consultation.reposJours ?? null}
            reposInclutJour={consultation.reposInclutJour ?? false}
            dateReprise={consultation.dateReprise ?? null}
            readonly
            onPrint={() => setPreviewRepos(true)}
          />
        )}
        </>
      )}

      {onglet === 'resume' && canDelete && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
          <Button
            variant="outline"
            leftIcon={<Trash2 size={13} />}
            onClick={() => setConfirmDel(true)}
            style={{ color: 'var(--erreur-texte)', borderColor: 'var(--erreur-bordure)' }}
          >
            {t('consultation.deletePermanently')}
          </Button>
        </div>
      )}

      {confirmDel && (
        <Modal
          icon={<Trash2 size={16} />}
          title={t('consultation.deleteConsultationTitle')}
          subtitle={t('consultation.deleteConsultationSubtitle')}
          width={480}
          onClose={() => setConfirmDel(false)}
          footer={<>
            <Button variant="outline" onClick={() => setConfirmDel(false)} disabled={deleteConsult.isPending}>{t('consultation.cancel')}</Button>
            <Button
              onClick={() => deleteConsult.mutate(undefined, { onSuccess: () => onDeleted ? onDeleted() : navigate('/consultations') })}
              disabled={deleteConsult.isPending}
              style={{ background: 'var(--erreur-accent)', color: '#fff', border: 'none', gap: 5 }}
            >
              <Trash2 size={14} /> {deleteConsult.isPending ? t('consultation.deleting') : t('consultation.delete')}
            </Button>
          </>}
        >
          <p style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--texte-secondaire)', lineHeight: 1.6 }}>
            {t('consultation.deleteConsultationBody')}
          </p>
          {impact.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {impact.map((line, i) => (
                <li key={i} style={{ fontSize: '13px', color: 'var(--erreur-texte)', fontWeight: 600 }}>{line}</li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {previewOrdId && (() => {
        const ord = consultation.ordonnances.find(o => o.id === previewOrdId)
        return ord ? <OrdonnancePrintModal consultation={consultation} ordonnance={ord} onClose={() => setPreviewOrdId(null)} variant="inline" /> : null
      })()}
      {previewRepos && (
        <CertificatReposPrintModal consultation={consultation} onClose={() => setPreviewRepos(false)} variant="inline" />
      )}
    </div>
  )
}
