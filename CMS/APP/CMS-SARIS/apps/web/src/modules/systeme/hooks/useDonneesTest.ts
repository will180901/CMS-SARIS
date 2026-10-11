/**
 * Hooks des données de test.
 *
 * Pendant qu'une génération tourne, l'état se relit chaque seconde et demie (progression en
 * direct) ; au repos, une fois toutes les quinze secondes seulement.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { donneesTestApi } from '../api/donneesTest.api'

export const DONNEES_TEST_KEY = ['systeme', 'donnees-test'] as const

export function useEtatDonneesTest(enabled = true) {
  return useQuery({
    queryKey: DONNEES_TEST_KEY,
    queryFn: () => donneesTestApi.etat(),
    enabled,
    refetchInterval: (q) => (q.state.data?.enCours ? 1500 : 15_000),
  })
}

export function usePrevisionsDonneesTest(mois: number, visitesParJour: number, enabled = true) {
  return useQuery({
    queryKey: [...DONNEES_TEST_KEY, 'previsions', mois, visitesParJour],
    queryFn: () => donneesTestApi.previsions(mois, visitesParJour),
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}

/** L'état change dans tous les cas, même après un refus : la page se remet à jour. */
function useRafraichir() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: DONNEES_TEST_KEY })
}

export function useGenererDonneesTest() {
  const rafraichir = useRafraichir()
  return useMutation({
    mutationFn: (p: { mois: number; visitesParJour: number }) =>
      donneesTestApi.generer(p.mois, p.visitesParJour),
    onSettled: rafraichir,
  })
}
export function useReprendreDonneesTest() {
  const rafraichir = useRafraichir()
  return useMutation({ mutationFn: () => donneesTestApi.reprendre(), onSettled: rafraichir })
}
export function useArreterDonneesTest() {
  const rafraichir = useRafraichir()
  return useMutation({ mutationFn: () => donneesTestApi.arreter(), onSettled: rafraichir })
}
export function useSupprimerDonneesTest() {
  const rafraichir = useRafraichir()
  return useMutation({ mutationFn: () => donneesTestApi.supprimer(), onSettled: rafraichir })
}
