/**
 * Tests unitaires de l'identifiant de connexion (logique pure, sans base) : sa forme, sa
 * normalisation en minuscules, la durée de réservation d'un identifiant libéré.
 *   pnpm --filter api exec tsx test/identifiant.test.ts
 */
import assert from 'node:assert/strict'
import {
  IDENTIFIANT_LONGUEUR_MAX,
  IDENTIFIANT_LONGUEUR_MIN,
  JOURS_RESERVATION,
  dateFrancaise,
  erreurIdentifiant,
  finDeReservation,
  normaliserIdentifiant,
} from '../src/modules/security/identifiant'

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

console.log('normaliserIdentifiant')
test('minuscules et sans espaces autour', () => {
  assert.equal(normaliserIdentifiant('  Moukanda '), 'moukanda')
  assert.equal(normaliserIdentifiant('ALICE.Martin'), 'alice.martin')
  assert.equal(normaliserIdentifiant('\tBob\n'), 'bob')
})
test('ne touche pas à l’intérieur : un espace au milieu reste (et sera refusé par la forme)', () => {
  assert.equal(normaliserIdentifiant('a b'), 'a b')
})
test('une saisie vide ou absente donne une chaîne vide, jamais une erreur', () => {
  assert.equal(normaliserIdentifiant(''), '')
  assert.equal(normaliserIdentifiant('   '), '')
  assert.equal(normaliserIdentifiant(undefined as unknown as string), '')
})
test('est idempotente', () => {
  const x = normaliserIdentifiant('  ÉLodie.K ')
  assert.equal(normaliserIdentifiant(x), x)
})

console.log('erreurIdentifiant')
test('accepte les identifiants valables', () => {
  for (const ok of ['abc', 'moukanda', 'a.b-c_d', 'agent01', 'x'.repeat(IDENTIFIANT_LONGUEUR_MAX), 'a1b']) {
    assert.equal(erreurIdentifiant(ok), null, ok)
  }
})
test('refuse trop court ou trop long, avec les bornes dans le message', () => {
  for (const court of ['', 'a', 'ab']) {
    assert.match(erreurIdentifiant(court) ?? '', new RegExp(`${IDENTIFIANT_LONGUEUR_MIN} à ${IDENTIFIANT_LONGUEUR_MAX}`), court)
  }
  assert.ok(erreurIdentifiant('x'.repeat(IDENTIFIANT_LONGUEUR_MAX + 1)))
})
test('la longueur exacte des bornes passe', () => {
  assert.equal(erreurIdentifiant('x'.repeat(IDENTIFIANT_LONGUEUR_MIN)), null)
  assert.equal(erreurIdentifiant('x'.repeat(IDENTIFIANT_LONGUEUR_MAX)), null)
})
test('doit commencer par une lettre', () => {
  for (const mauvais of ['1abc', '.abc', '-abc', '_abc']) {
    assert.ok(erreurIdentifiant(mauvais), mauvais)
  }
})
test('refuse espaces, accents, majuscules et symboles', () => {
  for (const mauvais of ['a b c', 'élodie', 'abC', 'a@b', 'a/b', 'a+b', 'a,b', "a'b", 'a\tb', 'abc!']) {
    assert.ok(erreurIdentifiant(mauvais), mauvais)
  }
})
test('une saisie NON normalisée est refusée : la normalisation se fait avant, pas ici', () => {
  assert.ok(erreurIdentifiant('Moukanda'))
})

console.log('réservation d’un identifiant libéré')
test('90 jours', () => {
  assert.equal(JOURS_RESERVATION, 90)
})
test('la fin de réservation est 90 jours après la libération', () => {
  const debut = new Date('2026-10-16T10:00:00.000Z')
  const fin = finDeReservation(debut)
  assert.equal(fin.toISOString(), '2027-01-14T10:00:00.000Z')
  assert.equal((+fin - +debut) / 86_400_000, 90)
})
test('ne modifie pas la date reçue', () => {
  const debut = new Date('2026-10-16T10:00:00.000Z')
  finDeReservation(debut)
  assert.equal(debut.toISOString(), '2026-10-16T10:00:00.000Z')
})
test('la date se dit en français, en toutes lettres', () => {
  assert.match(dateFrancaise(new Date('2027-01-14T10:00:00.000Z')), /^14 janvier 2027$/)
})

console.log('\n' + passed + ' reussis, ' + failed + ' echoues')
if (failed > 0) process.exit(1)
