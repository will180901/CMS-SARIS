/**
 * InfoSection / InfoRow — présentation en lecture seule d'un ensemble de champs
 * (label + valeur), groupés dans une section titrée. Généralise le motif
 * label-au-dessus-de-la-valeur déjà réinventé localement à plusieurs endroits
 * (ex. `IdentiteTab.tsx`, `VisiteSidebar.tsx`) — première brique partagée de ce
 * type dans le design system SARIS.
 *
 * Usage :
 *   <InfoSection title="Décision" icon={<CheckCircle2 size={14}/>}>
 *     <InfoRow label="Statut" valueNode={<StatusPill tone="success">Clôturée</StatusPill>} />
 *     <InfoRow label="Conclusion" value={consultation.conclusion} full />
 *   </InfoSection>
 */
import type { ReactNode } from 'react'
import { Card } from './Card'

interface InfoSectionProps {
  title:     ReactNode
  icon?:     ReactNode
  actions?:  ReactNode
  /** Nombre de colonnes de la grille (les `InfoRow` avec `full` ignorent ce nombre). */
  columns?:  number
  children:  ReactNode
}

export function InfoSection({ title, icon, actions, columns = 2, children }: InfoSectionProps) {
  return (
    <Card>
      <Card.Header icon={icon} title={title} compact actions={actions} />
      <Card.Body padding="md">
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: 'var(--espace-4) var(--espace-5)',
        }}>
          {children}
        </div>
      </Card.Body>
    </Card>
  )
}

interface InfoRowProps {
  label:      ReactNode
  value?:     string | number | null
  /** Rendu personnalisé de la valeur (badge, lien…) — prioritaire sur `value`. */
  valueNode?: ReactNode
  /** Occupe toute la largeur de la grille (texte long : notes, conclusion…). */
  full?:      boolean
}

export function InfoRow({ label, value, valueNode, full }: InfoRowProps) {
  const empty = value === undefined || value === null || value === ''
  return (
    <div style={{ gridColumn: full ? '1 / -1' : undefined, minWidth: 0 }}>
      <p style={{
        margin: '0 0 3px', fontSize: 10, fontWeight: 700,
        color: 'var(--texte-tertiaire)', textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        {label}
      </p>
      {valueNode ?? (
        <p style={{
          margin: 0, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
          color: empty ? 'var(--texte-tertiaire)' : 'var(--texte-primaire)',
          fontStyle: empty ? 'italic' : 'normal',
        }}>
          {empty ? '—' : value}
        </p>
      )}
    </div>
  )
}
