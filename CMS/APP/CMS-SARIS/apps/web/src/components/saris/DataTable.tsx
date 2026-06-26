import type React from 'react'
import type { ColumnResize } from './useColumnResize'

/**
 * Primitives de tableau SARIS — alignées sur le tableau des Journaux d'audit.
 *
 * Langage visuel canonique (référence : AuditPage) :
 *  - Carte conteneur : fond surface, bordure légère, rayon `--radius-xl`, overflow masqué
 *  - En-tête : overline majuscule, sticky, fond `--fond-surface-2`
 *  - Lignes : zébrure (impaires `--fond-surface-2`) + survol bleu `--ap-50`
 *  - Cellules : padding `--espace-2 --espace-4`, texte `--font-size-body-sm`
 *
 * Utilisable avec de vraies tables HTML (`<table>/<thead>/<tbody>`) pour
 * conserver la sémantique et les interactions de ligne existantes.
 */

/** Carte conteneur du tableau (identique au tableau Journaux d'audit).
 *  RESPONSIVE : défilement HORIZONTAL sur écran étroit (au lieu de couper les colonnes).
 *  `overflowY: hidden` (pas `visible`) pour ne PAS créer de conteneur de scroll vertical sur la
 *  carte → l'en-tête `position: sticky` reste calé sur le scroll vertical du PARENT. */
export const DATA_TABLE_CARD: React.CSSProperties = {
  background: 'var(--fond-surface)',
  border: '1px solid var(--bordure-legere)',
  borderRadius: 'var(--radius-xl)',
  overflowX: 'auto',
  overflowY: 'hidden',
}

/** Largeur minimale d'une table de données pour qu'elle DÉFILE (et ne s'écrase pas) sur mobile.
 *  À appliquer au `<table>` : `style={{ ...DATA_TABLE_MINW, width: '100%' }}`. */
export const DATA_TABLE_MINW: React.CSSProperties = { minWidth: 560 }

export interface DataColumn {
  /** Libellé affiché dans l'en-tête (souvent une chaîne, parfois un nœud). */
  label: React.ReactNode
  /** Alignement du texte de la colonne. Défaut : `left`. */
  align?: 'left' | 'right' | 'center'
  /** Largeur fixe de la colonne (ex. `'130px'`, `48`). */
  width?: string | number
}

/**
 * En-tête de tableau canonique (overline majuscule, sticky en haut du scroll).
 * À utiliser dans un `<table>` à la place d'un `<thead>` manuel.
 *
 * Si `resize` est fourni (via `useColumnResize`), chaque frontière de colonne
 * reçoit une poignée de redimensionnement (glisser pour ajuster, double-clic pour
 * réinitialiser). Le `<table>` parent doit alors recevoir `tableLayout` et `containerRef`.
 */
export function DataTableHead({ columns, resize }: { columns: DataColumn[]; resize?: ColumnResize }) {
  const last = columns.length - 1
  return (
    <thead>
      <tr style={{ background: 'var(--fond-surface-2)', borderBottom: '1px solid var(--bordure-legere)' }}>
        {columns.map((c, i) => (
          <th
            key={i}
            style={{
              padding: 'var(--espace-2) var(--espace-4)',
              textAlign: c.align ?? 'left',
              fontSize: 'var(--font-size-overline)',
              fontWeight: 700,
              color: 'var(--texte-tertiaire)',
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              position: 'sticky',
              top: 0,
              zIndex: 5,
              background: 'var(--fond-surface-2)',
              width: resize?.widths?.[i] ?? c.width,
            }}
          >
            {c.label}
            {resize && i < last && (
              <span
                className="saris-col-resize"
                role="separator"
                aria-orientation="vertical"
                aria-label="Redimensionner la colonne"
                onPointerDown={e => resize.startDrag(i, e)}
                onDoubleClick={resize.reset}
              />
            )}
          </th>
        ))}
      </tr>
    </thead>
  )
}

/** Couleur de fond d'une ligne (zébrure + survol bleu) — style Journaux d'audit. */
export function dataRowBackground(striped: boolean, hovered: boolean): string {
  return hovered ? 'var(--ap-50)' : striped ? 'var(--fond-surface-2)' : 'transparent'
}

/** Style complet d'une ligne de données (`<tr>`) : zébrure, survol, séparateur. */
export function dataRowStyle(striped: boolean, hovered: boolean): React.CSSProperties {
  return {
    background: dataRowBackground(striped, hovered),
    borderBottom: '1px solid var(--bordure-legere)',
    transition: 'background 0.12s',
  }
}

/** Padding canonique d'une cellule (`<td>`). */
export const DATA_TD_PADDING = 'var(--espace-2) var(--espace-4)'
