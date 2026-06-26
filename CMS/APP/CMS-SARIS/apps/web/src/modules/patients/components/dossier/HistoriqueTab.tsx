import { History, ArrowRight, Tag } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/saris'
import { formatDate, formatTime } from '@/lib/intl'
import { CategorieBadge } from '../CategorieBadge'
import type { PatientDossier, HistoriqueCategoriePatient } from '@cms-saris/types'

// ── Entrée de la timeline ─────────────────────────────────────────────────────

function TimelineEntry({ entry, index }: { entry: HistoriqueCategoriePatient; index: number }) {
  const { t } = useTranslation()
  const isFirst = index === 0
  const date    = formatDate(entry.dateEffet, {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  const time = formatTime(entry.createdAt, {
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div style={{ display: 'flex', gap: '14px' }}>
      {/* Axe vertical */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width:      32,
          height:     32,
          borderRadius: 8,
          background: isFirst ? 'var(--ap-50)' : 'var(--fond-surface-2)',
          border:     `1.5px solid ${isFirst ? 'var(--ap-200)' : 'var(--bordure-legere)'}`,
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Tag size={13} style={{ color: isFirst ? 'var(--ap-600)' : 'var(--texte-tertiaire)' }} />
        </div>
        <div style={{ flex: 1, width: 1, background: 'var(--bordure-legere)', minHeight: 12 }} />
      </div>

      {/* Contenu */}
      <div style={{ paddingBottom: '20px', flex: 1, minWidth: 0 }}>
        {/* Date/heure */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--texte-tertiaire)' }}>
            {date}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--bordure-normale)' }}>·</span>
          <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)' }}>{time}</span>
          {isFirst && (
            <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--ap-600)', background: 'var(--ap-50)', padding: '1px 6px', borderRadius: 99, border: '1px solid var(--ap-200)', letterSpacing: '0.03em' }}>
              {t('patients.historyCurrentBadge')}
            </span>
          )}
        </div>

        {/* Carte */}
        <div style={{
          background:   'var(--fond-surface)',
          border:       `1px solid ${isFirst ? 'var(--ap-200)' : 'var(--bordure-legere)'}`,
          borderRadius: 8,
          padding:      '12px 14px',
        }}>
          {/* Transition de catégorie */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {entry.ancienneCategId ? (
              <>
                <span style={{ fontSize: '12px', color: 'var(--texte-tertiaire)', fontStyle: 'italic' }}>
                  {t('patients.historyFormerCategory')}
                </span>
                <ArrowRight size={13} style={{ color: 'var(--texte-tertiaire)', flexShrink: 0 }} />
                <CategorieBadge code={entry.nouvelleCategorie.code} libelle={entry.nouvelleCategorie.libelle} />
              </>
            ) : (
              <>
                <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--texte-secondaire)' }}>
                  {t('patients.historyInitialCategory')}
                </span>
                <ArrowRight size={13} style={{ color: 'var(--texte-tertiaire)', flexShrink: 0 }} />
                <CategorieBadge code={entry.nouvelleCategorie.code} libelle={entry.nouvelleCategorie.libelle} />
              </>
            )}
          </div>

          {/* Motif */}
          {entry.motif && (
            <p style={{
              fontSize: '12px',
              color:    'var(--texte-secondaire)',
              margin:   '8px 0 0',
              paddingTop: '8px',
              borderTop: '1px solid var(--bordure-legere)',
              lineHeight: '1.5',
            }}>
              <span style={{ fontWeight: '600', color: 'var(--texte-tertiaire)' }}>{t('patients.historyReasonLabel')}</span>
              {entry.motif}
            </p>
          )}

          {/* Opérateur */}
          {entry.createdBy && (
            <p style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', margin: '6px 0 0' }}>
              {t('patients.historyByLabel', { operator: entry.createdBy })}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Onglet historique ─────────────────────────────────────────────────────────

export function HistoriqueTab({ dossier }: { dossier: PatientDossier }) {
  const { t } = useTranslation()
  const historique = dossier.historiquesCateg

  return (
    <div>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <History size={15} style={{ color: 'var(--ap-600)' }} />
        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--texte-primaire)' }}>
          {t('patients.categoryHistoryTitle')}
        </span>
        <span style={{
          fontSize: '11px', color: 'var(--texte-tertiaire)',
          background: 'var(--fond-surface-2)', padding: '1px 7px', borderRadius: 99,
        }}>
          {t(historique.length > 1 ? 'patients.entryCountPlural' : 'patients.entryCountSingular', { count: historique.length })}
        </span>
      </div>

      {/* Timeline */}
      {historique.length === 0 ? (
        <EmptyState
          icon={<History size={20} />}
          title={t('patients.historyEmptyTitle')}
          variant="subtle"
        />
      ) : (
        <div style={{ maxWidth: 640 }}>
          {historique.map((entry, index) => (
            <TimelineEntry key={entry.id} entry={entry} index={index} />
          ))}
          {/* Fin de timeline */}
          <div style={{ display: 'flex', gap: '14px' }}>
            <div style={{ width: 32, display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--bordure-normale)', marginTop: 4 }} />
            </div>
            <p style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', fontStyle: 'italic', paddingTop: 2 }}>
              {t('patients.recordCreatedOn', { date: formatDate(dossier.createdAt, { day: '2-digit', month: 'long', year: 'numeric' }) })}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
