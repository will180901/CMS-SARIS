import { useEffect, useState } from 'react'
import { desktopBridge, type UpdateStatus } from '@/lib/desktop'

/**
 * S'abonne au statut de mise à jour poussé par Electron (electron-updater / GitHub).
 * En navigateur web (`window.saris` absent), `status` reste `null` → aucune bulle.
 */
export function useAppUpdates() {
  const [status, setStatus] = useState<UpdateStatus | null>(null)

  useEffect(() => {
    const bridge = desktopBridge()
    if (!bridge) return
    // onStatus renvoie une fonction de désabonnement (nettoyage du listener IPC).
    return bridge.updates.onStatus(setStatus)
  }, [])

  return {
    status,
    download: (): void => void desktopBridge()?.updates.download(),
    install:  (): void => void desktopBridge()?.updates.install(),
    check:    (): void => void desktopBridge()?.updates.check(),
  }
}
