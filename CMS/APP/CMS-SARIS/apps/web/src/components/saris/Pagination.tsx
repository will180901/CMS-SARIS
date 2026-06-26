/**
 * Pagination SARIS — re-export du composant et du hook de pagination
 * pour un usage global cohérent dans toutes les pages avec tableau.
 *
 * Le visuel est calé sur celui de la page Référentiels (référence UX).
 */

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { IconButton } from './IconButton'
import { SelectBox } from './SelectBox'
import type { PaginationControls } from '../../hooks/usePagination'

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100]

interface PaginationBarProps<T> extends Pick<
  PaginationControls<T>,
  'page' | 'pageSize' | 'totalPages' | 'total' | 'start' | 'end'
  | 'setPage' | 'setPageSize'
  | 'goFirst' | 'goLast' | 'goPrev' | 'goNext'
  | 'canGoPrev' | 'canGoNext'
> {
  /** Liste personnalisée des tailles proposées */
  pageSizeOptions?: number[]
  /** Si vrai, la barre est collée au tableau (pas de border-radius arrondi) */
  attached?: boolean
}

export function PaginationBar<T>({
  page, pageSize, totalPages, total, start, end,
  setPageSize,
  goFirst, goLast, goPrev, goNext,
  canGoPrev, canGoNext,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  attached,
}: PaginationBarProps<T>) {
  if (total === 0) return null

  return (
    <div
      style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        'var(--espace-2) var(--espace-4)',
        border:         '1px solid var(--bordure-legere)',
        borderTop:      attached ? 'none' : '1px solid var(--bordure-legere)',
        background:     'var(--fond-surface-2)',
        borderRadius:   attached
                          ? '0 0 var(--radius-lg) var(--radius-lg)'
                          : 'var(--radius-lg)',
        flexShrink:     0,
        gap:            'var(--espace-3)',
        flexWrap:       'wrap',
      }}
    >
      {/* ── Lignes par page ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-2)' }}>
        <span style={{
          fontSize: 'var(--font-size-caption)',
          color: 'var(--texte-tertiaire)',
          whiteSpace: 'nowrap',
        }}>
          Lignes par page
        </span>
        <div style={{ width: 76 }}>
          <SelectBox
            size="sm"
            value={String(pageSize)}
            onChange={(v) => setPageSize(Number(v))}
            aria-label="Nombre de lignes par page"
            fullWidth
            options={pageSizeOptions.map(n => ({ value: String(n), label: String(n) }))}
          />
        </div>
      </div>

      {/* ── Info ────────────────────────────────────────────────────── */}
      <span
        style={{
          fontSize:   'var(--font-size-caption)',
          color:      'var(--texte-tertiaire)',
          flex:       1,
          textAlign:  'center',
          whiteSpace: 'nowrap',
        }}
      >
        {total === 0
          ? 'Aucun résultat'
          : `${start + 1} – ${end} sur ${total} résultat${total > 1 ? 's' : ''}`}
      </span>

      {/* ── Navigation ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <IconButton
          aria-label="Première page"
          icon={<ChevronsLeft size={13} />}
          tone="neutral" size="sm"
          onClick={goFirst}
          disabled={!canGoPrev}
        />
        <IconButton
          aria-label="Page précédente"
          icon={<ChevronLeft size={13} />}
          tone="neutral" size="sm"
          onClick={goPrev}
          disabled={!canGoPrev}
        />

        <span style={{
          fontSize:   'var(--font-size-caption)',
          color:      'var(--texte-secondaire)',
          fontWeight: 500,
          padding:    '0 var(--espace-2)',
          whiteSpace: 'nowrap',
          minWidth:   70,
          textAlign:  'center',
        }}>
          {page} / {totalPages}
        </span>

        <IconButton
          aria-label="Page suivante"
          icon={<ChevronRight size={13} />}
          tone="neutral" size="sm"
          onClick={goNext}
          disabled={!canGoNext}
        />
        <IconButton
          aria-label="Dernière page"
          icon={<ChevronsRight size={13} />}
          tone="neutral" size="sm"
          onClick={goLast}
          disabled={!canGoNext}
        />
      </div>
    </div>
  )
}
