/**
 * Pont avec le client de bureau (Electron). En navigateur web, `window.saris` est
 * absent → `isDesktop === false` et l'application fonctionne normalement.
 *
 * Le preload Electron expose :
 *  - `window.__SARIS_CONFIG__` : { apiUrl } lue au démarrage par `lib/api.ts`.
 *  - `window.saris` : version de l'app, réglage de l'URL serveur, mises à jour,
 *    coffre sécurisé (DPAPI) pour les jetons.
 */
/** État de mise à jour poussé par le processus principal Electron (electron-updater). */
export type UpdateStatus =
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available' }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }

export interface SarisDesktopBridge {
  isDesktop: true
  apiUrl: string
  appVersion: string
  platform: string
  setApiUrl: (url: string) => Promise<{ ok: boolean }>
  getConfig: () => Promise<{ apiUrl: string; appVersion: string }>
  checkForUpdates: () => Promise<void>
  /** Mises à jour automatiques (GitHub Releases) — abonnement au statut + actions. */
  updates: {
    onStatus: (cb: (s: UpdateStatus) => void) => () => void
    check: () => Promise<void>
    download: () => Promise<void>
    install: () => Promise<void>
  }
  setNativeTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>
  openAppMenu: () => Promise<void>
  /** Ouvre une URL (téléchargement) dans le navigateur système. */
  openExternal: (url: string) => Promise<void>
  /** Télécharge l'installeur depuis l'URL et le lance (l'app se ferme). Annonce de MAJ. */
  installFromUrl: (url: string) => Promise<{ ok: boolean; error?: string }>
  secure: {
    get: (key: string) => Promise<string | null>
    set: (key: string, value: string) => Promise<void>
    del: (key: string) => Promise<void>
  }
}

declare global {
  interface Window {
    __SARIS_CONFIG__?: { apiUrl?: string }
    /** Blob de session chiffré, amorcé synchroniquement par le preload (desktop). */
    __SARIS_SESSION__?: string | null
    saris?: SarisDesktopBridge
  }
}

/** Vrai uniquement dans le client de bureau Electron. */
export const isDesktop: boolean =
  typeof window !== 'undefined' && window.saris?.isDesktop === true

/** Le pont Electron, ou null en navigateur web. */
export function desktopBridge(): SarisDesktopBridge | null {
  return (typeof window !== 'undefined' && window.saris) || null
}

/** Version de l'application de bureau (null en web). */
export function appVersion(): string | null {
  return desktopBridge()?.appVersion ?? null
}
