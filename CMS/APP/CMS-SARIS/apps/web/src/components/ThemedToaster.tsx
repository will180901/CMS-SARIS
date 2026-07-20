/**
 * ThemedToaster — connecte le Toaster générique de packages/ui (qui ne peut pas
 * dépendre d'apps/web) au thème réel de l'app (theme-provider.tsx maison).
 */
import type { ComponentProps } from 'react'
import { Toaster } from '@workspace/ui/components/sonner'
import { useTheme } from '@/components/theme-provider'

export function ThemedToaster(props: ComponentProps<typeof Toaster>) {
  const { theme } = useTheme()
  return <Toaster theme={theme} {...props} />
}
