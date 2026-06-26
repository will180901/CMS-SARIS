/**
 * ConfirmDialog — modale de confirmation générique (socle).
 *
 * Utilisée pour toutes les confirmations sensibles : suppression, désactivation,
 * quitter sans enregistrer… Header à icône colorée par ton + footer design-system.
 *
 * Charte SARIS : couleurs sémantiques (rouge/ambre/bleu) réservées au ton,
 * aucune bordure décorative colorée.
 */

import { useTranslation } from 'react-i18next'
import { AlertTriangle, Info } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog'

interface ConfirmDialogProps {
  open:          boolean
  onCancel:      () => void
  onConfirm:     () => void
  title:         string
  description:   string
  confirmLabel?: string
  cancelLabel?:  string
  /** 'destructive' → rouge | 'warning' → ambre | 'info' → bleu */
  variant?:      'destructive' | 'warning' | 'info'
  loading?:      boolean
}

const TONES = {
  destructive: { bg: 'var(--erreur-fond)', color: 'var(--erreur-accent)', btn: 'var(--erreur-accent)', icon: <AlertTriangle size={18} /> },
  warning:     { bg: 'var(--avert-fond)',  color: 'var(--avert-accent)',  btn: 'var(--avert-accent)',  icon: <AlertTriangle size={18} /> },
  info:        { bg: 'var(--ap-50)',       color: 'var(--ap-600)',        btn: 'var(--ap-500)',        icon: <Info size={18} /> },
} as const

export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant      = 'destructive',
  loading      = false,
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  const tone = TONES[variant]

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent
        style={{
          background:   'var(--fond-surface)',
          borderRadius: 'var(--radius-xl)',
          border:       '1px solid var(--bordure-legere)',
          boxShadow:    'var(--ombre-4)',
          maxWidth:     '440px',
          padding:      0,
          overflow:     'hidden',
          gap:          0,
        }}
      >
        <AlertDialogHeader style={{
          padding: 'var(--espace-5) var(--espace-5) var(--espace-4)',
          display: 'flex', flexDirection: 'row', alignItems: 'flex-start',
          gap: 'var(--espace-3)', textAlign: 'left',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 'var(--radius-lg)',
            background: tone.bg, color: tone.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {tone.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <AlertDialogTitle style={{
              margin: 0, fontSize: 'var(--font-size-h4)', fontWeight: 700,
              color: 'var(--texte-primaire)', lineHeight: 1.3,
            }}>
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription style={{
              margin: '4px 0 0', fontSize: 'var(--font-size-body-sm)',
              color: 'var(--texte-secondaire)', lineHeight: 1.55,
            }}>
              {description}
            </AlertDialogDescription>
          </div>
        </AlertDialogHeader>

        <AlertDialogFooter style={{
          padding: 'var(--espace-3) var(--espace-5)',
          borderTop: '1px solid var(--bordure-legere)',
          background: 'var(--fond-surface-2)',
          display: 'flex', justifyContent: 'flex-end', gap: 'var(--espace-2)',
        }}>
          <AlertDialogCancel
            disabled={loading}
            style={{
              margin: 0,
              background:   'var(--fond-surface)',
              border:       '1px solid var(--bordure-normale)',
              color:        'var(--texte-secondaire)',
              borderRadius: 'var(--radius-md)',
              fontSize:     'var(--font-size-body-sm)',
              fontWeight:   600,
              height:       34,
              padding:      '0 14px',
            }}
          >
            {cancelLabel ?? t('referentiels.cancel')}
          </AlertDialogCancel>

          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            style={{
              background:   tone.btn,
              color:        '#fff',
              borderRadius: 'var(--radius-md)',
              fontSize:     'var(--font-size-body-sm)',
              fontWeight:   600,
              height:       34,
              padding:      '0 16px',
              opacity:      loading ? 0.7 : 1,
            }}
          >
            {confirmLabel ?? t('referentiels.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
