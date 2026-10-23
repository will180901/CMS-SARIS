/**
 * Avec qui l'écran parle-t-il (cf. electron/interlocuteur.ts) — logique pure, sans Electron ni réseau.
 *   pnpm --filter @cms-saris/desktop test
 */
import assert from 'node:assert/strict'
import { choisirInterlocuteur, type EtatReseau, type Interlocuteur } from '../electron/interlocuteur.ts'

let reussis = 0
let echoues = 0
function test(nom: string, fn: () => void): void {
  try {
    fn()
    reussis++
    console.log('  ✓ ' + nom)
  } catch (e) {
    echoues++
    console.error('  ✗ ' + nom + '\n     ' + (e as Error).message)
  }
}

console.log('choisirInterlocuteur')
test('connecté, rien à remonter : l’écran parle directement au serveur central', () => {
  assert.equal(choisirInterlocuteur({ actuel: 'local', enLigne: true, travailEnAttente: false }), 'central')
  assert.equal(choisirInterlocuteur({ actuel: 'central', enLigne: true, travailEnAttente: false }), 'central')
})
test('pas connecté : l’écran parle au service local, quoi qu’il en soit du reste', () => {
  for (const actuel of ['central', 'local'] as Interlocuteur[])
    for (const travailEnAttente of [true, false])
      assert.equal(choisirInterlocuteur({ actuel, enLigne: false, travailEnAttente }), 'local')
})
test('retour d’Internet avec du travail en attente : l’écran reste sur le local jusqu’à la fin de l’envoi', () => {
  assert.equal(choisirInterlocuteur({ actuel: 'local', enLigne: true, travailEnAttente: true }), 'local')
})
test('déjà sur le central et en ligne : on y reste, même si la file d’envoi se remplit un instant', () => {
  assert.equal(choisirInterlocuteur({ actuel: 'central', enLigne: true, travailEnAttente: true }), 'central')
})

console.log('scénario : une journée')
test('connecté → coupure → travail hors ligne → retour → envoi → retour sur le central', () => {
  let actuel: Interlocuteur = 'local'
  const etape = (e: Omit<EtatReseau, 'actuel'>): Interlocuteur => (actuel = choisirInterlocuteur({ actuel, ...e }))
  assert.equal(etape({ enLigne: true, travailEnAttente: false }), 'central', 'le matin, connecté')
  assert.equal(etape({ enLigne: false, travailEnAttente: false }), 'local', 'coupure : bascule immédiate')
  assert.equal(etape({ enLigne: false, travailEnAttente: true }), 'local', 'on saisit hors ligne')
  assert.equal(etape({ enLigne: true, travailEnAttente: true }), 'local', 'Internet revient, 40 lignes à envoyer')
  assert.equal(etape({ enLigne: true, travailEnAttente: true }), 'local', 'envoi en cours')
  assert.equal(etape({ enLigne: true, travailEnAttente: false }), 'central', 'tout est parti : retour sur le serveur')
  assert.equal(etape({ enLigne: true, travailEnAttente: true }), 'central', 'une écriture interne ne ramène pas sur le local')
})

console.log(`\n${reussis} reussis, ${echoues} echoues`)
if (echoues > 0) process.exit(1)
