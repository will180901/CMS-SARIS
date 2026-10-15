/**
 * Tests unitaires du cache du drapeau « mot de passe temporaire » (base factice, aucune connexion) :
 * il est lu à CHAQUE requête authentifiée, donc mis en cache quelques secondes — mais jamais au point
 * de faire attendre une personne qui vient de choisir son mot de passe.
 *   pnpm --filter api exec tsx test/mot-de-passe-temporaire-cache.test.ts
 */
import assert from 'node:assert/strict'
import { MotDePasseTemporaireService } from '../src/modules/security/mot-de-passe-temporaire.service'
import type { PrismaService } from '../src/prisma/prisma.service'

let passed = 0
let failed = 0
const attentes: Promise<void>[] = []
function test(name: string, fn: () => Promise<void>): void {
  const run = async () => {
    try {
      await fn()
      passed++
      console.log('  ✓ ' + name)
    } catch (e) {
      failed++
      console.error('  ✗ ' + name + '\n     ' + (e as Error).message)
    }
  }
  attentes.push(
    attentes.length ? attentes[attentes.length - 1]!.then(run) : run(),
  )
}

/** Une base factice : compte les lectures, et rend la valeur qu'on lui dit. */
function serviceAvecBase(valeur: { motDePasseTemp: boolean } | null) {
  const base = { lectures: 0, valeur }
  const prisma = {
    utilisateur: {
      findUnique: () => {
        base.lectures++
        return Promise.resolve(base.valeur)
      },
    },
  } as unknown as PrismaService
  return { service: new MotDePasseTemporaireService(prisma), base }
}

test('lit la base une fois, puis répond depuis le cache', async () => {
  const { service, base } = serviceAvecBase({ motDePasseTemp: true })
  assert.equal(await service.doitChanger('u1'), true)
  assert.equal(await service.doitChanger('u1'), true)
  assert.equal(await service.doitChanger('u1'), true)
  assert.equal(base.lectures, 1)
})

test('un autre compte a sa propre entrée', async () => {
  const { service, base } = serviceAvecBase({ motDePasseTemp: true })
  await service.doitChanger('u1')
  await service.doitChanger('u2')
  assert.equal(base.lectures, 2)
})

test('invalider force la relecture : le drapeau levé se voit tout de suite', async () => {
  const { service, base } = serviceAvecBase({ motDePasseTemp: true })
  assert.equal(await service.doitChanger('u1'), true)
  base.valeur = { motDePasseTemp: false }
  assert.equal(await service.doitChanger('u1'), true) // encore en cache
  service.invalider('u1')
  assert.equal(await service.doitChanger('u1'), false)
  assert.equal(base.lectures, 2)
})

test('invalider un compte ne touche pas aux autres', async () => {
  const { service, base } = serviceAvecBase({ motDePasseTemp: true })
  await service.doitChanger('u1')
  await service.doitChanger('u2')
  service.invalider('u1')
  await service.doitChanger('u2')
  assert.equal(base.lectures, 2)
})

test('une entrée expire : après le délai, la base est relue', async () => {
  const { service, base } = serviceAvecBase({ motDePasseTemp: true })
  const vrai = Date.now
  try {
    let t = 1_000_000
    Date.now = () => t
    await service.doitChanger('u1')
    t += 19_000
    await service.doitChanger('u1')
    assert.equal(base.lectures, 1)
    t += 2_000
    base.valeur = { motDePasseTemp: false }
    assert.equal(await service.doitChanger('u1'), false)
    assert.equal(base.lectures, 2)
  } finally {
    Date.now = vrai
  }
})

test('un compte introuvable ou sans drapeau n’est pas sous contrainte', async () => {
  assert.equal(await serviceAvecBase(null).service.doitChanger('x'), false)
  assert.equal(
    await serviceAvecBase({ motDePasseTemp: false }).service.doitChanger('x'),
    false,
  )
})

void Promise.all(attentes).then(() => {
  console.log('\n' + passed + ' reussis, ' + failed + ' echoues')
  if (failed > 0) process.exit(1)
})
