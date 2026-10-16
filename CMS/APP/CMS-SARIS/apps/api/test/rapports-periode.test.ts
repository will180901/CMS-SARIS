/**
 * Tests unitaires de la période d'un rapport — la règle pure, sans base : quand une période est
 * « partielle » (un mois entamé face au mois plein), donc non comparable à la précédente.
 *   pnpm --filter api exec tsx test/rapports-periode.test.ts
 */
import assert from 'node:assert/strict'
import { periodeEstPartielle } from '../src/modules/rapports/rapports-periode'

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

const d = (a: number, m: number, j: number) => new Date(a, m - 1, j)
/** Le mois précédent, de la même façon que le service : du 1er au 1er du mois courant. */
const avant = (debut: Date) => ({
  debut: new Date(debut.getFullYear(), debut.getMonth() - 1, 1),
  fin: new Date(debut),
})

console.log('periodeEstPartielle')
test('le mois en cours (du 1er à demain) face au mois plein : partielle', () => {
  const debut = d(2026, 10, 1)
  const fin = d(2026, 10, 17) // « demain » le 16
  assert.equal(periodeEstPartielle(debut, fin, avant(debut), d(2026, 10, 16)), true)
})

test('un mois entier écoulé face au mois plein : pas partielle', () => {
  const debut = d(2026, 9, 1)
  const fin = d(2026, 10, 1)
  assert.equal(periodeEstPartielle(debut, fin, avant(debut), d(2026, 10, 16)), false)
})

test('les longueurs de mois ne suffisent pas à la rendre partielle (février face à janvier)', () => {
  const debut = d(2027, 2, 1)
  const fin = d(2027, 3, 1) // 28 jours face à 31 : 90 %
  assert.equal(periodeEstPartielle(debut, fin, avant(debut), d(2027, 3, 5)), false)
  const debut2 = d(2027, 3, 1)
  const fin2 = d(2027, 4, 1) // 31 jours face à 28
  assert.equal(periodeEstPartielle(debut2, fin2, avant(debut2), d(2027, 4, 5)), false)
})

test('le dernier jour du mois, « demain » = le 1er : le mois est complet', () => {
  const debut = d(2026, 10, 1)
  const fin = d(2026, 11, 1) // « Générer maintenant » le 31 octobre
  assert.equal(periodeEstPartielle(debut, fin, avant(debut), d(2026, 10, 31)), false)
})

test('une fin lointaine dans le futur : la période court encore, même si elle a la bonne longueur', () => {
  const debut = d(2026, 10, 1)
  const fin = d(2026, 11, 1)
  assert.equal(periodeEstPartielle(debut, fin, avant(debut), d(2026, 10, 10)), true)
})

test('la fin posée à demain minuit n’est pas « en cours » à elle seule', () => {
  // Une semaine entière face à une semaine entière, fin = demain : on ne la déclare pas partielle.
  const debut = d(2026, 10, 10)
  const fin = d(2026, 10, 17)
  const prec = { debut: d(2026, 10, 3), fin: debut }
  assert.equal(periodeEstPartielle(debut, fin, prec, d(2026, 10, 16)), false)
})

test('une semaine face à une semaine : jamais partielle', () => {
  const debut = d(2026, 10, 5)
  const fin = d(2026, 10, 12)
  const prec = { debut: d(2026, 9, 28), fin: debut }
  assert.equal(periodeEstPartielle(debut, fin, prec, d(2026, 10, 16)), false)
})

test('seuil : 90 % de la période précédente n’est pas partielle, 80 % l’est', () => {
  const prec = { debut: d(2026, 1, 1), fin: d(2026, 1, 21) } // 20 jours
  assert.equal(periodeEstPartielle(d(2026, 1, 21), d(2026, 2, 8), prec, d(2026, 3, 1)), false) // 18 j : 90 %
  assert.equal(periodeEstPartielle(d(2026, 1, 21), d(2026, 2, 6), prec, d(2026, 3, 1)), true) // 16 j : 80 %
})

test('une période précédente vide de durée ne rend pas la courante partielle', () => {
  const prec = { debut: d(2026, 1, 1), fin: d(2026, 1, 1) }
  assert.equal(periodeEstPartielle(d(2026, 1, 1), d(2026, 2, 1), prec, d(2026, 3, 1)), false)
})

console.log('\n' + passed + ' reussis, ' + failed + ' echoues')
if (failed > 0) process.exit(1)
