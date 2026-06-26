/**
 * Stockage de la session selon l'environnement :
 *
 *  - **Web** : `sessionStorage` (éphémère, effacé à la fermeture de l'onglet —
 *    règle de sécurité JWT historique).
 *  - **Desktop (Electron)** : coffre **DPAPI** (chiffré au repos, lié au compte
 *    Windows). Le jeton de rafraîchissement n'est donc plus en clair. Le blob est
 *    amorcé SYNCHRONEMENT par le preload (`window.__SARIS_SESSION__`) pour éviter
 *    toute hydratation asynchrone (pas de « flash » de déconnexion au démarrage) ;
 *    les écritures vont dans le coffre via `window.saris.secure`.
 */
import type { StateStorage } from 'zustand/middleware'
import { isDesktop, desktopBridge } from '@/lib/desktop'

export const SESSION_PERSIST_KEY = 'cms-saris-session'

// Cache mémoire (lecture/écriture synchrone) — la persistance réelle est DPAPI.
const cache = new Map<string, string>()

function desktopGetItem(name: string): string | null {
  if (cache.has(name)) return cache.get(name) ?? null
  // Blob amorcé par le preload Electron au démarrage (lecture synchrone du coffre).
  if (name === SESSION_PERSIST_KEY && typeof window !== 'undefined' && window.__SARIS_SESSION__) {
    cache.set(name, window.__SARIS_SESSION__)
    return window.__SARIS_SESSION__
  }
  return null
}

const desktopSecureStorage: StateStorage = {
  getItem: (name) => desktopGetItem(name),
  setItem: (name, value) => {
    cache.set(name, value)
    void desktopBridge()?.secure.set(name, value) // chiffré DPAPI, asynchrone
  },
  removeItem: (name) => {
    cache.delete(name)
    void desktopBridge()?.secure.del(name)
  },
}

/** Coffre DPAPI en desktop, sessionStorage en web. */
export const sessionPersistStorage: StateStorage = isDesktop ? desktopSecureStorage : sessionStorage
