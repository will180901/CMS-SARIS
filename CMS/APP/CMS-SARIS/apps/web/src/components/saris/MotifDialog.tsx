/**
 * MotifDialog — petite modale « saisir un motif puis confirmer ».
 *
 * Remplace les window.prompt() natifs (annulation, clôture, …) par une modale
 * personnalisée cohérente (shell Modal + Textarea). Le bouton de confirmation
 * reste désactivé tant que le motif n'atteint pas la longueur minimale.
 */

import { useState } from 'react'
import type { ReactNode } from 'react'
import { Modal } from './Modal'
import { Field, Textarea } from './Field'
import { Button } from './Button'

interface MotifDialogProps {
  icon:         ReactNode
  title:        string
  subtitle?:    string
  label?:       string
  placeholder?: string
  confirmLabel: string
  confirmIcon?: ReactNode
  /** Bouton de confirmation rouge (action destructive). */
  danger?:      boolean
  loading?:     boolean
  minLength?:   number
  onConfirm:    (motif: string) => void
  onClose:      () => void
}

export function MotifDialog({
  icon, title, subtitle, label = 'Motif', placeholder,
  confirmLabel, confirmIcon, danger, loading, minLength = 3,
  onConfirm, onClose,
}: MotifDialogProps) {
  const [motif, setMotif] = useState('')
  const ok = motif.trim().length >= minLength

  return (
    <Modal
      icon={icon}
      title={title}
      subtitle={subtitle}
      width={480}
      onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Annuler</Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          disabled={!ok}
          loading={loading}
          leftIcon={confirmIcon}
          onClick={() => { if (ok) onConfirm(motif.trim()) }}
        >
          {confirmLabel}
        </Button>
      </>}
    >
      <Field label={label} required>
        {(id) => (
          <Textarea
            id={id}
            value={motif}
            onChange={e => setMotif(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder={placeholder}
            autoFocus
          />
        )}
      </Field>
    </Modal>
  )
}
