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
  /** Code (immuable après création, cf. verrouillage CategoriePatient.code) du patient
   *  — pour ne proposer les types réservés aux employés qu'aux bonnes catégories. */
  categorieCode?: string
}

// Types qui n'ont de sens que pour un EMPLOYÉ SARIS (CDI/CDD) — un bilan obligatoire ou
// une visite pré-embauche ne concernent jamais un ayant droit, un sous-traitant ou un
// riverain. Codes @unique et immuables (cf. UpdateCategoriePatientDto) → comparaison sûre.
const TYPES_RESERVES_EMPLOYE = ['BILAN_OBLIGATOIRE', 'VISITE_PRE_EMBAUCHE']

export function TypeConsultationSelect({ consultationId, currentTypeId, readonly, categorieCode }: Props) {
  const { t } = useTranslation()
  const { data: types = [] } = useTypesConsultation()
  const setType = useSetTypeConsultation(consultationId)
  const estEmploye = categorieCode === 'ASSURE_CDI' || categorieCode === 'ASSURE_CDD'
  // On garde toujours la valeur DÉJÀ choisie dans la liste, même si elle est réservée
  // employé et que ce patient ne l'est pas (donnée existante) — sinon le combo
  // s'afficherait vide alors que la consultation a bien un type enregistré.
  const actifs  = types.filter(ty =>
    ty.statut === 'ACTIF' &&
    (estEmploye || !TYPES_RESERVES_EMPLOYE.includes(ty.code) || ty.id === currentTypeId),
  )

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
