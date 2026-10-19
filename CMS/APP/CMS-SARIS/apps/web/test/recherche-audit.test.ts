/**
 * Recherche dans le journal d'audit par ce que l'écran affiche : « création » → « création|CREATE ».
 *   pnpm --filter web exec tsx test/recherche-audit.test.ts
 */
import assert from 'node:assert/strict'
import i18n from '../src/i18n/config'
import { codesDeLOnglet, etendreRecherche, rechercheAudit } from '../src/lib/rechercheAudit'

let passed = 0
let failed = 0
let chaine: Promise<void> = Promise.resolve()
function test(name: string, fn: () => void | Promise<void>): void {
  chaine = chaine.then(async () => {
    try {
      await fn()
      passed++
      console.log('  ✓ ' + name)
    } catch (e) {
      failed++
      console.error('  ✗ ' + name + '\n     ' + (e as Error).message)
    }
  })
}

const CODES = [
  { code: 'CREATE', libelle: 'Création' },
  { code: 'UPDATE', libelle: 'Modification' },
  { code: 'LOGIN', libelle: 'Connexion' },
  { code: 'LOGIN_FAILED', libelle: 'Connexion échouée' },
  { code: "Bon d'examen", libelle: 'Bon d’examen' },
]

console.log('etendreRecherche')
test('un mot est élargi aux codes dont le libellé le contient (accents et casse ignorés)', () => {
  assert.equal(etendreRecherche('création', CODES), 'création|=CREATE')
  assert.equal(etendreRecherche('CREATION', CODES), 'CREATION|=CREATE')
  assert.equal(etendreRecherche('modif', CODES), 'modif|=UPDATE')
})
test('plusieurs codes pour un mot ; le mot tapé reste la première variante', () => {
  assert.equal(etendreRecherche('connexion', CODES), 'connexion|=LOGIN|=LOGIN_FAILED')
})
test('les mots restent séparés (ET côté serveur), chacun élargi pour son compte', () => {
  assert.equal(etendreRecherche('création moukanda', CODES), 'création|=CREATE moukanda')
})
test('une espace du code devient une espace insécable (l’espace sépare les mots)', () => {
  assert.equal(etendreRecherche('bon', CODES), 'bon|=Bon\u00a0d\'examen')
})
test('un mot d’une lettre n’est pas élargi ; un mot sans libellé correspondant reste tel quel', () => {
  assert.equal(etendreRecherche('c', CODES), 'c')
  assert.equal(etendreRecherche('zzz', CODES), 'zzz')
})
test('un mot qui EST déjà le code n’est pas répété', () => {
  const codes = [{ code: 'LOGIN', libelle: 'Login' }, { code: 'LOGIN_FAILED', libelle: 'Login échoué' }]
  // « login » EST le code LOGIN (casse près) : le serveur le trouve déjà ; seul le code voisin est ajouté
  assert.equal(etendreRecherche('login', codes), 'login|=LOGIN_FAILED')
})
test('au plus 6 codes ajoutés par mot', () => {
  const beaucoup = Array.from({ length: 20 }, (_, i) => ({ code: 'C' + i, libelle: 'Connexion ' + i }))
  assert.equal(etendreRecherche('connexion', beaucoup).split('|').length, 7)
})
test('saisie vide ou espaces', () => {
  assert.equal(etendreRecherche('   ', CODES), '')
})

console.log('rechercheAudit (avec les vrais libellés de l’application)')
test('français : « création » trouve le code CREATE ; « suppression » le code DELETE', async () => {
  await i18n.changeLanguage('fr')
  assert.ok(rechercheAudit('création', 'actions').split('|').includes('=CREATE'))
  assert.ok(rechercheAudit('suppression', 'actions').split('|').includes('=DELETE'))
})
test('anglais : « creation » ET « create » trouvent CREATE ; le libellé suit la langue', async () => {
  await i18n.changeLanguage('en')
  assert.ok(codesDeLOnglet('actions').find((c) => c.code === 'CREATE')?.libelle)
  assert.ok(rechercheAudit('creation', 'actions').split('|').includes('=CREATE'))
  await i18n.changeLanguage('fr')
})
test('onglet Authentifications : on cherche dans les résultats de connexion, pas dans les actions', async () => {
  await i18n.changeLanguage('fr')
  const codes = codesDeLOnglet('authentifications').map((c) => c.code)
  assert.ok(codes.some((c) => c.startsWith('ECHEC')), 'résultats de connexion absents')
  assert.ok(!codes.includes('CREATE'), 'une action ne doit pas se retrouver parmi les résultats de connexion')
})
test('un libellé d’entité du serveur (« Bon de pharmacie ») est retrouvé par son code', async () => {
  await i18n.changeLanguage('fr')
  assert.ok(rechercheAudit('pharmacie', 'actions').includes('=Bon\u00a0de\u00a0pharmacie'))
})

void chaine.then(() => {
  console.log('\n' + passed + ' reussis, ' + failed + ' echoues')
  if (failed > 0) process.exit(1)
})
