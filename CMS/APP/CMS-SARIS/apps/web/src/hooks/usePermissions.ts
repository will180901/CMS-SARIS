/**
 * usePermissions — hook de vérification des permissions granulaires.
 *
 * Source : permissions exposées dans la session via le JWT.
 *
 * Usage :
 *   const { has, hasAny, hasAll, permissions } = usePermissions()
 *   if (has('consultation.create')) { ... }
 *
 *   // Conditionnellement masquer un bouton :
 *   {has('ordonnance.create') && <Button>Nouvelle ordonnance</Button>}
 */

import { useMemo } from 'react'
import { useSessionStore } from '@/stores/session.store'
import type { PermissionCode } from '@cms-saris/types'

export interface UsePermissionsResult {
  /** Set des permissions de l'utilisateur (déduplication efficace) */
  permissions: Set<PermissionCode>
  /** Vérifie qu'au moins UNE permission est présente */
  has:    (perm: PermissionCode) => boolean
  /** Vérifie qu'au moins UNE des permissions listées est présente */
  hasAny: (...perms: PermissionCode[]) => boolean
  /** Vérifie que TOUTES les permissions listées sont présentes */
  hasAll: (...perms: PermissionCode[]) => boolean
}

export function usePermissions(): UsePermissionsResult {
  const userPerms = useSessionStore(s => s.user?.permissions ?? [])

  return useMemo<UsePermissionsResult>(() => {
    const set = new Set<PermissionCode>(userPerms)
    return {
      permissions: set,
      has:    (perm) => set.has(perm),
      hasAny: (...perms) => perms.some(p => set.has(p)),
      hasAll: (...perms) => perms.every(p => set.has(p)),
    }
  }, [userPerms])
}
