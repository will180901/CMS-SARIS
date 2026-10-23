/**
 * Les deux serveurs de l'application de bureau et le jeton de chacun (cf. src/lib/interlocuteur.ts).
 *   pnpm --filter web exec tsx test/interlocuteur.test.ts
 */
import assert from 'node:assert/strict'
import {
  basculerJetons,
  interlocuteurDeLUrl,
  interlocuteurPossible,
  type JetonsSession,
} from '../src/lib/interlocuteur'

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

const deuxJeux = (): JetonsSession => ({
  interlocuteur: 'central',
  token: 'C-acces',
  refreshToken: 'C-renouv',
  autres: { local: { token: 'L-acces', refreshToken: 'L-renouv' } },
})

console.log('basculerJetons')
test('passer sur le local : le jeu du local devient actif, celui du central attend à côté', () => {
  const s = basculerJetons(deuxJeux(), 'local')!
  assert.equal(s.interlocuteur, 'local')
  assert.equal(s.token, 'L-acces')
  assert.equal(s.refreshToken, 'L-renouv')
  assert.deepEqual(s.autres, { central: { token: 'C-acces', refreshToken: 'C-renouv' } })
})
test('et retour sur le central : rien ne s’est perdu ni mélangé', () => {
  const aller = basculerJetons(deuxJeux(), 'local')!
  const retour = basculerJetons(aller, 'central')!
  assert.deepEqual(retour, deuxJeux())
})
test('déjà sur la cible : rien ne change', () => {
  const s = deuxJeux()
  assert.equal(basculerJetons(s, 'central'), s)
})
test('pas de jeu pour la cible : on ne bascule pas (null), la session est intacte', () => {
  const s: JetonsSession = { interlocuteur: 'central', token: 'C-acces', refreshToken: 'C-renouv', autres: {} }
  assert.equal(basculerJetons(s, 'local'), null)
  assert.equal(s.token, 'C-acces')
})
test('le jeu renouvelé de l’actif suit : après un renouvellement, la bascule garde le DERNIER jeu', () => {
  const s = { ...deuxJeux(), token: 'C-acces-2', refreshToken: 'C-renouv-2' }
  const sur = basculerJetons(s, 'local')!
  assert.deepEqual(sur.autres.central, { token: 'C-acces-2', refreshToken: 'C-renouv-2' })
})

console.log('interlocuteurPossible')
test('pas de session : on parle à qui l’on veut (l’écran de connexion)', () => {
  const vide: JetonsSession = { interlocuteur: null, token: null, refreshToken: null, autres: {} }
  assert.equal(interlocuteurPossible('central', vide), 'central')
  assert.equal(interlocuteurPossible('local', vide), 'local')
})
test('session avec les deux jeux : on parle à qui l’on veut', () => {
  assert.equal(interlocuteurPossible('local', deuxJeux()), 'local')
  assert.equal(interlocuteurPossible('central', deuxJeux()), 'central')
})
test('session sans le jeu de la cible : on reste sur le serveur dont on a le jeton (jamais de 401 en boucle)', () => {
  const seulLocal: JetonsSession = { interlocuteur: 'local', token: 'L', refreshToken: 'Lr', autres: {} }
  assert.equal(interlocuteurPossible('central', seulLocal), 'local')
  const seulCentral: JetonsSession = { interlocuteur: 'central', token: 'C', refreshToken: 'Cr', autres: {} }
  assert.equal(interlocuteurPossible('local', seulCentral), 'central')
})

console.log('interlocuteurDeLUrl')
test('l’adresse du service local est « local », toute autre est « central »', () => {
  const locale = 'http://127.0.0.1:50955'
  assert.equal(interlocuteurDeLUrl('http://127.0.0.1:50955', locale), 'local')
  assert.equal(interlocuteurDeLUrl('http://127.0.0.1:50955/', locale), 'local')
  assert.equal(interlocuteurDeLUrl('https://cms-saris-api.onrender.com', locale), 'central')
})
test('sans service local (navigateur, mode distant) : toujours « central »', () => {
  assert.equal(interlocuteurDeLUrl('http://localhost:3000', undefined), 'central')
  assert.equal(interlocuteurDeLUrl('http://localhost:3000', ''), 'central')
})

console.log('\n' + passed + ' reussis, ' + failed + ' echoues')
if (failed > 0) process.exit(1)
