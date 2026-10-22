/**
 * L'intercepteur qui annonce au moteur de synchronisation d'un poste qu'une écriture vient d'avoir lieu.
 * Logique pure : un faux client, une fausse requête.
 *   pnpm --filter api exec tsx test/ecriture-locale.test.ts
 */
import assert from 'node:assert/strict'
import { of, lastValueFrom } from 'rxjs'
import type { CallHandler, ExecutionContext } from '@nestjs/common'
import { EcritureLocaleInterceptor } from '../src/modules/sync/ecriture-locale.interceptor'
import type { SyncClientService } from '../src/modules/sync/sync-client.service'

let passed = 0
let failed = 0
async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
    passed++
    console.log('  ✓ ' + name)
  } catch (e) {
    failed++
    console.error('  ✗ ' + name + '\n     ' + (e as Error).message)
  }
}

/** Joue une requête à travers l'intercepteur et dit combien de fois le moteur a été prévenu. */
async function annonces(enabled: boolean, methode: string, url: string): Promise<number> {
  let n = 0
  const client = { enabled, notifierEcritureLocale: () => { n++ } } as unknown as SyncClientService
  const contexte = {
    switchToHttp: () => ({ getRequest: () => ({ method: methode, originalUrl: url }) }),
  } as unknown as ExecutionContext
  const suite: CallHandler = { handle: () => of('ok') }
  await lastValueFrom(new EcritureLocaleInterceptor(client).intercept(contexte, suite))
  return n
}

async function main() {
  console.log('EcritureLocaleInterceptor')
  await test('une requête qui modifie quelque chose prévient le moteur, une fois la réponse donnée', async () => {
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(await annonces(true, m, '/patients'), 1, m)
  })
  await test('une lecture ne prévient personne', async () => {
    assert.equal(await annonces(true, 'GET', '/patients'), 0)
  })
  await test('la synchronisation ne se déclenche pas elle-même', async () => {
    for (const u of ['/sync/now', '/sync/run', '/sync/push', '/sync']) assert.equal(await annonces(true, 'POST', u), 0, u)
  })
  await test('une route dont le nom commence comme « sync » mais n’en est pas une reste une écriture', async () => {
    assert.equal(await annonces(true, 'POST', '/synchronisation/messagerie/rechiffrer'), 1)
  })
  await test('hors poste de bureau (serveur central), aucun effet', async () => {
    assert.equal(await annonces(false, 'POST', '/patients'), 0)
  })
  console.log(`\n${passed} reussis, ${failed} echoues`)
  if (failed > 0) process.exit(1)
}
void main()
