/**
 * Un nombre dans un texte du serveur : « 1 234 », « 54 502 » (espace insécable ordinaire entre les milliers).
 *   pnpm --filter api exec tsx test/nombre.test.ts
 */
import assert from 'node:assert/strict'
import { nombreFr } from '../src/common/nombre'

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

const NBSP = ' '

test('rien à séparer sous 1 000', () => {
  assert.equal(nombreFr(0), '0')
  assert.equal(nombreFr(7), '7')
  assert.equal(nombreFr(999), '999')
})
test('une espace insécable ORDINAIRE entre les milliers (pas l’espace fine d’Intl)', () => {
  assert.equal(nombreFr(1000), `1${NBSP}000`)
  assert.equal(nombreFr(54502), `54${NBSP}502`)
  assert.equal(nombreFr(1234567), `1${NBSP}234${NBSP}567`)
  assert.ok(!nombreFr(54502).includes(' '))
})
test('arrondi à l’entier (les Mo sont des quotients)', () => {
  assert.equal(nombreFr(349.6), '350')
  assert.equal(nombreFr(1499.4), `1${NBSP}499`)
  assert.equal(nombreFr(0.4), '0')
})
test('un nombre négatif garde son signe', () => {
  assert.equal(nombreFr(-12345), `-12${NBSP}345`)
  assert.equal(nombreFr(-5), '-5')
})

console.log('\n' + passed + ' reussis, ' + failed + ' echoues')
if (failed > 0) process.exit(1)
