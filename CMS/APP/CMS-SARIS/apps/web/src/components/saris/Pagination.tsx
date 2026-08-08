/**
 * Pagination SARIS — re-export du composant et du hook de pagination
 * pour un usage global cohérent dans toutes les pages avec tableau.
 *
 * Le visuel est calé sur celui de la page Référentiels (référence UX).
 */

import { useTranslation } from 'react-i18next'
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
  // Appelé avant tout retour anticipé : un hook ne peut pas être conditionnel.
  const { t } = useTranslation()
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
          {t('pagination.rowsPerPage')}
        </span>
        <div style={{ width: 76 }}>
          <SelectBox
            size="sm"
            value={String(pageSize)}
            onChange={(v) => setPageSize(Number(v))}
            aria-label={t('pagination.rowsPerPageAria')}
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
        {/* `count` porte le total : c'est lui qui décide du singulier ou du pluriel. */}
        {t('pagination.range', { count: total, start: start + 1, end })}
      </span>

      {/* ── Navigation ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <IconButton
          aria-label={t('pagination.first')}
          icon={<ChevronsLeft size={13} />}
          tone="neutral" size="sm"
          onClick={goFirst}
          disabled={!canGoPrev}
        />
        <IconButton
          aria-label={t('pagination.prev')}
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
          aria-label={t('pagination.next')}
          icon={<ChevronRight size={13} />}
          tone="neutral" size="sm"
          onClick={goNext}
          disabled={!canGoNext}
        />
        <IconButton
          aria-label={t('pagination.last')}
          icon={<ChevronsRight size={13} />}
          tone="neutral" size="sm"
          onClick={goLast}
          disabled={!canGoNext}
        />
      </div>
    </div>
  )
}
