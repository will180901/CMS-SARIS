/**
 * PastilleEtat — l'état d'un poste, dit de la même façon partout : cartes du parc, tableau
 * d'activité, fiche du poste. Une seule table (relatif.ts) décide de la teinte et du libellé ;
 * ce composant n'y ajoute que l'icône du poste SUSPENDU, pour qu'une décision d'administrateur
 * ne se confonde pas avec un poste à surveiller (même teinte, autre signe).
 */

import { useTranslation } from 'react-i18next'
import { Pause } from 'lucide-react'
import { StatusPill } from '@/components/saris'
import { PASTILLE_ETAT, type EtatPoste } from './relatif'

export function PastilleEtat({ etat }: { etat: EtatPoste }) {
  const { t } = useTranslation()
  const p = PASTILLE_ETAT[etat]
  const suspendu = etat === 'suspendu'
  return (
    <StatusPill tone={p.tone} size="sm" dot={!suspendu} icon={suspendu ? <Pause size={10} /> : undefined}>
      {t(p.cle)}
    </StatusPill>
  )
}
