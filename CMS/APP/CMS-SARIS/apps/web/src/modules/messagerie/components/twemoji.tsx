/**
 * twemoji — rendu unifié des emojis en IMAGES Apple (style WhatsApp), à partir
 * d'UN sprite local auto-hébergé (`/emoji/apple-64.png`, pré-caché PWA) positionné
 * via les coordonnées sheet du jeu `@emoji-mart/data/sets/15/apple.json`.
 *
 * Utilisé pour le rendu des emojis DANS les messages, stickers et réactions
 * (le picker, lui, utilise le composant emoji-mart). → look Apple/WhatsApp
 * identique sur tous les appareils, sans police native ni CDN.
 */
import type { CSSProperties } from 'react'
import rawData from '@emoji-mart/data/sets/15/apple.json'

interface Skin { native: string; x: number; y: number }
interface EmojiDef { id: string; name: string; keywords?: string[]; skins: Skin[] }
interface Category { id: string; emojis: string[] }
interface EmojiData { categories: Category[]; emojis: Record<string, EmojiDef>; sheet: { cols: number; rows: number } }

export const EMOJI_DATA = rawData as unknown as EmojiData
export const SPRITE_URL = `${import.meta.env.BASE_URL}emoji/apple-64.png`
const COLS = EMOJI_DATA.sheet.cols
const ROWS = EMOJI_DATA.sheet.rows

/** Map : caractère emoji natif → coordonnées (x,y) dans le sprite. */
export const NATIVE_TO_COORD = new Map<string, { x: number; y: number }>()
for (const id in EMOJI_DATA.emojis) {
  for (const sk of EMOJI_DATA.emojis[id]!.skins) {
    if (sk?.native && typeof sk.x === 'number') NATIVE_TO_COORD.set(sk.native, { x: sk.x, y: sk.y })
  }
}

function lookup(emoji: string): { x: number; y: number } | undefined {
  return NATIVE_TO_COORD.get(emoji)
    ?? NATIVE_TO_COORD.get(emoji.replace(/️/g, ''))   // sans variation selector
    ?? NATIVE_TO_COORD.get(emoji + '️')               // avec variation selector
}

export function spriteStyle(x: number, y: number, size: number): CSSProperties {
  return {
    display: 'inline-block', width: size, height: size, verticalAlign: '-0.18em',
    backgroundImage:    `url(${SPRITE_URL})`,
    backgroundSize:     `${COLS * 100}% ${ROWS * 100}%`,
    backgroundPosition: `${(x / (COLS - 1)) * 100}% ${(y / (ROWS - 1)) * 100}%`,
    backgroundRepeat:   'no-repeat',
  }
}

/** Une tuile emoji (image Twemoji depuis le sprite local). */
export function Twemoji({ emoji, size = 20 }: { emoji: string; size?: number }) {
  const c = lookup(emoji)
  if (!c) return <span style={{ fontSize: size, lineHeight: 1 }}>{emoji}</span>
  return <span role="img" aria-label={emoji} style={spriteStyle(c.x, c.y, size)} />
}

const URL_RE = /(https?:\/\/[^\s]+)/g
const EMOJI_RE = /\p{Extended_Pictographic}/u

function segmenter(): Intl.Segmenter | null {
  try {
    const Seg = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter
    return Seg ? new Seg('fr', { granularity: 'grapheme' }) : null
  } catch { return null }
}
const SEG = segmenter()

function graphemes(text: string): string[] {
  if (SEG) return [...SEG.segment(text)].map(s => s.segment)
  return [...text]
}

// Mention : token stable `@[Nom Affiché](userId)` posé par le composer. Rendu = `@Nom` surligné.
const MENTION_RE = /(@\[[^\]]+\]\([0-9a-fA-F-]{36}\))/g
const MENTION_ONE = /^@\[([^\]]+)\]\([0-9a-fA-F-]{36}\)$/

/**
 * Rend un texte de message : @mentions → puces surlignées, emojis → images Twemoji,
 * URLs → liens cliquables, le reste en texte. `size` = taille des emojis (px).
 */
/**
 * MISE EN FORME façon WhatsApp : *gras*, _italique_, ~barré~, +souligné+.
 *
 * On encadre le texte de MARQUEURS au lieu de stocker du HTML. Ce choix n'est pas
 * cosmétique : le message reste du TEXTE, donc il se chiffre, se cite, se modifie, se
 * recherche et se relit partout — y compris dans une notification ou un aperçu de liste.
 * Stocker du HTML aurait ouvert la porte à l'injection dans un fil de discussion, sur des
 * messages venus d'ailleurs par synchronisation.
 *
 * Le souligné n'existe pas dans WhatsApp ; « + » est donc notre marqueur, choisi parce
 * qu'il ne heurte aucune des trois conventions établies.
 */
const MARQUEURS: Record<string, (contenu: React.ReactNode[], k: number) => React.ReactNode> = {
  '*': (c, k) => <strong key={k}>{c}</strong>,
  '_': (c, k) => <em key={k}>{c}</em>,
  '~': (c, k) => <s key={k}>{c}</s>,
  '+': (c, k) => <u key={k}>{c}</u>,
}

/** Vide, espace, tabulation ou saut de ligne — sans expression régulière. */
function estEspace(c: string | undefined): boolean {
  return !c || c.trim() === ''
}

/** Lettre ou chiffre — sans expression régulière, et valable au-delà de l'alphabet latin. */
function estAlphanumerique(c: string | undefined): boolean {
  if (!c) return false
  if (c >= '0' && c <= '9') return true
  return c.toLowerCase() !== c.toUpperCase()
}

/**
 * Cherche le prochain marqueur OUVRANT qui possède un fermant valide.
 *
 * Deux règles, chacune née d'un vrai faux positif :
 *  - le marqueur est COLLÉ à son contenu — « 2 * 3 * 4 » reste une multiplication,
 *    « 5 + 2 + 3 » reste une addition ;
 *  - il ouvre un MOT — sinon « BON_EXAMEN_ACTION » ou « dossier_patient_2026 », qui
 *    parsèment cette application, partiraient en italique au milieu d'une phrase.
 *    WhatsApp accepte ce défaut ; ici les codes à souligné sont trop courants.
 */
function prochainMarqueur(text: string, depuis: number): { debut: number; fin: number; car: string } | null {
  for (let i = depuis; i < text.length; i++) {
    const c = text[i]!
    if (!MARQUEURS[c]) continue
    if (estEspace(text[i + 1])) continue
    if (estAlphanumerique(text[i - 1])) continue
    for (let j = i + 2; j < text.length; j++) {
      if (text[j] !== c || estEspace(text[j - 1])) continue
      return { debut: i, fin: j, car: c }
    }
  }
  return null
}

export function renderRich(text: string, size = 19): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const ref = { key: 0 }
  renderFormate(text, size, out, ref)
  return out
}

/** Couche de mise en forme. Récursive : *gras avec _italique_ dedans* fonctionne. */
function renderFormate(text: string, size: number, out: React.ReactNode[], ref: { key: number }): void {
  let i = 0
  for (;;) {
    const trouve = prochainMarqueur(text, i)
    if (!trouve) { renderMentions(text.slice(i), size, out, ref); return }
    if (trouve.debut > i) renderMentions(text.slice(i, trouve.debut), size, out, ref)
    const interne: React.ReactNode[] = []
    renderFormate(text.slice(trouve.debut + 1, trouve.fin), size, interne, ref)
    out.push(MARQUEURS[trouve.car]!(interne, ref.key++))
    i = trouve.fin + 1
  }
}

/** Mentions @quelqu'un, puis délègue le reste (URLs + emojis) à renderPlain. */
function renderMentions(text: string, size: number, out: React.ReactNode[], ref: { key: number }): void {
  for (const part of text.split(MENTION_RE)) {
    if (!part) continue
    const m = part.match(MENTION_ONE)
    if (m) {
      out.push(
        <span key={ref.key++} style={{ color: 'var(--ap-700)', fontWeight: 600, background: 'var(--ap-50)', borderRadius: 4, padding: '0 2px' }}>@{m[1]}</span>,
      )
      continue
    }
    renderPlain(part, size, out, ref)
  }
}

// URLs + emojis (sans mentions) — partie « texte ordinaire » de renderRich.
function renderPlain(text: string, size: number, out: React.ReactNode[], ref: { key: number }): void {
  for (const segment of text.split(URL_RE)) {
    if (!segment) continue
    if (/^https?:\/\//.test(segment)) {
      out.push(<a key={ref.key++} href={segment} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>{segment}</a>)
      continue
    }
    let buf = ''
    const flush = () => { if (buf) { out.push(<span key={ref.key++}>{buf}</span>); buf = '' } }
    for (const g of graphemes(segment)) {
      if (EMOJI_RE.test(g) && lookup(g)) { flush(); out.push(<Twemoji key={ref.key++} emoji={g} size={size} />) }
      else buf += g
    }
    flush()
  }
}
