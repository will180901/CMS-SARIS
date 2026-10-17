/**
 * Écran de chargement NEUTRE affiché pendant l'hydratation de la session (lecture du
 * stockage persistant : sessionStorage côté web, coffre DPAPI côté desktop). Évite le
 * FLASH de l'écran de connexion qui apparaissait avant que `isAuthenticated` soit connu.
 */
import { useTranslation } from 'react-i18next'
import { isDesktop } from '@/lib/desktop'
import { DESKTOP_TITLEBAR_H } from '@/components/layout/DesktopTitleBar'

export function LoadingScreen() {
  const { t } = useTranslation()
  return (
    <div
      className="fixed inset-x-0 bottom-0 flex items-center justify-center bg-background"
      style={{ top: isDesktop ? DESKTOP_TITLEBAR_H : 0 }}
    >
      <div
        className="h-9 w-9 animate-spin rounded-full border-[3px] border-muted border-t-primary"
        role="status"
        aria-label={t('common.loading')}
      />
    </div>
  )
}
