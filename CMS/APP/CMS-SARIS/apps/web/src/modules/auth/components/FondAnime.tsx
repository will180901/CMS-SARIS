/**
 * FondAnime — le décor de la page de connexion, DERRIÈRE la carte du formulaire.
 *
 * De l'arrière vers l'avant :
 *   1. l'animation (canvas) : mesh presque monochrome, nuages de carrés, réseau de neurones
 *      parcouru de petits pixels qui brillent en pulsant — cf. lib/fondAnime.ts ;
 *   2. un rideau de verre dépoli : flou LÉGER partout (les petits carrés restent lisibles
 *      comme des carrés), flou FORT au centre, autour de la carte ;
 *   3. un grain épais et couvrant : la texture « grains de sable » de l'application, en plus
 *      gros et plus dense, posée par-dessus le flou.
 *
 * Purement décoratif : invisible pour les lecteurs d'écran, insensible à la souris.
 */
import { useEffect, useRef } from 'react'
import { demarrerFondAnime } from '../lib/fondAnime'

/**
 * Grain épais : du bruit fractal à grosses mailles (baseFrequency 0,55 contre 0,82 pour le
 * grain de l'application), assez dense pour VOILER — mais jamais d'aplat : ce sont des grains.
 * Deux teintes : sur fond sombre des grains clairs (des grains sombres ne s'y verraient pas),
 * sur fond clair des grains sombres.
 */
const grain = (couleur: '1' | '0', alpha: number, exposant: number, taille: number, frequence: number) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${taille}' height='${taille}'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='${frequence}' numOctaves='2' stitchTiles='stitch' result='t'/%3E%3CfeColorMatrix in='t' type='matrix' values='0 0 0 0 ${couleur} 0 0 0 0 ${couleur} 0 0 0 0 ${couleur} ${alpha} 0 0 0 0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='gamma' exponent='${exposant}' amplitude='1' offset='0'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`

const GRAIN_CLAIR_SUR_SOMBRE = `${grain('1', 0.62, 2.6, 240, 0.55)}, ${grain('1', 0.5, 2.8, 150, 0.7)}`
const GRAIN_SOMBRE_SUR_CLAIR = `${grain('0', 0.7, 2.5, 240, 0.55)}, ${grain('0', 0.55, 2.7, 150, 0.7)}`

const COUCHE: React.CSSProperties = { position: 'absolute', inset: 0 }

export function FondAnime() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    return demarrerFondAnime(canvas)
  }, [])

  return (
    <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <canvas ref={ref} style={{ ...COUCHE, width: '100%', height: '100%', display: 'block' }} />

      {/* Rideau de verre dépoli — flou léger partout… */}
      <div style={{
        ...COUCHE,
        WebkitBackdropFilter: 'blur(0.8px)', backdropFilter: 'blur(0.8px)',
        background: 'color-mix(in srgb, var(--fond-page) 3%, transparent)',
      }} />
      {/* …et flou fort au centre, autour de la carte (fondu radial vers les bords). */}
      <div style={{
        ...COUCHE,
        WebkitBackdropFilter: 'blur(14px)', backdropFilter: 'blur(14px)',
        background: 'color-mix(in srgb, var(--fond-page) 20%, transparent)',
        maskImage: 'radial-gradient(ellipse 40% 52% at 50% 50%, #000 0%, #000 30%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 40% 52% at 50% 50%, #000 0%, #000 30%, transparent 100%)',
      }} />

      {/* Grain épais et couvrant. */}
      <div className="hidden dark:block"
        style={{ ...COUCHE, backgroundImage: GRAIN_CLAIR_SUR_SOMBRE, backgroundSize: '240px 240px, 150px 150px', opacity: 0.42 }} />
      <div className="block dark:hidden"
        style={{ ...COUCHE, backgroundImage: GRAIN_SOMBRE_SUR_CLAIR, backgroundSize: '240px 240px, 150px 150px', opacity: 0.5 }} />
    </div>
  )
}
