/**
 * EmojiPicker — picker emoji-mart (la mise en page appréciée : barre de
 * catégories, sections, « Fréquemment utilisé », teintes de peau, recherche),
 * avec les emojis **Apple** (style WhatsApp) servis depuis UN sprite LOCAL
 * auto-hébergé (`/emoji/apple-64.png`, pré-caché PWA) → beau, identique partout,
 * hors-ligne, sans CDN.
 *
 * On monte le Picker vanilla dans un ref (compatible React 19). Le sprite est
 * fourni via `getSpritesheetURL` en URL ABSOLUE (une URL relative faisait
 * planter le rendu d'emoji-mart, d'où la grille vide observée auparavant).
 */
import { useEffect, useRef } from 'react'
import data from '@emoji-mart/data/sets/15/apple.json'
import { Picker } from 'emoji-mart'

// URL absolue du sprite Apple auto-hébergé.
const SPRITE_URL = new URL(`${import.meta.env.BASE_URL}emoji/apple-64.png`, window.location.origin).href

export function EmojiPicker({ onPick }: { onPick: (native: string) => void }) {
  const ref   = useRef<HTMLDivElement>(null)
  const cbRef = useRef(onPick)
  cbRef.current = onPick

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Suivre le thème de l'APP (classe `.dark` sur <html>), PAS celui de l'OS :
    // `theme:'auto'` se basait sur le système → incohérence (app claire / picker sombre).
    const appTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    const picker = new Picker({
      data,
      set:               'apple',
      getSpritesheetURL: () => SPRITE_URL,
      theme:             appTheme,
      locale:            'fr',
      previewPosition:   'none',
      skinTonePosition:  'preview',
      navPosition:       'top',
      perLine:           9,
      emojiButtonSize:   36,
      emojiSize:         26,
      maxFrequentRows:   2,
      onEmojiSelect:     (e: { native?: string }) => { if (e?.native) cbRef.current(e.native) },
    })
    el.appendChild(picker as unknown as HTMLElement)
    return () => { el.innerHTML = '' }
  }, [])

  return <div ref={ref} />
}
