/**
 * stale-chunk.ts — Récupération après un déploiement.
 *
 * Les pages sont chargées en `lazy()` : chaque route est un fichier séparé dont le
 * nom contient un hash de contenu (`DossierPage-CyWYCNsC.js`). À chaque déploiement
 * ces hash changent et les anciens fichiers disparaissent du serveur.
 *
 * Un onglet resté ouvert (ou servi par le service worker, enregistré en `autoUpdate`
 * + `clientsClaim`) garde en mémoire l'ancien `index.html`. Quand l'utilisateur ouvre
 * ENFIN une page qu'il n'avait pas encore visitée, le navigateur réclame un fichier
 * qui n'existe plus → l'import échoue → l'erreur remonte jusqu'à l'ErrorBoundary.
 *
 * Symptôme caractéristique : les pages déjà chargées continuent de fonctionner (la
 * liste des patients), et seule une page jamais ouverte depuis le déploiement casse
 * (le dossier patient). Rien à voir avec les données ni avec les droits.
 *
 * Remède : recharger la page une fois pour récupérer le nouvel `index.html`. On borne
 * la tentative (une seule fois par session de navigation) pour ne jamais créer de
 * boucle de rechargement si la panne vient d'ailleurs.
 */

const CLE_TENTATIVE = 'cms-saris:rechargement-chunk'

/** Reconnaît un échec de chargement de module (messages variables selon navigateur). */
export function estChunkObsolete(erreur: unknown): boolean {
  const message =
    erreur instanceof Error ? `${erreur.name} ${erreur.message}` : String(erreur ?? '')
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||   // Safari
    /error loading dynamically imported module/i.test(message) ||
    /ChunkLoadError/i.test(message)
  )
}

/**
 * Purge ce qui ferait resservir l'ANCIENNE version après le rechargement.
 *
 * Recharger ne suffit pas : l'application est une PWA et son service worker répond
 * depuis son propre cache (`Cache Storage`), y compris pour `index.html`. Tant qu'il
 * est en place avec l'ancien manifeste, le rechargement retombe sur les mêmes
 * fichiers disparus. On le désinscrit et on vide ses caches — il se réenregistre
 * tout seul au chargement suivant, avec le manifeste à jour.
 *
 * Sans effet sur les données : la file de rejeu hors-ligne et le cache local des
 * dossiers vivent dans IndexedDB, qui n'est pas touché ici.
 */
async function purgerCacheApplicatif(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((r) => r.unregister()))
    }
  } catch {
    /* best-effort */
  }
  try {
    if ('caches' in window) {
      const noms = await caches.keys()
      await Promise.all(noms.map((n) => caches.delete(n)))
    }
  } catch {
    /* best-effort */
  }
}

/**
 * Recharge la page une seule fois pour récupérer la version déployée.
 * @returns true si un rechargement a été engagé (l'appelant peut s'arrêter là).
 */
export function tenterRechargementUnique(): boolean {
  try {
    if (sessionStorage.getItem(CLE_TENTATIVE)) return false
    sessionStorage.setItem(CLE_TENTATIVE, '1')
  } catch {
    // Stockage indisponible (navigation privée stricte) : on ne recharge pas plutôt
    // que de risquer une boucle infinie.
    return false
  }
  // La purge est asynchrone ; on recharge dans tous les cas, même si elle échoue.
  void purgerCacheApplicatif().finally(() => window.location.reload())
  return true
}

/** À appeler une fois l'application affichée : la tentative a réussi. */
export function reinitialiserTentative(): void {
  try {
    sessionStorage.removeItem(CLE_TENTATIVE)
  } catch {
    /* sans importance */
  }
}

/**
 * Branche le filet AVANT le rendu de React : Vite émet `vite:preloadError` quand le
 * préchargement d'un chunk échoue, souvent avant même que l'erreur n'atteigne React.
 */
export function installerFiletChunkObsolete(): void {
  window.addEventListener('vite:preloadError', (e) => {
    e.preventDefault() // sinon Vite relaie l'erreur et l'écran casse quand même
    tenterRechargementUnique()
  })

  window.addEventListener('unhandledrejection', (e) => {
    if (estChunkObsolete(e.reason)) {
      e.preventDefault()
      tenterRechargementUnique()
    }
  })
}
