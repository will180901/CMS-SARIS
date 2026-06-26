/**
 * Preload — pont sécurisé entre le processus principal et le frontend (React).
 *
 * Exposé via contextBridge (contextIsolation activé) :
 *  - window.__SARIS_CONFIG__ : { apiUrl } lue SYNCHRONEMENT au chargement, pour que
 *    `apps/web/src/lib/api.ts` connaisse l'URL du serveur dès le démarrage.
 *  - window.saris : API applicative (version, réglage de l'URL, mises à jour,
 *    stockage sécurisé DPAPI).
 */
import { contextBridge, ipcRenderer } from 'electron'

interface BootConfig {
  apiUrl: string
  appVersion: string
  platform: string
  /** Serveur central déjà configuré (mode local) — pour pré-remplir l'écran de config. */
  serverUrl: string
}

const boot = ipcRenderer.sendSync('saris:config') as BootConfig

contextBridge.exposeInMainWorld('__SARIS_CONFIG__', { apiUrl: boot.apiUrl })

// Blob de session chiffré (DPAPI) lu SYNCHRONEMENT → le store l'hydrate sans flash.
const session = ipcRenderer.sendSync('saris:session-load') as string | null
contextBridge.exposeInMainWorld('__SARIS_SESSION__', session)

contextBridge.exposeInMainWorld('saris', {
  isDesktop: true,
  apiUrl: boot.apiUrl,
  appVersion: boot.appVersion,
  platform: boot.platform,
  serverUrl: boot.serverUrl,
  /** Enregistre l'URL du serveur puis relance l'application. */
  setApiUrl: (url: string): Promise<{ ok: boolean }> => ipcRenderer.invoke('saris:set-api-url', url),
  /**
   * Configuration du poste en mode local (écran de 1er lancement) : authentifie au serveur
   * central. En cas de succès, le processus principal démarre le backend embarqué + lance
   * la 1ère synchro, puis recharge vers l'application.
   */
  syncSetup: (params: {
    serverUrl: string; login: string; password: string; totpCode?: string; tempToken?: string
  }): Promise<{ ok: boolean; error?: string; requireTotp?: boolean; tempToken?: string }> =>
    ipcRenderer.invoke('saris:sync-setup', params),
  /** Progression après « Connecter » : { step: 'backend'|'done'|'error', message }. */
  onSetupStatus: (cb: (s: { step: string; message: string }) => void): (() => void) => {
    const listener = (_e: unknown, payload: { step: string; message: string }): void => cb(payload)
    ipcRenderer.on('saris:setup-status', listener)
    return () => ipcRenderer.removeListener('saris:setup-status', listener)
  },
  /**
   * Bascule « online-first » : le process principal pousse l'URL d'API ACTIVE — le CENTRAL
   * quand l'appareil est en ligne (messagerie/temps réel instantanés) et le backend LOCAL
   * SQLite quand il est hors-ligne.
   */
  onApiUrl: (cb: (s: { url: string; mode: string; online: boolean }) => void): (() => void) => {
    const listener = (_e: unknown, payload: { url: string; mode: string; online: boolean }): void => cb(payload)
    ipcRenderer.on('saris:api-url', listener)
    return () => ipcRenderer.removeListener('saris:api-url', listener)
  },
  getConfig: (): Promise<{ apiUrl: string; appVersion: string }> => ipcRenderer.invoke('saris:get-config'),
  checkForUpdates: (): Promise<void> => ipcRenderer.invoke('saris:check-updates'),
  /**
   * Mises à jour automatiques (façon grandes apps) : abonnement au statut poussé
   * par le processus principal + actions déclenchées par la bulle de l'interface.
   */
  updates: {
    onStatus: (cb: (s: unknown) => void): (() => void) => {
      const listener = (_e: unknown, payload: unknown): void => cb(payload)
      ipcRenderer.on('saris:update-status', listener)
      return () => ipcRenderer.removeListener('saris:update-status', listener)
    },
    check:    (): Promise<void> => ipcRenderer.invoke('saris:check-updates'),
    download: (): Promise<void> => ipcRenderer.invoke('saris:update-download'),
    install:  (): Promise<void> => ipcRenderer.invoke('saris:update-install'),
  },
  /** Synchronise la barre de titre + les menus natifs avec le thème de l'app. */
  setNativeTheme: (theme: 'light' | 'dark' | 'system'): Promise<void> =>
    ipcRenderer.invoke('saris:set-native-theme', theme),
  /** Ouvre le menu de l'application (popup natif depuis la barre de titre custom). */
  openAppMenu: (): Promise<void> => ipcRenderer.invoke('saris:open-menu'),
  /** Coffre chiffré au repos (DPAPI) — pour stocker p. ex. le refresh token. */
  secure: {
    get: (key: string): Promise<string | null> => ipcRenderer.invoke('saris:secure-get', key),
    set: (key: string, value: string): Promise<void> => ipcRenderer.invoke('saris:secure-set', key, value),
    del: (key: string): Promise<void> => ipcRenderer.invoke('saris:secure-del', key),
  },
})
