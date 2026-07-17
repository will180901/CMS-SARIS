/**
 * useDesktopDownload — cycle « Télécharger → Ouvrir / Enregistrer sous » façon
 * WhatsApp Desktop, pour une pièce jointe de messagerie.
 *
 * En navigateur web (PWA), ce hook ne fait rien (`isDesktop === false`) — le
 * comportement existant (téléchargement navigateur classique) reste inchangé,
 * c'est aux composants appelants de garder leur repli web tel quel.
 *
 * Dans le client de bureau : la pièce est d'abord DÉCHIFFRÉE via l'API (comme
 * aujourd'hui) puis écrite dans l'espace de fichiers DÉDIÉ au compte connecté
 * (jamais partagé entre comptes sur un même poste) ; ensuite seulement les
 * actions Ouvrir (application par défaut du système) et Enregistrer sous…
 * (dialogue natif, en dehors de l'espace géré par l'app) deviennent disponibles.
 */
import { useState } from 'react'
import { desktopBridge, isDesktop } from '@/lib/desktop'
import { useSessionStore } from '@/stores/session.store'
import { messagerieApi } from '../api/messagerie.api'
import { mimeKind } from '../components/mediaUtils'

export type DesktopDownloadStage = 'idle' | 'downloading' | 'downloaded' | 'error'

export function useDesktopDownload(pieceId: string, nomFichier: string, mimeType: string) {
  const userId = useSessionStore(s => s.user?.id)
  const [stage, setStage] = useState<DesktopDownloadStage>('idle')
  const [localPath, setLocalPath] = useState<string | null>(null)

  /** Télécharge (déchiffre + écrit dans l'espace du compte). No-op hors desktop. */
  async function download(): Promise<string | null> {
    if (!isDesktop || !userId) return null
    setStage('downloading')
    try {
      const { dataUrl } = await messagerieApi.piece(pieceId)
      const res = await desktopBridge()!.media.save({ userId, category: mimeKind(mimeType), nomFichier, dataUrl })
      if (!res.ok || !res.path) { setStage('error'); return null }
      setLocalPath(res.path)
      setStage('downloaded')
      return res.path
    } catch {
      setStage('error')
      return null
    }
  }

  /** Ouvre le fichier déjà téléchargé avec l'application par défaut du système. */
  function open() {
    if (localPath) void desktopBridge()!.media.openPath(localPath)
  }

  /** « Enregistrer sous… » — re-déchiffre au besoin, dialogue natif, hors espace géré par l'app. */
  async function saveAs() {
    const { dataUrl } = await messagerieApi.piece(pieceId)
    await desktopBridge()!.media.saveAs({ dataUrl, suggestedName: nomFichier })
  }

  return { stage, localPath, download, open, saveAs }
}
