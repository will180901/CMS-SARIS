import { useLayoutEffect, useState } from 'react'
import { useIsMobile } from '@/hooks/useMediaQuery'

/**
 * Tableaux en CARTES sur téléphone.
 *
 * Sur un écran étroit, un tableau de 5 à 7 colonnes n'en montrait que 2 ou 3 : le reste
 * n'était accessible qu'en faisant glisser le tableau, sans que rien ne l'indique. Sous
 * 768 px, chaque ligne devient une carte : la première cellule en titre, les suivantes
 * en « INTITULÉ … valeur ». Le rendu est porté par la classe CSS `saris-cartes`
 * (packages/ui/src/styles/globals.css) ; ce hook recopie l'intitulé de chaque colonne
 * sur ses cellules (`data-label`), que le CSS affiche devant la valeur.
 *
 * Fonctionne pour les vraies tables (`thead th` / `tbody > tr > td`) et pour les tableaux
 * en grille (`[role=columnheader]` / enfants directs de `[role=table]`). Une ligne qui n'a
 * pas autant de cellules que d'en-têtes (état vide, chargement) est laissée telle quelle.
 *
 * Renvoie une ref de rappel à poser sur l'élément qui contient l'en-tête et les lignes.
 */
export const CLASSE_CARTES = 'saris-cartes'

function etiqueter(racine: HTMLElement) {
  const entetes = Array.from(racine.querySelectorAll<HTMLElement>('thead th, [role="columnheader"]'))
    .map(e => (e.textContent ?? '').trim())
  if (entetes.length === 0) return
  racine.querySelectorAll<HTMLElement>('tbody > tr, [role="table"] > *').forEach(ligne => {
    const cellules = Array.from(ligne.children) as HTMLElement[]
    if (cellules.length !== entetes.length) return
    cellules.forEach((c, i) => { if (c.dataset.label !== entetes[i]) c.dataset.label = entetes[i] })
  })
}

export function useCartesMobile(): (el: HTMLElement | null) => void {
  const isMobile = useIsMobile()
  const [racine, setRacine] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    if (!racine) return
    racine.classList.add(CLASSE_CARTES)
    if (!isMobile) return
    etiqueter(racine)
    // Pagination, filtres, chargement : de nouvelles lignes arrivent. Le rappel de
    // l'observateur passe avant l'affichage → pas d'image intermédiaire non étiquetée.
    // Il n'observe pas les attributs : poser `data-label` ne le relance pas.
    const obs = new MutationObserver(() => etiqueter(racine))
    obs.observe(racine, { childList: true, subtree: true, characterData: true })
    return () => obs.disconnect()
  }, [racine, isMobile])

  return setRacine
}
