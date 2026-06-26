/**
 * MediaViewer — lecteur plein-panneau d'une pièce jointe (clic sur un message
 * média). MÊME comportement/allure que MediaPreview : couvre uniquement la zone
 * de droite (rendu en place, `position:absolute`), thème cohérent (tokens SARIS),
 * média grand et lisible. Lecture seule : pas de rognage/légende/envoi — juste
 * visionner + télécharger + fermer.
 */
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { X, Download, Loader2, AlertTriangle, FileText } from 'lucide-react'
import { messagerieApi, type PieceJointeMeta } from '../api/messagerie.api'
import { formatBytes } from './mediaUtils'

const C = {
  modal: 'var(--fond-surface)', stage: 'var(--fond-page)', field: 'var(--fond-surface-2)',
  border: 'var(--bordure-legere)', txt: 'var(--texte-primaire)', txt2: 'var(--texte-secondaire)',
  txt3: 'var(--texte-tertiaire)', accent: 'var(--ap-400)', err: 'var(--erreur-accent)',
}

export function MediaViewer({ pj, onClose }: { pj: PieceJointeMeta; onClose: () => void }) {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['messagerie', 'piece', pj.id],
    queryFn:  () => messagerieApi.piece(pj.id),
    staleTime: 5 * 60_000,
  })
  const mime = pj.mimeType
  const isVideo = mime.startsWith('video/')
  const isImage = mime.startsWith('image/')
  const isAudio = mime.startsWith('audio/')

  function download() {
    if (!data) return
    const a = document.createElement('a')
    a.href = data.dataUrl; a.download = data.nomFichier
    document.body.appendChild(a); a.click(); a.remove()
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 62, background: C.modal, display: 'flex', flexDirection: 'column' }}>
      {/* En-tête */}
      <div style={{ flexShrink: 0, height: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', borderBottom: `1px solid ${C.border}` }}>
        <button onClick={onClose} title={t('messagerie.close')} style={iconBtn}><X size={20} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pj.nomFichier}</p>
          <p style={{ margin: 0, fontSize: 11, color: C.txt3 }}>{formatBytes(pj.taille)}</p>
        </div>
        <button onClick={download} disabled={!data} title={t('messagerie.downloadAction')} style={{ ...iconBtn, color: C.txt2 }}><Download size={18} /></button>
      </div>

      {/* Stage */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, background: C.stage }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: C.txt3 }}>
            <Loader2 size={26} className="animate-spin" /><span style={{ fontSize: 13 }}>{t('messagerie.loading')}</span>
          </div>
        ) : isError || !data ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: C.err }}>
            <AlertTriangle size={26} /><span style={{ fontSize: 13 }}>{t('messagerie.openMediaError')}</span>
          </div>
        ) : isVideo ? (
          <video src={data.dataUrl} controls autoPlay playsInline
            style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12, background: '#000', boxShadow: '0 10px 34px rgba(0,0,0,0.28)' }} />
        ) : isImage ? (
          <img src={data.dataUrl} alt={pj.nomFichier}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 12, boxShadow: '0 10px 34px rgba(0,0,0,0.22)' }} />
        ) : isAudio ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
            <audio src={data.dataUrl} controls autoPlay style={{ width: 360 }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '32px 40px', borderRadius: 18, background: C.modal, border: `1px solid ${C.border}` }}>
            <div style={{ width: 96, height: 96, borderRadius: 20, background: C.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={42} /></div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.txt }}>{pj.nomFichier}</p>
            <button onClick={download} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 9999, background: C.accent, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <Download size={15} /> {t('messagerie.downloadAction')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const iconBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--texte-secondaire)' }
