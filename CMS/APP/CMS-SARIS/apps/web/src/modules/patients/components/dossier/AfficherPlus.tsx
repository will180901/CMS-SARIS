/**
 * AfficherPlus — l'historique d'un patient s'affiche par tranches (constat 87) : tout
 * charger d'un bloc rendait les longs parcours interminables à parcourir.
 */
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/saris'

export const TRANCHE_HISTORIQUE = 20

export function AfficherPlus({ affiches, total, onPlus }: { affiches: number; total: number; onPlus: () => void }) {
  const { t } = useTranslation()
  const reste = total - affiches
  if (reste <= 0) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
      <Button variant="secondary" size="sm" onClick={onPlus}>
        {t('patients.afficherPlus', { count: Math.min(TRANCHE_HISTORIQUE, reste), reste })}
      </Button>
    </div>
  )
}
