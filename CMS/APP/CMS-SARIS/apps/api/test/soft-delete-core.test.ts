/**
 * Tests unitaires de la logique PURE de soft-delete (offline-first).
 *   pnpm --filter @cms-saris/db exec tsx <chemin>/apps/api/test/soft-delete-core.test.ts
 */
import assert from 'node:assert/strict'
import {
  isSoftDeletable,
  toSoftDeleteUpdate,
  addNotDeletedFilter,
  delegateName,
} from '../src/prisma/soft-delete-core'

let passed = 0
let failed = 0
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log('  ✓ ' + name) }
  catch (e) { failed++; console.error('  ✗ ' + name + '\n     ' + (e as Error).message) }
}

const allow = new Set<string>(['Patient', 'Consultation'])
const NOW = new Date('2026-06-07T10:00:00.000Z')

console.log('isSoftDeletable')
test('modèle dans l\'allow-list', () => assert.equal(isSoftDeletable('Patient', allow), true))
test('modèle hors allow-list', () => assert.equal(isSoftDeletable('JournalAudit', allow), false))
test('modèle undefined', () => assert.equal(isSoftDeletable(undefined, allow), false))

console.log('toSoftDeleteUpdate')
test('delete -> update {deletedAt}', () => {
  assert.deepEqual(toSoftDeleteUpdate({ where: { id: 'x' } }, NOW), { where: { id: 'x' }, data: { deletedAt: NOW } })
})
test('deleteMany sans where -> update data', () => {
  assert.deepEqual(toSoftDeleteUpdate({}, NOW), { data: { deletedAt: NOW } })
})

console.log('addNotDeletedFilter')
test('ajoute deletedAt: null par défaut', () => {
  assert.deepEqual(addNotDeletedFilter({ where: { siteId: 's' } }), { where: { siteId: 's', deletedAt: null } })
})
test('args undefined -> where deletedAt null', () => {
  assert.deepEqual(addNotDeletedFilter(undefined), { where: { deletedAt: null } })
})
test('respecte un filtre deletedAt explicite (synchro tombstones)', () => {
  const a = { where: { deletedAt: { not: null } } }
  assert.deepEqual(addNotDeletedFilter(a), a)
})
test('préserve les autres clés (orderBy, take)', () => {
  const a = { where: { x: 1 }, orderBy: { updatedAt: 'asc' }, take: 10 } as Record<string, unknown>
  const r = addNotDeletedFilter(a) as Record<string, unknown>
  assert.deepEqual(r.orderBy, { updatedAt: 'asc' })
  assert.equal(r.take, 10)
})

console.log('delegateName')
test('PascalCase -> camelCase', () => {
  assert.equal(delegateName('Patient'), 'patient')
  assert.equal(delegateName('MessageReaction'), 'messageReaction')
})

console.log('\n' + passed + ' reussis, ' + failed + ' echoues')
if (failed > 0) process.exit(1)
