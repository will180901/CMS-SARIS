/**
 * Chiffrement at-rest des secrets TOTP (AES-256-GCM).
 *
 * Le secret TOTP est la clé maîtresse de la 2FA d'un utilisateur : stocké en
 * clair, une fuite de la base compromettrait toutes les double-authentifications.
 * On le chiffre donc avant écriture et on le déchiffre uniquement au moment de
 * vérifier un code.
 *
 * Format stocké :  v1:<iv_b64>:<authTag_b64>:<ciphertext_b64>
 * La clé AES-256 (32 octets) est dérivée de la variable d'environnement
 * `TOTP_ENC_KEY` via scrypt (n'importe quelle longueur de phrase est acceptée).
 *
 * Rétro-compatibilité : un secret SANS préfixe `v1:` est considéré comme un
 * ancien secret en clair et renvoyé tel quel par {@link decryptSecret} — ainsi
 * la migration est transparente (les secrets sont ré-écrits chiffrés au prochain
 * setup, sans casser l'existant).
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const VERSION = 'v1'
const KEY_SALT = 'cms-saris.totp.v1' // sel applicatif fixe : le secret reste TOTP_ENC_KEY

let cachedKey: Buffer | null = null

function getKey(): Buffer {
  if (cachedKey) return cachedKey
  const passphrase = process.env['TOTP_ENC_KEY']
  if (!passphrase) {
    throw new Error(
      'TOTP_ENC_KEY manquante dans l’environnement : impossible de (dé)chiffrer les secrets TOTP. ' +
        'Ajoutez-la dans apps/api/.env.',
    )
  }
  cachedKey = scryptSync(passphrase, KEY_SALT, 32)
  return cachedKey
}

/** Chiffre un secret TOTP (base32) pour stockage en base. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12) // 96 bits : taille recommandée pour GCM
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':')
}

/** Déchiffre un secret stocké. Renvoie tel quel un ancien secret en clair (rétro-compat). */
export function decryptSecret(stored: string): string {
  if (!stored.startsWith(VERSION + ':')) return stored // legacy : secret en clair
  const [, ivB64, tagB64, ctB64] = stored.split(':')
  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error('Secret TOTP chiffré illisible (format invalide).')
  }
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8')
}

/** True si la valeur stockée est déjà au format chiffré v1. */
export function isEncrypted(stored: string): boolean {
  return stored.startsWith(VERSION + ':')
}
