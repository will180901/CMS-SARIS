/**
 * Field — wrapper d'input standardisé : label, hint, error, required.
 * S'utilise avec un <input>, <textarea>, <select> ou un composant custom.
 */

import type { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useId } from 'react'

// ── Field racine ──────────────────────────────────────────────────────────────

interface FieldProps {
  label?:       ReactNode
  hint?:        ReactNode
  error?:       ReactNode
  required?:    boolean
  children:     (id: string) => ReactNode
}

export function Field({ label, hint, error, required, children }: FieldProps) {
  const id = useId()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-1)' }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            fontSize:    'var(--font-size-label)',
            fontWeight:  600,
            color:       'var(--texte-secondaire)',
          }}
        >
          {label}
          {required && <span style={{ color: 'var(--erreur-accent)', marginLeft: 3 }}>*</span>}
        </label>
      )}
      {children(id)}
      {error ? (
        <p style={{
          margin: 0, fontSize: 'var(--font-size-caption)',
          color: 'var(--erreur-accent)', display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {error}
        </p>
      ) : hint ? (
        <p style={{
          margin: 0, fontSize: 'var(--font-size-caption)',
          color: 'var(--texte-tertiaire)',
        }}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}

// ── TextInput uniformisé ──────────────────────────────────────────────────────

interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  invalid?: boolean
  size?:    'sm' | 'md' | 'lg'
}

const SIZE_MAP_INPUT = {
  sm: { height: 30, fontSize: 'var(--font-size-body-sm)', padding: '0 var(--espace-2)' },
  md: { height: 36, fontSize: 'var(--font-size-body)',    padding: '0 var(--espace-3)' },
  lg: { height: 42, fontSize: 'var(--font-size-body-lg)', padding: '0 var(--espace-3)' },
}

export function TextInput({ invalid, size = 'md', style, ...rest }: TextInputProps) {
  const s = SIZE_MAP_INPUT[size]
  return (
    <input
      {...rest}
      style={{
        ...s,
        width:         '100%',
        borderRadius:  'var(--radius-md)',
        border:        `1px solid ${invalid ? 'var(--erreur-accent)' : 'var(--bordure-normale)'}`,
        background:    'var(--fond-surface)',
        color:         'var(--texte-primaire)',
        outline:       'none',
        boxSizing:     'border-box',
        transition:    'border-color 0.15s, box-shadow 0.15s',
        ...style,
      }}
      onFocus={(e) => {
        if (!invalid) {
          e.currentTarget.style.borderColor = 'var(--ap-400)'
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(78, 139, 164, 0.15)'
        }
        rest.onFocus?.(e)
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = invalid ? 'var(--erreur-accent)' : 'var(--bordure-normale)'
        e.currentTarget.style.boxShadow = 'none'
        rest.onBlur?.(e)
      }}
    />
  )
}

// ── Textarea uniformisé ───────────────────────────────────────────────────────

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export function Textarea({ invalid, style, ...rest }: TextareaProps) {
  return (
    <textarea
      {...rest}
      style={{
        width:         '100%',
        minHeight:     80,
        padding:       'var(--espace-2) var(--espace-3)',
        fontSize:      'var(--font-size-body-sm)',
        lineHeight:    1.5,
        borderRadius:  'var(--radius-md)',
        border:        `1px solid ${invalid ? 'var(--erreur-accent)' : 'var(--bordure-normale)'}`,
        background:    'var(--fond-surface)',
        color:         'var(--texte-primaire)',
        outline:       'none',
        boxSizing:     'border-box',
        fontFamily:    'inherit',
        resize:        'vertical',
        transition:    'border-color 0.15s, box-shadow 0.15s',
        ...style,
      }}
      onFocus={(e) => {
        if (!invalid) {
          e.currentTarget.style.borderColor = 'var(--ap-400)'
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(78, 139, 164, 0.15)'
        }
        rest.onFocus?.(e)
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = invalid ? 'var(--erreur-accent)' : 'var(--bordure-normale)'
        e.currentTarget.style.boxShadow = 'none'
        rest.onBlur?.(e)
      }}
    />
  )
}
