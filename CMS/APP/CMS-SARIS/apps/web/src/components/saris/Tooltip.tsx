/**
 * Tooltip — info-bulle SARIS stylée (wrapper ergonomique du Tooltip radix).
 *
 * Usage : <Tooltip label="Supprimer"><IconButton .../></Tooltip>
 * Le TooltipProvider est déjà monté à la racine (main.tsx). z au-dessus des
 * modales/menus (z-1200) pour rester visible partout.
 */
import type { ReactNode } from 'react'
import {
  Tooltip as TooltipRoot,
  TooltipTrigger,
  TooltipContent,
} from '@workspace/ui/components/tooltip'

interface Props {
  label:       ReactNode
  children:    ReactNode
  side?:       'top' | 'bottom' | 'left' | 'right'
  sideOffset?: number
  /** Délai d'ouverture en ms (0 = immédiat). */
  delay?:      number
}

export function Tooltip({ label, children, side = 'top', sideOffset = 6, delay }: Props) {
  if (label == null || label === '') return <>{children}</>
  return (
    <TooltipRoot {...(delay != null ? { delayDuration: delay } : {})}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={sideOffset}
        className="z-[1200] max-w-[260px] font-medium tracking-tight shadow-lg ring-1 ring-white/10"
      >
        {label}
      </TooltipContent>
    </TooltipRoot>
  )
}
