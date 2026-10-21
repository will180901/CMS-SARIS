/**
 * saisie — ce qui touche au champ de saisie lui-même (le DOM), pour que `formatage.ts` reste pur.
 */
import { appliquerOps, type Resultat } from './formatage'

/**
 * Joue un `Resultat` dans le champ, édition après édition, par les commandes natives du
 * navigateur : le Ctrl+Z annule la mise en forme comme n'importe quelle frappe, et chaque
 * édition passe par `onChange` — les @mentions suivent donc le texte sans code à part.
 *
 * Si le navigateur refuse la commande native, `repli` reçoit le texte final et c'est à
 * l'appelant de le poser dans son état.
 */
export function appliquerResultat(el: HTMLTextAreaElement, res: Resultat, repli: (texte: string) => void): void {
  el.focus()
  const avant = el.value
  let reussi = true
  for (const op of [...res.ops].sort((a, b) => b.pos - a.pos)) {
    el.setSelectionRange(op.pos, op.pos + op.suppr)
    const ok = op.ins === ''
      ? (op.suppr === 0 || document.execCommand('delete'))
      : document.execCommand('insertText', false, op.ins)
    if (!ok) { reussi = false; break }
  }
  if (reussi) {
    el.setSelectionRange(res.selection[0], res.selection[1])
    return
  }
  repli(appliquerOps(avant, res.ops))
  requestAnimationFrame(() => { el.setSelectionRange(res.selection[0], res.selection[1]) })
}

/** Les propriétés qui décident où un caractère tombe dans un champ : on les recopie sur le miroir. */
const PROPRIETES_MIROIR = [
  'direction', 'boxSizing', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch',
  'fontSize', 'lineHeight', 'fontFamily', 'textAlign', 'textTransform', 'textIndent', 'letterSpacing', 'wordSpacing', 'tabSize',
] as const

/**
 * Où se trouve le caractère `index` du champ, en pixels, par rapport à son coin haut-gauche
 * (défilement du champ déduit) ? Un champ de saisie ne le dit pas : on construit un MIROIR
 * invisible, de même police, même largeur, même retour à la ligne, et on mesure un repère
 * placé à cet endroit du texte. `h` est la hauteur d'une ligne.
 */
export function coordonneesTexte(el: HTMLTextAreaElement, index: number): { x: number; y: number; h: number } {
  const style = getComputedStyle(el)
  const miroir = document.createElement('div')
  for (const p of PROPRIETES_MIROIR) miroir.style[p] = style[p]
  miroir.style.position = 'absolute'
  miroir.style.visibility = 'hidden'
  miroir.style.top = '0'
  miroir.style.left = '-9999px'
  miroir.style.overflow = 'hidden'
  miroir.style.whiteSpace = 'pre-wrap'
  miroir.style.overflowWrap = 'break-word'
  // Le champ perd la largeur de sa barre de défilement quand il en a une : le miroir aussi.
  const barre = el.offsetWidth - el.clientWidth - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth)
  miroir.style.width = `${el.offsetWidth - Math.max(0, barre)}px`
  miroir.textContent = el.value.slice(0, index)
  const repere = document.createElement('span')
  repere.textContent = el.value.slice(index) || '.'
  miroir.appendChild(repere)
  document.body.appendChild(miroir)
  const hauteur = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4
  const pos = { x: repere.offsetLeft - el.scrollLeft, y: repere.offsetTop - el.scrollTop, h: hauteur }
  document.body.removeChild(miroir)
  return pos
}
