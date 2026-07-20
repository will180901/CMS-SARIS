/**
 * tones.ts — table de couleurs partagée pour les tuiles d'icône statiques
 * (PageHeader, Card.Header, Modal, StatCard). Élargit le TONE_MAP historique
 * de StatCard (neutral/accent/gold/success/warning/error) avec les 6 tons
 * décoratifs de personnalisation (rose/violet/bleu/emeraude/cyan/ambre),
 * définis dans packages/ui/src/styles/globals.css.
 */

export type Tone =
  | 'neutral' | 'accent' | 'gold' | 'success' | 'warning' | 'error'
  | 'rose' | 'violet' | 'bleu' | 'emeraude' | 'cyan' | 'ambre'

export const TILE_TONE_MAP: Record<Tone, { bg: string; color: string }> = {
  neutral:  { bg: 'var(--fond-surface-2)', color: 'var(--texte-secondaire)' },
  accent:   { bg: 'var(--ap-50)',          color: 'var(--ap-600)'           },
  gold:     { bg: 'var(--as-50)',          color: 'var(--as-700)'           },
  success:  { bg: 'var(--succes-fond)',    color: 'var(--succes-accent)'    },
  warning:  { bg: 'var(--avert-fond)',     color: 'var(--avert-accent)'     },
  error:    { bg: 'var(--erreur-fond)',    color: 'var(--erreur-accent)'    },
  rose:     { bg: 'var(--ton-rose-fond)',      color: 'var(--ton-rose-icone)'      },
  violet:   { bg: 'var(--ton-violet-fond)',    color: 'var(--ton-violet-icone)'    },
  bleu:     { bg: 'var(--ton-bleu-fond)',      color: 'var(--ton-bleu-icone)'      },
  emeraude: { bg: 'var(--ton-emeraude-fond)',  color: 'var(--ton-emeraude-icone)'  },
  cyan:     { bg: 'var(--ton-cyan-fond)',      color: 'var(--ton-cyan-icone)'      },
  ambre:    { bg: 'var(--ton-ambre-fond)',     color: 'var(--ton-ambre-icone)'     },
}
