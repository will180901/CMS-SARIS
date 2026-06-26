import { useEffect } from 'react'
import { create } from 'zustand'
import { BASE_URL, setApiBaseUrl } from '@/lib/api'

type Mode = 'central' | 'local' | 'web'

interface ConnectivityState {
  /** URL de l'API actuellement active. */
  apiUrl: string
  /** 'central' (en ligne, serveur distant), 'local' (hors-ligne, backend embarqué), 'web'. */
  mode: Mode
  /** Le central est-il joignable ? */
  online: boolean
  /** Incrémenté à CHAQUE bascule → réabonne les flux temps réel (SSE) au bon backend. */
  version: number
  apply: (apiUrl: string, mode: Mode, online: boolean) => void
}

/**
 * État de connectivité du client de bureau (« online-first / offline-fallback »). Le process
 * principal (Electron) sonde le central et pousse ici l'URL active : CENTRAL quand l'appareil
 * est en ligne (messagerie + temps réel instantanés, comme le web) et backend LOCAL SQLite
 * quand il est hors-ligne. Sur le web classique, reste sur 'web' (aucune bascule).
 */
export const useConnectivityStore = create<ConnectivityState>((set, get) => ({
  apiUrl: BASE_URL,
  mode: 'web',
  online: true,
  version: 0,
  apply: (apiUrl, mode, online) => {
    setApiBaseUrl(apiUrl) // bascule l'URL de TOUS les fetch (liaison vive)
    set({ apiUrl: (apiUrl || '').replace(/\/+$/, ''), mode, online, version: get().version + 1 })
  },
}))

interface SarisBridge {
  onApiUrl?: (cb: (s: { url: string; mode: Mode; online: boolean }) => void) => () => void
}

/**
 * Branche la bascule online-first : écoute le process principal qui pousse l'URL active.
 * No-op sur le web (pas de `window.saris`). À appeler UNE seule fois (AppShell).
 */
export function useApiEndpointSwitch(): void {
  const apply = useConnectivityStore((s) => s.apply)
  useEffect(() => {
    const saris = (window as unknown as { saris?: SarisBridge }).saris
    if (!saris?.onApiUrl) return
    const off = saris.onApiUrl((s) => {
      if (s && s.url) apply(s.url, s.mode ?? 'central', s.online ?? true)
    })
    return off
  }, [apply])
}
