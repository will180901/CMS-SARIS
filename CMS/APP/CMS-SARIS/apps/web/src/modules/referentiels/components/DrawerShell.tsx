/**
 * DrawerShell — enveloppe réutilisable pour tous les drawers de création / édition.
 *
 * Panneau latéral droit (Sheet shadcn). Fournit un hero header propre (icône
 * optionnelle + titre + description + bouton fermer), un corps scrollable et un
 * footer premium (Annuler / Enregistrer). Protège contre la perte de saisie
 * ("dirty state") via une confirmation.
 *
 * Charte SARIS : un seul accent (bleu sarcelle var(--ap-*)), aucune bordure
 * décorative colorée, couleurs sémantiques réservées au ton "danger".
 *
 * 100 % rétrocompatible : toutes les props historiques sont conservées ; les
 * nouvelles (icon, tone, saveLabel, cancelLabel, saveDisabled) sont optionnelles.
 */

import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@workspace/ui/components/sheet'
import { Button } from '@/components/saris'
import { ConfirmDialog } from './ConfirmDialog'

interface DrawerShellProps {
  open:          boolean
  onClose:       () => void
  title:         string
  description?:  string
  onSave:        () => void
  isSaving?:     boolean
  /** true si le formulaire a des modifications non sauvegardées */
  isDirty?:      boolean
  children:      ReactNode
  /** Icône affichée dans le hero (chip coloré). Optionnel. */
  icon?:         ReactNode
  /** Ton du hero/footer : "normal" (accent) ou "danger" (suppression). */
  tone?:         'normal' | 'danger'
  /** Libellé du bouton de validation (défaut : "Enregistrer"). */
  saveLabel?:    string
  /** Libellé du bouton d'annulation (défaut : "Annuler"). */
  cancelLabel?:  string
  /** Désactive la validation (ex : formulaire invalide). */
  saveDisabled?: boolean
  /** Largeur du panneau (défaut : 460px). */
  width?:        number
}

export function DrawerShell({
  open,
  onClose,
  title,
  description,
  onSave,
  isSaving     = false,
  isDirty      = false,
  children,
  icon,
  tone         = 'normal',
  saveLabel,
  cancelLabel,
  saveDisabled = false,
  width        = 460,
}: DrawerShellProps) {
  const { t } = useTranslation()
  const [leaveWarning, setLeaveWarning] = useState(false)

  const handleAttemptClose = () => {
    if (isDirty) setLeaveWarning(true)
    else onClose()
  }

  const iconColor = tone === 'danger' ? 'var(--erreur-accent)' : 'var(--ap-600)'
  const iconBg    = tone === 'danger' ? 'var(--erreur-fond)'   : 'var(--ap-50)'

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && handleAttemptClose()}>
        <SheetContent
          side="right"
          style={{
            width:         `${width}px`,
            maxWidth:      '95vw',
            padding:       0,
            gap:           0,
            display:       'flex',
            flexDirection: 'column',
            height:        '100vh',
            maxHeight:     '100vh',
            background:    'var(--fond-surface)',
          }}
        >
          {/* ── Hero header ─────────────────────────────────────────────────── */}
          <SheetHeader
            style={{
              position:     'relative',
              padding:      'var(--espace-5) var(--espace-6) var(--espace-4)',
              borderBottom: '1px solid var(--bordure-legere)',
              flexShrink:   0,
              display:      'flex', flexDirection: 'row', alignItems: 'center',
              gap:          'var(--espace-3)',
              textAlign:    'left',
            }}
          >
            {icon && (
              <div style={{
                width: 38, height: 38, borderRadius: 'var(--radius-lg)',
                background: iconBg, color: iconColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {icon}
              </div>
            )}

            <div style={{ flex: 1, minWidth: 0, paddingRight: 28 }}>
              <SheetTitle
                style={{
                  margin: 0,
                  fontSize:   'var(--font-size-h4)',
                  fontWeight: 700,
                  color:      'var(--texte-primaire)',
                  lineHeight: 1.25,
                }}
              >
                {title}
              </SheetTitle>
              {description && (
                <SheetDescription
                  style={{
                    margin: '3px 0 0',
                    fontSize: 'var(--font-size-caption)',
                    color:    'var(--texte-tertiaire)',
                    lineHeight: 1.4,
                  }}
                >
                  {description}
                </SheetDescription>
              )}
            </div>

            {/* Bouton fermer */}
            <button
              aria-label={t('referentiels.closePanel')}
              onClick={handleAttemptClose}
              disabled={isSaving}
              style={{
                position: 'absolute', top: 14, right: 14,
                background: 'transparent', border: 'none',
                padding: 6, borderRadius: 'var(--radius-md)',
                color: 'var(--texte-tertiaire)',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                transition: 'background 0.12s, color 0.12s',
              }}
              onMouseEnter={e => { if (!isSaving) { e.currentTarget.style.background = 'var(--fond-surface-2)'; e.currentTarget.style.color = 'var(--texte-primaire)' } }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--texte-tertiaire)' }}
            >
              <X size={16} />
            </button>
          </SheetHeader>

          {/* ── Corps scrollable ────────────────────────────────────────────── */}
          <div style={{
            flex: 1, minHeight: 0,
            overflowY: 'auto', overflowX: 'hidden',
            padding: 'var(--espace-5) var(--espace-6)',
          }}>
            {children}
          </div>

          {/* ── Footer ──────────────────────────────────────────────────────── */}
          <div style={{
            padding: 'var(--espace-3) var(--espace-6)',
            borderTop: '1px solid var(--bordure-legere)',
            background: 'var(--fond-surface)',
            display: 'flex', justifyContent: 'flex-end', gap: 'var(--espace-2)',
            flexShrink: 0,
          }}>
            <Button variant="secondary" size="sm" onClick={handleAttemptClose} disabled={isSaving}>
              {cancelLabel ?? t('referentiels.cancel')}
            </Button>
            <Button
              variant={tone === 'danger' ? 'danger' : 'primary'}
              size="sm"
              onClick={onSave}
              loading={isSaving}
              disabled={isSaving || saveDisabled}
              style={{ minWidth: 120 }}
            >
              {saveLabel ?? t('referentiels.save')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Confirmation "quitter sans enregistrer" ─────────────────────────── */}
      <ConfirmDialog
        open={leaveWarning}
        onCancel={() => setLeaveWarning(false)}
        onConfirm={() => { setLeaveWarning(false); onClose() }}
        title={t('referentiels.leaveTitle')}
        description={t('referentiels.leaveDescription')}
        confirmLabel={t('referentiels.leaveConfirm')}
        variant="warning"
      />
    </>
  )
}
