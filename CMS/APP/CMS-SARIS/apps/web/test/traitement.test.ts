/**
 * Fin d'un traitement : « 5 jours » prescrits le 16 octobre se terminent le 20, pas le 21.
 *   pnpm --filter web exec tsx test/traitement.test.ts
 */
import assert from 'node:assert/strict'
import { dernierJourDeTraitement, etatTraitement, finDeTraitement } from '../src/lib/traitement'

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

/** « jj/mm » du jour local d'une date — sans dépendre de la langue ni du fuseau de la machine. */
const jm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
const prescrit = new Date(2026, 9, 16, 13, 0, 0) // 16 octobre 2026, 13 h (heure locale)

console.log('finDeTraitement (l’instant où la durée est écoulée)')
test('5 jours à partir du 16 : la durée est écoulée le 21 à la même heure', () => {
  assert.equal(jm(finDeTraitement(prescrit, '5 jours')!), '21/10')
})

console.log('dernierJourDeTraitement (la date à afficher)')
test('5 jours à partir du 16 octobre → dernier jour : le 20 (16, 17, 18, 19, 20)', () => {
  assert.equal(jm(dernierJourDeTraitement(finDeTraitement(prescrit, '5 jours')!)), '20/10')
})
test('1 jour : le traitement du 16 se termine le 16', () => {
  assert.equal(jm(dernierJourDeTraitement(finDeTraitement(prescrit, '1 jour')!)), '16/10')
})
test('2 semaines à partir du 16 → le 29', () => {
  assert.equal(jm(dernierJourDeTraitement(finDeTraitement(prescrit, '2 semaines')!)), '29/10')
})
test('1 mois à partir du 16 octobre → le 15 novembre', () => {
  assert.equal(jm(dernierJourDeTraitement(finDeTraitement(prescrit, '1 mois')!)), '15/11')
})
test('passage de mois et d’année : 10 jours à partir du 26 décembre → le 4 janvier', () => {
  assert.equal(jm(dernierJourDeTraitement(finDeTraitement(new Date(2026, 11, 26, 9, 0, 0), '10 jours')!)), '04/01')
})
test('accepte une date ISO (texte) comme l’API la rend', () => {
  assert.equal(jm(dernierJourDeTraitement(new Date(2026, 9, 21, 13, 0, 0).toISOString())), '20/10')
})

console.log('l’état (en cours / terminé) reste décidé sur l’instant d’échéance, pas sur la date affichée')
test('le 20 en fin de journée le traitement de 5 jours est encore en cours ; le 22 il est terminé', () => {
  const ligne = { duree: '5 jours' }
  assert.equal(etatTraitement(ligne, prescrit.toISOString(), new Date(2026, 9, 20, 23, 0, 0).getTime()).etat, 'EN_COURS')
  assert.equal(etatTraitement(ligne, prescrit.toISOString(), new Date(2026, 9, 22, 8, 0, 0).getTime()).etat, 'TERMINE')
})

console.log('\n' + passed + ' reussis, ' + failed + ' echoues')
if (failed > 0) process.exit(1)
