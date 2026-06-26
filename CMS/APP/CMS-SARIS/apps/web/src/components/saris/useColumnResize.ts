import { useCallback, useLayoutEffect, useRef, useState } from 'react'

/**
 * useColumnResize — redimensionnement des colonnes par glissement, réutilisable
 * pour les vraies tables HTML ET les tableaux en CSS grid.
 *
 * Principe :
 *  - On mesure les largeurs réelles des cellules d'en-tête une fois les données
 *    prêtes → on préserve exactement le rendu auto initial.
 *  - Glissement « par paire de voisins » : élargir une colonne rétrécit sa
 *    voisine de droite d'autant → largeur totale constante, pas de scroll
 *    horizontal qui apparaît.
 *  - Largeur minimale par colonne, persistance localStorage, double-clic = reset.
 *
 * Intégration vraie table : `containerRef` sur le `<table>`, `cellsSelector: 'thead th'`,
 *   appliquer `tableLayout` au `<table>` et `widths` aux `<th>`.
 * Intégration grid : `containerRef` sur la ligne d'en-tête, appliquer `gridTemplate`
 *   à l'en-tête et à toutes les lignes.
 */

const BASE_MIN = 60 // px — plancher de largeur pour une colonne « normale »
// Plancher effectif : une colonne déjà plus étroite (avatar, chevron…) garde sa
// taille comme plancher → elle ne peut que s'agrandir, jamais rétrécir sous 0.
const minFloor = (w: number) => Math.min(BASE_MIN, w)

export interface ColumnResize {
  /** À poser sur l'élément dont on mesure les cellules (table ou ligne d'en-tête). */
  containerRef: (el: HTMLElement | null) => void
  /** Largeurs px par colonne, ou null tant que non mesuré (rendu auto d'origine). */
  widths: number[] | null
  /** `'fixed'` une fois les largeurs fixées (pour `<table>`), sinon `'auto'`. */
  tableLayout: 'auto' | 'fixed'
  /** Chaîne `gridTemplateColumns` (ex. "180px 120px …") ou null. */
  gridTemplate: string | null
  /** Démarre le glissement de la frontière entre la colonne `boundary` et `boundary+1`. */
  startDrag: (boundary: number, e: React.PointerEvent) => void
  /** Réinitialise les largeurs (retour au rendu auto). */
  reset: () => void
  /** Vrai pendant un glissement. */
  resizing: boolean
}

interface Options {
  /** Clé de persistance (unique par tableau). */
  storageKey: string
  /** Mesurer seulement quand les données sont prêtes (évite de figer sur le squelette). */
  ready?: boolean
  /** Sélecteur des cellules d'en-tête dans le conteneur. Défaut : enfants directs. */
  cellsSelector?: string
}

export function useColumnResize({ storageKey, ready = true, cellsSelector = ':scope > *' }: Options): ColumnResize {
  const elRef = useRef<HTMLElement | null>(null)
  const [widths, setWidths] = useState<number[] | null>(() => {
    try {
      const raw = localStorage.getItem(`coltbl:${storageKey}`)
      const parsed = raw ? JSON.parse(raw) : null
      return Array.isArray(parsed) && parsed.every((n: unknown) => typeof n === 'number') ? parsed : null
    } catch {
      return null
    }
  })
  const [resizing, setResizing] = useState(false)
  const drag = useRef<{ b: number; x: number; l: number; r: number; minL: number; minR: number } | null>(null)

  const containerRef = useCallback((el: HTMLElement | null) => { elRef.current = el }, [])

  const cells = useCallback((): HTMLElement[] => {
    if (!elRef.current) return []
    return Array.from(elRef.current.querySelectorAll(cellsSelector)) as HTMLElement[]
  }, [cellsSelector])

  // Mesure initiale (sous layout auto) → fige les largeurs, puis passe en fixed.
  useLayoutEffect(() => {
    const cs = cells()
    if (widths) {
      // Colonnes changées (nombre différent) → on réinitialise et on re-mesurera.
      if (cs.length && widths.length !== cs.length) setWidths(null)
      return
    }
    if (!ready || !cs.length) return
    const measured = cs.map(c => c.offsetWidth)
    if (measured.every(w => w > 0)) setWidths(measured)
  }, [ready, widths, cells])

  const persist = useCallback((w: number[]) => {
    try { localStorage.setItem(`coltbl:${storageKey}`, JSON.stringify(w)) } catch { /* quota / privé */ }
  }, [storageKey])

  const onMove = useCallback((e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    let delta = e.clientX - d.x
    delta = Math.max(d.minL - d.l, Math.min(d.r - d.minR, delta))
    setWidths(prev => {
      if (!prev) return prev
      const next = [...prev]
      next[d.b] = d.l + delta
      next[d.b + 1] = d.r - delta
      return next
    })
  }, [])

  const onUp = useCallback(() => {
    drag.current = null
    setResizing(false)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    setWidths(prev => { if (prev) persist(prev); return prev })
  }, [onMove, persist])

  const startDrag = useCallback((boundary: number, e: React.PointerEvent) => {
    const cs = cells()
    const left = cs[boundary]
    const right = cs[boundary + 1]
    if (!left || !right) return
    e.preventDefault()
    e.stopPropagation()
    // Garantit un tableau de largeurs concret avant le drag.
    if (!widths) setWidths(cs.map(c => c.offsetWidth))
    const lw = left.offsetWidth
    const rw = right.offsetWidth
    drag.current = { b: boundary, x: e.clientX, l: lw, r: rw, minL: minFloor(lw), minR: minFloor(rw) }
    setResizing(true)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [cells, widths, onMove, onUp])

  const reset = useCallback(() => {
    try { localStorage.removeItem(`coltbl:${storageKey}`) } catch { /* ignore */ }
    setWidths(null)
  }, [storageKey])

  return {
    containerRef,
    widths,
    tableLayout: widths ? 'fixed' : 'auto',
    gridTemplate: widths ? widths.map(w => `${w}px`).join(' ') : null,
    startDrag,
    reset,
    resizing,
  }
}
