/**
 * Stickers + utilitaires emoji pour la messagerie. Les stickers (et tous les
 * emojis) sont rendus en images Twemoji depuis le sprite local (cf. twemoji.tsx).
 */

/** Stickers = emojis envoyés en un clic, rendus en grand (image Twemoji). */
export const STICKERS: string[] = [
  '👍','🙏','❤️','😂','🎉','👏','💪','🔥','✅','💯',
  '🤝','🥳','😍','😎','🙌','👌','🤞','✨','⭐','🏆',
  '🩺','💊','🚑','⛑️','😷','🤒','🆗','⚠️','❗','⏰',
  '😴','☕','🍀','🌟','💐','🎂','🤗','🫶','😇','🤩',
]

/** Découpe une chaîne en graphèmes (emojis composés inclus). */
export function splitGraphemes(text: string): string[] {
  try {
    const Seg = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter
    if (Seg) return [...new Seg('fr', { granularity: 'grapheme' }).segment(text)].map(s => s.segment)
  } catch { /* fallback */ }
  return [...text]
}

/**
 * Un message est-il « emoji seul » (à rendre en grand) ?
 * true si le contenu ne contient que des emojis/espaces et ≤ 8 emojis.
 */
export function isEmojiOnly(text: string): boolean {
  const t = (text || '').trim()
  if (!t) return false
  // Retire variation selectors / ZWJ / espaces pour le test de "non-emoji".
  const stripped = t.replace(/[\s️‍]/gu, '')
  if (!stripped) return false
  // Aucun caractère "mot" (lettre/chiffre) → considéré emoji-only.
  if (/[\p{L}\p{N}]/u.test(stripped)) return false
  // Doit contenir au moins un pictogramme.
  if (!/\p{Extended_Pictographic}/u.test(stripped)) return false
  let count: number
  try {
    const Seg = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter
    count = Seg ? [...new Seg('fr', { granularity: 'grapheme' }).segment(stripped)].length : [...stripped].length
  } catch { count = [...stripped].length }
  return count > 0 && count <= 8
}
