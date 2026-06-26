/**
 * useNavStack — à appeler UNE fois dans le shell. Enregistre chaque navigation
 * dans `navStack.store` pour alimenter les flèches « Précédent / Suivant ».
 */
import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { useNavStackStore } from '@/stores/navStack.store'

export function useNavStackTracker() {
  const location = useLocation()
  const navType  = useNavigationType()   // 'POP' | 'PUSH' | 'REPLACE'

  useEffect(() => {
    const path = location.pathname + location.search
    const { push, replace, pop } = useNavStackStore.getState()
    if      (navType === 'POP')     pop(path)
    else if (navType === 'REPLACE') replace(path)
    else                            push(path)
    // location.key change à CHAQUE navigation (y compris POP) → l'effet se déclenche
    // une fois par navigation. navType est lu dans le corps (pas besoin en dépendance).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key])
}
