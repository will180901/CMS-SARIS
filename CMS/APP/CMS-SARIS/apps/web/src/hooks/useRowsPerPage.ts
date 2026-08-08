import { useMyPreferences } from '@/modules/admin/hooks/useAdmin'

/**
 * useRowsPerPage — taille de page par défaut issue de la préférence utilisateur
 * `lignesParPage` (onglet Paramètres › Personnel). Repli sur `fallback` tant que
 * la préférence n'est pas chargée. À passer comme `defaultPageSize` de
 * usePagination pour que le réglage s'applique réellement aux tableaux.
 *
 * Le repli vaut 10, comme le défaut servi par l'API (PREF_DEFAULTS, me.service).
 * Les deux doivent rester alignés : sinon les tableaux s'affichent avec une taille
 * pendant le chargement de la préférence, puis sautent à une autre.
 */
export function useRowsPerPage(fallback = 10): number {
  const { data } = useMyPreferences()
  return data?.lignesParPage ?? fallback
}
