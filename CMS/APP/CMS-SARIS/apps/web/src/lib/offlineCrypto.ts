/**
 * offlineCrypto.ts — Chiffrement au repos de la file hors-ligne (IndexedDB).
 *
 * Objet : `payloadJson` (table file_mutations) contient des PII patient en clair
 * (nom, motif, examen, conclusion…). On le chiffre en AES-256-GCM côté renderer.
 *
 * Stratégie de clé :
 *   - DESKTOP (Electron, isDesktop) : la clé brute (32 octets, base64) est stockée
 *     via window.saris.secure.* → chiffrée au repos par DPAPI/safeStorage, liée au
 *     compte Windows. Importée en CryptoKey non-extractible à l'usage. Racine de
 *     confiance = DPAPI.
 *   - WEB PUR (isDesktop === false) : CryptoKey AES-GCM 256 NON-EXTRACTIBLE générée
 *     puis persistée TELLE QUELLE dans IndexedDB (structured clone). Le matériel
 *     n'est jamais exposé au JS (exportKey échoue).
 *
 * LIMITE du cas web : protège contre l'inspection casuelle d'IndexedDB (DevTools,
 * extraction de fichier de profil). NE protège PAS contre un attaquant même-origine
 * déterminé (XSS exécutant subtle.encrypt/decrypt avec la clé non-extractible). Le
 * vrai durcissement reste la prévention XSS (CSP, sanitisation). Pour le desktop,
 * DPAPI ajoute une protection au repos liée au compte OS.
 *
 * Format de stockage : 'enc:v1:' + base64( iv(12 octets) || ciphertext(+tag GCM) ).
 * subtle.encrypt accole le tag GCM (16 octets) à la fin du ciphertext (≠ Node où il
 * est séparé) — on stocke le bloc tel quel, pas d'interop binaire avec message-crypto.ts.
 */

import { isDesktop, desktopBridge } from './desktop'

const PREFIX = 'enc:v1:'
const IV_BYTES = 12
const SECURE_KEY_NAME = 'cms-saris.offline-queue.key.v1'   // nom dans le coffre DPAPI

// ── helpers base64 (Uint8Array <-> base64, sûrs pour binaire) ──────────────────

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin)
}

// Retourne explicitement un Uint8Array adossé à un ArrayBuffer concret (et non
// ArrayBufferLike, qui inclut SharedArrayBuffer) → accepté comme BufferSource par
// les overloads stricts de crypto.subtle (TS ≥ 5.7).
function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// ── Résolution de la clé (singleton mémoire, chargée une fois) ─────────────────

let keyPromise: Promise<CryptoKey> | null = null

async function importRawKey(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM', length: 256 },
    /* extractable */ false,
    ['encrypt', 'decrypt'],
  )
}

/** DESKTOP : récupère (ou crée) la clé brute via le coffre DPAPI, l'importe non-extractible. */
async function resolveDesktopKey(): Promise<CryptoKey> {
  const bridge = desktopBridge()
  if (!bridge) throw new Error('offlineCrypto: bridge desktop indisponible')

  const existing = await bridge.secure.get(SECURE_KEY_NAME)
  if (existing) {
    return importRawKey(base64ToBytes(existing))
  }
  // Première fois : générer 32 octets, persister en base64 dans le coffre DPAPI.
  const raw = crypto.getRandomValues(new Uint8Array(32))
  await bridge.secure.set(SECURE_KEY_NAME, bytesToBase64(raw))
  return importRawKey(raw)
}

/**
 * WEB : CryptoKey AES-GCM non-extractible persistée telle quelle dans une table
 * IndexedDB dédiée (crypto_keys). On NE met PAS la clé dans file_mutations.
 */
async function resolveWebKey(): Promise<CryptoKey> {
  const { db } = await import('./db')   // import différé : évite cycle db ↔ offlineCrypto
  const row = await db.crypto_keys.get(SECURE_KEY_NAME)
  if (row?.key) return row.key
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    /* extractable */ false,
    ['encrypt', 'decrypt'],
  )
  await db.crypto_keys.put({ id: SECURE_KEY_NAME, key })
  return key
}

function getKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    keyPromise = (isDesktop ? resolveDesktopKey() : resolveWebKey()).catch(err => {
      keyPromise = null   // permet une nouvelle tentative au prochain appel
      throw err
    })
  }
  return keyPromise
}

// ── API publique ───────────────────────────────────────────────────────────────

/** Chiffre une chaîne. Renvoie 'enc:v1:<base64(iv||ciphertext)>'. */
export async function encryptField(plaintext: string): Promise<string> {
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)),
  )
  const blob = new Uint8Array(iv.length + ct.length)
  blob.set(iv, 0)
  blob.set(ct, iv.length)
  return PREFIX + bytesToBase64(blob)
}

/**
 * Déchiffre une valeur produite par encryptField. COMPAT : si la valeur n'a PAS
 * le préfixe 'enc:', elle est traitée comme legacy clair et renvoyée telle quelle
 * (mutations enfilées avant l'activation du chiffrement → jamais perdues).
 */
export async function decryptField(stored: string): Promise<string> {
  if (!stored.startsWith(PREFIX)) return stored   // legacy clair, fallback
  const key = await getKey()
  const blob = base64ToBytes(stored.slice(PREFIX.length))
  const iv = blob.slice(0, IV_BYTES)
  const ct = blob.slice(IV_BYTES)
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return new TextDecoder().decode(pt)
}

/** True si la valeur est chiffrée par ce module (utilitaire de test/diagnostic). */
export function isEncrypted(stored: string): boolean {
  return stored.startsWith(PREFIX)
}
