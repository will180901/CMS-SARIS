/**
 * useMediaQuery — réagit à une media query CSS en React (matchMedia), SSR-safe.
 *
 * Fondation du responsive SARIS : un seul hook + des breakpoints partagés, à
 * réutiliser partout (shell, split-panels, modales, grilles) plutôt que de
 * recoder des seuils en dur dans chaque écran.
 */
import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Breakpoints SARIS (mobile-first). Alignés sur les tokens `--breakpoint-*`. */
export const BP = {
  /** ≤ 767px — téléphones (sidebar en drawer, split-panels empilés). */
  mobile:  '(max-width: 767px)',
  /** 768–1023px — tablettes. */
  tablet:  '(min-width: 768px) and (max-width: 1023px)',
  /** ≤ 1023px — téléphones + tablettes (un seul panneau à la fois). */
  compact: '(max-width: 1023px)',
  /** ≥ 1024px — bureau. */
  desktop: '(min-width: 1024px)',
  /** Pointeur grossier sans survol (tactile) — désactive les interactions hover. */
  touch:   '(hover: none) and (pointer: coarse)',
} as const

/** Vrai sous 768px (téléphone). */
export function useIsMobile(): boolean { return useMediaQuery(BP.mobile) }
/** Vrai entre 768 et 1023px (tablette). */
export function useIsTablet(): boolean { return useMediaQuery(BP.tablet) }
/** Vrai ≤ 1023px (téléphone + tablette) : un seul panneau visible à la fois. */
export function useIsCompact(): boolean { return useMediaQuery(BP.compact) }
/** Vrai sur appareil tactile (pas de survol fiable). */
export function useIsTouch(): boolean { return useMediaQuery(BP.touch) }
