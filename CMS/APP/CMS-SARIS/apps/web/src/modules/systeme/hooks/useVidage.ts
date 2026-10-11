/**
 * Hooks du vidage des données métier.
 *
 * Une fois le centre vidé, tout ce que l'application affichait de ses dossiers n'existe plus : on
 * recharge TOUT (les listes, les tableaux de bord, les dossiers ouverts), pas seulement cette page.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { vidageApi } from '../api/vidage.api'
import { DONNEES_TEST_KEY } from './useDonneesTest'

export const VIDAGE_KEY = ['systeme', 'vidage'] as const

export function useEtatVidage(enabled = true) {
  return useQuery({
    queryKey: VIDAGE_KEY,
    queryFn: () => vidageApi.etat(),
    enabled,
    refetchInterval: 15_000,
  })
}

export function useViderDonnees() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: vidageApi.vider,
    onSuccess: () => qc.invalidateQueries(),
    // Un refus change aussi l'état affiché (une génération qui vient de démarrer, un mode qui change…)
    onError: () => {
      void qc.invalidateQueries({ queryKey: VIDAGE_KEY })
      void qc.invalidateQueries({ queryKey: DONNEES_TEST_KEY })
    },
  })
}
