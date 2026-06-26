/**
 * usePagination — hook générique de pagination côté client.
 *
 * Gère :
 *   - page courante (1-based)
 *   - taille de page (lignes par page)
 *   - reset automatique sur changement de données filtrées
 *   - bornes (start/end) pour l'affichage "X–Y sur Z"
 *   - navigation prev/next/first/last
 */

import { useState, useEffect, useRef } from 'react'

export interface PaginationState {
  page:       number
  pageSize:   number
  totalPages: number
  total:      number
  start:      number
  end:        number
}

export interface PaginationControls<T> extends PaginationState {
  pageData:       T[]
  setPage:        (p: number) => void
  setPageSize:    (size: number) => void
  goFirst:        () => void
  goLast:         () => void
  goPrev:         () => void
  goNext:         () => void
  canGoPrev:      boolean
  canGoNext:      boolean
}

export function usePagination<T>(
  data:            T[],
  defaultPageSize: number = 10,
): PaginationControls<T> {
  const [page,     setPageRaw]     = useState(1)
  const [pageSize, setPageSizeRaw] = useState(defaultPageSize)

  // Adopte une nouvelle taille par défaut quand elle change (ex. la préférence
  // utilisateur `lignesParPage` arrive de façon asynchrone, ou est modifiée).
  // Un choix manuel via setPageSize ne change pas `defaultPageSize`, donc il
  // n'est jamais écrasé par cet effet.
  const prevDefault = useRef(defaultPageSize)
  useEffect(() => {
    if (prevDefault.current !== defaultPageSize) {
      prevDefault.current = defaultPageSize
      setPageSizeRaw(defaultPageSize)
      setPageRaw(1)
    }
  }, [defaultPageSize])

  const total      = data.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Page courante bornée (1 ≤ page ≤ totalPages)
  const currentPage = Math.min(Math.max(1, page), totalPages)

  const start = (currentPage - 1) * pageSize
  const end   = Math.min(start + pageSize, total)
  const pageData = data.slice(start, end)

  // Reset à la page 1 quand le nombre total d'items change (filtre/recherche)
  useEffect(() => {
    setPageRaw(1)
  }, [total])

  const setPage = (p: number) =>
    setPageRaw(Math.max(1, Math.min(p, totalPages)))

  const setPageSize = (size: number) => {
    setPageSizeRaw(size)
    setPageRaw(1)
  }

  return {
    pageData,
    page:       currentPage,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total,
    start,
    end,
    goFirst:   () => setPage(1),
    goLast:    () => setPage(totalPages),
    goPrev:    () => setPage(currentPage - 1),
    goNext:    () => setPage(currentPage + 1),
    canGoPrev: currentPage > 1,
    canGoNext: currentPage < totalPages,
  }
}
