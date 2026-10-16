import { useEffect, useState } from 'react'

/**
 * Une valeur qui ne suit la saisie qu'après `delaiMs` sans changement : la recherche faite par le
 * serveur ne part pas à chaque frappe, seulement quand la personne a fini de taper.
 */
export function useDebouncedValue<T>(valeur: T, delaiMs = 300): T {
  const [retardee, setRetardee] = useState(valeur)
  useEffect(() => {
    const t = setTimeout(() => setRetardee(valeur), delaiMs)
    return () => clearTimeout(t)
  }, [valeur, delaiMs])
  return retardee
}
