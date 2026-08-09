/**
 * Barre de titre personnalisée du client de bureau (Electron) — façon WhatsApp.
 *
 * Remplace la barre/menu natif Windows : logo + nom à gauche, et rien d'autre. Le
 * bouton « ⋮ » a été retiré — il n'ouvrait qu'un menu de réglages techniques sans
 * usage quotidien, au milieu des boutons système. Les
 * boutons système (réduire / agrandir / fermer) sont dessinés par l'OS via l'overlay
 * (`titleBarOverlay`), thématisé — on réserve donc de la place à droite. Le fond suit
 * le thème (`--fond-page`) pour se fondre avec l'overlay natif.
 *
 * Ne s'affiche QUE dans le client de bureau (cf. AppShell + `isDesktop`).
 */
import { useTranslation } from 'react-i18next'
import { isDesktop } from '@/lib/desktop'

/** Hauteur de la barre — doit correspondre à `titleBarOverlay.height` (Electron). */
export const DESKTOP_TITLEBAR_H = 40

/** Largeur réservée à droite pour les boutons système natifs (Windows ≈ 138 px). */
const OVERLAY_RESERVED = 140

const DRAG = { WebkitAppRegion: 'drag' } as React.CSSProperties

export function DesktopTitleBar() {
  const { t } = useTranslation()

  return (
    <header
      style={{
        height: DESKTOP_TITLEBAR_H,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: `0 ${OVERLAY_RESERVED}px 0 12px`,
        background: 'var(--fond-page)',
        borderBottom: '1px solid var(--bordure-legere)',
        userSelect: 'none',
        ...DRAG,
      }}
    >
      <img
        src="/icon-192.png"
        alt=""
        width={20}
        height={20}
        style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0 }}
      />
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--texte-primaire)', letterSpacing: '-0.01em' }}>
        CMS SARIS
      </span>
      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--texte-tertiaire)', whiteSpace: 'nowrap' }}>
        {t('shell.desktopSubtitle')}
      </span>

      <div style={{ flex: 1 }} />
    </header>
  )
}

/**
 * Bande de déplacement seule, pour les écrans rendus HORS du shell — la page de
 * connexion en premier lieu.
 *
 * La fenêtre est sans cadre : Windows ne dessine que les boutons réduire/fermer, et
 * rien n'est déplaçable tant que l'application ne déclare pas elle-même une zone
 * `-webkit-app-region: drag`. Le shell le fait via DesktopTitleBar ; la page de
 * connexion, elle, vit en dehors et restait donc clouée au centre de l'écran —
 * impossible de l'écarter pour lire ce qu'il y a derrière.
 *
 * Volontairement nue (ni logo ni menu) : sur une fenêtre de 460 px de large dont
 * 140 sont déjà pris par les boutons système, une barre de titre complète serait à
 * l'étroit. Ici on ne veut que la poignée.
 */
export function DesktopDragStrip() {
  if (!isDesktop) return null
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed', top: 0, left: 0, right: OVERLAY_RESERVED,
        height: DESKTOP_TITLEBAR_H,
        // Au-dessus du fond, sous les éventuelles fenêtres modales.
        zIndex: 5,
        ...DRAG,
      }}
    />
  )
}
