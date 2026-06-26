/**
 * Modal — shell de fenêtre modale SARIS.
 *
 * Overlay flouté + carte centrée (header icône/titre/sous-titre + bouton fermer,
 * corps défilant, pied d'actions collé). Ferme par Échap et clic sur l'overlay,
 * verrouille le scroll de fond. Remplace les modales « hand-rollées » et les
 * <dialog>/panneaux inline incohérents.
 */

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './IconButton'
import { useIsMobile } from '@/hooks/useMediaQuery'

interface ModalProps {
  icon:      ReactNode
  title:     string
  subtitle?: string
  onClose:   () => void
  /** Largeur de la carte (px). Défaut 560. */
  width?:    number
  /** Contenu du pied (boutons d'action). Optionnel. */
  footer?:   ReactNode
  /** Padding du corps. Défaut `var(--espace-5)`. Passer `0` pour les modales « liste » (rangées pleine largeur). */
  bodyPadding?: string
  children:  ReactNode
}

export function Modal({ icon, title, subtitle, onClose, width = 560, footer, bodyPadding = 'var(--espace-5)', children }: ModalProps) {
  const isMobile = useIsMobile()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  // Portalisé dans <body> : sinon un ancêtre avec backdrop-filter/transform/filter
  // (ex. le rideau de confidentialité « verre poli » de la zone détail) devient le
  // bloc englobant du `position: fixed` → la modale se retrouve piégée et rognée
  // dans la zone au lieu d'être centrée sur le viewport.
  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="saris-grain"
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 1001, width, maxWidth: isMobile ? 'calc(100vw - 18px)' : 'calc(100vw - 32px)', maxHeight: isMobile ? 'calc(100vh - 18px)' : 'calc(100vh - 32px)',
          backgroundColor: 'var(--fond-surface)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--ombre-4)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{
          padding: isMobile ? 'var(--espace-3) var(--espace-4)' : 'var(--espace-4) var(--espace-5)',
          borderBottom: '1px solid var(--bordure-legere)',
          display: 'flex', alignItems: 'center', gap: 'var(--espace-2)',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 'var(--radius-lg)',
            background: 'var(--ap-50)', color: 'var(--ap-600)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-h4)', fontWeight: 700, color: 'var(--texte-primaire)' }}>{title}</p>
            {subtitle && <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>{subtitle}</p>}
          </div>
          <IconButton aria-label="Fermer" icon={<X size={15} />} onClick={onClose} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile && bodyPadding === 'var(--espace-5)' ? 'var(--espace-4)' : bodyPadding, display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
          {children}
        </div>

        {footer && (
          <div style={{
            padding: isMobile ? 'var(--espace-3) var(--espace-4)' : 'var(--espace-3) var(--espace-5)',
            borderTop: '1px solid var(--bordure-legere)',
            background: 'var(--fond-surface-2)',
            display: 'flex', justifyContent: 'flex-end', gap: 'var(--espace-2)',
          }}>
            {footer}
          </div>
        )}
      </div>
    </>,
    document.body,
  )
}
