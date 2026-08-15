/**
 * DatePicker — sélecteur de date personnalisé SARIS.
 *
 * Remplace les <input type="date"> natifs (incohérents entre navigateurs/OS).
 * Affiche un calendrier popover sur clic, format français "31 décembre 2026".
 *
 * Valeur : string ISO yyyy-MM-dd (compatible avec les inputs date natifs).
 */

import { useState } from 'react'
import { CalendarDays, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@workspace/ui/components/popover'
import { Calendar } from '@workspace/ui/components/calendar'
import { formatDate } from '@/lib/intl'
import { SelectBox } from './SelectBox'

interface Props {
  value:        string | null | undefined        // yyyy-MM-dd
  onChange:     (value: string | null) => void
  placeholder?: string
  disabled?:    boolean
  invalid?:     boolean
  /** Date min/max au format ISO yyyy-MM-dd */
  min?:         string
  max?:         string
  size?:        'sm' | 'md' | 'lg'
  fullWidth?:   boolean
  /** Permet de remettre à null via une croix */
  clearable?:   boolean
  /**
   * Disposition de l'en-tête du calendrier :
   *   - 'dropdown' (défaut) : menus déroulants mois/année (natifs)
   *   - 'label' : libellé « mai 2026 » + navigation par chevrons (zéro natif)
   */
  captionLayout?: 'dropdown' | 'label'
  id?:          string
  'aria-label'?: string
}

const SIZE_MAP = {
  sm: { height: 30, fontSize: 'var(--font-size-body-sm)', padX: 8 },
  md: { height: 36, fontSize: 'var(--font-size-body)',    padX: 10 },
  lg: { height: 42, fontSize: 'var(--font-size-body-lg)', padX: 12 },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseISO(iso: string | null | undefined): Date | undefined {
  if (!iso) return undefined
  // yyyy-MM-dd → Date locale (sans fuseau)
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}

function toISO(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function formatHumanDate(d: Date): string {
  // Suit la langue active (cf. `@/lib/intl`) : « 31 décembre 2026 » / « 31 December 2026 ».
  return formatDate(d, {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ── Composant ─────────────────────────────────────────────────────────────────

export function DatePicker({
  value, onChange,
  placeholder = 'Choisir une date…',
  disabled, invalid,
  min, max,
  size = 'md', fullWidth = true,
  clearable,
  captionLayout = 'dropdown',
  id, 'aria-label': ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false)
  const s = SIZE_MAP[size]
  const selected = parseISO(value ?? null)
  const minDate = parseISO(min)
  const maxDate = parseISO(max)

  // MOIS AFFICHÉ, piloté par nous. react-day-picker sait le faire seul, mais son en-tête
  // « dropdown » rend des <select> NATIFS — une fenêtre du système, qui ignore le thème.
  // On le met donc en mode « label » (chevrons seuls) et on fournit nos propres combos.
  const [moisAffiche, setMoisAffiche] = useState<Date>(selected ?? new Date())
  const debutPlage = minDate ?? new Date(1920, 0)
  const finPlage = maxDate ?? new Date(new Date().getFullYear() + 5, 11)

  const optionsMois = Array.from({ length: 12 }, (_, i) => ({
    value: String(i),
    label: formatDate(new Date(2000, i, 1), { month: 'long' }),
  }))
  const optionsAnnees: { value: string; label: string }[] = []
  for (let a = finPlage.getFullYear(); a >= debutPlage.getFullYear(); a--)
    optionsAnnees.push({ value: String(a), label: String(a) })

  // Jours désactivés (react-day-picker v10 : fromDate/toDate ne suffisent plus).
  // Garantit qu'on ne peut pas choisir une date hors de la plage [min, max].
  const dayMatchers: Array<{ before: Date } | { after: Date }> = []
  if (minDate) dayMatchers.push({ before: minDate })
  if (maxDate) dayMatchers.push({ after: maxDate })

  function handleSelect(d: Date | undefined) {
    if (!d) return
    onChange(toISO(d))
    setOpen(false)
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange(null)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        // À chaque ouverture on repart de la date choisie (ou d'aujourd'hui) : sans cela,
        // le calendrier rouvrirait sur le dernier mois consulté, ce qui désoriente.
        if (o) setMoisAffiche(selected ?? new Date())
        setOpen(o)
      }}
    >
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          aria-label={ariaLabel ?? placeholder}
          disabled={disabled}
          style={{
            display:        'inline-flex',
            alignItems:     'center',
            gap:            'var(--espace-2)',
            height:         s.height,
            padding:        `0 ${s.padX}px`,
            fontSize:       s.fontSize,
            width:          fullWidth ? '100%' : 'auto',
            borderRadius:   'var(--radius-md)',
            border:         `1px solid ${invalid ? 'var(--erreur-accent)' : 'var(--bordure-normale)'}`,
            background:     'var(--fond-surface)',
            color:          selected ? 'var(--texte-primaire)' : 'var(--texte-tertiaire)',
            cursor:         disabled ? 'not-allowed' : 'pointer',
            opacity:        disabled ? 0.6 : 1,
            textAlign:      'left',
            transition:     'border-color 0.15s, box-shadow 0.15s',
            justifyContent: 'flex-start',
            fontWeight:     selected ? 500 : 400,
          }}
        >
          <CalendarDays size={14} style={{ color: 'var(--ap-600)', flexShrink: 0 }} />
          <span style={{
            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {selected ? formatHumanDate(selected) : placeholder}
          </span>
          {clearable && selected && !disabled && (
            <span
              role="button"
              aria-label="Effacer"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={e => { if (e.key === 'Enter') handleClear(e as any) }}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 18, height: 18, borderRadius: 4,
                color: 'var(--texte-tertiaire)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--fond-surface-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <X size={11} />
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={4}
        style={{
          padding: 0,
          background: 'var(--fond-surface)',
          border: '1px solid var(--bordure-normale)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--ombre-3)',
          width: 'auto',
        }}
      >
        {captionLayout === 'dropdown' && (
          <div style={{
            display: 'flex', gap: 6, padding: 8,
            borderBottom: '1px solid var(--bordure-legere)',
          }}>
            <div style={{ flex: 1.4, minWidth: 0 }}>
              <SelectBox
                size="sm"
                aria-label="Mois"
                value={String(moisAffiche.getMonth())}
                onChange={(v) => setMoisAffiche(new Date(moisAffiche.getFullYear(), Number(v), 1))}
                options={optionsMois}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <SelectBox
                size="sm"
                aria-label="Année"
                value={String(moisAffiche.getFullYear())}
                onChange={(v) => setMoisAffiche(new Date(Number(v), moisAffiche.getMonth(), 1))}
                options={optionsAnnees}
              />
            </div>
          </div>
        )}

        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          disabled={dayMatchers.length ? dayMatchers : undefined}
          locale={undefined}
          weekStartsOn={1}    // lundi
          month={moisAffiche}
          onMonthChange={setMoisAffiche}
          // TOUJOURS « label » : le mode « dropdown » de react-day-picker rend des combos
          // NATIFS. Nos propres combos sont au-dessus.
          captionLayout="label"
          startMonth={debutPlage}
          endMonth={finPlage}
        />
      </PopoverContent>
    </Popover>
  )
}
