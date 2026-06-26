/**
 * Tests PURS du chiffrement at-rest des secrets TOTP (AES-256-GCM).
 *   pnpm --filter @cms-saris/db exec tsx <repo>/apps/api/test/totp-secret.test.ts
 *
 * Prouve que la clé maîtresse de la 2FA n'est jamais stockée en clair :
 *  - round-trip (chiffrer → déchiffrer = secret base32 original) ;
 *  - format v1:<iv>:<tag>:<ct>, IV 96 bits, tag 128 bits ;
 *  - le secret en clair n'apparaît pas dans la valeur stockée ;
 *  - authentification GCM : toute altération casse le déchiffrement (throw) ;
 *  - rétro-compat : un secret SANS préfixe v1: est rendu tel quel (migration douce) ;
 *  - isEncrypted() discrimine clair vs chiffré.
 *
 * La clé est lue PARESSEUSEMENT (getKey au 1er appel) : poser TOTP_ENC_KEY avant
 * tout appel de fonction suffit, l'import statique est OK.
 */
import assert from 'node:assert/strict'

process.env['TOTP_ENC_KEY'] = 'cle-de-test-totp-suffisamment-longue'

import {
  encryptSecret,
  decryptSecret,
  isEncrypted,
} from '../src/common/crypto/totp-secret'

let passed = 0
let failed = 0
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log('  ✓ ' + name) }
  catch (e) { failed++; console.error('  ✗ ' + name + '\n     ' + (e as Error).message) }
}

// Un secret TOTP réaliste (base32).
const SECRET = 'JBSWY3DPEHPK3PXP'

console.log('round-trip')
test('chiffrer puis déchiffrer = secret original', () => {
  assert.equal(decryptSecret(encryptSecret(SECRET)), SECRET)
})
test('deux chiffrements diffèrent (IV aléatoire) mais même clair', () => {
  const a = encryptSecret(SECRET)
  const b = encryptSecret(SECRET)
  assert.notEqual(a, b)
  assert.equal(decryptSecret(a), decryptSecret(b))
})

console.log('format & confidentialité')
test('format v1:<iv>:<tag>:<ct> (4 segments)', () => {
  const parts = encryptSecret(SECRET).split(':')
  assert.equal(parts.length, 4)
  assert.equal(parts[0], 'v1')
})
test('IV 96 bits, tag GCM 128 bits', () => {
  const [, iv, tag] = encryptSecret(SECRET).split(':')
  assert.equal(Buffer.from(iv!, 'base64').length, 12)
  assert.equal(Buffer.from(tag!, 'base64').length, 16)
})
test('le secret en clair n’apparaît pas dans la valeur stockée', () => {
  const stored = encryptSecret(SECRET)
  assert.ok(!stored.includes(SECRET))
})
test('isEncrypted() : vrai sur chiffré, faux sur clair', () => {
  assert.equal(isEncrypted(encryptSecret(SECRET)), true)
  assert.equal(isEncrypted(SECRET), false)
  assert.equal(isEncrypted('JBSWY3DP'), false)
})

console.log('authentification GCM (altération)')
function tamper(stored: string, idx: number): string {
  const parts = stored.split(':')
  const buf = Buffer.from(parts[idx]!, 'base64')
  buf[0] = buf[0]! ^ 0xff
  parts[idx] = buf.toString('base64')
  return parts.join(':')
}
test('ciphertext altéré → throw (déchiffrement refusé)', () => {
  assert.throws(() => decryptSecret(tamper(encryptSecret(SECRET), 3)))
})
test('tag altéré → throw', () => {
  assert.throws(() => decryptSecret(tamper(encryptSecret(SECRET), 2)))
})
test('IV altéré → throw', () => {
  assert.throws(() => decryptSecret(tamper(encryptSecret(SECRET), 1)))
})
test('format v1 incomplet → throw explicite', () => {
  assert.throws(() => decryptSecret('v1:onlyoneseg'), /illisible|invalide/)
})

console.log('rétro-compatibilité (migration douce)')
test('secret SANS préfixe v1: rendu tel quel (ancien clair)', () => {
  assert.equal(decryptSecret(SECRET), SECRET)
  assert.equal(decryptSecret('ancien-secret-clair'), 'ancien-secret-clair')
})

console.log('\n' + passed + ' reussis, ' + failed + ' echoues')
if (failed > 0) process.exit(1)
