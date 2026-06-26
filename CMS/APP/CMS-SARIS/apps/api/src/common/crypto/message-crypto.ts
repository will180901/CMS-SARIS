/**
 * Chiffrement des messages de la messagerie interne (AES-256-GCM).
 *
 * Le contenu d'un message n'est JAMAIS stocké en clair : il est chiffré avant
 * écriture en base et déchiffré uniquement au moment de servir le fil à un
 * participant autorisé. Combiné à TLS en transport (production), cela protège
 * la confidentialité des échanges entre agents.
 *
 * Format stocké :  v1:<iv_b64>:<authTag_b64>:<ciphertext_b64>
 * Clé AES-256 dérivée via scrypt de `MESSAGE_ENC_KEY` (ou repli sur
 * `TOTP_ENC_KEY` déjà présente — fonctionne sans config supplémentaire).
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { readFileSync } from 'fs'
import { Logger } from '@nestjs/common'

const cryptoLogger = new Logger('message-crypto')

// Format de stockage :
//   v2:<keyId>:<iv>:<tag>:<ct>  → clé identifiée (rotation possible)
//   v1:<iv>:<tag>:<ct>          → LEGACY (toujours déchiffrable, clé id "1")
const VERSION = 'v2'
const LEGACY = 'v1'
const KEY_SALT = 'cms-saris.message.v1'

/**
 * Trousseau de clés (rotation) :
 *   - MESSAGE_ENC_KEYS = "1:phraseA,2:phraseB" (plusieurs clés actives)
 *   - MESSAGE_ENC_KEYS_FILE = "/run/secrets/msg_keys" (compat HSM/Vault : un agent
 *       Vault / secret Kubernetes monte le trousseau en FICHIER au lieu de l'env.
 *       Contenu accepté : JSON {"1":"phraseA","2":"phraseB"} OU "1:phraseA,2:phraseB").
 *   - MESSAGE_ENC_KEY_CURRENT = "2" (clé utilisée pour CHIFFRER ; défaut = plus grand id)
 *   - Repli mono-clé : MESSAGE_ENC_KEY (ou TOTP_ENC_KEY) = clé id "1".
 * Les anciennes clés restent dans le trousseau pour DÉCHIFFRER les messages
 * existants après une rotation. Dériver via scrypt (id "1" identique au legacy v1).
 */
let registry: { keys: Record<string, string>; current: string } | null = null
const derived: Record<string, Buffer> = {}

/** Parse "1:phraseA,2:phraseB" → { '1': 'phraseA', '2': 'phraseB' } dans `out`. */
function parsePairs(raw: string, out: Record<string, string>): void {
  for (const pair of raw.split(',')) {
    const idx = pair.indexOf(':')
    if (idx > 0) out[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim()
  }
}

/** Lit le trousseau depuis un fichier (Vault/secret monté) : JSON objet ou format "id:pass,…". */
function keysFromFile(path: string, out: Record<string, string>): void {
  let txt: string
  try { txt = readFileSync(path, 'utf8').trim() } catch {
    throw new Error(`MESSAGE_ENC_KEYS_FILE illisible : ${path}`)
  }
  if (txt.startsWith('{')) {
    const obj = JSON.parse(txt) as Record<string, unknown>
    for (const [id, pass] of Object.entries(obj)) if (typeof pass === 'string') out[id.trim()] = pass
  } else {
    parsePairs(txt, out)
  }
}

function loadRegistry(): { keys: Record<string, string>; current: string } {
  if (registry) return registry
  const keys: Record<string, string> = {}
  const file = process.env['MESSAGE_ENC_KEYS_FILE']
  if (file) keysFromFile(file, keys)            // trousseau monté (Vault/HSM) — prioritaire
  const raw = process.env['MESSAGE_ENC_KEYS']
  if (raw) parsePairs(raw, keys)                // env complète/écrase le fichier
  // Clé legacy "1" (compat des messages v1 + repli mono-clé) si absente du trousseau.
  const legacyPass = process.env['MESSAGE_ENC_KEY'] ?? process.env['TOTP_ENC_KEY']
  if (!keys['1'] && legacyPass) keys['1'] = legacyPass

  const ids = Object.keys(keys)
  if (!ids.length) {
    throw new Error('Aucune clé de chiffrement (MESSAGE_ENC_KEYS[_FILE] ou MESSAGE_ENC_KEY/TOTP_ENC_KEY). Ajoutez-la dans apps/api/.env.')
  }
  const current = process.env['MESSAGE_ENC_KEY_CURRENT'] && keys[process.env['MESSAGE_ENC_KEY_CURRENT']!]
    ? process.env['MESSAGE_ENC_KEY_CURRENT']!
    : ids.sort((a, b) => Number(a) - Number(b)).pop()!

  if (!process.env['MESSAGE_ENC_KEY'] && !raw && !file && process.env['NODE_ENV'] === 'production') {
    cryptoLogger.warn('[sécurité] MESSAGE_ENC_KEY absente en production : repli sur TOTP_ENC_KEY. Définissez une clé dédiée + activez la rotation.')
  }
  registry = { keys, current }
  return registry
}

/** Identifiant de la clé COURANTE (utilisée pour chiffrer). */
export function currentKeyId(): string {
  return loadRegistry().current
}

/** Vrai si le contenu stocké est déjà chiffré avec la clé courante (rien à ré-encrypter). */
export function isCurrent(stored: string): boolean {
  const parts = stored.split(':')
  return parts[0] === VERSION && parts[1] === loadRegistry().current
}

/**
 * Ré-encrypte un contenu stocké vers la clé COURANTE (nettoyage post-rotation).
 * Renvoie le nouveau ciphertext, ou `null` si déjà à jour OU illisible (jamais
 * destructif : on ne ré-écrit que si l'on a pu déchiffrer le contenu d'origine).
 */
export function reencryptToCurrent(stored: string): string | null {
  if (isCurrent(stored)) return null
  const buf = decryptRaw(stored)
  if (!buf) return null
  return encryptRaw(buf)
}

/** Clé AES-256 dérivée (scrypt) pour un identifiant de clé donné, mise en cache. */
function keyFor(id: string): Buffer {
  if (derived[id]) return derived[id]!
  const pass = loadRegistry().keys[id]
  if (!pass) throw new Error(`Clé de chiffrement « ${id} » inconnue (rotation : conservez les anciennes clés).`)
  return (derived[id] = scryptSync(pass, KEY_SALT, 32))
}

/** Résout la clé d'un message stocké selon son préfixe de version. */
function decodeKey(parts: string[]): { key: Buffer; iv: string; tag: string; ct: string } | null {
  if (parts[0] === VERSION && parts.length === 5) {
    return { key: keyFor(parts[1]!), iv: parts[2]!, tag: parts[3]!, ct: parts[4]! }
  }
  if (parts[0] === LEGACY && parts.length === 4) {
    return { key: keyFor('1'), iv: parts[1]!, tag: parts[2]!, ct: parts[3]! }
  }
  return null
}

/** Chiffre un contenu (string/Buffer) avec la clé COURANTE → format v2:<keyId>:… */
function encryptRaw(plain: Buffer): string {
  const { current } = loadRegistry()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyFor(current), iv)
  const ct = Buffer.concat([cipher.update(plain), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, current, iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':')
}

/** Déchiffre un contenu stocké (v2 ou legacy v1) → Buffer, ou null si illisible. */
function decryptRaw(stored: string): Buffer | null {
  const decoded = decodeKey(stored.split(':'))
  if (!decoded) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', decoded.key, Buffer.from(decoded.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(decoded.tag, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(decoded.ct, 'base64')), decipher.final()])
  } catch {
    return null
  }
}

/** Chiffre le contenu d'un message pour stockage. */
export function encryptMessage(plain: string): string {
  return encryptRaw(Buffer.from(plain, 'utf8'))
}

/** Déchiffre un message stocké. Renvoie un placeholder si illisible (jamais throw). */
export function decryptMessage(stored: string): string {
  if (!stored.startsWith(VERSION + ':') && !stored.startsWith(LEGACY + ':')) return stored // ancien format / clair
  const buf = decryptRaw(stored)
  return buf ? buf.toString('utf8') : '[message illisible]'
}

/** Chiffre un contenu binaire (pièce jointe) pour stockage. Même format/clé. */
export function encryptBytes(plain: Buffer): string {
  return encryptRaw(plain)
}

/** Déchiffre un contenu binaire stocké. Throw si illisible (l'appelant gère). */
export function decryptBytes(stored: string): Buffer {
  const buf = decryptRaw(stored)
  if (!buf) throw new Error('Pièce jointe illisible')
  return buf
}
