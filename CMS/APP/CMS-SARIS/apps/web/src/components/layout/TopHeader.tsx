/**
 * TopHeader — barre supérieure commune, fine et discrète (verre poli).
 * Contient le statut de connectivité + la cloche de notifications (badge non-lus)
 * qui ouvre le drawer droit. Le flux temps réel (SSE) est monté ici une seule fois.
 */
import { useState } from 'react'
import { Bell, Wifi, WifiOff, RefreshCw, CloudUpload, Menu, Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tooltip } from '@/components/saris'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useUiStore } from '@/stores/ui.store'
import { usePrivacyStore } from '@/stores/privacy.store'
import { useNetworkStore } from '@/stores/network.store'
import { useSyncStore } from '@/stores/sync.store'
import { useUnreadCount, useNotificationStream } from '@/modules/notifications/hooks/useNotifications'
import { useApiEndpointSwitch } from '@/stores/connectivity.store'
import { NotificationDrawer } from './NotificationDrawer'
import { BreadcrumbBar } from './BreadcrumbBar'

export function TopHeader() {
  const { t } = useTranslation()
  const [open, setOpen]  = useState(false)
  const isMobile         = useIsMobile()
  const toggleMobileNav  = useUiStore(s => s.toggleMobileNav)
  const isOnline         = useNetworkStore(s => s.isOnline)
  const syncStatus       = useSyncStore(s => s.status)
  const pendingCount     = useSyncStore(s => s.pendingCount)
  const { data }         = useUnreadCount()
  const unread           = data?.count ?? 0
  const curtain          = usePrivacyStore(s => s.curtain)
  const toggleCurtain    = usePrivacyStore(s => s.toggle)
  const syncing          = syncStatus === 'syncing'

  // Flux temps réel : monté une seule fois (header global).
  useNotificationStream()
  // Client de bureau : bascule online-first (central en ligne / local hors-ligne).
  useApiEndpointSwitch()

  return (
    <>
      <style>{'@keyframes saris-notif-blink{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.3;transform:scale(0.82)}}'}</style>
      <header
        style={{
          flexShrink: 0,
          height: 48,
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6,
          padding: '0 16px',
          borderBottom: '1px solid var(--bordure-legere)',
          background: 'color-mix(in srgb, var(--fond-surface) 78%, transparent)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      >
        {/* Hamburger — ouvre le tiroir de navigation (mobile uniquement) */}
        {isMobile && (
          <button
            aria-label={t('nav.menu', { defaultValue: 'Menu' })}
            onClick={toggleMobileNav}
            style={{
              marginRight: 'auto',
              width: 36, height: 36, borderRadius: 'var(--radius-lg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--texte-secondaire)',
            }}
          >
            <Menu size={20} />
          </button>
        )}

        {/* Fil d'Ariane + navigation avant / arrière (desktop) */}
        {!isMobile && <BreadcrumbBar />}

        {/* Statut de connectivité */}
        <Tooltip label={isOnline ? t('header.onlineTooltip') : t('header.offlineTooltip')}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 600,
            padding: '4px 9px', borderRadius: 9999,
            background: isOnline ? 'var(--succes-fond)' : 'var(--avert-fond)',
            color:      isOnline ? 'var(--succes-texte)' : 'var(--avert-texte)',
          }}>
            {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
            {isOnline ? t('common.online') : t('common.offline')}
          </span>
        </Tooltip>

        {/* File de synchronisation hors-ligne */}
        {(pendingCount > 0 || syncing) && (
          <Tooltip label={syncing
            ? t('header.syncingTooltip')
            : t('header.pendingTooltip', { count: pendingCount })}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 11, fontWeight: 600,
              padding: '4px 9px', borderRadius: 9999,
              background: 'var(--info-fond)', color: 'var(--info-texte)',
            }}>
              {syncing
                ? <RefreshCw size={12} className="animate-spin" />
                : <CloudUpload size={12} />}
              {syncing ? t('header.syncing') : t('header.pending', { count: pendingCount })}
            </span>
          </Tooltip>
        )}

        {/* Interrupteur du rideau de confidentialité (zones de détail) */}
        <Tooltip label={curtain ? t('privacy.disable') : t('privacy.enable')}>
          <button
            type="button"
            role="switch"
            aria-checked={curtain}
            aria-label={curtain ? t('privacy.disable') : t('privacy.enable')}
            onClick={toggleCurtain}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 30, padding: '0 9px', borderRadius: 9999,
              background: 'transparent', border: 'none', cursor: 'pointer',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--fond-surface-2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            {curtain
              ? <EyeOff size={14} style={{ color: 'var(--ap-600)' }} />
              : <Eye    size={14} style={{ color: 'var(--texte-tertiaire)' }} />}
            {/* Rail + bouton coulissant */}
            <span aria-hidden="true" style={{
              position: 'relative', width: 34, height: 19, borderRadius: 9999, flexShrink: 0,
              background: curtain ? 'var(--ap-500)' : 'var(--bordure-normale)',
              transition: 'background 0.18s',
            }}>
              <span style={{
                position: 'absolute', top: 2, left: curtain ? 17 : 2,
                width: 15, height: 15, borderRadius: 9999, background: '#fff',
                boxShadow: '0 1px 2px rgba(15,23,42,0.28)',
                transition: 'left 0.18s',
              }} />
            </span>
          </button>
        </Tooltip>

        {/* Cloche notifications */}
        <Tooltip label={t('header.notifications')}>
          <button
            aria-label={t('header.notifications') + (unread > 0 ? ` (${unread})` : '')}
            onClick={() => setOpen(true)}
            style={{
              position: 'relative',
              width: 34, height: 34, borderRadius: 'var(--radius-lg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--texte-secondaire)', transition: 'background 0.12s, color 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--fond-surface-2)'; e.currentTarget.style.color = 'var(--texte-primaire)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--texte-secondaire)' }}
          >
            <Bell size={17} />
            {/* Témoin lumineux : point vert clignotant en haut à droite, présent
                uniquement s'il y a au moins une notification/message non lu. */}
            {unread > 0 && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute', top: 3, right: 3,
                  width: 9, height: 9, borderRadius: 9999,
                  background: 'var(--succes-texte)',
                  boxShadow: '0 0 0 2px var(--fond-surface), 0 0 7px 1px var(--succes-texte)',
                  animation: 'saris-notif-blink 1.4s ease-in-out infinite',
                }}
              />
            )}
          </button>
        </Tooltip>
      </header>

      <NotificationDrawer open={open} onClose={() => setOpen(false)} />
    </>
  )
}
