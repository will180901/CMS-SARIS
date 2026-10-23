import { useEffect } from 'react'
import { create } from 'zustand'
import { BASE_URL, setApiBaseUrl } from '@/lib/api'
import { desktopBridge, urlDuServeur, type SarisDesktopBridge } from '@/lib/desktop'
import { interlocuteurPossible } from '@/lib/interlocuteur'
import { assurerJetons } from '@/lib/secondJeton'
import { useSessionStore } from '@/stores/session.store'

type Mode = 'central' | 'local' | 'web'

interface ConnectivityState {
  /** URL de l'API actuellement active. */
  apiUrl: string
  /** 'central' (en ligne, serveur distant), 'local' (hors-ligne, backend embarqué), 'web'. */
  mode: Mode
  /** Le central est-il joignable ? (l'état du RÉSEAU — l'écran peut encore parler au local le temps d'un envoi) */
  online: boolean
  /** Incrémenté à CHAQUE bascule → réabonne les flux temps réel (SSE) au bon backend. */
  version: number
  /** Dernier numéro de séquence appliqué (anti-régression pull/push) — usage interne. */
  seq: number
  /** Ce que le processus principal a DEMANDÉ en dernier (même si l'on n'a pas pu le faire faute de jeton). */
  souhait: { apiUrl: string; mode: Mode; online: boolean } | null
  apply: (apiUrl: string, mode: Mode, online: boolean, seq?: number) => void
  /** Rejoue le dernier souhait (un jeton qu'il manquait vient d'être obtenu). */
  reappliquer: () => void
}

/**
 * État de connectivité du client de bureau (« en ligne d'abord »). Le process principal (Electron) sonde le
 * central et pousse ici l'adresse à utiliser : le CENTRAL quand l'appareil est en ligne et que tout ce qui était
 * en attente est remonté (messagerie + temps réel instantanés, comme le web), le service LOCAL de la machine
 * (SQLite) sinon. Sur le web classique, reste sur 'web' (aucune bascule).
 */
export const useConnectivityStore = create<ConnectivityState>((set, get) => ({
  apiUrl: BASE_URL,
  mode: 'web',
  online: true,
  version: 0,
  seq: -1,
  souhait: null,
  apply: (apiUrl, mode, online, seq) => {
    // Une mise à jour porteuse d'un seq <= au dernier appliqué est PÉRIMÉE (arrivée en
    // désordre entre le pull initial au montage et un push concurrent) → ignorée.
    if (typeof seq === 'number' && seq <= get().seq) return
    let url = apiUrl
    let modeFinal = mode
    // Client de bureau, avec une session ouverte : l'adresse et le JEU DE JETONS changent ensemble. Le central et
    // le service local refusent les jetons l'un de l'autre ; si l'on n'a pas encore celui du serveur demandé (ex.
    // connexion faite hors ligne), on reste sur celui dont on a le jeton et on essaie d'obtenir l'autre en silence.
    if ((mode === 'central' || mode === 'local') && desktopBridge()?.localApiUrl) {
      const session = useSessionStore.getState()
      const possible = interlocuteurPossible(mode, {
        interlocuteur: session.interlocuteur, token: session.token,
        refreshToken: session.refreshToken, autres: session.autresJetons,
      })
      if (possible !== mode && mode === 'local' && session.isAuthenticated) {
        // COUPURE alors qu'on n'a pas le jeton du service local (il n'a pas pu être obtenu à la connexion : comptes
        // pas encore synchronisés…). Rester sur le central serait parler à un serveur qu'on sait injoignable ; lui
        // présenter le jeton du central, le service local le refuserait. La seule issue : se reconnecter — auprès du
        // service local, qui connaît les comptes — avec ses identifiants.
        session.clearSession()
      } else if (possible !== mode) {
        modeFinal = possible
        url = urlDuServeur(possible) ?? apiUrl
        void assurerJetons(mode).then((ok) => { if (ok) get().reappliquer() })
      } else if (session.isAuthenticated && session.interlocuteur && session.interlocuteur !== mode) {
        session.basculerVers(mode)
      }
    }
    setApiBaseUrl(url, modeFinal) // bascule l'URL ET le mode pour TOUS les fetch (liaison vive)
    set({
      apiUrl: (url || '').replace(/\/+$/, ''), mode: modeFinal, online,
      version: get().version + 1, seq: seq ?? get().seq,
      souhait: { apiUrl, mode, online },
    })
  },
  reappliquer: () => {
    const s = get().souhait
    if (s) get().apply(s.apiUrl, s.mode, s.online)
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
      apply(s.url, (s.mode as Mode) ?? 'central', s.online ?? true, s.seq)
    })
    // Le NAVIGATEUR sait immediatement que la carte reseau est tombee — pas besoin
    // d'attendre qu'une sonde expire. On previent le processus principal, qui bascule
    // aussitot sur le backend local. Au retour, on le signale aussi, mais c'est la sonde
    // qui tranchera : une carte qui remonte ne prouve pas que le serveur repond.
    const signaler = (): void => saris.notifyNetwork?.(navigator.onLine)
    window.addEventListener('offline', signaler)
    window.addEventListener('online', signaler)

    // L'autre serveur n'a pas pu être joint à la connexion (service local qui démarre, réseau instable) : on
    // retente en silence, pour que la prochaine bascule — surtout la coupure — trouve son jeton prêt.
    const retente = window.setInterval(() => {
      const s = useSessionStore.getState()
      if (!s.isAuthenticated || !s.interlocuteur || !desktopBridge()?.localApiUrl) return
      const autre = s.interlocuteur === 'central' ? 'local' : 'central'
      if (!s.autresJetons[autre]) void assurerJetons(autre).then((ok) => { if (ok) useConnectivityStore.getState().reappliquer() })
    }, 30_000)

    saris.getConnectivity?.()
      .then((s) => { if (s && s.url) apply(s.url, s.mode as Mode, s.online, s.seq) })
      .catch(() => { /* best-effort : ancien build sans getConnectivity, ou erreur IPC */ })
    return () => {
      window.clearInterval(retente)
      window.removeEventListener('offline', signaler)
      window.removeEventListener('online', signaler)
      off()
    }
  }, [apply])
}
