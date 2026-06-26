import { useEffect, useState } from 'react'
import { formatDuree } from '@/lib/duree'

/**
 * LiveDuration — affiche une durée écoulée qui se met à jour toute seule.
 *
 * S'adapte à l'échelle (à l'instant → min → h → jours → semaines → mois → ans)
 * via formatDuree(). Le rafraîchissement ralentit avec l'âge (pas la peine de
 * re-render chaque seconde pour une visite vieille de 3 jours).
 */
export function LiveDuration({
  from, court = true, precis = false,
}: {
  from: string | number | Date
  court?: boolean
  precis?: boolean
}) {
  const [, tick] = useState(0)

  useEffect(() => {
    const ageMs = Date.now() - new Date(from).getTime()
    // Cadence adaptative : < 1h → 30s ; < 1j → 5min ; sinon → 1h.
    const interval = ageMs < 3_600_000 ? 30_000 : ageMs < 86_400_000 ? 300_000 : 3_600_000
    const id = setInterval(() => tick(n => n + 1), interval)
    return () => clearInterval(id)
  }, [from])

  return <>{formatDuree(from, undefined, { court, precis })}</>
}
