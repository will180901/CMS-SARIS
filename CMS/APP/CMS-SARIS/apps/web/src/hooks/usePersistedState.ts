/**
 * usePersistedState — `useState` qui SURVIT à la navigation (et au refresh de l'onglet).
 *
 * Drop-in de `useState` : même signature, même valeur de retour `[value, setValue]`.
 * La valeur est stockée dans `viewState.store` (sessionStorage) sous `(pageKey, key)`
 * au lieu de l'état local du composant → on retrouve son contexte au retour sur la page.
 *
 *   // avant : const [search, setSearch] = useState('')
 *   const [search, setSearch] = usePersistedState('triage', 'search', '')
 *
 * ⚠️ À réserver à l'état de NAVIGATION (sélection, filtres, recherche, onglet, largeur).
 * NE PAS l'utiliser pour les modales/drawers/brouillons : ceux-là DOIVENT repartir à zéro
 * (ils restent en `useState` nu). Pour un `selectedId` persisté, revalider l'id contre les
 * données courantes côté page (auto-sélection de repli si l'élément a disparu).
 */
import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { useViewStateStore } from '@/stores/viewState.store'

export function usePersistedState<T>(
  pageKey: string,
  key: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const stored = useViewStateStore((s) => s.pages[pageKey]?.[key]) as T | undefined
  const setStore = useViewStateStore((s) => s.set)

  const value = stored !== undefined ? stored : initial

  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (v) => {
      // Lire la valeur LA PLUS À JOUR du store (évite les fermetures périmées
      // quand on enchaîne plusieurs mises à jour fonctionnelles).
      const cur = useViewStateStore.getState().pages[pageKey]?.[key]
      const prev = (cur === undefined ? initial : cur) as T
      const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v
      setStore(pageKey, key, next)
    },
    [pageKey, key, initial, setStore],
  )

  return [value, setValue]
}
