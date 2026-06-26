/**
 * Mise à jour automatique (electron-updater) — pilotée par l'INTERFACE.
 *
 * Au lieu d'une boîte de dialogue native, l'état de mise à jour est poussé au
 * frontend (`saris:update-status`), qui affiche une BULLE au-dessus du menu
 * utilisateur (façon grandes apps). L'utilisateur clique pour télécharger puis
 * redémarrer/installer.
 *
 * Flux :
 *   démarrage (packagé) → checkForUpdates() silencieux
 *     → 'available'   : la bulle propose « Mettre à jour »
 *     → (clic) download → 'downloading' (%) → 'downloaded'
 *     → (clic) « Redémarrer & installer » → quitAndInstall()
 *
 * Canal : GitHub Releases (voir `publish` dans electron-builder.yml). Le dépôt doit
 * publier `latest.yml` + l'installeur signé. Ne fonctionne qu'en build PACKAGÉ.
 */
import { type BrowserWindow } from 'electron'
import log from 'electron-log/main'
import { autoUpdater } from 'electron-updater'

let getWindow: () => BrowserWindow | null = () => null
let pendingVersion = ''

type UpdateStatus =
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available' }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }

function send(payload: UpdateStatus): void {
  try {
    getWindow()?.webContents.send('saris:update-status', payload)
  } catch (e) {
    log.warn('[updater] envoi du statut au renderer échoué', e)
  }
}

export function initAutoUpdater(windowGetter: () => BrowserWindow | null): void {
  getWindow = windowGetter
  autoUpdater.logger = log
  autoUpdater.autoDownload = false            // l'utilisateur déclenche le téléchargement depuis la bulle
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => send({ state: 'checking' }))
  autoUpdater.on('update-available', (info) => {
    pendingVersion = info.version
    send({ state: 'available', version: info.version })
  })
  autoUpdater.on('update-not-available', () => send({ state: 'not-available' }))
  autoUpdater.on('download-progress', (p) =>
    send({ state: 'downloading', version: pendingVersion, percent: Math.round(p.percent) }),
  )
  autoUpdater.on('update-downloaded', (info) => {
    pendingVersion = info.version
    send({ state: 'downloaded', version: info.version })
  })
  autoUpdater.on('error', (err) => {
    log.error('[updater]', err)
    send({ state: 'error', message: String((err as Error)?.message ?? err) })
  })

  // Vérification SILENCIEUSE au démarrage (rien ne s'affiche s'il n'y a pas de MAJ).
  autoUpdater.checkForUpdates().catch((e) => log.warn('[updater] vérif démarrage échouée', e))
}

/** Vérification manuelle (menu de l'app ou bouton « vérifier »). */
export function checkForUpdates(): void {
  autoUpdater.checkForUpdates().catch((e) => log.warn('[updater] vérif manuelle échouée', e))
}

/** Lance le téléchargement de la mise à jour disponible. */
export function downloadUpdate(): void {
  autoUpdater.downloadUpdate().catch((e) => {
    log.warn('[updater] téléchargement échoué', e)
    send({ state: 'error', message: String((e as Error)?.message ?? e) })
  })
}

/** Ferme l'app et installe la mise à jour téléchargée. */
export function quitAndInstall(): void {
  autoUpdater.quitAndInstall()
}
