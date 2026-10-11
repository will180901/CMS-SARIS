/**
 * useNavigation — retourne les groupes/items de navigation filtrés selon
 * les PERMISSIONS de l'utilisateur connecté (et plus uniquement les rôles).
 */

import { useMemo } from 'react'
import { NAV_GROUPS } from '@/config/navigation.config'
import { usePermissions } from './usePermissions'
import { useModeSysteme } from '@/modules/systeme/hooks/useModeSysteme'

export function useNavigation() {
  const { hasAny } = usePermissions()
  const { data: mode } = useModeSysteme()
  const modeTest = mode?.mode === 'TEST'

  return useMemo(() =>
    NAV_GROUPS
      .map(group => ({
        ...group,
        items: group.items.filter(item =>
          // Tableau vide = accessible à tous les utilisateurs authentifiés
          (item.permissions.length === 0 || hasAny(...item.permissions)) &&
          // Certaines entrées n'existent qu'en mode Test
          (!item.modeTestSeulement || modeTest),
        ),
      }))
      .filter(group => group.items.length > 0),
  [hasAny, modeTest])
}
