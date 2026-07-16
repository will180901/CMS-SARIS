/**
 * HistoriqueCategorieTab — historique des changements de catégorie du patient
 * (partie administrative, pas clinique). Purement informatif, pas d'action.
 */
import { useTranslation } from 'react-i18next'
import { Tag } from 'lucide-react'
import { EmptyState } from '@/components/saris'
import { formatDate, formatTime } from '@/lib/intl'
import type { PatientDossier } from '@cms-saris/types'

export function HistoriqueCategorieTab({ dossier }: { dossier: PatientDossier }) {
  const { t } = useTranslation()
  const historiques = [...dossier.historiquesCateg].sort(
    (a, b) => new Date(b.dateEffet ?? b.createdAt).getTime() - new Date(a.dateEffet ?? a.createdAt).getTime(),
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <Tag size={15} style={{ color: 'var(--ap-600)' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--texte-primaire)' }}>{t('patients.categoryHistoryTitle')}</span>
        <span style={{ fontSize: 11, color: 'var(--texte-tertiaire)', background: 'var(--fond-surface-2)', padding: '1px 7px', borderRadius: 99 }}>
          {t('patients.totalCount', { count: historiques.length })}
        </span>
      </div>

      {historiques.length === 0 ? (
        <EmptyState icon={<Tag size={20} />} title={t('patients.historyEmptyTitle')} variant="subtle" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 680 }}>
          {historiques.map(h => (
            <div
              key={h.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)',
                borderRadius: 10, padding: '12px 14px',
              }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                background: 'var(--fond-surface-2)', color: 'var(--texte-secondaire)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Tag size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--texte-primaire)' }}>
                  {h.ancienneCategId ? t('patients.tlCategoryChange') : t('patients.tlInitialCategory')}
                </span>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--texte-secondaire)' }}>
                  → {h.nouvelleCategorie.libelle}{h.motif ? ` · ${h.motif}` : ''}
                </p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--texte-tertiaire)' }}>
                  {formatDate(h.dateEffet ?? h.createdAt, { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </div>
                <div style={{ fontSize: 10, color: 'var(--texte-quaternaire)' }}>
                  {formatTime(h.dateEffet ?? h.createdAt, { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
