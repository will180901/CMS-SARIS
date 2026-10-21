/**
 * Mise en forme façon WhatsApp du composeur : marqueurs, listes, citations, retour à la ligne,
 * découpage d'un message en blocs.
 *   pnpm --filter web exec tsx test/formatage.test.ts
 */
import assert from 'node:assert/strict'
import {
  analyserBlocs, appliquerOps, basculerBloc, basculerMarqueur, declencherListe, prefixeDeLigne,
  retourALaLigne, retourArriere, scinderLignes, type Resultat,
} from '../src/modules/messagerie/lib/formatage'

let passed = 0
let failed = 0
function test(name: string, fn: () => void): void {
  try {
    fn()
    passed++
    console.log('  ✓ ' + name)
  } catch (e) {
    failed++
    console.error('  ✗ ' + name + '\n     ' + (e as Error).message)
  }
}

/** Joue le résultat sur le texte et rend le texte final + ce qui est sélectionné ensuite. */
function jouer(texte: string, res: Resultat | null): { texte: string; choix: string; selection: [number, number] } {
  assert.ok(res, 'un résultat était attendu')
  const final = appliquerOps(texte, res.ops)
  return { texte: final, choix: final.slice(res.selection[0], res.selection[1]), selection: res.selection }
}
/** Position de `mot` dans `texte`, pour sélectionner sans compter les caractères à la main. */
const plage = (texte: string, mot: string): [number, number] => {
  const i = texte.indexOf(mot)
  assert.ok(i >= 0, `« ${mot} » introuvable dans « ${texte} »`)
  return [i, i + mot.length]
}

console.log('basculerMarqueur — gras, italique, barré, code…')
test('sans sélection : la paire est posée, le curseur au milieu', () => {
  const r = jouer('abc', basculerMarqueur('abc', 3, 3, '*'))
  assert.equal(r.texte, 'abc**')
  assert.deepEqual(r.selection, [4, 4])
})
test('la sélection est entourée, et reste sur le texte (marqueurs exclus)', () => {
  const t = 'bonjour tout le monde'
  const [a, b] = plage(t, 'tout')
  const r = jouer(t, basculerMarqueur(t, a, b, '*'))
  assert.equal(r.texte, 'bonjour *tout* le monde')
  assert.equal(r.choix, 'tout')
})
test('rappuyer sur le bouton RETIRE : la sélection étant à l’intérieur des marqueurs', () => {
  const t = 'bonjour *tout* le monde'
  const [a, b] = plage(t, 'tout')
  const r = jouer(t, basculerMarqueur(t, a, b, '*'))
  assert.equal(r.texte, 'bonjour tout le monde')
  assert.equal(r.choix, 'tout')
})
test('rappuyer sur le bouton RETIRE : la sélection englobant les marqueurs', () => {
  const t = 'bonjour *tout* le monde'
  const [a, b] = plage(t, '*tout*')
  const r = jouer(t, basculerMarqueur(t, a, b, '*'))
  assert.equal(r.texte, 'bonjour tout le monde')
  assert.equal(r.choix, 'tout')
})
test('les espaces en bord de sélection restent dehors', () => {
  const t = 'bonjour tout le monde'
  const [a, b] = plage(t, ' tout ')
  assert.equal(jouer(t, basculerMarqueur(t, a, b, '_')).texte, 'bonjour _tout_ le monde')
})
test('chaque ligne est entourée séparément, les lignes vides sont laissées', () => {
  const t = 'a\n\nb'
  const r = jouer(t, basculerMarqueur(t, 0, t.length, '*'))
  assert.equal(r.texte, '*a*\n\n*b*')
  assert.equal(r.choix, 'a*\n\n*b')
})
test('chaque ligne, retirée d’un coup', () => {
  const t = '*a*\n\n*b*'
  assert.equal(jouer(t, basculerMarqueur(t, 0, t.length, '*')).texte, 'a\n\nb')
})
test('le souligné d’un code (BON_EXAMEN_ACTION) n’est pas pris pour un italique à retirer', () => {
  const t = 'BON_EXAMEN_ACTION'
  const [a, b] = plage(t, 'EXAMEN')
  assert.equal(jouer(t, basculerMarqueur(t, a, b, '_')).texte, 'BON__EXAMEN__ACTION')
})
test('une sélection d’espaces seuls ne change rien', () => {
  const r = basculerMarqueur('a   b', 1, 4, '*')
  assert.deepEqual(r.ops, [])
})
test('monospace : la sélection entière, sauts de ligne compris, est entourée d’un bloc', () => {
  const t = 'a\nb'
  const r = jouer(t, basculerMarqueur(t, 0, t.length, '```', false))
  assert.equal(r.texte, '```a\nb```')
  assert.equal(r.choix, 'a\nb')
})
test('monospace retiré', () => {
  const t = '```a\nb```'
  assert.equal(jouer(t, basculerMarqueur(t, 0, t.length, '```', false)).texte, 'a\nb')
})

console.log('basculerBloc — puces, numéros, citation')
test('sur une ligne vide : la liste s’ouvre, le curseur la suit', () => {
  const r = jouer('', basculerBloc('', 0, 0, 'puce'))
  assert.equal(r.texte, '• ')
  assert.deepEqual(r.selection, [2, 2])
})
test('le curseur au milieu d’une ligne reste sur le même caractère', () => {
  const r = jouer('bonjour', basculerBloc('bonjour', 3, 3, 'puce'))
  assert.equal(r.texte, '• bonjour')
  assert.deepEqual(r.selection, [5, 5])
})
test('liste numérotée : 1, 2, 3 sur les lignes sélectionnées', () => {
  const t = 'a\nb\nc'
  assert.equal(jouer(t, basculerBloc(t, 0, t.length, 'numero')).texte, '1. a\n2. b\n3. c')
})
test('les lignes vides d’une sélection sont sautées, la numérotation continue', () => {
  const t = 'a\n\nb'
  assert.equal(jouer(t, basculerBloc(t, 0, t.length, 'numero')).texte, '1. a\n\n2. b')
})
test('rappuyer retire la liste de toutes les lignes', () => {
  const t = '• a\n• b'
  assert.equal(jouer(t, basculerBloc(t, 0, t.length, 'puce')).texte, 'a\nb')
})
test('un autre préfixe est REMPLACÉ, pas empilé', () => {
  assert.equal(jouer('1. a', basculerBloc('1. a', 0, 0, 'puce')).texte, '• a')
  assert.equal(jouer('- a', basculerBloc('- a', 0, 0, 'citation')).texte, '> a')
})
test('une sélection qui s’arrête juste après un saut de ligne ne touche pas la ligne suivante', () => {
  assert.equal(jouer('a\nb', basculerBloc('a\nb', 0, 2, 'puce')).texte, '• a\nb')
})

console.log('declencherListe — « - », « * », « . » + espace en début de ligne')
test('« - » puis espace : la liste s’ouvre', () => {
  const r = jouer('- ', declencherListe('-', '- ', 2))
  assert.equal(r.texte, '• ')
  assert.deepEqual(r.selection, [2, 2])
})
test('« * » et « . » aussi', () => {
  assert.equal(jouer('* ', declencherListe('*', '* ', 2)).texte, '• ')
  assert.equal(jouer('. ', declencherListe('.', '. ', 2)).texte, '• ')
})
test('sur une ligne suivante', () => {
  assert.equal(jouer('abc\n- ', declencherListe('abc\n-', 'abc\n- ', 6)).texte, 'abc\n• ')
})
test('pas en milieu de ligne', () => {
  assert.equal(declencherListe('a-', 'a- ', 3), null)
})
test('pas si la ligne commence par autre chose (« -x »)', () => {
  assert.equal(declencherListe('-x', '-x ', 3), null)
})
test('pas sur un collage (plusieurs caractères d’un coup)', () => {
  assert.equal(declencherListe('', '- ', 2), null)
})

console.log('retourALaLigne — Ctrl+Entrée')
test('texte simple : un saut de ligne', () => {
  const r = jouer('abc', retourALaLigne('abc', 3, 3))
  assert.equal(r.texte, 'abc\n')
  assert.deepEqual(r.selection, [4, 4])
})
test('liste à puces : la ligne suivante reprend la puce', () => {
  assert.equal(jouer('• a', retourALaLigne('• a', 3, 3)).texte, '• a\n• ')
  assert.equal(jouer('- a', retourALaLigne('- a', 3, 3)).texte, '- a\n- ')
})
test('liste numérotée : 2 devient 3', () => {
  assert.equal(jouer('2. a', retourALaLigne('2. a', 4, 4)).texte, '2. a\n3. ')
})
test('citation : la citation continue', () => {
  assert.equal(jouer('> a', retourALaLigne('> a', 3, 3)).texte, '> a\n> ')
})
test('un élément vide FERME la liste', () => {
  const r = jouer('• ', retourALaLigne('• ', 2, 2))
  assert.equal(r.texte, '')
  assert.deepEqual(r.selection, [0, 0])
  assert.equal(jouer('1. a\n2. ', retourALaLigne('1. a\n2. ', 8, 8)).texte, '1. a\n')
})
test('au milieu d’un élément : la fin passe à la ligne suivante, avec sa puce', () => {
  assert.equal(jouer('• abcd', retourALaLigne('• abcd', 4, 4)).texte, '• ab\n• cd')
})
test('curseur dans le préfixe lui-même : simple saut de ligne', () => {
  assert.equal(jouer('• a', retourALaLigne('• a', 1, 1)).texte, '•\n a')
})
test('une sélection est remplacée par le saut de ligne', () => {
  assert.equal(jouer('abcd', retourALaLigne('abcd', 1, 3)).texte, 'a\nd')
})

console.log('retourArriere — dans une liste')
test('juste après le préfixe : il part en entier', () => {
  const r = jouer('• ', retourArriere('• ', 2, 2))
  assert.equal(r.texte, '')
  assert.equal(jouer('• a', retourArriere('• a', 2, 2)).texte, 'a')
  assert.equal(jouer('12. a', retourArriere('12. a', 4, 4)).texte, 'a')
})
test('ailleurs, ou avec une sélection : la touche garde son effet normal', () => {
  assert.equal(retourArriere('• a', 3, 3), null)
  assert.equal(retourArriere('abc', 2, 2), null)
  assert.equal(retourArriere('• abc', 2, 4), null)
})

console.log('prefixeDeLigne')
test('reconnaît puces, numéros et citations — et pas le reste', () => {
  assert.equal(prefixeDeLigne('• x')?.type, 'puce')
  assert.equal(prefixeDeLigne('- x')?.type, 'puce')
  assert.equal(prefixeDeLigne('* x')?.type, 'puce')
  assert.equal(prefixeDeLigne('10. x')?.numero, 10)
  assert.equal(prefixeDeLigne('> x')?.type, 'citation')
  for (const non of ['-x', '*gras*', '1.x', '1000. x', 'a. b', '>x', '']) assert.equal(prefixeDeLigne(non), null, non)
})

console.log('scinderLignes — le monospace n’est pas découpé')
test('un bloc ``` garde ses sauts de ligne', () => {
  assert.deepEqual(scinderLignes('a\n```x\ny```\nb'), ['a', '```x\ny```', 'b'])
})
test('un bloc jamais fermé n’est pas un bloc', () => {
  assert.deepEqual(scinderLignes('```x\ny'), ['```x', 'y'])
})

console.log('analyserBlocs — du texte aux blocs')
test('un paragraphe, avec ses lignes vides', () => {
  assert.deepEqual(analyserBlocs('a\n\nb'), [{ type: 'paragraphe', texte: 'a\n\nb' }])
})
test('puces, numéros, citation', () => {
  assert.deepEqual(analyserBlocs('- a\n- b'), [{ type: 'puces', items: ['a', 'b'] }])
  assert.deepEqual(analyserBlocs('1. a\n2. b'), [{ type: 'numeros', items: [{ numero: 1, texte: 'a' }, { numero: 2, texte: 'b' }] }])
  assert.deepEqual(analyserBlocs('> a\n> b'), [{ type: 'citation', texte: 'a\nb' }])
})
test('la ligne vide entre un paragraphe et une liste ne s’ajoute pas à l’espace du bloc', () => {
  assert.deepEqual(analyserBlocs('intro\n\n- a\n- b\n\nfin'), [
    { type: 'paragraphe', texte: 'intro' },
    { type: 'puces', items: ['a', 'b'] },
    { type: 'paragraphe', texte: 'fin' },
  ])
})
test('dans un bloc ```, un « - » en début de ligne n’est pas une puce', () => {
  assert.deepEqual(analyserBlocs('```x\n- y```'), [{ type: 'paragraphe', texte: '```x\n- y```' }])
})
test('un message ordinaire reste UN paragraphe, rien ne change pour lui', () => {
  assert.deepEqual(analyserBlocs('Bonjour *Marie*, ça va ?'), [{ type: 'paragraphe', texte: 'Bonjour *Marie*, ça va ?' }])
})

console.log(`\n${passed} reussis, ${failed} echoues`)
if (failed > 0) process.exit(1)
