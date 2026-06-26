/**
 * ConversationCard — élément de la liste des conversations (panneau gauche).
 * Avatar (ou icône groupe) + nom + aperçu + heure + non-lus, et un menu d'actions
 * (au survol) PORTÉ PAR LA CONVERSATION : supprimer / quitter.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, MoreVertical, Trash2, LogOut } from 'lucide-react'
import { Avatar } from '@/components/saris'
import { Popover, PopoverContent, PopoverTrigger } from '@workspace/ui/components/popover'
import { useIsTouch } from '@/hooks/useMediaQuery'
import { formatTime, formatDate } from '@/lib/intl'
import { renderRich } from './twemoji'
import type { ConversationItem } from '../api/messagerie.api'

function formatCardTime(iso: string, yesterdayLabel: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return formatTime(iso)
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return yesterdayLabel
  return formatDate(iso, { day: '2-digit', month: '2-digit' })
}

export function ConversationCard({
  conv, selected, onClick, onDelete,
}: {
  conv: ConversationItem
  selected: boolean
  onClick: () => void
  onDelete: (conv: ConversationItem) => void
}) {
  const { t } = useTranslation()
  const [hover, setHover] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const isTouch = useIsTouch()
  const isGroupe = conv.type === 'GROUPE'
  const nom = conv.titre

  let apercu = t('messagerie.noMessage')
  if (conv.dernierMessage) {
    const dm = conv.dernierMessage
    const prefix = dm.deMoi ? t('messagerie.youPrefix') : (isGroupe ? `${dm.auteur} : ` : '')
    apercu = `${prefix}${dm.apercu ?? ''}`
  }

  const showMenu = hover || menuOpen || isTouch

  return (
    <div
      role="button" tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter') onClick() }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
        background: selected ? 'var(--ap-50)' : 'transparent',
        borderLeft: `3px solid ${selected ? 'var(--ap-400)' : 'transparent'}`,
        borderBottom: '1px solid var(--bordure-legere)', transition: 'background 0.1s',
      }}
    >
      {isGroupe
        ? <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--ap-100)', color: 'var(--ap-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Users size={18} /></div>
        : <Avatar nom={nom} size={40} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: conv.nonLus > 0 ? 700 : 600, color: 'var(--texte-primaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nom}
          </span>
          {conv.dernierMessage && <span style={{ fontSize: 10, color: 'var(--texte-tertiaire)', flexShrink: 0 }}>{formatCardTime(conv.dernierMessage.createdAt, t('messagerie.yesterday'))}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 }}>
          <span style={{ fontSize: 12, color: conv.nonLus > 0 ? 'var(--texte-secondaire)' : 'var(--texte-tertiaire)', fontWeight: conv.nonLus > 0 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {renderRich(apercu, 13)}
          </span>
          {conv.nonLus > 0 && (
            <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9999, background: 'var(--ap-400)', color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: '18px', textAlign: 'center', flexShrink: 0 }}>
              {conv.nonLus > 99 ? '99+' : conv.nonLus}
            </span>
          )}
        </div>
      </div>

      {/* Menu d'actions de la conversation (au survol) */}
      {showMenu && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 8, right: 8 }}>
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <button title={t('messagerie.cardActions')} style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--texte-secondaire)' }}>
                <MoreVertical size={14} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={4} style={{ width: 210, padding: 4, background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.14)' }}>
              <button onClick={() => { setMenuOpen(false); onDelete(conv) }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 7, fontSize: 13, color: 'var(--erreur-accent)', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--erreur-fond)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {isGroupe ? <LogOut size={14} /> : <Trash2 size={14} />}
                {isGroupe ? t('messagerie.leaveGroup') : t('messagerie.deleteConversation')}
              </button>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  )
}
