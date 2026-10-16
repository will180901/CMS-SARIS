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

// ── Pagination découpée par le SERVEUR ───────────────────────────────────────

export type PaginationServeur = Omit<PaginationControls<never>, 'pageData'>

/**
 * Pagination dont les pages sont découpées par le SERVEUR : on ne garde que la page courante et la
 * taille de page, le total vient de la réponse. Les contrôles rendus sont ceux de `usePagination` (sans
 * `pageData`) : `PaginationBar` s'utilise à l'identique.
 *  - `cleDeRemiseAZero` : quand elle change (filtre, recherche), retour à la page 1 PENDANT le rendu —
 *    aucune requête inutile ne part avec l'ancienne page ;
 *  - `avantChangement` : appelé quand la personne change de page ou de taille (ex. quitter une sélection
 *    en lot, qui ne doit pas survivre à la page qu'elle voyait).
 */
export function usePaginationServeur(
  defaultPageSize: number = 10,
  cleDeRemiseAZero: string = '',
  avantChangement?: () => void,
) {
  const [page,     setPageBrut]     = useState(1)
  const [pageSize, setPageSizeBrut] = useState(defaultPageSize)
  const [cle,      setCle]          = useState(cleDeRemiseAZero)
  const [taille,   setTaille]       = useState(defaultPageSize)

  // Remises à zéro faites pendant le rendu (modèle « état dérivé » de React), pas dans un effet.
  if (cle !== cleDeRemiseAZero) { setCle(cleDeRemiseAZero); setPageBrut(1) }
  if (taille !== defaultPageSize) { setTaille(defaultPageSize); setPageSizeBrut(defaultPageSize); setPageBrut(1) }

  /** Les contrôles complets, une fois le total connu (réponse du serveur). */
  const controles = (total: number): PaginationServeur => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const courante   = Math.min(Math.max(1, page), totalPages)
    const start      = (courante - 1) * pageSize
    const aller = (p: number) => {
      avantChangement?.()
      setPageBrut(Math.max(1, Math.min(p, totalPages)))
    }
    return {
      page: courante, pageSize, totalPages, total, start, end: Math.min(start + pageSize, total),
      setPage: aller,
      setPageSize: (taillePage: number) => { avantChangement?.(); setPageSizeBrut(taillePage); setPageBrut(1) },
      goFirst: () => aller(1),
      goLast:  () => aller(totalPages),
      goPrev:  () => aller(courante - 1),
      goNext:  () => aller(courante + 1),
      canGoPrev: courante > 1,
      canGoNext: courante < totalPages,
    }
  }

  return {
    /** Page demandée au serveur (à passer à la requête). */
    page,
    pageSize,
    controles,
    /** Revient à une page qui existe encore (la dernière page a été vidée, par exemple). */
    recaler: (p: number) => setPageBrut(Math.max(1, p)),
  }
}
