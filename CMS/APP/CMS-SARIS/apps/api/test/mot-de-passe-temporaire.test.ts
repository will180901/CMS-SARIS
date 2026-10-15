/**
 * Tests unitaires du mot de passe TEMPORAIRE (logique pure, sans base) : le générateur satisfait
 * toujours la politique, n'utilise que du hasard cryptographique, et la liste des routes permises à
 * un compte qui doit d'abord choisir son mot de passe est exactement celle qu'on croit.
 *   pnpm --filter api exec tsx test/mot-de-passe-temporaire.test.ts
 */
import assert from 'node:assert/strict'
import {
  genererMotDePasseTemporaire,
  respectePolitique,
  routePermiseAvecMotDePasseTemporaire,
  type PolitiqueMotDePasse,
} from '../src/modules/security/mot-de-passe-temporaire'

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

const TOUT: PolitiqueMotDePasse = {
  longueurMin: 12,
  exigerMajuscule: true,
  exigerMinuscule: true,
  exigerChiffre: true,
  exigerSpecial: true,
}

console.log('générateur')
test('respecte TOUJOURS la politique, quelle que soit sa combinaison et sa longueur', () => {
  for (const longueurMin of [0, 1, 6, 8, 10, 12, 14, 15, 16, 20, 25, 40, 64])
    for (let masque = 0; masque < 16; masque++) {
      const politique: PolitiqueMotDePasse = {
        longueurMin,
        exigerMajuscule: !!(masque & 1),
        exigerMinuscule: !!(masque & 2),
        exigerChiffre: !!(masque & 4),
        exigerSpecial: !!(masque & 8),
      }
      for (let i = 0; i < 60; i++) {
        const mdp = genererMotDePasseTemporaire(politique)
        assert.ok(
          respectePolitique(mdp, politique),
          `« ${mdp} » ne respecte pas ${JSON.stringify(politique)}`,
        )
      }
    }
})
test('toujours une majuscule, une minuscule, un chiffre et un tiret, même quand la politique n’exige rien', () => {
  for (let i = 0; i < 500; i++) {
    const mdp = genererMotDePasseTemporaire({ longueurMin: 0 })
    assert.ok(
      /[A-Z]/.test(mdp) &&
        /[a-z]/.test(mdp) &&
        /\d/.test(mdp) &&
        mdp.includes('-'),
      mdp,
    )
  }
})
test('forme « Xk7m-Qp3d-Wn9t » : groupes de quatre, séparés par un tiret, trois groupes au moins', () => {
  for (let i = 0; i < 300; i++)
    assert.match(
      genererMotDePasseTemporaire({ longueurMin: 0 }),
      /^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){2,}$/,
    )
})
test('ni I, O, l, o, 0 ni 1 : le mot de passe se recopie à la main sans se tromper', () => {
  for (let i = 0; i < 2000; i++)
    assert.doesNotMatch(
      genererMotDePasseTemporaire(TOUT).replace(/-/g, ''),
      /[IOlo01]/,
    )
})
test('la longueur minimale est atteinte avec le moins de groupes possible', () => {
  assert.equal(genererMotDePasseTemporaire({ longueurMin: 0 }).length, 14)
  assert.equal(genererMotDePasseTemporaire({ longueurMin: 14 }).length, 14)
  assert.equal(genererMotDePasseTemporaire({ longueurMin: 15 }).length, 19)
  assert.equal(genererMotDePasseTemporaire({ longueurMin: 19 }).length, 19)
  assert.equal(genererMotDePasseTemporaire({ longueurMin: 20 }).length, 24)
})
test('une longueur démesurée est plafonnée (l’API refuse plus de 200 caractères)', () => {
  assert.ok(genererMotDePasseTemporaire({ longueurMin: 10_000 }).length <= 64)
  assert.ok(
    genererMotDePasseTemporaire({ longueurMin: Number.NaN }).length >= 14,
  )
  assert.ok(genererMotDePasseTemporaire({ longueurMin: -5 }).length >= 14)
})
test('deux mots de passe ne se ressemblent pas : mille tirages, mille valeurs différentes', () => {
  const vus = new Set<string>()
  for (let i = 0; i < 1000; i++) vus.add(genererMotDePasseTemporaire(TOUT))
  assert.equal(vus.size, 1000)
})
test('le hasard est cryptographique : jamais Math.random', () => {
  const vrai = Math.random
  Math.random = () => {
    throw new Error('Math.random utilisé')
  }
  try {
    for (let i = 0; i < 50; i++) genererMotDePasseTemporaire(TOUT)
  } finally {
    Math.random = vrai
  }
})
test('termine et reste valide avec un générateur dégénéré (toujours le même nombre)', () => {
  for (const fixe of [0, 1])
    for (const min of [0, 14, 30]) {
      const mdp = genererMotDePasseTemporaire({ longueurMin: min }, (n) =>
        Math.min(fixe, n - 1),
      )
      assert.ok(respectePolitique(mdp, { ...TOUT, longueurMin: min }), mdp)
    }
})
test('le générateur injectable est bien celui qui est utilisé', () => {
  const a = genererMotDePasseTemporaire({ longueurMin: 0 }, () => 0)
  const b = genererMotDePasseTemporaire({ longueurMin: 0 }, () => 0)
  assert.equal(a, b)
  assert.notEqual(
    a,
    genererMotDePasseTemporaire({ longueurMin: 0 }, () => 1),
  )
})

console.log('respectePolitique')
test('refuse ce qui ne respecte pas chaque règle', () => {
  assert.equal(
    respectePolitique('abcDEF123-', { ...TOUT, longueurMin: 11 }),
    false,
  )
  assert.equal(respectePolitique('abcdef123-xyz', TOUT), false) // pas de majuscule
  assert.equal(respectePolitique('ABCDEF123-XYZ', TOUT), false) // pas de minuscule
  assert.equal(respectePolitique('abcDEFghi-xyz', TOUT), false) // pas de chiffre
  assert.equal(respectePolitique('abcDEF123xyzK', TOUT), false) // pas de spécial
  assert.equal(respectePolitique('abcDEF123-xyz', TOUT), true)
})

console.log('routes permises avec un mot de passe temporaire')
test('remplacer son mot de passe, lire sa session, se déconnecter', () => {
  assert.equal(
    routePermiseAvecMotDePasseTemporaire('POST', '/auth/change-password'),
    true,
  )
  assert.equal(
    routePermiseAvecMotDePasseTemporaire('POST', '/auth/logout'),
    true,
  )
  assert.equal(routePermiseAvecMotDePasseTemporaire('GET', '/auth/me'), true)
})
test('rien d’autre : ni les données, ni le profil, ni les préférences, ni l’administration', () => {
  for (const [m, u] of [
    ['GET', '/patients'],
    ['GET', '/me/profil'],
    ['GET', '/me/preferences'],
    ['PATCH', '/me/profil'],
    ['POST', '/me/totp/disable'],
    ['GET', '/admin/utilisateurs'],
    ['POST', '/admin/utilisateurs/x/reset-password'],
    ['GET', '/sync/pull'],
    ['GET', '/notifications'],
    ['GET', '/systeme/mode'],
  ] as const)
    assert.equal(routePermiseAvecMotDePasseTemporaire(m, u), false, `${m} ${u}`)
})
test('la méthode compte : lire le changement de mot de passe ou envoyer une déconnexion à /auth/me ne passe pas', () => {
  assert.equal(
    routePermiseAvecMotDePasseTemporaire('GET', '/auth/change-password'),
    false,
  )
  assert.equal(
    routePermiseAvecMotDePasseTemporaire('DELETE', '/auth/change-password'),
    false,
  )
  assert.equal(routePermiseAvecMotDePasseTemporaire('POST', '/auth/me'), false)
  assert.equal(
    routePermiseAvecMotDePasseTemporaire('GET', '/auth/logout'),
    false,
  )
})
test('la casse de la méthode, la requête, la barre finale ne changent rien — mais un autre chemin ne passe pas', () => {
  assert.equal(
    routePermiseAvecMotDePasseTemporaire('post', '/auth/change-password'),
    true,
  )
  assert.equal(
    routePermiseAvecMotDePasseTemporaire('GET', '/auth/me?x=1'),
    true,
  )
  assert.equal(routePermiseAvecMotDePasseTemporaire('GET', '/auth/me/'), true)
  assert.equal(routePermiseAvecMotDePasseTemporaire('GET', '/AUTH/ME'), true)
  assert.equal(
    routePermiseAvecMotDePasseTemporaire('GET', '/auth/me/extra'),
    false,
  )
  assert.equal(routePermiseAvecMotDePasseTemporaire('GET', '/x/auth/me'), false)
  assert.equal(
    routePermiseAvecMotDePasseTemporaire('GET', '/patients?next=/auth/me'),
    false,
  )
  assert.equal(routePermiseAvecMotDePasseTemporaire('GET', ''), false)
})

console.log('\n' + passed + ' reussis, ' + failed + ' echoues')
if (failed > 0) process.exit(1)
