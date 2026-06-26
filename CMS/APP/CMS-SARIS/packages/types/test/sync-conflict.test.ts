/**
 * Tests unitaires de la logique de résolution de conflit (sync offline-first).
 * Exécuté par tsx (hors typecheck du paquet) :
 *   pnpm exec tsx packages/types/test/sync-conflict.test.ts
 */
import assert from 'node:assert/strict'
import {
  resolveConflict,
  mergeTombstone,
  diffFields,
  isTombstone,
} from '../src/sync-conflict.ts'

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

const T1 = '2026-06-01T10:00:00.000Z' // ancien
const T2 = '2026-06-01T11:00:00.000Z' // moyen
const T3 = '2026-06-01T12:00:00.000Z' // récent

console.log('resolveConflict')
test('existant null -> apply', () => {
  assert.deepEqual(resolveConflict({ updatedAt: T2 }, null), { kind: 'apply' })
})
test('entrant plus recent, sans base -> apply (LWW)', () => {
  assert.deepEqual(resolveConflict({ updatedAt: T3 }, { updatedAt: T1 }), { kind: 'apply' })
})
test('entrant plus ancien, sans base -> skip (LWW)', () => {
  assert.deepEqual(resolveConflict({ updatedAt: T1 }, { updatedAt: T3 }), { kind: 'skip' })
})
test('horodatages egaux -> skip (idempotent)', () => {
  assert.deepEqual(resolveConflict({ updatedAt: T2 }, { updatedAt: T2 }), { kind: 'skip' })
})
test('entrant recent + serveur a bouge depuis la base -> conflit (winner incoming)', () => {
  // client edite depuis T1 ; serveur est a T2 ; edition client horodatee T3
  assert.deepEqual(
    resolveConflict({ updatedAt: T3, baseUpdatedAt: T1 }, { updatedAt: T2 }),
    { kind: 'conflict', winner: 'incoming' },
  )
})
test('entrant ancien + serveur a bouge depuis la base -> conflit (winner existing)', () => {
  // client edite depuis T1 (horodatage T2 mettons) ; serveur deja a T3
  assert.deepEqual(
    resolveConflict({ updatedAt: T2, baseUpdatedAt: T1 }, { updatedAt: T3 }),
    { kind: 'conflict', winner: 'existing' },
  )
})
test('entrant recent + base == existant (serveur inchange) -> apply (pas de conflit)', () => {
  assert.deepEqual(
    resolveConflict({ updatedAt: T3, baseUpdatedAt: T2 }, { updatedAt: T2 }),
    { kind: 'apply' },
  )
})
test('entrant ancien + base == existant -> skip', () => {
  assert.deepEqual(
    resolveConflict({ updatedAt: T1, baseUpdatedAt: T2 }, { updatedAt: T2 }),
    { kind: 'skip' },
  )
})
test('dates invalides -> traitees comme epoch, pas de crash', () => {
  const r = resolveConflict({ updatedAt: 'pas-une-date' }, { updatedAt: 'invalide' })
  assert.deepEqual(r, { kind: 'skip' }) // 0 == 0 -> skip
})

console.log('mergeTombstone (suppressions)')
test('suppression plus recente l\'emporte sur edition (apply)', () => {
  // entrant = tombstone horodate T3 ; existant vivant T2
  assert.deepEqual(
    mergeTombstone({ updatedAt: T3, deletedAt: T3 }, { updatedAt: T2 }),
    { kind: 'apply' },
  )
})
test('edition plus recente l\'emporte sur suppression existante (apply)', () => {
  // entrant vivant T3 ; existant tombstone T2 -> LWW: edition recente gagne
  assert.deepEqual(
    mergeTombstone({ updatedAt: T3 }, { updatedAt: T2, deletedAt: T2 }),
    { kind: 'apply' },
  )
})
test('suppression plus ancienne que edition existante -> skip', () => {
  assert.deepEqual(
    mergeTombstone({ updatedAt: T1, deletedAt: T1 }, { updatedAt: T3 }),
    { kind: 'skip' },
  )
})

console.log('diffFields')
test('champs disjoints', () => {
  assert.deepEqual(diffFields({ nom: 'A', age: 1 }, { nom: 'A', age: 2 }), ['age'])
})
test('plusieurs champs differents (tries)', () => {
  assert.deepEqual(diffFields({ b: 1, a: 1 }, { b: 2, a: 2 }), ['a', 'b'])
})
test('identiques -> []', () => {
  assert.deepEqual(diffFields({ x: 1 }, { x: 1 }), [])
})
test('ignore updatedAt/createdAt/deletedAt par defaut', () => {
  assert.deepEqual(diffFields({ updatedAt: T1, createdAt: T1, deletedAt: null, v: 1 }, { updatedAt: T3, createdAt: T2, deletedAt: T3, v: 1 }), [])
})

console.log('isTombstone')
test('tombstone vrai/faux', () => {
  assert.equal(isTombstone({ updatedAt: T1, deletedAt: T1 }), true)
  assert.equal(isTombstone({ updatedAt: T1 }), false)
  assert.equal(isTombstone({ updatedAt: T1, deletedAt: null }), false)
})

console.log('\n' + passed + ' reussis, ' + failed + ' echoues')
if (failed > 0) process.exit(1)
