/**
 * Appairage d'un poste : formes de code, empreintes, état, limite d'essais — logique pure.
 *   pnpm --filter api exec tsx test/appairage-code.test.ts
 */
import assert from 'node:assert/strict'
import {
  ALPHABET_CODE,
  LONGUEUR_CODE,
  LimiteurEchecs,
  empreinteCode,
  empreinteSecret,
  etatCode,
  formaterCode,
  genererCode,
  genererSecret,
  memeEmpreinte,
  normaliserCode,
} from '../src/modules/sync/appairage-code'

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

console.log('Codes')
test('un code tiré a la bonne longueur et ne contient que des symboles de l’alphabet', () => {
  for (let i = 0; i < 200; i++) {
    const c = genererCode()
    assert.equal(c.length, LONGUEUR_CODE)
    for (const x of c) assert.ok(ALPHABET_CODE.includes(x), c)
  }
})
test('l’alphabet n’a ni 0, ni 1, ni I, ni O (aucune confusion à la saisie)', () => {
  for (const interdit of '01IO') assert.ok(!ALPHABET_CODE.includes(interdit))
  assert.equal(new Set(ALPHABET_CODE).size, 32)
})
test('deux codes tirés ne sont pas les mêmes (40 bits)', () => {
  const vus = new Set(Array.from({ length: 500 }, () => genererCode()))
  assert.equal(vus.size, 500)
})
test('la présentation sépare en deux groupes de quatre', () => {
  assert.equal(formaterCode('K7QM4XPD'), 'K7QM-4XPD')
})
test('la saisie est ramenée à la forme canonique (casse, espaces, tirets)', () => {
  assert.equal(normaliserCode('k7qm-4xpd'), 'K7QM4XPD')
  assert.equal(normaliserCode(' K7QM 4XPD '), 'K7QM4XPD')
  assert.equal(normaliserCode('K7QM_4XPD'), 'K7QM4XPD')
})
test('une saisie qui ne peut pas être un code est refusée', () => {
  assert.equal(normaliserCode(''), null)
  assert.equal(normaliserCode('K7QM4XP'), null) // trop court
  assert.equal(normaliserCode('K7QM4XPDX'), null) // trop long
  assert.equal(normaliserCode('K7QM4XP0'), null) // 0 hors alphabet
  assert.equal(normaliserCode('K7QM4XPO'), null) // O hors alphabet
  assert.equal(normaliserCode("K7QM';--"), null)
})

console.log('Empreintes')
test('l’empreinte d’un code dépend de la clé du serveur', () => {
  assert.notEqual(empreinteCode('K7QM4XPD', 'cle-a'), empreinteCode('K7QM4XPD', 'cle-b'))
  assert.equal(empreinteCode('K7QM4XPD', 'cle-a'), empreinteCode('K7QM4XPD', 'cle-a'))
  assert.notEqual(empreinteCode('K7QM4XPD', 'cle-a'), empreinteCode('K7QM4XPE', 'cle-a'))
})
test('l’empreinte ne contient jamais le code', () => {
  assert.ok(!empreinteCode('K7QM4XPD', 'cle').includes('K7QM4XPD'))
})
test('un secret de poste a 256 bits et deux secrets diffèrent', () => {
  const a = genererSecret()
  assert.equal(Buffer.from(a, 'base64url').length, 32)
  assert.notEqual(a, genererSecret())
})
test('la comparaison d’empreintes est exacte, à longueur égale ou non', () => {
  const e = empreinteSecret('secret')
  assert.ok(memeEmpreinte(e, empreinteSecret('secret')))
  assert.ok(!memeEmpreinte(e, empreinteSecret('autre')))
  assert.ok(!memeEmpreinte(e, e.slice(0, 10)))
})

console.log('État d’un code')
const maintenant = new Date('2026-10-23T10:00:00Z')
const futur = new Date('2026-10-24T10:00:00Z')
const passe = new Date('2026-10-22T10:00:00Z')
test('actif tant qu’il n’est ni annulé, ni expiré, ni épuisé', () => {
  assert.equal(etatCode({ annuleAt: null, expireAt: futur, usagesMax: 3 }, 2, maintenant), 'ACTIF')
})
test('épuisé quand tous ses postes sont appairés', () => {
  assert.equal(etatCode({ annuleAt: null, expireAt: futur, usagesMax: 3 }, 3, maintenant), 'EPUISE')
})
test('expiré à la date dite (pile à l’instant compris)', () => {
  assert.equal(etatCode({ annuleAt: null, expireAt: passe, usagesMax: 3 }, 0, maintenant), 'EXPIRE')
  assert.equal(etatCode({ annuleAt: null, expireAt: maintenant, usagesMax: 3 }, 0, maintenant), 'EXPIRE')
})
test('annulé l’emporte sur tout le reste', () => {
  assert.equal(etatCode({ annuleAt: passe, expireAt: passe, usagesMax: 1 }, 1, maintenant), 'ANNULE')
})

console.log('Limite d’essais ratés')
test('bloque une origine après le maximum d’échecs, pas avant', () => {
  const l = new LimiteurEchecs(3, 60_000)
  for (let i = 0; i < 2; i++) l.enregistrerEchec('1.2.3.4', 1000)
  assert.ok(!l.bloque('1.2.3.4', 1000))
  l.enregistrerEchec('1.2.3.4', 1000)
  assert.ok(l.bloque('1.2.3.4', 1000))
})
test('une autre origine n’est pas touchée', () => {
  const l = new LimiteurEchecs(2, 60_000)
  l.enregistrerEchec('a', 0)
  l.enregistrerEchec('a', 0)
  assert.ok(l.bloque('a', 0))
  assert.ok(!l.bloque('b', 0))
})
test('les anciens échecs sortent de la fenêtre : l’origine est libérée', () => {
  const l = new LimiteurEchecs(2, 60_000)
  l.enregistrerEchec('a', 0)
  l.enregistrerEchec('a', 10_000)
  assert.ok(l.bloque('a', 20_000))
  assert.ok(!l.bloque('a', 65_000)) // le premier est sorti, il n'en reste qu'un
  assert.ok(!l.bloque('a', 120_000))
})
test('un succès efface l’ardoise', () => {
  const l = new LimiteurEchecs(2, 60_000)
  l.enregistrerEchec('a', 0)
  l.enregistrerEchec('a', 0)
  l.oublier('a')
  assert.ok(!l.bloque('a', 0))
})

console.log(`\n${passed} reussis, ${failed} echoues`)
if (failed > 0) process.exit(1)
