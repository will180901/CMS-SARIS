/**
 * PermissionGate — protège une route entière selon les permissions.
 * Contrôle d'accès par permission granulaire (et non par simple rôle).
 *
 * Si l'utilisateur n'a aucune des permissions listées → redirection.
 *
 * Usage :
 *   <PermissionGate any={['consultation.read']}>
 *     <ConsultationPage />
 *   </PermissionGate>
 */

import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { usePermissions } from '@/hooks/usePermissions'
import type { PermissionCode } from '@cms-saris/types'

interface Props {
  /** Au moins UNE des permissions doit être présente */
  any?:      PermissionCode[]
  /** Toutes les permissions doivent être présentes */
  all?:      PermissionCode[]
  children:  ReactNode
  /** Route de redirection si accès refusé (défaut : /dashboard) */
  redirect?: string
}

export function PermissionGate({ any, all, children, redirect = '/dashboard' }: Props) {
  const { hasAny, hasAll } = usePermissions()

  let allowed = true
  if (any && any.length > 0) allowed = hasAny(...any)
  if (allowed && all && all.length > 0) allowed = hasAll(...all)

  if (!allowed) return <Navigate to={redirect} replace />
  return <>{children}</>
}
