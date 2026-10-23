/**
 * Quand la bulle de synchronisation se montre (cf. src/lib/bulleSynchro.ts).
 *   pnpm --filter web exec tsx test/bulle-synchro.test.ts
 */
import assert from 'node:assert/strict'
import { bulleVoulue, lisser, LISSAGE_INITIAL, type Bulle, type EtatSynchro } from '../src/lib/bulleSynchro'

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

const calme: EtatSynchro = { enCours: false, pendingPush: false, suspendu: false, resync: false }

console.log('bulleVoulue')
test('connecté au central : un cycle de fond ou une file qui se remplit ne montrent rien', () => {
  assert.equal(bulleVoulue({ ...calme, enCours: true }, true), null)
  assert.equal(bulleVoulue({ ...calme, pendingPush: true }, true), null)
  assert.equal(bulleVoulue({ ...calme, enCours: true, pendingPush: true }, true), null)
})
test('sur le service local : « en cours » puis « en attente », dans cet ordre de priorité', () => {
  assert.equal(bulleVoulue({ ...calme, enCours: true }, false), 'enCours')
  assert.equal(bulleVoulue({ ...calme, pendingPush: true }, false), 'enAttente')
  assert.equal(bulleVoulue({ ...calme, enCours: true, pendingPush: true }, false), 'enCours')
  assert.equal(bulleVoulue(calme, false), null)
})
test('les ordres d’un administrateur sont toujours montrés, connecté ou non', () => {
  for (const central of [true, false]) {
    assert.equal(bulleVoulue({ ...calme, suspendu: true }, central), 'suspendue')
    assert.equal(bulleVoulue({ ...calme, resync: true }, central), 'resync')
    assert.equal(bulleVoulue({ ...calme, suspendu: true, resync: true, enCours: true }, central), 'suspendue')
  }
})
test('service local muet (état inconnu) : rien', () => {
  assert.equal(bulleVoulue(null, false), null)
})

console.log('lisser')
const suite = (voulues: (Bulle | null)[]): (Bulle | null)[] => {
  let s = LISSAGE_INITIAL
  return voulues.map((v) => (s = lisser(s, v)).affichee)
}
test('une lecture isolée n’affiche rien (un cycle de 1 s ne fait pas clignoter la bulle)', () => {
  assert.deepEqual(suite([null, 'enCours', null, null, null]), [null, null, null, null, null])
})
test('deux lectures de suite affichent la bulle ; elle ne disparaît qu’après trois lectures calmes', () => {
  assert.deepEqual(
    suite(['enCours', 'enCours', 'enCours', null, null, null, null]),
    [null, 'enCours', 'enCours', 'enCours', 'enCours', null, null],
  )
})
test('une bulle qui persiste ne disparaît pas sur une lecture calme isolée', () => {
  assert.deepEqual(suite(['enAttente', 'enAttente', null, 'enAttente', 'enAttente']), [null, 'enAttente', 'enAttente', 'enAttente', 'enAttente'])
})
test('le texte ne saute pas d’un état à l’autre à chaque lecture', () => {
  assert.deepEqual(
    suite(['enAttente', 'enAttente', 'enCours', 'enAttente', 'enCours', 'enCours']),
    [null, 'enAttente', 'enAttente', 'enAttente', 'enAttente', 'enCours'],
  )
})

console.log('\n' + passed + ' reussis, ' + failed + ' echoues')
if (failed > 0) process.exit(1)
