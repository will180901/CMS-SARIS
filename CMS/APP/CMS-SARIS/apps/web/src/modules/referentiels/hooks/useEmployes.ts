/**
 * Hooks — Registre des employés SARIS.
 *  - useEmployeLookup : reconnaissance dynamique par matricule à l'accueil (debounce côté
 *    appelant). Le registre se construit à l'accueil, au fil des patients : il n'a plus
 *    d'écran de gestion à part (onglet Référentiels retiré le 2026-10-09).
 */
import { useQuery } from '@tanstack/react-query'
import { employesApi } from '../api/employes.api'
import { usePermissions } from '@/hooks/usePermissions'

/** Reconnaissance par matricule. `matricule` doit déjà être « débouncé » par l'appelant. */
export function useEmployeLookup(matricule: string) {
  const { has } = usePermissions()
  const m = matricule.trim()
  return useQuery({
    queryKey: ['employes', 'lookup', m],
    queryFn:  () => employesApi.lookup(m),
    enabled:  has('employe.read') && m.length >= 3,
    staleTime: 10_000,
  })
}
