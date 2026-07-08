/**
 * VisiteArchiveSummary — vue de fin de vie d'une visite CLÔTURÉE ou ANNULÉE :
 * remplace MotifCard + NotesCard + ActionsCard par un seul résumé en lecture
 * seule, propre et lisible (les dernières constantes restent visibles dans
 * `VisiteSidebar`, toujours affichée — pas dupliquées ici).
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, XCircle, Trash2, Stethoscope } from 'lucide-react'
import { Button, Modal, InfoSection, InfoRow, StatusPill } from '@/components/saris'
import { usePermissions } from '@/hooks/usePermissions'
import { useDeleteVisite } from '../hooks/useTriage'
import { formatDateTime } from '@/lib/intl'
import type { VisiteDetail as VisiteDetailType } from '@cms-saris/types'

interface Props {
  visite: VisiteDetailType
}

export function VisiteArchiveSummary({ visite }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { has } = usePermissions()
  const [confirmDel, setConfirmDel] = useState(false)
  const deleteVisite = useDeleteVisite()

  const cloturee = visite.statut === 'CLOTUREE'
  const canDelete = has('visite.delete')
  const consultation = visite.consultations?.[0] ?? null

  const impact = consultation ? [
    consultation._count.diagnostics > 0 && t('triage.archiveImpactDiagnostics', { count: consultation._count.diagnostics }),
    consultation._count.ordonnances > 0 && t('triage.archiveImpactOrdonnances', { count: consultation._count.ordonnances }),
    consultation._count.bonsExamen > 0 && t('triage.archiveImpactBonsExamen', { count: consultation._count.bonsExamen }),
    consultation._count.bonsPharmacie > 0 && t('triage.archiveImpactBonsPharmacie', { count: consultation._count.bonsPharmacie }),
    consultation._count.certificats > 0 && t('triage.archiveImpactCertificats', { count: consultation._count.certificats }),
  ].filter((x): x is string => !!x) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <InfoSection
        title={t('triage.archiveVisitTitle')}
        icon={cloturee ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
      >
        <InfoRow
          label={t('triage.archiveStatusLabel')}
          valueNode={
            <StatusPill tone={cloturee ? 'success' : 'error'}>
              {cloturee ? t('triage.visiteCloturee') : t('triage.visiteAnnulee')}
            </StatusPill>
          }
        />
        <InfoRow
          label={cloturee ? t('triage.archiveClosedAtLabel') : t('triage.archiveCancelledAtLabel')}
          value={visite.dateCloture ? formatDateTime(visite.dateCloture, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null}
        />
        <InfoRow label={t('triage.motifConsultation')} value={visite.motifPrincipal?.libelle} />
        <InfoRow label={t('triage.soignantAssigneLabel')} value={visite.soignant ? `${visite.soignant.prenom} ${visite.soignant.nom}` : null} />
        {!cloturee && (
          <InfoRow label={t('triage.archiveCancelReasonLabel')} value={visite.motifAnnulation} full />
        )}
      </InfoSection>

      {visite.notesAccueil && (
        <InfoSection title={t('triage.notesAccueil')} columns={1}>
          <InfoRow label={t('triage.notesAccueil')} value={visite.notesAccueil} full />
        </InfoSection>
      )}

      {consultation && (
        <InfoSection title={t('triage.archiveConsultationTitle')} icon={<Stethoscope size={14} />}>
          <InfoRow
            label={t('triage.archiveConsultationStatusLabel')}
            valueNode={
              <button
                type="button"
                onClick={() => navigate('/consultations', { state: { openConsultationId: consultation.id } })}
                style={{
                  fontSize: 13, fontWeight: 600, color: 'var(--ap-600)',
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline',
                }}
              >
                {t('triage.archiveOpenConsultation')}
              </button>
            }
          />
        </InfoSection>
      )}

      {canDelete && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
          <Button
            variant="outline"
            leftIcon={<Trash2 size={13} />}
            onClick={() => setConfirmDel(true)}
            style={{ color: 'var(--erreur-texte)', borderColor: 'var(--erreur-bordure)' }}
          >
            {t('triage.supprimerDefinitivement')}
          </Button>
        </div>
      )}

      {confirmDel && (
        <Modal
          icon={<Trash2 size={16} />}
          title={t('triage.supprimerVisiteTitle')}
          subtitle={t('triage.supprimerVisiteSubtitle')}
          width={480}
          onClose={() => setConfirmDel(false)}
          footer={<>
            <Button variant="outline" onClick={() => setConfirmDel(false)} disabled={deleteVisite.isPending}>{t('triage.annuler')}</Button>
            <Button
              onClick={() => deleteVisite.mutate(visite.id, { onSuccess: () => navigate('/triage') })}
              disabled={deleteVisite.isPending}
              style={{ background: 'var(--erreur-accent)', color: '#fff', border: 'none', gap: 5 }}
            >
              <Trash2 size={14} /> {deleteVisite.isPending ? t('triage.suppression') : t('triage.supprimer')}
            </Button>
          </>}
        >
          <p style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--texte-secondaire)', lineHeight: 1.6 }}>
            {t('triage.supprimerVisiteBody')}
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
    </div>
  )
}
