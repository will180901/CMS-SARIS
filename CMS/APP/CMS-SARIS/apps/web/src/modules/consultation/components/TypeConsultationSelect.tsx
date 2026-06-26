/**
 * TypeConsultationSelect — pilule de sélection du type de consultation
 * (AT, Bilan obligatoire, Médecine générale…). Alimente les statistiques.
 */

import { useTranslation } from 'react-i18next'
import { ClipboardList } from 'lucide-react'
import { SelectBox } from '@/components/saris'
import { useTypesConsultation } from '@/modules/referentiels/hooks/useReferentiels'
import { useSetTypeConsultation } from '../hooks/useConsultation'

interface Props {
  consultationId: string
  currentTypeId:  string | null
  readonly?:      boolean
}

export function TypeConsultationSelect({ consultationId, currentTypeId, readonly }: Props) {
  const { t } = useTranslation()
  const { data: types = [] } = useTypesConsultation()
  const setType = useSetTypeConsultation(consultationId)
  const actifs  = types.filter(ty => ty.statut === 'ACTIF')

  if (readonly) {
    const lib = types.find(ty => ty.id === currentTypeId)?.libelle
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '12px', fontWeight: 600,
        color: 'var(--ap-700)', background: 'var(--ap-50)', border: '1px solid var(--ap-100)',
        borderRadius: 9999, padding: '3px 10px',
      }}>
        <ClipboardList size={12} /> {lib ?? t('consultation.typeNotSpecified')}
      </span>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, width: '100%', maxWidth: 320 }}>
      <ClipboardList size={13} style={{ color: 'var(--ap-600)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <SelectBox
          size="sm"
          value={currentTypeId ?? ''}
          onChange={v => setType.mutate(v || null)}
          placeholder={t('consultation.typePlaceholder')}
          options={actifs.map(ty => ({ value: ty.id, label: ty.libelle }))}
          aria-label={t('consultation.typeLabel')}
        />
      </div>
    </div>
  )
}
