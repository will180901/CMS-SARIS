/**
 * Tests unitaires du mode du système (production / test) — les règles pures, sans base :
 * le verrou de configuration (qui doit échouer du bon côté) et ce que « le mode effectif » veut dire.
 *   pnpm --filter api exec tsx test/mode-systeme.test.ts
 */
import assert from 'node:assert/strict'
import {
  modeTestVerrouille,
  modeEnregistre,
  modeEffectif,
  CLE_MODE,
} from '../src/modules/systeme/mode-systeme'

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

console.log('modeTestVerrouille (variable MODE_TEST_AUTORISE)')
test('absente ou vide : autorisé (comportement par défaut)', () => {
  for (const v of [undefined, '', '   '])
    assert.equal(modeTestVerrouille(v), false)
})
test('« true » et ses équivalents : autorisé, casse et espaces indifférents', () => {
  for (const v of ['true', 'TRUE', ' True ', '1', 'oui', 'yes', 'on'])
    assert.equal(modeTestVerrouille(v), false, v)
})
test('« false » et ses équivalents : verrouillé', () => {
  for (const v of ['false', 'FALSE', ' False ', '0', 'non', 'no', 'off'])
    assert.equal(modeTestVerrouille(v), true, v)
})
test('TOUTE autre valeur verrouille — une faute de frappe n’ouvre pas le verrou', () => {
  for (const v of [
    'flase',
    'fasle',
    'fals',
    'verrouille',
    'x',
    'null',
    'undefined',
  ])
    assert.equal(modeTestVerrouille(v), true, v)
})

console.log('modeEnregistre')
test('seule la valeur « TEST » est le mode test', () => {
  assert.equal(modeEnregistre('TEST'), 'TEST')
})
test('tout le reste est « PRODUCTION » : absent, vide, autre casse, valeur inconnue', () => {
  for (const v of [
    'PRODUCTION',
    null,
    undefined,
    '',
    'test',
    'Test',
    'DEV',
    'true',
  ])
    assert.equal(modeEnregistre(v), 'PRODUCTION', String(v))
})

console.log('modeEffectif')
test('non verrouillé : le mode enregistré s’applique', () => {
  assert.equal(modeEffectif('TEST', false), 'TEST')
  assert.equal(modeEffectif('PRODUCTION', false), 'PRODUCTION')
  assert.equal(modeEffectif(null, false), 'PRODUCTION')
})
test('verrouillé : toujours PRODUCTION, même si la base dit « TEST »', () => {
  assert.equal(modeEffectif('TEST', true), 'PRODUCTION')
  assert.equal(modeEffectif('PRODUCTION', true), 'PRODUCTION')
  assert.equal(modeEffectif(undefined, true), 'PRODUCTION')
})

console.log('clé réservée')
test('la clé du mode est dans l’espace « systeme. » des paramètres', () => {
  assert.equal(CLE_MODE, 'systeme.mode')
})

console.log('\n' + passed + ' reussis, ' + failed + ' echoues')
if (failed > 0) process.exit(1)
