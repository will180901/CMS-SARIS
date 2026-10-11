/**
 * Tests unitaires du contrôle du flux, côté POSTE (logique pure, sans réseau ni base) :
 * lire les ordres du serveur et décider quoi en faire.
 *   pnpm --filter api exec tsx test/sync-controle.test.ts
 */
import assert from 'node:assert/strict'
import {
  lireMode,
  lireOrdres,
  resyncAEngager,
  refusDeSuspension,
  refusDeVidage,
  vidageAEngager,
  vidageDejaFait,
  PosteSuspenduError,
  VidageEnAttenteError,
  NIVEAU_CONTROLE,
  type OrdresServeur,
} from '../src/modules/sync/sync-controle'

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

const D1 = '2026-10-11T08:00:00.000Z'
const D2 = '2026-10-11T09:30:00.000Z'
const libre: OrdresServeur = {
  suspendu: false,
  motif: null,
  resyncDemandeeAt: null,
  vidageDemandeAt: null,
}

console.log('lireOrdres')
test('un battement qui porte des ordres', () => {
  assert.deepEqual(
    lireOrdres({
      ok: true,
      controle: {
        suspendu: true,
        motif: 'Machine à vérifier',
        resyncDemandeeAt: D1,
        vidageDemandeAt: D2,
      },
    }),
    {
      suspendu: true,
      motif: 'Machine à vérifier',
      resyncDemandeeAt: D1,
      vidageDemandeAt: D2,
    },
  )
})
test('poste libre, rien à faire', () => {
  assert.deepEqual(
    lireOrdres({
      ok: true,
      controle: { suspendu: false, motif: null, resyncDemandeeAt: null, vidageDemandeAt: null },
    }),
    libre,
  )
})
test('serveur d’avant le vidage : le champ manque, ce n’est pas un ordre', () => {
  assert.equal(
    lireOrdres({ controle: { suspendu: false, resyncDemandeeAt: D1 } })!.vidageDemandeAt,
    null,
  )
})
test('date de vidage invalide ignorée', () => {
  assert.equal(lireOrdres({ controle: { vidageDemandeAt: 'hier' } })!.vidageDemandeAt, null)
  assert.equal(lireOrdres({ controle: { vidageDemandeAt: 12345 } })!.vidageDemandeAt, null)
  assert.equal(lireOrdres({ controle: { vidageDemandeAt: '' } })!.vidageDemandeAt, null)
})
test('serveur ancien (réponse « ok » seule) : AUCUNE information, pas « libéré »', () => {
  assert.equal(lireOrdres({ ok: true }), null)
})
test('réponse illisible ou vide : aucune information', () => {
  for (const corps of [null, undefined, 'ok', 42, [], { controle: null }, { controle: 'x' }])
    assert.equal(lireOrdres(corps), null)
})
test('« suspendu » ne vaut que pour true (jamais pour une chaîne ou un nombre)', () => {
  for (const v of ['true', 1, 'oui', null, undefined])
    assert.equal(lireOrdres({ controle: { suspendu: v } })!.suspendu, false)
})
test('motif vide ou non textuel ignoré', () => {
  assert.equal(lireOrdres({ controle: { suspendu: true, motif: '' } })!.motif, null)
  assert.equal(lireOrdres({ controle: { suspendu: true, motif: 12 } })!.motif, null)
})
test('date de demande invalide ignorée', () => {
  assert.equal(lireOrdres({ controle: { resyncDemandeeAt: 'hier' } })!.resyncDemandeeAt, null)
  assert.equal(lireOrdres({ controle: { resyncDemandeeAt: 12345 } })!.resyncDemandeeAt, null)
})

console.log('lireMode (mode du système annoncé par le serveur)')
test('« TEST » et « PRODUCTION » sont lus', () => {
  assert.equal(lireMode({ ok: true, mode: 'TEST' }), 'TEST')
  assert.equal(lireMode({ ok: true, mode: 'PRODUCTION' }), 'PRODUCTION')
})
test('absent (serveur ancien) ou illisible : AUCUNE information — le poste garde le mode qu’il connaît', () => {
  for (const corps of [null, undefined, 'x', 7, [], {}, { ok: true }, { mode: null }, { mode: 'test' }, { mode: 'DEV' }, { mode: 1 }])
    assert.equal(lireMode(corps), null)
})

console.log('resyncAEngager')
test('une nouvelle demande est engagée', () => {
  assert.equal(resyncAEngager({ ...libre, resyncDemandeeAt: D1 }, null), true)
})
test('pas de demande, rien à engager', () => {
  assert.equal(resyncAEngager(libre, null), false)
})
test('la demande déjà prise (en cours ou accomplie) n’est jamais refaite', () => {
  assert.equal(resyncAEngager({ ...libre, resyncDemandeeAt: D1 }, D1), false)
})
test('une demande PLUS RÉCENTE que la dernière accomplie est engagée', () => {
  assert.equal(resyncAEngager({ ...libre, resyncDemandeeAt: D2 }, D1), true)
})
test('un poste suspendu attend la levée : rien n’est engagé', () => {
  assert.equal(
    resyncAEngager({ ...libre, suspendu: true, resyncDemandeeAt: D1 }, null),
    false,
  )
})

console.log('vidageAEngager')
test('un vidage demandé est engagé', () => {
  assert.equal(vidageAEngager({ ...libre, vidageDemandeAt: D1 }, null), true)
})
test('pas de vidage demandé, rien à engager', () => {
  assert.equal(vidageAEngager(libre, null), false)
  assert.equal(vidageAEngager(libre, D1), false)
})
test('le vidage déjà pris (en cours ou accompli) n’est jamais refait', () => {
  assert.equal(vidageAEngager({ ...libre, vidageDemandeAt: D1 }, D1), false)
})
test('un vidage PLUS RÉCENT que le dernier accompli est engagé', () => {
  assert.equal(vidageAEngager({ ...libre, vidageDemandeAt: D2 }, D1), true)
})
test('un poste suspendu attend la levée : aucun vidage n’est engagé', () => {
  assert.equal(
    vidageAEngager({ ...libre, suspendu: true, vidageDemandeAt: D1 }, null),
    false,
  )
})
test('le vidage et la resynchronisation sont deux ordres indépendants', () => {
  assert.equal(vidageAEngager({ ...libre, resyncDemandeeAt: D1 }, null), false)
  assert.equal(resyncAEngager({ ...libre, vidageDemandeAt: D1 }, null), false)
})

console.log('vidageDejaFait (vidage déjà accompli sur CE poste)')
test('jamais fait : à faire', () => {
  assert.equal(vidageDejaFait(D1, null), false)
  assert.equal(vidageDejaFait(D1, undefined), false)
  assert.equal(vidageDejaFait(D1, ''), false)
})
test('fait pour CETTE demande : à ne pas refaire (le travail saisi depuis serait perdu)', () => {
  assert.equal(vidageDejaFait(D1, D1), true)
})
test('fait pour une demande plus récente ou plus ancienne', () => {
  assert.equal(vidageDejaFait(D1, D2), true)
  assert.equal(vidageDejaFait(D2, D1), false)
})
test('une date illisible ne vaut jamais « déjà fait »', () => {
  assert.equal(vidageDejaFait(D1, 'hier'), false)
  assert.equal(vidageDejaFait('hier', D1), false)
})

console.log('refusDeSuspension')
test('423 + code POSTE_SUSPENDU : suspension reconnue, motif conservé', () => {
  const e = refusDeSuspension(423, { code: 'POSTE_SUSPENDU', motif: 'Contrôle' })
  assert.ok(e instanceof PosteSuspenduError)
  assert.equal(e!.motif, 'Contrôle')
})
test('sans motif', () => {
  assert.equal(refusDeSuspension(423, { code: 'POSTE_SUSPENDU' })!.motif, null)
})
test('un 423 venu d’ailleurs (relais, plateforme) n’est pas une décision d’administrateur', () => {
  assert.equal(refusDeSuspension(423, { message: 'Locked' }), null)
  assert.equal(refusDeSuspension(423, null), null)
  assert.equal(refusDeSuspension(423, 'Locked'), null)
})
test('un autre statut n’est jamais une suspension', () => {
  for (const status of [200, 401, 403, 409, 500])
    assert.equal(refusDeSuspension(status, { code: 'POSTE_SUSPENDU' }), null)
})

console.log('refusDeVidage')
test('423 + code VIDAGE_EN_ATTENTE : vidage en attente reconnu', () => {
  assert.ok(refusDeVidage(423, { code: 'VIDAGE_EN_ATTENTE' }) instanceof VidageEnAttenteError)
})
test('une suspension n’est pas un vidage en attente, et inversement', () => {
  assert.equal(refusDeVidage(423, { code: 'POSTE_SUSPENDU' }), null)
  assert.equal(refusDeSuspension(423, { code: 'VIDAGE_EN_ATTENTE' }), null)
})
test('un 423 venu d’ailleurs, ou un autre statut, n’est jamais un vidage en attente', () => {
  assert.equal(refusDeVidage(423, { message: 'Locked' }), null)
  assert.equal(refusDeVidage(423, null), null)
  assert.equal(refusDeVidage(423, 'VIDAGE_EN_ATTENTE'), null)
  for (const status of [200, 401, 403, 409, 500])
    assert.equal(refusDeVidage(status, { code: 'VIDAGE_EN_ATTENTE' }), null)
})

console.log('niveau')
test('le niveau annoncé est un entier positif (0 = poste ancien)', () => {
  assert.ok(Number.isInteger(NIVEAU_CONTROLE) && NIVEAU_CONTROLE >= 1)
})
test('le niveau 2 est celui du vidage : un poste qui l’annonce sait vider sa copie', () => {
  assert.ok(NIVEAU_CONTROLE >= 2)
})

console.log('\n' + passed + ' reussis, ' + failed + ' echoues')
if (failed > 0) process.exit(1)
