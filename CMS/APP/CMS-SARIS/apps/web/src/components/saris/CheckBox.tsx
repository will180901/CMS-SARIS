/**
 * CheckBox — case à cocher SARIS, basée sur Radix.
 *
 * Remplace `<input type="checkbox">`, qui est dessiné par le SYSTÈME D'EXPLOITATION :
 * taille minuscule sous Windows, coche bleue système, aspect différent d'une machine à
 * l'autre. Ici tout est dessiné par nous, donc identique partout et fidèle au thème.
 *
 * L'API est volontairement calquée sur celle d'un input natif (`checked` / `onChange`
 * recevant un booléen) pour que la substitution reste lisible dans les écrans existants.
 */
import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import { Check, Minus } from 'lucide-react'

interface CheckBoxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** État « partiellement coché » (une liste dont seuls certains éléments le sont). */
  indeterminate?: boolean
  disabled?: boolean
  id?: string
  /** Obligatoire si aucun label n'est associé à la case. */
  'aria-label'?: string
  /** 14 = compact (listes denses) · 16 = défaut · 18 = confortable */
  size?: number
}

export function CheckBox({
  checked, onChange, indeterminate = false, disabled, id,
  'aria-label': ariaLabel, size = 16,
}: CheckBoxProps) {
  const actif = checked || indeterminate
  return (
    <CheckboxPrimitive.Root
      id={id}
      checked={indeterminate ? 'indeterminate' : checked}
      onCheckedChange={(v) => onChange(v === true)}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        width: size, height: size, flexShrink: 0, padding: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 4,
        border: `1.5px solid ${actif ? 'var(--ap-400)' : 'var(--bordure-normale)'}`,
        background: actif ? 'var(--ap-400)' : 'var(--fond-surface)',
        color: '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.12s, border-color 0.12s',
      }}
    >
      <CheckboxPrimitive.Indicator style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {indeterminate
          ? <Minus size={size - 5} strokeWidth={3.5} />
          : <Check size={size - 5} strokeWidth={3.5} />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}
