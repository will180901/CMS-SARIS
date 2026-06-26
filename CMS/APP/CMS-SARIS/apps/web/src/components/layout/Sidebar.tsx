/**
 * Sidebar — barre latérale principale de navigation SARIS.
 *
 * Architecture :
 *   - En-tête fixe : logo + statut connexion
 *   - Carte identité utilisateur (avatar, rôle, site)
 *   - Navigation par groupes — items filtrés par permission
 *   - Footer compact : raccourcis (changer mdp, déconnexion)
 *
 * Design : large (260px), hiérarchie claire, atoms réutilisables.
 */

import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LogOut, ChevronsUpDown,
  Stethoscope, Settings,
} from 'lucide-react'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@workspace/ui/components/popover'
import { UpdateBubble } from './UpdateBubble'
import { useNavigation }   from '@/hooks/useNavigation'
import { useLogout }       from '@/modules/auth/hooks/useLogout'
import { useSessionStore } from '@/stores/session.store'
import { useServerHealth } from '@/hooks/useServerHealth'
import { useSyncEngine }   from '@/hooks/useSyncEngine'
import { ROLE_META, getPrimaryRole } from '@/config/navigation.config'
import { useSites }        from '@/modules/referentiels/hooks/useReferentiels'
import { useMessagerieUnread } from '@/modules/messagerie/hooks/useMessagerie'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useUiStore } from '@/stores/ui.store'
import { isDesktop } from '@/lib/desktop'
import { DESKTOP_TITLEBAR_H } from './DesktopTitleBar'
import { Avatar, StatusPill } from '@/components/saris'
import type { Role } from '@cms-saris/types'
import { useTranslation } from 'react-i18next'

const SIDEBAR_WIDTH = 264
/** Largeur de la sidebar REPLIÉE (rail d'icônes) — le contenu démarre après. */
export const SIDEBAR_RAIL = 68
/** Décalage haut en client de bureau : la sidebar démarre sous la barre de titre custom. */
const SIDEBAR_TOP = isDesktop ? DESKTOP_TITLEBAR_H : 0

// Mappage clé de navigation → clé i18n (le menu reste défini en français dans la config).
const GROUP_TKEY: Record<string, string> = {
  clinique: 'navGroups.clinique',
  administration_medicale: 'navGroups.adminMedicale',
  administration_systeme: 'navGroups.adminSysteme',
  systeme: 'navGroups.systeme',
}
const ITEM_TKEY: Record<string, string> = {
  dashboard: 'nav.dashboard', patients: 'nav.patients', triage: 'nav.triage',
  consultations: 'nav.consultations', sorties: 'nav.sortiesCritiques', messagerie: 'nav.messagerie',
  referentiels: 'nav.referentiels', utilisateurs: 'nav.utilisateurs',
  roles: 'nav.roles', audit: 'nav.audit', sync: 'nav.synchronisation', parametres: 'nav.parametres',
}

// ── Composant ─────────────────────────────────────────────────────────────────

export function Sidebar() {
  const { t } = useTranslation()
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [expanded,   setExpanded]   = useState(false)
  const isMobile         = useIsMobile()
  const mobileNavOpen    = useUiStore(s => s.mobileNavOpen)
  const setMobileNavOpen = useUiStore(s => s.setMobileNavOpen)
  const location         = useLocation()
  // Ferme le drawer mobile à chaque navigation (clic sur un item ou redirection).
  useEffect(() => { setMobileNavOpen(false) }, [location.pathname, setMobileNavOpen])
  const navGroups        = useNavigation()
  const navigate         = useNavigate()
  const user             = useSessionStore(s => s.user)
  const logoutMutation   = useLogout()
  const { data: sites = [] } = useSites()

  // Badge non-lus sur l'item « Messagerie » (seulement si la nav le contient).
  const hasMessagerie = navGroups.some(g => g.items.some(i => i.key === 'messagerie'))
  const { data: msgUnread } = useMessagerieUnread(hasMessagerie)
  const messagerieUnread = msgUnread?.count ?? 0

  // Pilote l'indicateur « En ligne / Hors ligne » via un ping réel du serveur.
  useServerHealth()
  // Rejeu des mutations hors-ligne à la reconnexion + compteur d'attente.
  useSyncEngine()

  if (!user) return null

  const siteName    = sites.find(s => s.id === user.siteId)?.libelle.replace('Centre Médico-Social ', '') ?? '—'
  const primaryRole = getPrimaryRole(user.roles as Role[])
  const roleMeta    = ROLE_META[primaryRole]

  function handleLogout() {
    setMenuOpen(false)
    logoutMutation.mutate()
  }

  // Contenu déployé (labels visibles) : TOUJOURS sur mobile (drawer plein) ; sur
  // bureau, au survol OU si le menu utilisateur est ouvert.
  const open = isMobile ? true : (expanded || menuOpen)

  return (
    <>
      {/* Voile sombre derrière le drawer (mobile uniquement) */}
      {isMobile && mobileNavOpen && (
        <div
          aria-hidden="true"
          onClick={() => setMobileNavOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 49, background: 'rgba(15,23,42,0.45)' }}
        />
      )}
      <aside
        onMouseEnter={isMobile ? undefined : () => setExpanded(true)}
        onMouseLeave={isMobile ? undefined : () => setExpanded(false)}
        style={{
          position:     'fixed',
          left: 0, top: SIDEBAR_TOP, zIndex: 50,
          width:        isMobile ? SIDEBAR_WIDTH : (open ? SIDEBAR_WIDTH : SIDEBAR_RAIL),
          height:       `calc(100vh - ${SIDEBAR_TOP}px)`,
          display:      'flex',
          flexDirection: 'column',
          background:   'var(--glass-sidebar-bg)',
          backdropFilter: 'blur(var(--glass-sidebar-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-sidebar-blur))',
          borderRight:  '1px solid var(--glass-bordure)',
          boxShadow:    (isMobile ? mobileNavOpen : open) ? 'var(--ombre-4)' : 'none',
          transform:    isMobile ? `translateX(${mobileNavOpen ? '0' : '-100%'})` : 'none',
          transition:   'width 0.18s ease, transform 0.22s ease, box-shadow 0.18s ease',
          userSelect:   'none',
          overflow:     'hidden',
        }}
      >
        {/* ── En-tête : logo + statut ────────────────────────────────────── */}
        <div style={{
          padding:      open ? '14px var(--espace-4)' : '14px 0',
          borderBottom: '1px solid var(--bordure-legere)',
          display:      'flex',
          alignItems:   'center',
          justifyContent: open ? 'flex-start' : 'center',
          gap:          'var(--espace-2)',
          flexShrink:   0,
        }}>
          <span style={{
            width: 36, height: 36, borderRadius: 'var(--radius-lg)', flexShrink: 0,
            background: '#fff', border: '1px solid var(--bordure-legere)',
            boxShadow: '0 1px 2px rgba(15,23,42,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <img
              src="/icon-192.png" alt="Logo CMS SARIS" width={24} height={24}
              style={{ width: 24, height: 24, objectFit: 'contain', display: 'block', transform: 'translateX(-0.5px)' }}
            />
          </span>
          {open && (
            <div style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap' }}>
              <p style={{
                margin: 0, fontSize: 14, fontWeight: 700,
                color: 'var(--texte-primaire)',
                letterSpacing: '-0.01em',
                lineHeight: 1.1,
              }}>
                CMS SARIS
              </p>
              <p style={{
                margin: '2px 0 0',
                fontSize: 'var(--font-size-overline)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: 'var(--texte-tertiaire)',
                lineHeight: 1,
              }}>
                {siteName}
              </p>
            </div>
          )}
        </div>

        {/* ── Navigation ─────────────────────────────────────────────────── */}
        <nav style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: open ? 'var(--espace-2)' : '8px 0',
        }}>
          {navGroups.map((group, gIdx) => (
            <div key={group.key} style={{ marginTop: gIdx > 0 ? (open ? 'var(--espace-3)' : 10) : 0 }}>
              {/* Label de groupe (déployé) ou simple séparateur (replié) */}
              {open ? (
                <p style={{
                  margin: 'var(--espace-2) 0 4px',
                  padding: '0 var(--espace-3)',
                  fontSize: 'var(--font-size-overline)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--texte-tertiaire)',
                  whiteSpace: 'nowrap',
                }}>
                  {GROUP_TKEY[group.key] ? t(GROUP_TKEY[group.key]!) : group.label}
                </p>
              ) : gIdx > 0 ? (
                <div style={{ height: 1, background: 'var(--bordure-legere)', margin: '6px 16px 8px' }} />
              ) : null}

              {/* Items */}
              {group.items.map(item => {
                const showBadge = item.key === 'messagerie' && messagerieUnread > 0
                return (
                <NavLink key={item.key} to={item.href} end={item.href === '/dashboard'}>
                  {({ isActive }) => (
                    <div
                      title={!open ? (ITEM_TKEY[item.key] ? t(ITEM_TKEY[item.key]!) : item.label) : undefined}
                      style={{
                        position: 'relative',
                        display: 'flex', alignItems: 'center',
                        justifyContent: open ? 'flex-start' : 'center',
                        gap: open ? 'var(--espace-2)' : 0,
                        padding: open ? '8px var(--espace-3)' : '9px 0',
                        margin: open ? 0 : '2px 10px',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        color:      isActive ? 'var(--ap-700)' : 'var(--texte-secondaire)',
                        background: isActive ? 'var(--ap-50)'  : 'transparent',
                        fontWeight: isActive ? 600 : 500,
                        transition: 'background 0.12s, color 0.12s',
                      }}
                      onMouseEnter={e => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'var(--fond-surface-2)'
                          e.currentTarget.style.color = 'var(--texte-primaire)'
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.color = 'var(--texte-secondaire)'
                        }
                      }}
                    >
                      {/* Indicateur actif gauche (déployé) */}
                      {isActive && open && (
                        <span aria-hidden="true" style={{ position: 'absolute', left: -8, top: 8, bottom: 8, width: 3, borderRadius: 2, background: 'var(--ap-500)' }} />
                      )}

                      <span style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
                        <item.icon size={18} strokeWidth={isActive ? 2 : 1.8} />
                        {/* Replié : pastille non-lus sur l'icône */}
                        {!open && showBadge && (
                          <span aria-hidden="true" style={{ position: 'absolute', top: -3, right: -4, width: 9, height: 9, borderRadius: 9999, background: 'var(--erreur-accent)', border: '1.5px solid var(--glass-sidebar-bg)' }} />
                        )}
                      </span>

                      {open && (
                        <span style={{ fontSize: 'var(--font-size-body-sm)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ITEM_TKEY[item.key] ? t(ITEM_TKEY[item.key]!) : item.label}
                        </span>
                      )}
                      {open && showBadge && (
                        <span
                          aria-label={`${messagerieUnread} message${messagerieUnread > 1 ? 's' : ''} non lu${messagerieUnread > 1 ? 's' : ''}`}
                          style={{ marginLeft: 'auto', flexShrink: 0, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9999, background: 'var(--erreur-accent)', color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: '18px', textAlign: 'center' }}
                        >
                          {messagerieUnread > 99 ? '99+' : messagerieUnread}
                        </span>
                      )}
                    </div>
                  )}
                </NavLink>
              )})}
            </div>
          ))}
        </nav>

        {/* ── Footer — Carte utilisateur cliquable ─────────────────────── */}
        <div style={{
          padding: open ? 'var(--espace-2)' : '8px 0',
          borderTop: '1px solid var(--bordure-legere)',
          flexShrink: 0,
        }}>
          {/* Bulle de mise à jour (desktop) — apparaît au-dessus du menu utilisateur. */}
          <UpdateBubble collapsed={!open} />
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <button
                aria-label="Menu utilisateur"
                title={!open ? user.login : undefined}
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: open ? 'flex-start' : 'center', gap: 'var(--espace-2)',
                  padding: open ? 'var(--espace-2)' : '6px 0',
                  borderRadius: 'var(--radius-md)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--fond-surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <Avatar nom={user.login} size={36} tone="accent" />
                {open && (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0,
                      fontSize: 'var(--font-size-body-sm)',
                      fontWeight: 600,
                      color: 'var(--texte-primaire)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {user.login}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      {user.personnelMedicalId && (
                        <Stethoscope size={9} style={{ color: 'var(--texte-tertiaire)', flexShrink: 0 }} />
                      )}
                      <span style={{
                        fontSize: 'var(--font-size-caption)',
                        color: roleMeta.text,
                        fontWeight: 600,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {roleMeta.label}
                      </span>
                    </div>
                  </div>
                )}
                {open && <ChevronsUpDown size={13} style={{ color: 'var(--texte-tertiaire)', flexShrink: 0 }} />}
              </button>
            </PopoverTrigger>

            <PopoverContent
              side="top"
              align="start"
              sideOffset={8}
              style={{
                width: SIDEBAR_WIDTH - 24,
                padding: 0,
                borderRadius: 'var(--radius-xl)',
                background: 'var(--fond-surface)',
                border: '1px solid var(--bordure-normale)',
                boxShadow: 'var(--ombre-3)',
                overflow: 'hidden',
              }}
            >
              {/* Carte profil étendue */}
              <div style={{
                padding: 'var(--espace-3) var(--espace-4)',
                borderBottom: '1px solid var(--bordure-legere)',
                background: 'var(--fond-surface-2)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-3)' }}>
                  <Avatar nom={user.login} size={44} tone="accent" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0,
                      fontSize: 'var(--font-size-body-sm)',
                      fontWeight: 600,
                      color: 'var(--texte-primaire)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {user.login}
                    </p>
                    <p style={{
                      margin: '2px 0 0',
                      fontSize: 'var(--font-size-caption)',
                      color: 'var(--texte-tertiaire)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {siteName}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 'var(--espace-2)' }}>
                  {user.roles.slice(0, 2).map(r => {
                    const m = ROLE_META[r as Role]
                    return (
                      <span
                        key={r}
                        style={{
                          fontSize: 'var(--font-size-caption)',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 9999,
                          background: m.bg, color: m.text,
                        }}
                      >
                        {m.label}
                      </span>
                    )
                  })}
                  {user.permissions && (
                    <StatusPill tone="neutral" dot={false} size="sm">
                      {user.permissions.length} permissions
                    </StatusPill>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ padding: 'var(--espace-1)' }}>
                <MenuItem
                  icon={<Settings size={13} />}
                  label="Paramètres"
                  onClick={() => { setMenuOpen(false); navigate('/admin/parametres') }}
                />
                <div style={{ height: 1, background: 'var(--bordure-legere)', margin: '4px 0' }} />
                <MenuItem
                  icon={<LogOut size={13} />}
                  label="Se déconnecter"
                  tone="danger"
                  disabled={logoutMutation.isPending}
                  onClick={handleLogout}
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </aside>
    </>
  )
}

// ── MenuItem ──────────────────────────────────────────────────────────────────

function MenuItem({
  icon, label, tone = 'normal', onClick, disabled,
}: {
  icon: React.ReactNode
  label: string
  tone?: 'normal' | 'danger'
  onClick: () => void
  disabled?: boolean
}) {
  const color = tone === 'danger' ? 'var(--erreur-accent)' : 'var(--texte-secondaire)'
  const hoverBg = tone === 'danger' ? 'var(--erreur-fond)' : 'var(--fond-surface-2)'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        display: 'flex', alignItems: 'center', gap: 'var(--espace-2)',
        padding: 'var(--espace-2) var(--espace-3)',
        borderRadius: 'var(--radius-md)',
        fontSize: 'var(--font-size-body-sm)',
        color, background: 'transparent', border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        textAlign: 'left',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {icon}
      {label}
    </button>
  )
}
