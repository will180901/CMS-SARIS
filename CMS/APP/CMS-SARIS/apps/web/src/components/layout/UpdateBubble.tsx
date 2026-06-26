import type { CSSProperties } from 'react'
import { ArrowUpCircle, Download, RefreshCw, Loader2 } from 'lucide-react'
import { useAppUpdates } from '@/hooks/useAppUpdates'

/**
 * Bulle de MISE À JOUR (client de bureau uniquement) affichée AU-DESSUS du menu
 * utilisateur. Apparaît quand electron-updater détecte une nouvelle version (GitHub
 * Releases) : l'utilisateur télécharge en un clic puis redémarre pour installer.
 * En navigateur web, le statut reste null → la bulle ne s'affiche jamais.
 */
export function UpdateBubble({ collapsed = false }: { collapsed?: boolean }) {
  const { status, download, install } = useAppUpdates()
  if (!status) return null

  const s = status.state
  if (s !== 'available' && s !== 'downloading' && s !== 'downloaded') return null

  const version = 'version' in status && status.version ? `v${status.version}` : 'Nouvelle version'
  const Icon = s === 'downloading' ? Loader2 : s === 'downloaded' ? RefreshCw : ArrowUpCircle
  const spinning = s === 'downloading'

  // ── Sidebar repliée : bouton-icône compact ──────────────────────────────────
  if (collapsed) {
    const onClick = s === 'downloaded' ? install : s === 'available' ? download : undefined
    return (
      <button
        type="button"
        onClick={onClick}
        title={s === 'downloaded' ? 'Redémarrer pour installer la mise à jour' : `Mise à jour ${version} disponible`}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, margin: '0 auto 6px',
          borderRadius: 'var(--radius-md)', border: 'none',
          cursor: onClick ? 'pointer' : 'default',
          background: 'var(--info-fond)', color: 'var(--info-accent)',
        }}
      >
        <Icon size={16} className={spinning ? 'animate-spin' : undefined} />
      </button>
    )
  }

  const title =
    s === 'downloaded' ? 'Mise à jour prête'
    : s === 'downloading' ? `Téléchargement… ${status.percent}%`
    : 'Mise à jour disponible'

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--espace-2)',
        padding: '8px 10px', marginBottom: 8,
        borderRadius: 'var(--radius-md)',
        background: 'var(--info-fond)',
        border: '1px solid var(--info-accent)',
      }}
    >
      <div style={{ flexShrink: 0, color: 'var(--info-accent)', display: 'flex' }}>
        <Icon size={16} className={spinning ? 'animate-spin' : undefined} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 'var(--font-size-caption)', fontWeight: 700,
          color: 'var(--info-texte)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {title}
        </p>
        <p style={{
          margin: 0, fontSize: 10, color: 'var(--info-texte)', opacity: 0.8,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {version}
        </p>
      </div>
      {s === 'available' && (
        <button type="button" onClick={download} style={bubbleBtn}>
          <Download size={12} /> Mettre à jour
        </button>
      )}
      {s === 'downloaded' && (
        <button type="button" onClick={install} style={bubbleBtn}>
          <RefreshCw size={12} /> Redémarrer
        </button>
      )}
    </div>
  )
}

const bubbleBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
  padding: '5px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
  background: 'var(--info-accent)', color: '#fff', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
}
