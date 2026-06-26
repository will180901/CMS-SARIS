/**
 * ConfirmDeleteModal — confirmation de suppression réutilisable (dossier patient).
 *
 * Réutilise la `Modal` SARIS. Ton « danger » (icône + bouton rouge), corps
 * d'avertissement, et un message optionnel rappelant l'irréversibilité. La
 * suppression effective est confiée à `onConfirm` (qui doit awaiter la mutation).
 */

import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Modal } from '@/components/saris'

interface ConfirmDeleteModalProps {
  title:        string
  subtitle?:    string
  /** Message d'avertissement affiché dans le corps. */
  message:      ReactNode
  /** Libellé du bouton de confirmation. Défaut « Supprimer ». */
  confirmLabel?: string | undefined
  onClose:      () => void
  /** Doit awaiter la mutation. La modale se ferme ensuite (sauf en cas d'erreur — voir closeOnSuccess). */
  onConfirm:    () => Promise<void>
  /** Ferme la modale après succès (défaut true). Mettre false si la page se démonte (ex. navigation). */
  closeOnSuccess?: boolean
}

export function ConfirmDeleteModal({
  title, subtitle, message, confirmLabel,
  onClose, onConfirm, closeOnSuccess = true,
}: ConfirmDeleteModalProps) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const resolvedConfirmLabel = confirmLabel ?? t('patients.deleteDefault')

  const handleConfirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
      if (closeOnSuccess) onClose()
    } catch {
      // Erreur déjà signalée par le toast du hook (ex. 409). On laisse la modale ouverte.
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      icon={<Trash2 size={17} />}
      title={title}
      subtitle={subtitle}
      width={440}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy} style={{ fontSize: '13px', height: 34 }}>
            {t('common.cancel')}
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={busy}
            style={{ fontSize: '13px', height: 34, gap: '5px', color: '#fff', border: 'none', background: 'var(--erreur-accent)' }}
          >
            {busy ? t('patients.deleting') : <><Trash2 size={13} /> {resolvedConfirmLabel}</>}
          </Button>
        </>
      }
    >
      <div style={{ fontSize: '13px', color: 'var(--texte-secondaire)', lineHeight: '1.6', padding: '12px', background: 'var(--erreur-fond)', border: '1px solid var(--erreur-bordure)', borderRadius: 'var(--radius-md)' }}>
        {message}
      </div>
    </Modal>
  )
}
