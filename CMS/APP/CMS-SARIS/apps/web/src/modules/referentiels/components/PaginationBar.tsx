/**
 * PaginationBar — Barre de pagination placée en bas du tableau.
 * Affiche : sélecteur lignes/page · info "X–Y sur Z" · navigation prev/next.
 */

import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import type { PaginationControls } from '../hooks/usePagination'

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100]

interface PaginationBarProps<T> extends Pick<
  PaginationControls<T>,
  'page' | 'pageSize' | 'totalPages' | 'total' | 'start' | 'end'
  | 'setPage' | 'setPageSize'
  | 'goFirst' | 'goLast' | 'goPrev' | 'goNext'
  | 'canGoPrev' | 'canGoNext'
> {}

export function PaginationBar<T>({
  page, pageSize, totalPages, total, start, end,
  setPageSize,
  goFirst, goLast, goPrev, goNext,
  canGoPrev, canGoNext,
}: PaginationBarProps<T>) {
  const { t } = useTranslation()
  if (total === 0) return null

  return (
    <div
      style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
        padding:         '10px 16px',
        border:          '1px solid var(--bordure-legere)',
        background:      'var(--fond-surface)',
        borderRadius:    '8px',
        flexShrink:      0,
        gap:             '12px',
        flexWrap:        'wrap',
      }}
    >
      {/* ── Lignes par page ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '12px', color: 'var(--texte-tertiaire)', whiteSpace: 'nowrap' }}>
          {t('referentiels.rowsPerPage')}
        </span>
        <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
          <SelectTrigger
            style={{
              height:       '28px',
              width:        '68px',
              fontSize:     '12px',
              border:       '1px solid var(--bordure-normale)',
              background:   'var(--fond-page)',
              borderRadius: '5px',
              padding:      '0 8px',
            }}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map(n => (
              <SelectItem key={n} value={String(n)} style={{ fontSize: '12px' }}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Info ────────────────────────────────────────────────────── */}
      <span
        style={{
          fontSize:  '12px',
          color:     'var(--texte-tertiaire)',
          flex:       '1',
          textAlign: 'center',
          whiteSpace:'nowrap',
        }}
      >
        {total === 0
          ? t('referentiels.noResult')
          : t(total > 1 ? 'referentiels.paginationInfoOther' : 'referentiels.paginationInfoOne', { start: start + 1, end, total })
        }
      </span>

      {/* ── Navigation ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {/* Première page */}
        <Button
          variant="ghost"
          size="icon"
          onClick={goFirst}
          disabled={!canGoPrev}
          style={{ width: '28px', height: '28px' }}
          title={t('referentiels.firstPage')}
        >
          <ChevronsLeft size={13} />
        </Button>

        {/* Page précédente */}
        <Button
          variant="ghost"
          size="icon"
          onClick={goPrev}
          disabled={!canGoPrev}
          style={{ width: '28px', height: '28px' }}
          title={t('referentiels.prevPage')}
        >
          <ChevronLeft size={13} />
        </Button>

        {/* Indicateur page courante */}
        <span
          style={{
            fontSize:    '12px',
            color:       'var(--texte-secondaire)',
            fontWeight:  '500',
            padding:     '0 8px',
            whiteSpace:  'nowrap',
            minWidth:    '70px',
            textAlign:   'center',
          }}
        >
          {page} / {totalPages}
        </span>

        {/* Page suivante */}
        <Button
          variant="ghost"
          size="icon"
          onClick={goNext}
          disabled={!canGoNext}
          style={{ width: '28px', height: '28px' }}
          title={t('referentiels.nextPage')}
        >
          <ChevronRight size={13} />
        </Button>

        {/* Dernière page */}
        <Button
          variant="ghost"
          size="icon"
          onClick={goLast}
          disabled={!canGoNext}
          style={{ width: '28px', height: '28px' }}
          title={t('referentiels.lastPage')}
        >
          <ChevronsRight size={13} />
        </Button>
      </div>
    </div>
  )
}
