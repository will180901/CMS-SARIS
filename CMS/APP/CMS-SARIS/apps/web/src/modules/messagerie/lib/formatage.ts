/**
 * formatage — la mise en forme façon WhatsApp du composeur et des bulles, en fonctions PURES
 * (du texte en entrée, du texte en sortie : aucun accès à l'écran, donc testable seule).
 *
 * Le message reste du TEXTE à marqueurs, jamais du HTML : *gras*, _italique_, ~barré~,
 * +souligné+, `code`, ```monospace```, et — en début de ligne — « • » ou « - » (puces),
 * « 1. » (liste numérotée), « > » (citation). Il se chiffre, se cite, se recherche et se relit
 * partout, y compris dans une notification.
 *
 * Chaque fonction qui modifie le texte rend un `Resultat` : une liste d'éditions élémentaires
 * (`Op`) plutôt qu'un texte complet. C'est ce qui permet à l'écran de les jouer UNE PAR UNE
 * dans le champ — le Ctrl+Z du navigateur reste cohérent, et les @mentions déjà posées, que
 * l'on suit par leur position, ne sont décalées que là où le texte a vraiment bougé.
 */

/** Une édition élémentaire : remplace `suppr` caractères à partir de `pos` par `ins`. */
export interface Op { pos: number; suppr: number; ins: string }

/** Les éditions (de la FIN vers le DÉBUT, pour que les positions restent valables) + la sélection voulue ensuite. */
export interface Resultat { ops: Op[]; selection: [number, number] }

export type TypeBloc = 'puce' | 'numero' | 'citation'

/** Rejoue les éditions sur un texte (c'est ce que fait le champ, édition après édition). */
export function appliquerOps(texte: string, ops: Op[]): string {
  let out = texte
  for (const o of [...ops].sort((a, b) => b.pos - a.pos)) {
    out = out.slice(0, o.pos) + o.ins + out.slice(o.pos + o.suppr)
  }
  return out
}

const parFinDecroissante = (ops: Op[]): Op[] => [...ops].sort((a, b) => b.pos - a.pos)

// ── Petits outils de caractères ──────────────────────────────────────────────

/** Vide, espace, tabulation ou saut de ligne — sans expression régulière. */
export function estEspace(c: string | undefined): boolean {
  return !c || c.trim() === ''
}

/** Lettre ou chiffre — sans expression régulière, et valable au-delà de l'alphabet latin. */
export function estAlphanumerique(c: string | undefined): boolean {
  if (!c) return false
  if (c >= '0' && c <= '9') return true
  return c.toLowerCase() !== c.toUpperCase()
}

// ── Lignes ───────────────────────────────────────────────────────────────────

/** Début de la ligne qui contient `pos`. (`lastIndexOf` avec un index négatif relirait la position 0.) */
function debutDeLigne(texte: string, pos: number): number {
  return pos <= 0 ? 0 : texte.lastIndexOf('\n', pos - 1) + 1
}

/** Fin (exclue) de la ligne qui contient `pos`. */
function finDeLigne(texte: string, pos: number): number {
  const i = texte.indexOf('\n', pos)
  return i === -1 ? texte.length : i
}

interface LigneInfo { debut: number; fin: number; texte: string }

/** Les lignes touchées par la sélection. Une sélection qui s'arrête juste après un saut de ligne ne compte pas la suivante. */
function lignesDeLaSelection(texte: string, debut: number, fin: number): LigneInfo[] {
  const finEff = fin > debut && texte[fin - 1] === '\n' ? fin - 1 : fin
  const premier = debutDeLigne(texte, debut)
  const dernier = finDeLigne(texte, finEff)
  const lignes: LigneInfo[] = []
  let cur = premier
  for (const ligne of texte.slice(premier, dernier).split('\n')) {
    lignes.push({ debut: cur, fin: cur + ligne.length, texte: ligne })
    cur += ligne.length + 1
  }
  return lignes
}

// ── Listes et citations : le préfixe d'une ligne ─────────────────────────────

export interface Prefixe {
  type: TypeBloc
  /** Nombre de caractères du préfixe, espace compris (« • » → 2, « 12. » → 4). */
  longueur: number
  /** Pour une liste numérotée : le numéro écrit. */
  numero: number
  /** Le préfixe tel qu'il est écrit — on le reprend à la ligne suivante. */
  marque: string
}

/** Quelle liste (ou citation) cette ligne ouvre-t-elle ? « • », « - » ou « * » + espace ; « 1. » ; « > ». */
export function prefixeDeLigne(ligne: string): Prefixe | null {
  let i = 0
  while (i < ligne.length && i < 3 && ligne[i]! >= '0' && ligne[i]! <= '9') i++
  if (i > 0 && ligne[i] === '.' && ligne[i + 1] === ' ') {
    return { type: 'numero', longueur: i + 2, numero: Number(ligne.slice(0, i)), marque: ligne.slice(0, i + 2) }
  }
  const c = ligne[0]
  if ((c === '•' || c === '-' || c === '*') && ligne[1] === ' ') return { type: 'puce', longueur: 2, numero: 0, marque: ligne.slice(0, 2) }
  if (c === '>' && ligne[1] === ' ') return { type: 'citation', longueur: 2, numero: 0, marque: '> ' }
  return null
}

/**
 * Met (ou retire) une liste à puces, une liste numérotée ou une citation sur les lignes
 * touchées par la sélection. Si toutes les lignes visées l'ont DÉJÀ, on la retire ; sinon on
 * la pose — en remplaçant un autre préfixe s'il y en avait un, et en numérotant 1, 2, 3…
 * Sur une sélection de plusieurs lignes, les lignes vides sont laissées telles quelles.
 */
export function basculerBloc(texte: string, debut: number, fin: number, type: TypeBloc): Resultat {
  const lignes = lignesDeLaSelection(texte, debut, fin)
  const cibles = lignes.length === 1 ? lignes : lignes.filter(l => l.texte.trim() !== '')
  if (cibles.length === 0) return { ops: [], selection: [debut, fin] }

  const retirer = cibles.every(l => prefixeDeLigne(l.texte)?.type === type)
  const ops: Op[] = []
  let numero = 0
  let delta = 0
  let premierDelta = 0
  let premierNouveau = 0
  cibles.forEach((l, k) => {
    const ancien = prefixeDeLigne(l.texte)?.longueur ?? 0
    const nouveau = retirer ? '' : type === 'puce' ? '• ' : type === 'citation' ? '> ' : `${++numero}. `
    ops.push({ pos: l.debut, suppr: ancien, ins: nouveau })
    if (k === 0) { premierDelta = nouveau.length - ancien; premierNouveau = nouveau.length }
    delta += nouveau.length - ancien
  })

  const premiere = cibles[0]!
  const derniere = cibles[cibles.length - 1]!
  let selection: [number, number]
  if (debut === fin) {
    // Le curseur reste sur le même caractère du texte : il suit le préfixe, sans jamais rentrer dedans.
    const ancien = prefixeDeLigne(premiere.texte)?.longueur ?? 0
    const decalage = Math.max(0, debut - (premiere.debut + ancien))
    const pos = premiere.debut + premierNouveau + decalage
    selection = [pos, pos]
  } else if (cibles.length === 1) {
    selection = [Math.max(premiere.debut + premierNouveau, debut + premierDelta), fin + premierDelta]
  } else {
    selection = [premiere.debut, derniere.fin + delta]
  }
  return { ops: parFinDecroissante(ops), selection }
}

// ── Mise en forme en ligne : *gras*, _italique_, ~barré~, +souligné+, `code`, ```monospace``` ──

const ESPACES_LIGNE = ' \t\r'
const ESPACES_BLOC = ' \t\r\n'

function rognerPlage(texte: string, a: number, b: number, espaces: string): [number, number] {
  let x = a
  let y = b
  while (x < y && espaces.includes(texte[x]!)) x++
  while (y > x && espaces.includes(texte[y - 1]!)) y--
  return [x, y]
}

/**
 * Entoure la sélection du marqueur `m` — ou l'ENLÈVE si elle l'est déjà (un seul bouton met et
 * retire, comme dans un éditeur).
 *
 * - Les espaces en bord de sélection restent dehors : « * mot * » ne serait pas du gras.
 * - Avec `parLigne`, chaque ligne de la sélection est entourée séparément (la mise en forme ne
 *   déborde pas d'une ligne sur l'autre) ; sans, la sélection entière l'est d'un bloc (monospace).
 * - Sans sélection, on pose la paire et le curseur se place au milieu : on peut activer le gras
 *   AVANT d'écrire.
 * - Après coup, la sélection reste sur le TEXTE (marqueurs exclus) : appuyer de nouveau défait.
 */
export function basculerMarqueur(texte: string, debut: number, fin: number, m: string, parLigne = true): Resultat {
  const l = m.length
  if (debut === fin) {
    return { ops: [{ pos: debut, suppr: 0, ins: m + m }], selection: [debut + l, debut + l] }
  }

  const segments: [number, number][] = []
  if (parLigne) {
    let cur = debut
    for (const ligne of texte.slice(debut, fin).split('\n')) {
      const [a, b] = rognerPlage(texte, cur, cur + ligne.length, ESPACES_LIGNE)
      if (b > a) segments.push([a, b])
      cur += ligne.length + 1
    }
  } else {
    const [a, b] = rognerPlage(texte, debut, fin, ESPACES_BLOC)
    if (b > a) segments.push([a, b])
  }
  if (segments.length === 0) return { ops: [], selection: [debut, fin] }

  // Le texte choisi porte lui-même ses marqueurs : « *mot* » sélectionné en entier.
  const enveloppe = ([a, b]: [number, number]) => b - a >= 2 * l + 1 && texte.startsWith(m, a) && texte.slice(b - l, b) === m
  // Le texte choisi est ENTRE deux marqueurs : « mot » sélectionné dans « *mot* ». Le marqueur
  // ouvrant doit pouvoir ouvrir (pas collé à une lettre), sinon « BON_EXAMEN_ACTION » perdrait ses « _ ».
  const entoure = ([a, b]: [number, number]) =>
    a - l >= 0 && texte.slice(a - l, a) === m && texte.slice(b, b + l) === m && !estAlphanumerique(texte[a - l - 1])

  const k = segments.length
  const premier = segments[0]!
  const dernier = segments[k - 1]!

  if (k === 1 && !enveloppe(premier) && entoure(premier)) {
    const [a, b] = premier
    return { ops: parFinDecroissante([{ pos: a - l, suppr: l, ins: '' }, { pos: b, suppr: l, ins: '' }]), selection: [a - l, b - l] }
  }

  const ops: Op[] = []
  if (segments.every(enveloppe)) {
    for (const [a, b] of segments) {
      ops.push({ pos: a, suppr: l, ins: '' }, { pos: b - l, suppr: l, ins: '' })
    }
    return { ops: parFinDecroissante(ops), selection: [premier[0], dernier[1] - 2 * l * k] }
  }
  for (const [a, b] of segments) {
    ops.push({ pos: a, suppr: 0, ins: m }, { pos: b, suppr: 0, ins: m })
  }
  return { ops: parFinDecroissante(ops), selection: [premier[0] + l, dernier[1] + l * (2 * k - 1)] }
}

// ── Frappe : ce qui se déclenche tout seul ───────────────────────────────────

/**
 * « - », « * » ou « . » suivi d'une espace, en TOUT DÉBUT de ligne, ouvre une liste à puces :
 * le déclencheur devient « • ». Ne réagit qu'à une frappe isolée (une espace tapée), jamais à un
 * collage ni à un texte qui change d'un coup.
 */
export function declencherListe(avant: string, apres: string, caret: number): Resultat | null {
  if (apres.length !== avant.length + 1 || apres[caret - 1] !== ' ') return null
  if (apres.slice(0, caret - 1) + apres.slice(caret) !== avant) return null
  const debut = debutDeLigne(apres, caret)
  if (caret - debut !== 2) return null
  const c = apres[debut]
  if (c !== '.' && c !== '-' && c !== '*') return null
  return { ops: [{ pos: debut, suppr: 2, ins: '• ' }], selection: [debut + 2, debut + 2] }
}

/**
 * Ctrl+Entrée (et Maj+Entrée) : aller à la ligne. Dans une liste ou une citation, la ligne
 * suivante reprend le préfixe — « 3. » devient « 4. » ; sur un élément VIDE, la liste se ferme
 * (le préfixe disparaît) au lieu d'en ouvrir un de plus.
 */
export function retourALaLigne(texte: string, debut: number, fin: number): Resultat {
  const simple = (ins: string): Resultat => ({
    ops: [{ pos: debut, suppr: fin - debut, ins }],
    selection: [debut + ins.length, debut + ins.length],
  })
  const lDebut = debutDeLigne(texte, debut)
  const lFin = finDeLigne(texte, debut)
  const ligne = texte.slice(lDebut, lFin)
  const p = prefixeDeLigne(ligne)
  if (!p || debut < lDebut + p.longueur) return simple('\n')

  if (debut === fin && ligne.slice(p.longueur).trim() === '') {
    return { ops: [{ pos: lDebut, suppr: lFin - lDebut, ins: '' }], selection: [lDebut, lDebut] }
  }
  return simple('\n' + (p.type === 'numero' ? `${p.numero + 1}. ` : p.marque))
}

/** Retour arrière juste APRÈS un préfixe de liste : il part en entier (« • » d'un coup, pas l'espace seule). */
export function retourArriere(texte: string, debut: number, fin: number): Resultat | null {
  if (debut !== fin) return null
  const lDebut = debutDeLigne(texte, debut)
  const p = prefixeDeLigne(texte.slice(lDebut, finDeLigne(texte, debut)))
  if (!p || debut !== lDebut + p.longueur) return null
  return { ops: [{ pos: lDebut, suppr: p.longueur, ins: '' }], selection: [lDebut, lDebut] }
}

// ── Lecture : du texte à des blocs ───────────────────────────────────────────

/** Position de la fermeture d'un bloc ``` ouvert en `i` (au moins un caractère entre les deux), ou -1. */
export function fermetureMonospace(texte: string, i: number): number {
  return texte.indexOf('```', i + 4)
}

/**
 * Découpe en lignes — sauf à l'intérieur d'un bloc ``` ... ``` : son contenu est du texte brut,
 * y compris ses sauts de ligne, et ne doit pas être pris pour des puces ou des citations.
 */
export function scinderLignes(texte: string): string[] {
  const lignes: string[] = []
  let courant = ''
  let dansCode = false
  let i = 0
  while (i < texte.length) {
    if (texte.startsWith('```', i)) {
      if (dansCode) { dansCode = false; courant += '```'; i += 3; continue }
      if (fermetureMonospace(texte, i) !== -1) { dansCode = true; courant += '```'; i += 3; continue }
    }
    const c = texte[i]!
    if (c === '\n' && !dansCode) { lignes.push(courant); courant = ''; i++; continue }
    courant += c
    i++
  }
  lignes.push(courant)
  return lignes
}

export type Bloc =
  | { type: 'paragraphe'; texte: string }
  | { type: 'puces'; items: string[] }
  | { type: 'numeros'; items: { numero: number; texte: string }[] }
  | { type: 'citation'; texte: string }

/**
 * Regroupe les lignes d'un message en blocs : paragraphes, listes à puces, listes numérotées,
 * citations. Les lignes qui se suivent et sont de même nature font UN bloc. Une ligne vide
 * entre un paragraphe et une liste ne s'ajoute pas à l'espace que le bloc a déjà autour de lui.
 */
export function analyserBlocs(texte: string): Bloc[] {
  type Brut =
    | { type: 'paragraphe'; lignes: string[] }
    | { type: 'puces'; items: string[] }
    | { type: 'numeros'; items: { numero: number; texte: string }[] }
    | { type: 'citation'; lignes: string[] }
  const bruts: Brut[] = []

  for (const ligne of scinderLignes(texte)) {
    const p = prefixeDeLigne(ligne)
    const dernier = bruts[bruts.length - 1]
    if (!p) {
      if (dernier?.type === 'paragraphe') dernier.lignes.push(ligne)
      else bruts.push({ type: 'paragraphe', lignes: [ligne] })
      continue
    }
    const reste = ligne.slice(p.longueur)
    if (p.type === 'puce') {
      if (dernier?.type === 'puces') dernier.items.push(reste)
      else bruts.push({ type: 'puces', items: [reste] })
    } else if (p.type === 'numero') {
      const item = { numero: p.numero, texte: reste }
      if (dernier?.type === 'numeros') dernier.items.push(item)
      else bruts.push({ type: 'numeros', items: [item] })
    } else if (dernier?.type === 'citation') {
      dernier.lignes.push(reste)
    } else {
      bruts.push({ type: 'citation', lignes: [reste] })
    }
  }

  const blocs: Bloc[] = []
  bruts.forEach((b, i) => {
    if (b.type === 'puces' || b.type === 'numeros') { blocs.push(b); return }
    if (b.type === 'citation') { blocs.push({ type: 'citation', texte: b.lignes.join('\n') }); return }
    const lignes = [...b.lignes]
    if (i > 0 && lignes[0] === '') lignes.shift()
    if (i < bruts.length - 1 && lignes[lignes.length - 1] === '') lignes.pop()
    if (lignes.length > 0) blocs.push({ type: 'paragraphe', texte: lignes.join('\n') })
  })
  return blocs
}
