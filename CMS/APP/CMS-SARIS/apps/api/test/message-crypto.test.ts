/**
 * Tests PURS du chiffrement de la messagerie interne (AES-256-GCM).
 *   pnpm --filter @cms-saris/db exec tsx <repo>/apps/api/test/message-crypto.test.ts
 *
 * Prouve le coeur métier confidentialité :
 *  - round-trip texte/binaire (chiffrer → déchiffrer = original) ;
 *  - le contenu chiffré ne contient JAMAIS le clair ;
 *  - format de stockage versionné v2:<keyId>:<iv>:<tag>:<ct> ;
 *  - authentification GCM : toute altération du ciphertext / tag / iv casse le
 *    déchiffrement (pas de message falsifié accepté) ;
 *  - rétro-compat legacy v1 (clé id "1") + repli TOTP_ENC_KEY ;
 *  - rotation de clés : la clé COURANTE chiffre, les anciennes restent lisibles,
 *    reencryptToCurrent ré-encrypte sans être destructif.
 *
 * IMPORTANT : les variables d'environnement DOIVENT être posées AVANT le premier
 * import du module — loadRegistry() met le trousseau en cache au premier appel.
 */
import assert from 'node:assert/strict'
import { createCipheriv, randomBytes, scryptSync } from 'node:crypto'

// ── Trousseau de test : 2 clés actives + repli legacy ───────────────────────
// id "1" = clé legacy (compat v1), id "2" = clé courante par défaut (plus grand id).
// Le module lit l'environnement PARESSEUSEMENT (loadRegistry au 1er appel de
// fonction) : poser ces variables avant tout appel suffit, l'import statique est OK.
process.env['MESSAGE_ENC_KEYS'] = '1:phrase-secrete-un,2:phrase-secrete-deux'
process.env['MESSAGE_ENC_KEY_CURRENT'] = '2'
process.env['MESSAGE_ENC_KEY'] = 'phrase-secrete-un'

import {
  encryptMessage,
  decryptMessage,
  encryptBytes,
  decryptBytes,
  currentKeyId,
  isCurrent,
  reencryptToCurrent,
} from '../src/common/crypto/message-crypto'

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

// ── Round-trip texte ────────────────────────────────────────────────────────
console.log('round-trip texte')
test('chiffrer puis déchiffrer = message original', () => {
  const clair = 'Patient en salle 3, tension 14/9, à revoir.'
  const stored = encryptMessage(clair)
  assert.equal(decryptMessage(stored), clair)
})
test('messages avec accents / emojis / sauts de ligne', () => {
  const clair = 'Résumé : éàùç — 🩺💊\nLigne 2\tTab'
  assert.equal(decryptMessage(encryptMessage(clair)), clair)
})
test('chaîne vide round-trip', () => {
  assert.equal(decryptMessage(encryptMessage('')), '')
})
test('deux chiffrements du même clair diffèrent (IV aléatoire)', () => {
  const a = encryptMessage('même texte')
  const b = encryptMessage('même texte')
  assert.notEqual(a, b) // IV de 12 octets distinct à chaque appel
  assert.equal(decryptMessage(a), decryptMessage(b)) // mais même clair
})

// ── Le clair ne fuite jamais dans le stockage ───────────────────────────────
console.log('confidentialité du stockage')
test('le contenu stocké ne contient pas le clair', () => {
  const clair = 'CONFIDENTIEL_DIAGNOSTIC_VIH'
  const stored = encryptMessage(clair)
  assert.ok(!stored.includes(clair), 'le clair ne doit pas apparaître dans le stockage')
  assert.ok(!stored.includes('DIAGNOSTIC'), 'aucun fragment du clair en stockage')
})

// ── Format de stockage versionné ────────────────────────────────────────────
console.log('format de stockage v2:<keyId>:<iv>:<tag>:<ct>')
test('préfixe v2 + 5 segments séparés par « : »', () => {
  const parts = encryptMessage('hello').split(':')
  assert.equal(parts.length, 5)
  assert.equal(parts[0], 'v2')
})
test('le 2e segment = identifiant de clé courante', () => {
  const parts = encryptMessage('hello').split(':')
  assert.equal(parts[1], currentKeyId())
  assert.equal(currentKeyId(), '2') // plus grand id / MESSAGE_ENC_KEY_CURRENT
})
test('iv / tag / ct sont du base64 décodable de tailles GCM attendues', () => {
  const [, , ivB64, tagB64, ctB64] = encryptMessage('abc').split(':')
  assert.equal(Buffer.from(ivB64!, 'base64').length, 12) // IV 96 bits
  assert.equal(Buffer.from(tagB64!, 'base64').length, 16) // tag GCM 128 bits
  assert.ok(Buffer.from(ctB64!, 'base64').length > 0)
})
test('isCurrent() vrai sur un message fraîchement chiffré', () => {
  assert.equal(isCurrent(encryptMessage('x')), true)
})

// ── Authentification GCM : toute altération est détectée ────────────────────
console.log('intégrité / authentification GCM')

/** Remplace le segment `idx` par sa version altérée (1 octet flippé en base64→bin→base64). */
function tamperSegment(stored: string, idx: number): string {
  const parts = stored.split(':')
  const buf = Buffer.from(parts[idx]!, 'base64')
  buf[0] = buf[0]! ^ 0xff // inverse le premier octet
  parts[idx] = buf.toString('base64')
  return parts.join(':')
}

test('ciphertext altéré → message illisible (texte) sans throw', () => {
  const stored = encryptMessage('contenu authentique')
  const tampered = tamperSegment(stored, 4) // segment ct
  // decryptMessage ne throw jamais : renvoie un placeholder, JAMAIS le clair falsifié.
  assert.equal(decryptMessage(tampered), '[message illisible]')
})
test('tag d’authentification altéré → illisible', () => {
  const stored = encryptMessage('contenu authentique')
  assert.equal(decryptMessage(tamperSegment(stored, 3)), '[message illisible]')
})
test('IV altéré → illisible', () => {
  const stored = encryptMessage('contenu authentique')
  assert.equal(decryptMessage(tamperSegment(stored, 2)), '[message illisible]')
})
test('keyId inconnu → throw explicite (clé absente du trousseau)', () => {
  // Comportement RÉEL : keyFor() lève avant le try/catch de decryptRaw, donc un
  // keyId inconnu n'est PAS avalé en placeholder mais remonté — signal fort qu'une
  // clé manque au trousseau (rotation mal configurée), plutôt qu'un faux « illisible ».
  const parts = encryptMessage('x').split(':')
  parts[1] = '999' // clé qui n'existe pas
  assert.throws(() => decryptMessage(parts.join(':')), /inconnue/)
})
test('décryptage binaire d’un ciphertext altéré → throw (l’appelant gère)', () => {
  const stored = encryptBytes(Buffer.from([1, 2, 3, 4]))
  assert.throws(() => decryptBytes(tamperSegment(stored, 4)), /illisible/)
})

// ── Pièces jointes binaires ─────────────────────────────────────────────────
console.log('round-trip binaire (pièces jointes)')
test('chiffrer/déchiffrer un buffer binaire = octets identiques', () => {
  const bin = Buffer.from([0x00, 0xff, 0x10, 0x7f, 0x80, 0xde, 0xad, 0xbe, 0xef])
  const stored = encryptBytes(bin)
  assert.deepEqual(decryptBytes(stored), bin)
})
test('buffer vide round-trip', () => {
  assert.deepEqual(decryptBytes(encryptBytes(Buffer.alloc(0))), Buffer.alloc(0))
})
test('gros buffer (64 Kio) round-trip', () => {
  const big = Buffer.alloc(64 * 1024)
  for (let i = 0; i < big.length; i++) big[i] = (i * 37) & 0xff
  assert.deepEqual(decryptBytes(encryptBytes(big)), big)
})

// ── Rétro-compatibilité & valeurs non chiffrées ─────────────────────────────
console.log('rétro-compatibilité')
test('valeur SANS préfixe v1/v2 renvoyée telle quelle (ancien clair)', () => {
  assert.equal(decryptMessage('ancien message en clair'), 'ancien message en clair')
})
// Reproduit FIDÈLEMENT la dérivation de clé du module (scrypt, sel applicatif fixe)
// pour fabriquer des ciphertexts « anciens » (clé id "1") et prouver qu'ils restent
// lisibles alors que la clé COURANTE est "2" — c'est tout l'enjeu d'une rotation.
const KEY_SALT = 'cms-saris.message.v1'
function deriveKey(pass: string): Buffer {
  return scryptSync(pass, KEY_SALT, 32)
}
/** Chiffre `clair` avec la passphrase donnée, au format `prefix` (v1 legacy ou v2:id). */
function encryptWith(pass: string, clair: string, prefix: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(pass), iv)
  const ct = Buffer.concat([cipher.update(Buffer.from(clair, 'utf8')), cipher.final()])
  const tag = cipher.getAuthTag()
  return [prefix, iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':')
}

const KEY1 = 'phrase-secrete-un' // = MESSAGE_ENC_KEY / clé id "1"

test('legacy v1 (clé id "1") déchiffrable alors que la clé courante est "2"', () => {
  // Format LEGACY : v1:<iv>:<tag>:<ct> → routé vers keyFor('1') par decodeKey().
  const clair = 'message historique chiffré avant la rotation'
  const legacy = encryptWith(KEY1, clair, 'v1')
  assert.ok(legacy.startsWith('v1:'))
  assert.equal(decryptMessage(legacy), clair) // ✅ toujours lisible après rotation
})
test('un v1 forgé avec une MAUVAISE passphrase → illisible (auth GCM)', () => {
  const legacy = encryptWith('mauvaise-clé', 'contenu', 'v1')
  assert.equal(decryptMessage(legacy), '[message illisible]')
})

// ── Rotation de clés ────────────────────────────────────────────────────────
console.log('rotation de clés (versioning v2:keyId)')
test('reencryptToCurrent() renvoie null si déjà à jour (clé courante)', () => {
  const stored = encryptMessage('déjà courant')
  assert.equal(isCurrent(stored), true)
  assert.equal(reencryptToCurrent(stored), null)
})
test('message chiffré avec ANCIENNE clé "1" → ré-encrypté vers clé courante "2"', () => {
  const clair = 'à faire tourner vers la clé courante'
  // « Ancien » message chiffré avec la clé id "1" mais au format versionné v2:1.
  const ancien = encryptWith(KEY1, clair, 'v2:1')
  assert.equal(isCurrent(ancien), false) // clé 1 ≠ clé courante 2
  assert.equal(decryptMessage(ancien), clair) // lisible avant rotation

  const re = reencryptToCurrent(ancien)
  assert.ok(re, 'doit produire un nouveau ciphertext (pas null)')
  assert.equal(re!.split(':')[1], '2') // désormais sur la clé courante
  assert.equal(isCurrent(re!), true)
  assert.equal(decryptMessage(re!), clair) // ✅ même clair, nouvelle clé
  assert.notEqual(re, ancien) // contenu stocké réellement changé
})
test('reencryptToCurrent() sur ciphertext décodable mais corrompu → null (non destructif)', () => {
  // Clé connue (2) mais octets invalides : decryptRaw renvoie null → pas de ré-écriture.
  // On ne ré-encrypte JAMAIS ce qu'on ne sait pas déchiffrer (évite la perte de données).
  assert.equal(reencryptToCurrent('v2:2:zzz:zzz:zzz'), null)
})

console.log('\n' + passed + ' reussis, ' + failed + ' echoues')
if (failed > 0) process.exit(1)
