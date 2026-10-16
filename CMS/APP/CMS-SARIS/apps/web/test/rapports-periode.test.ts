/**
 * Tests de l'affichage de la période d'un rapport : la borne de fin est exclusive (le 1er du mois
 * suivant, ou « demain »), l'écran doit montrer le DERNIER JOUR COUVERT — dans le fuseau de la
 * personne, qui n'est pas forcément celui du serveur.
 *   pnpm --filter web exec tsx test/rapports-periode.test.ts
 */
import assert from 'node:assert/strict'
import { dernierJourCouvert } from '../src/modules/rapports/lib/periode'

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

/** Le jour (AAAA-MM-JJ) que la personne lit à l'écran, dans SON fuseau. */
function jourAffiche(iso: string, fuseau: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: fuseau })
}

// Un minuit du SERVEUR : à Brazzaville (UTC+1) ou sur Render (UTC).
const MINUIT_1ER_OCTOBRE = {
  'serveur UTC': '2026-10-01T00:00:00.000Z',
  'serveur Brazzaville (UTC+1)': '2026-09-30T23:00:00.000Z',
}
const FUSEAUX = ['UTC', 'Africa/Brazzaville', 'America/New_York', 'Asia/Tokyo']

console.log('dernierJourCouvert')
for (const [serveur, borne] of Object.entries(MINUIT_1ER_OCTOBRE)) {
  for (const fuseau of FUSEAUX) {
    test(`mois de septembre, ${serveur}, lu à ${fuseau} : se termine le 30 septembre`, () => {
      assert.equal(jourAffiche(dernierJourCouvert(borne), fuseau), '2026-09-30')
    })
  }
}

test('« Générer maintenant » le 16 : la fin posée à demain (17) s’affiche le 16', () => {
  assert.equal(jourAffiche(dernierJourCouvert('2026-10-16T23:00:00.000Z'), 'Africa/Brazzaville'), '2026-10-16')
  assert.equal(jourAffiche(dernierJourCouvert('2026-10-17T00:00:00.000Z'), 'UTC'), '2026-10-16')
})

test('un jour de plus sur la borne : le jour affiché avance d’un jour', () => {
  assert.equal(jourAffiche(dernierJourCouvert('2026-11-01T00:00:00.000Z'), 'UTC'), '2026-10-31')
})

test('année : le 1er janvier suivant se lit le 31 décembre', () => {
  assert.equal(jourAffiche(dernierJourCouvert('2027-01-01T00:00:00.000Z'), 'UTC'), '2026-12-31')
})

console.log('\n' + passed + ' reussis, ' + failed + ' echoues')
if (failed > 0) process.exit(1)
