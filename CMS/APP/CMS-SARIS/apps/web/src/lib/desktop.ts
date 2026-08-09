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
  /** Identité de CETTE machine dans le parc — le desktop est lui-même un poste, et sa
   *  page Synchronisation doit répondre à « où suis-je ? » avant de montrer les autres.
   *  Absentes en web : un navigateur n'est pas une machine du parc. */
  posteLibelle?: string
  posteLocalId?: string
  posteSiteId?: string | null
  /** URL du backend embarqué (mode local) — vide en mode distant. */
  localApiUrl?: string
  /** Signale au processus principal la perte/retour du réseau (bascule immédiate). */
  notifyNetwork?: (online: boolean) => void
  /** Provisionne le poste à partir de la PREMIÈRE connexion (jetons + site du compte). */
  provisionPoste?: (params: { accessToken: string; refreshToken: string; siteId: string })
    => Promise<{ ok: boolean; error?: string }>
  setApiUrl: (url: string) => Promise<{ ok: boolean }>
  getConfig: () => Promise<{ apiUrl: string; appVersion: string }>
  /** Bascule « online-first » : pousse l'URL d'API active (central en ligne / local hors-ligne). */
  onApiUrl?: (cb: (s: { url: string; mode: string; online: boolean; seq: number }) => void) => () => void
  /** État de connectivité ACTUEL à la demande — cf. onApiUrl pour les changements suivants. */
  getConnectivity?: () => Promise<{ url: string; mode: string; online: boolean; seq: number } | null>
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
  /** Signale l'écran actif au process principal (redimensionnement de la fenêtre desktop). */
  setWindowMode: (mode: 'login' | 'app') => void
  /** Ouvre une URL (téléchargement) dans le navigateur système. */
  openExternal: (url: string) => Promise<void>
  /** Télécharge l'installeur depuis l'URL et le lance (l'app se ferme). Annonce de MAJ. */
  installFromUrl: (url: string) => Promise<{ ok: boolean; error?: string }>
  secure: {
    get: (key: string) => Promise<string | null>
    set: (key: string, value: string) => Promise<void>
    del: (key: string) => Promise<void>
  }
  /**
   * Espace de fichiers PAR UTILISATEUR (façon WhatsApp Desktop) pour les pièces
   * jointes de la messagerie — dossier dédié au compte connecté, jamais partagé
   * entre comptes sur un même poste. `category` : 'documents' | 'images' | 'videos' | 'audio'.
   */
  media: {
    ensureDirs: (userId: string) => Promise<{ ok: boolean; dirs?: Record<string, string>; error?: string }>
    save: (params: { userId: string; category: string; nomFichier: string; dataUrl: string }) => Promise<{ ok: boolean; path?: string; error?: string }>
    openPath: (filePath: string) => Promise<{ ok: boolean; error?: string }>
    saveAs: (params: { dataUrl: string; suggestedName: string }) => Promise<{ ok: boolean; canceled?: boolean; path?: string; error?: string }>
    showInFolder: (filePath: string) => Promise<void>
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
