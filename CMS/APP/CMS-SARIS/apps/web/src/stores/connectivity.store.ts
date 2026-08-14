import { useEffect } from 'react'
import { create } from 'zustand'
import { BASE_URL, setApiBaseUrl } from '@/lib/api'
import type { SarisDesktopBridge } from '@/lib/desktop'

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
  /** Dernier numéro de séquence appliqué (anti-régression pull/push) — usage interne. */
  seq: number
  apply: (apiUrl: string, mode: Mode, online: boolean, seq?: number) => void
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
  seq: -1,
  apply: (apiUrl, mode, online, seq) => {
    // Une mise à jour porteuse d'un seq <= au dernier appliqué est PÉRIMÉE (arrivée en
    // désordre entre le pull initial au montage et un push concurrent) → ignorée.
    if (typeof seq === 'number' && seq <= get().seq) return
    setApiBaseUrl(apiUrl, mode) // bascule l'URL ET le mode pour TOUS les fetch (liaison vive)
    set({ apiUrl: (apiUrl || '').replace(/\/+$/, ''), mode, online, version: get().version + 1, seq: seq ?? get().seq })
  },
}))

/**
 * Branche la bascule online-first : hydrate l'état RÉEL actuel au montage (pull, pour ne pas
 * rester bloqué sur les valeurs par défaut après un reload/Ctrl+R), puis écoute le process
 * principal pour les changements suivants (push). No-op sur le web (pas de `window.saris`).
 * À appeler UNE seule fois (AppShell).
 */
export function useApiEndpointSwitch(): void {
  const apply = useConnectivityStore((s) => s.apply)
  useEffect(() => {
    const saris = (window as unknown as { saris?: SarisDesktopBridge }).saris
    if (!saris?.onApiUrl) return
    const off = saris.onApiUrl((s) => {
      if (!s || !s.url) return
      // Plus rien à négocier avant d'appliquer : un seul jeton vaut pour les deux
      // serveurs, et en architecture locale d'abord l'adresse ne change de toute façon
      // plus au gré du réseau — ce signal ne porte plus qu'une INFORMATION d'état.
      apply(s.url, (s.mode as Mode) ?? 'central', s.online ?? true, s.seq)
    })
    // Le NAVIGATEUR sait immediatement que la carte reseau est tombee — pas besoin
    // d'attendre qu'une sonde expire. On previent le processus principal, qui bascule
    // aussitot sur le backend local. Au retour, on le signale aussi, mais c'est la sonde
    // qui tranchera : une carte qui remonte ne prouve pas que le serveur repond.
    const signaler = (): void => saris.notifyNetwork?.(navigator.onLine)
    window.addEventListener('offline', signaler)
    window.addEventListener('online', signaler)

    saris.getConnectivity?.()
      .then((s) => { if (s && s.url) apply(s.url, s.mode as Mode, s.online, s.seq) })
      .catch(() => { /* best-effort : ancien build sans getConnectivity, ou erreur IPC */ })
    return () => {
      window.removeEventListener('offline', signaler)
      window.removeEventListener('online', signaler)
      off()
    }
  }, [apply])
}
