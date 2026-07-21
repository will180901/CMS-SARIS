/**
 * VisitesTab — tous les passages au triage du patient (toutes visites confondues),
 * du plus récent au plus ancien. Chaque ligne ouvre le résumé DE LA VISITE dans un
 * TIROIR qui glisse de la droite ; la consultation qui en a découlé (le cas échéant)
 * reste accessible depuis ce résumé, sans jamais s'y substituer par défaut.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HeartPulse, ChevronRight, Loader2 } from 'lucide-react'
import { EmptyState } from '@/components/saris'
import { formatDate, formatTime } from '@/lib/intl'
import { usePatientVisites } from '@/modules/triage/hooks/useTriage'
import { DossierDetailDrawer } from './DossierDetailPanel'
import type { DossierDetailTarget } from './DossierDetailPanel'

const STATUT_VISITE: Record<string, { labelKey: string; tint: string; bg: string }> = {
  EN_ATTENTE: { labelKey: 'patients.visiteEnAttente', tint: 'var(--avert-texte)',  bg: 'var(--avert-fond)'  },
  EN_COURS:   { labelKey: 'patients.visiteEnCours',   tint: 'var(--info-texte)',   bg: 'var(--info-fond)'   },
  CLOTUREE:   { labelKey: 'patients.visiteCloturee',  tint: 'var(--succes-texte)', bg: 'var(--succes-fond)' },
  ANNULEE:    { labelKey: 'patients.visiteAnnulee',   tint: 'var(--erreur-texte)', bg: 'var(--erreur-fond)' },
}

export function VisitesTab({ patientId }: { patientId: string }) {
  const { t } = useTranslation()
  const { data: visites = [], isLoading, isError } = usePatientVisites(patientId)
  const [detail, setDetail] = useState<DossierDetailTarget | null>(null)

  return (
    <div>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <HeartPulse size={15} style={{ color: 'var(--ap-600)' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--texte-primaire)' }}>{t('patients.visitesTitle')}</span>
        <span style={{ fontSize: 11, color: 'var(--texte-tertiaire)', background: 'var(--fond-surface-2)', padding: '1px 7px', borderRadius: 99 }}>
          {t('patients.totalCount', { count: visites.length })}
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

      {!isError && !isLoading && visites.length === 0 && (
        <EmptyState icon={<HeartPulse size={20} />} title={t('patients.visitesEmpty')} variant="subtle" />
      )}

      {!isError && !isLoading && visites.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 720 }}>
          {visites.map(v => {
            const cfg = STATUT_VISITE[v.statut] ?? STATUT_VISITE.CLOTUREE
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setDetail({ kind: 'VISITE', visiteId: v.id })}
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
                  background: 'var(--ap-50)', color: 'var(--ap-600)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <HeartPulse size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--texte-primaire)' }}>
                      {v.motifPrincipal?.libelle ?? t('patients.visitesTitle')}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em',
                      padding: '2px 7px', borderRadius: 9999, background: cfg.bg, color: cfg.tint,
                    }}>
                      {t(cfg.labelKey)}
                    </span>
                  </div>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--texte-secondaire)' }}>
                    {formatDate(v.dateOuverture, { day: '2-digit', month: 'long', year: 'numeric' })} · {formatTime(v.dateOuverture, { hour: '2-digit', minute: '2-digit' })}
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
