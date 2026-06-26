/**
 * SelectBox — combo personnalisé SARIS basé sur shadcn/ui Select.
 *
 * Remplace les <select> natifs (qui sont moches sous Windows/Linux).
 * Cohérent avec les TextInput/Textarea : focus ring, tailles, états.
 */

import {
  Select as ShadSelect, SelectContent, SelectGroup, SelectLabel,
  SelectTrigger, SelectValue, SelectSeparator,
} from '@workspace/ui/components/select'
import { Select as SelectPrimitive } from 'radix-ui'
import { CheckIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Valeur sentinelle utilisée en interne pour représenter une "valeur vide"
 * (équivalent de la chaîne vide), car Radix Select interdit `value=""`.
 * Convertie automatiquement vers/depuis "" dans le binding du composant.
 */
const EMPTY_SENTINEL = '__saris_empty__'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SelectOption<V extends string = string> {
  value:     V
  label:     ReactNode
  /** Sous-titre optionnel (ex: code, métadonnée) */
  sublabel?: ReactNode
  /** Désactivable individuellement */
  disabled?: boolean
}

export interface SelectGroupDef<V extends string = string> {
  label:   string
  options: SelectOption<V>[]
}

interface CommonProps {
  value:        string | undefined
  onChange:     (value: string) => void
  placeholder?: string
  /** Désactive tout le composant */
  disabled?:    boolean
  invalid?:     boolean
  /** sm = 30px · md = 36px (défaut) · lg = 42px */
  size?:        'sm' | 'md' | 'lg'
  fullWidth?:   boolean
  id?:          string
  /** Aria-label (obligatoire si pas de Field/label associé) */
  'aria-label'?: string
}

type SelectBoxProps =
  & CommonProps
  & (
    | { options: SelectOption[];      groups?: never }
    | { options?: never;               groups: SelectGroupDef[] }
  )

const SIZE_MAP = {
  sm: { height: 30, fontSize: 'var(--font-size-body-sm)' },
  md: { height: 36, fontSize: 'var(--font-size-body)'    },
  lg: { height: 42, fontSize: 'var(--font-size-body-lg)' },
}

// ── Composant ─────────────────────────────────────────────────────────────────

/** Convertit "" → sentinelle, sinon laisse tel quel */
function toRadixValue(v: string | undefined): string {
  return v === '' || v === undefined ? EMPTY_SENTINEL : v
}
function fromRadixValue(v: string): string {
  return v === EMPTY_SENTINEL ? '' : v
}

export function SelectBox({
  value, onChange,
  placeholder = 'Sélectionner…',
  disabled, invalid,
  size = 'md', fullWidth = true,
  id, 'aria-label': ariaLabel,
  ...rest
}: SelectBoxProps) {
  const s = SIZE_MAP[size]

  return (
    <ShadSelect
      value={toRadixValue(value)}
      onValueChange={(v) => onChange(fromRadixValue(v))}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        style={{
          height: s.height,
          fontSize: s.fontSize,
          width: fullWidth ? '100%' : 'auto',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${invalid ? 'var(--erreur-accent)' : 'var(--bordure-normale)'}`,
          background: 'var(--fond-surface)',
          color: 'var(--texte-primaire)',
          padding: '0 var(--espace-3)',
          fontWeight: 500,
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>

      <SelectContent
        position="popper"
        sideOffset={4}
        align="start"
        style={{
          background:   'var(--fond-surface)',
          border:       '1px solid var(--bordure-normale)',
          borderRadius: 'var(--radius-lg)',
          boxShadow:    'var(--ombre-3)',
          maxHeight:    320,
          padding:      4,
          // Largeur égale au trigger (cohérence visuelle, sinon le menu reprend
          // une largeur "min-content" qui peut être beaucoup plus étroite)
          width:        'var(--radix-select-trigger-width)',
          minWidth:     'var(--radix-select-trigger-width)',
        }}
      >
        {'groups' in rest && rest.groups ? (
          rest.groups.map((g, gi) => (
            <SelectGroup key={g.label}>
              {gi > 0 && <SelectSeparator />}
              <SelectLabel
                style={{
                  fontSize: 'var(--font-size-overline)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: 'var(--texte-tertiaire)',
                  padding: '4px 8px',
                }}
              >
                {g.label}
              </SelectLabel>
              {g.options.map(o => (
                <CustomItem key={o.value} option={o} />
              ))}
            </SelectGroup>
          ))
        ) : (
          (rest as { options: SelectOption[] }).options.map(o => (
            <CustomItem key={o.value} option={o} />
          ))
        )}
      </SelectContent>
    </ShadSelect>
  )
}

// ── Item ──────────────────────────────────────────────────────────────────────

function CustomItem({ option }: { option: SelectOption }) {
  // Radix interdit value="" → on transforme silencieusement avec la sentinelle.
  // Le mapping inverse est géré dans onValueChange du <ShadSelect>.
  const radixValue = option.value === '' ? EMPTY_SENTINEL : option.value

  // Important : on bypasse le <SelectItem> de shadcn (qui enrobe tout son
  // contenu dans <ItemText>, ce qui faisait remonter le sublabel dans le
  // trigger du combo). Ici on délimite explicitement <ItemText> au seul
  // label, et le sublabel reste à côté — donc visible dans la liste
  // déroulante mais JAMAIS dans la valeur sélectionnée affichée.
  return (
    <SelectPrimitive.Item
      value={radixValue}
      disabled={option.disabled}
      data-slot="select-item"
      className="relative flex w-full cursor-default items-start gap-2 rounded-md px-2 py-1.5 outline-hidden focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
      style={{
        padding: '7px 28px 7px 10px',
        borderRadius: 'var(--radius-md)',
        cursor: option.disabled ? 'not-allowed' : 'pointer',
        opacity: option.disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position: 'absolute', right: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <SelectPrimitive.ItemIndicator>
          <CheckIcon size={14} />
        </SelectPrimitive.ItemIndicator>
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minWidth: 0 }}>
        <SelectPrimitive.ItemText>
          <span style={{ color: 'var(--texte-primaire)', fontWeight: 500, fontSize: 'var(--font-size-body-sm)' }}>
            {option.label}
          </span>
        </SelectPrimitive.ItemText>
        {option.sublabel && (
          <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
            {option.sublabel}
          </span>
        )}
      </div>
    </SelectPrimitive.Item>
  )
}
