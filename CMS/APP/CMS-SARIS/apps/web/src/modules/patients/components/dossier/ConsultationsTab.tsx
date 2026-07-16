/**
 * ConsultationsTab — toutes les consultations du patient, du plus récent au plus
 * ancien. Chaque ligne ouvre le résumé de la consultation dans un TIROIR qui
 * glisse de la droite (aperçu complet lecture seule si clôturée/annulée).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Stethoscope, ChevronRight, Loader2 } from 'lucide-react'
import { EmptyState } from '@/components/saris'
import { formatDate, formatTime } from '@/lib/intl'
import { labelDecision } from '@/config/labels'
import { usePatientConsultations } from '@/modules/consultation/hooks/useConsultation'
import { DossierDetailDrawer } from './DossierDetailPanel'
import type { DossierDetailTarget } from './DossierDetailPanel'

const STATUT_CONSULT: Record<string, { labelKey: string; tint: string; bg: string }> = {
  OUVERTE:  { labelKey: 'patients.consultStatusOpen',      tint: 'var(--info-texte)',   bg: 'var(--info-fond)'   },
  CLOTUREE: { labelKey: 'patients.consultStatusClosed',    tint: 'var(--succes-texte)', bg: 'var(--succes-fond)' },
  ANNULEE:  { labelKey: 'patients.consultStatusCancelled', tint: 'var(--erreur-texte)', bg: 'var(--erreur-fond)' },
}

export function ConsultationsTab({ patientId }: { patientId: string }) {
  const { t } = useTranslation()
  const { data: consultations = [], isLoading, isError } = usePatientConsultations(patientId)
  const [detail, setDetail] = useState<DossierDetailTarget | null>(null)

  return (
    <div>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <Stethoscope size={15} style={{ color: 'var(--ap-600)' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--texte-primaire)' }}>{t('patients.consultationsTitle')}</span>
        <span style={{ fontSize: 11, color: 'var(--texte-tertiaire)', background: 'var(--fond-surface-2)', padding: '1px 7px', borderRadius: 99 }}>
          {t('patients.totalCount', { count: consultations.length })}
        </span>
      </div>

      {isError && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', color: 'var(--erreur-texte)', fontSize: 13 }}>
          {t('patients.erreurChargement')}
        </div>
      )}

      {!isError && isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 8, color: 'var(--texte-tertiaire)' }}>
          <Loader2 size={16} className="animate-spin" />
          <span style={{ fontSize: 13 }}>{t('patients.loading')}</span>
        </div>
      )}

      {!isError && !isLoading && consultations.length === 0 && (
        <EmptyState icon={<Stethoscope size={20} />} title={t('patients.consultEmptyTitle')} variant="subtle" />
      )}

      {!isError && !isLoading && consultations.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 720 }}>
          {consultations.map(c => {
            const cfg = STATUT_CONSULT[c.statut] ?? STATUT_CONSULT.CLOTUREE
            const decision = c.decisionMedicale ? labelDecision(c.decisionMedicale) : null
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setDetail({ kind: 'CONSULTATION', consultationId: c.id })}
                style={{
                  width: '100%', textAlign: 'left',
                  background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)',
                  borderRadius: 10, padding: '12px 14px',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 12,
                  transition: 'border-color 0.12s, background 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ap-300)'; e.currentTarget.style.background = 'var(--fond-surface-2)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bordure-legere)'; e.currentTarget.style.background = 'var(--fond-surface)' }}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                  background: cfg.bg, color: cfg.tint,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Stethoscope size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--texte-primaire)' }}>
                      {c.soignant ? t('consultation.doctorPrefix', { name: c.soignant.nom }) : (c.visite?.motifPrincipal?.libelle ?? t('patients.consultationsTitle'))}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em',
                      padding: '2px 7px', borderRadius: 9999, background: cfg.bg, color: cfg.tint,
                    }}>
                      {t(cfg.labelKey)}
                    </span>
                  </div>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--texte-secondaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formatDate(c.createdAt, { day: '2-digit', month: 'long', year: 'numeric' })} · {formatTime(c.createdAt, { hour: '2-digit', minute: '2-digit' })}
                    {c.visite?.motifPrincipal?.libelle ? ` · ${c.visite.motifPrincipal.libelle}` : ''}
                    {decision ? ` · ${decision}` : ''}
                  </p>
                </div>
                <ChevronRight size={15} style={{ color: 'var(--texte-tertiaire)', flexShrink: 0 }} />
              </button>
            )
          })}
        </div>
      )}

      {detail && <DossierDetailDrawer target={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
