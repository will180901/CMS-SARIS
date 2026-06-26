/**
 * DelegationsWidget — visible pour les infirmiers délégués.
 * Affiche les délégations actives qui les concernent (médicaments autorisés).
 */

import { useTranslation } from 'react-i18next'
import { GitBranch, Calendar } from 'lucide-react'
import { Card, StatusPill, EmptyState } from '@/components/saris'
import { useDelegations } from '@/modules/acteurs/hooks/useDelegations'
import { useSessionStore } from '@/stores/session.store'
import { formatDate } from '@/lib/intl'

export function DelegationsWidget() {
  const { t } = useTranslation()
  const personnelMedicalId = useSessionStore(s => s.user?.personnelMedicalId)
  const { data: delegations = [], isLoading } = useDelegations()

  // Filtrer les délégations actives qui me concernent
  const mesDelegations = delegations.filter(d =>
    d.statut === 'ACTIVE' &&
    d.infirmierId === personnelMedicalId &&
    new Date(d.dateFin) > new Date(),
  )

  if (isLoading || mesDelegations.length === 0) {
    if (!personnelMedicalId) return null   // pas de personnel lié
    if (mesDelegations.length === 0 && !isLoading) {
      // Afficher un avertissement explicite
      return (
        <Card>
          <Card.Header
            icon={<GitBranch size={14} />}
            title={t('dashboard.delegTitle')}
            subtitle={t('dashboard.delegCannotPrescribe')}
          />
          <Card.Body padding="md">
            <EmptyState
              icon={<GitBranch size={20} />}
              title={t('dashboard.delegEmptyTitle')}
              description={t('dashboard.delegEmptyDescription')}
              variant="subtle"
            />
          </Card.Body>
        </Card>
      )
    }
    return null
  }

  return (
    <Card>
      <Card.Header
        icon={<GitBranch size={14} />}
        title={t('dashboard.myActiveDelegations')}
        subtitle={t(mesDelegations.length > 1 ? 'dashboard.delegCountOther' : 'dashboard.delegCountOne', { count: mesDelegations.length })}
      />
      <Card.Body padding="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-2)' }}>
          {mesDelegations.map(d => (
            <div key={d.id} style={{
              padding: 'var(--espace-3)',
              background: 'var(--ap-50)',
              border: '1px solid var(--ap-200)',
              borderRadius: 'var(--radius-md)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-2)', marginBottom: 6 }}>
                <StatusPill tone="success" dot>{t('dashboard.delegActive')}</StatusPill>
                <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Calendar size={11} />
                  {t('dashboard.delegUntil', { date: formatDate(d.dateFin) })}
                </span>
              </div>
              {d.perimetre && (
                <p style={{
                  margin: '0 0 6px',
                  fontSize: 'var(--font-size-body-sm)',
                  color: 'var(--texte-primaire)',
                  whiteSpace: 'pre-wrap',
                }}>
                  {d.perimetre}
                </p>
              )}
            </div>
          ))}
        </div>
      </Card.Body>
    </Card>
  )
}
