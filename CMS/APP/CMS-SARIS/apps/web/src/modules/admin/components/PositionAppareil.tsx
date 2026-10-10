/**
 * PositionAppareil — la position de l'APPAREIL relevée à une connexion web, telle qu'on la
 * montre dans le journal des connexions et la liste des sessions.
 *
 *  - relevée : coordonnées (lien vers la carte) et marge d'erreur — « ± 35 m » d'un
 *    téléphone ou d'un portable en Wi-Fi, « ± 3 km » d'un poste fixe en câble : la marge
 *    est toujours dite, une position sans sa marge laisse croire à une exactitude qu'elle n'a pas ;
 *  - manquante (refusée, indisponible, sans réponse) : en rouge — c'est ce qui rend
 *    visibles, dans un journal, les connexions que l'on ne peut pas situer ;
 *  - poste de bureau : rien (sa position est celle enregistrée à son installation).
 *
 * Les coordonnées sont DÉCLARÉES par l'appareil : elles tracent, elles ne prouvent pas.
 */

import { useTranslation } from 'react-i18next'
import { Crosshair, MapPinOff } from 'lucide-react'
import { StatusPill } from '@/components/saris'
import { formatDateTime } from '@/lib/intl'
import { formatCoordonnees, formatPrecision, urlCarte } from '@/lib/geo'
import type { PositionConnexion } from '../api/admin.api'

export function PositionAppareil({ position }: { position?: PositionConnexion | null }) {
  const { t } = useTranslation()
  if (!position || position.etat === 'NON_APPLICABLE') return null

  if (position.etat === 'OK' && position.latitude != null && position.longitude != null) {
    return (
      <a
        href={urlCarte(position.latitude, position.longitude)} target="_blank" rel="noopener noreferrer"
        title={position.releveeLe ? t('position.releveeLe', { date: formatDateTime(position.releveeLe) }) : t('position.voirCarte')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--ap-600)', textDecoration: 'none',
          fontSize: 'var(--font-size-caption)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
        }}
      >
        <Crosshair size={11} style={{ flexShrink: 0 }} />
        {formatCoordonnees(position.latitude, position.longitude)}
        {position.precisionM != null && (
          <span style={{ color: 'var(--texte-tertiaire)' }}>
            {t('position.marge', { marge: formatPrecision(position.precisionM) })}
          </span>
        )}
      </a>
    )
  }

  return (
    <span title={t(`position.detail.${position.etat}`)} style={{ display: 'inline-flex' }}>
      <StatusPill tone="error" dot={false} icon={<MapPinOff size={11} />}>
        {t(`position.etat.${position.etat}`)}
      </StatusPill>
    </span>
  )
}
