import { useMyPreferences } from '@/modules/admin/hooks/useAdmin'

/**
 * useRowsPerPage — taille de page par défaut issue de la préférence utilisateur
 * `lignesParPage` (onglet Paramètres › Personnel). Repli sur `fallback` tant que
 * la préférence n'est pas chargée. À passer comme `defaultPageSize` de
 * usePagination pour que le réglage s'applique réellement aux tableaux.
 */
export function useRowsPerPage(fallback = 25): number {
  const { data } = useMyPreferences()
  return data?.lignesParPage ?? fallback
}
