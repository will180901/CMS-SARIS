/**
 * Appairage d'un poste de bureau — la partie SANS base de données ni réseau : forme des codes, empreintes, état d'un
 * code, limite d'essais. Isolée pour être testée seule (cf. test/appairage-code.test.ts).
 *
 * Un CODE D'APPAIRAGE (8 caractères, ex. `K7QM-4XPD`) est ce qu'un administrateur remet à qui installe un poste, à la
 * place d'un identifiant et d'un mot de passe. Il ne sert qu'à ENREGISTRER le poste. Celui-ci reçoit alors son propre
 * SECRET (long, aléatoire), qu'il garde chiffré sur sa machine et échange contre un jeton limité à la synchronisation.
 */
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

/** 32 symboles sans 0, 1, I ni O : un code dicté ou recopié ne se confond pas. 8 symboles = 40 bits. */
export const ALPHABET_CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const LONGUEUR_CODE = 8

/** Un code tiré au hasard (cryptographiquement), sans séparateur : `K7QM4XPD`. */
export function genererCode(
  tirer: (max: number) => number = (max) => randomInt(max),
): string {
  let code = ''
  for (let i = 0; i < LONGUEUR_CODE; i++) code += ALPHABET_CODE[tirer(ALPHABET_CODE.length)]
  return code
}

/** Présentation lisible : `K7QM-4XPD`. */
export function formaterCode(code: string): string {
  return `${code.slice(0, LONGUEUR_CODE / 2)}-${code.slice(LONGUEUR_CODE / 2)}`
}

/**
 * Ramène ce que la personne a saisi à la forme canonique, ou `null` si ça ne peut pas être un code : majuscules,
 * espaces et tirets ignorés (`k7qm 4xpd`, `K7QM-4XPD`), jamais de symbole hors alphabet ni de longueur fausse.
 */
export function normaliserCode(saisie: string): string | null {
  const code = String(saisie ?? '')
    .toUpperCase()
    .replace(/[\s\-_]/g, '')
  if (code.length !== LONGUEUR_CODE) return null
  for (const c of code) if (!ALPHABET_CODE.includes(c)) return null
  return code
}

/**
 * Empreinte d'un code, la seule chose rangée en base. HMAC avec une clé du serveur (et non un simple hachage) : un code
 * de 40 bits se retrouverait en quelques secondes par force brute à partir d'une empreinte volée, alors qu'avec la clé il
 * faut aussi avoir pris le serveur.
 */
export function empreinteCode(codeNormalise: string, cle: string): string {
  return createHmac('sha256', cle).update(`appairage:${codeNormalise}`).digest('hex')
}

/** Le secret d'un poste : 256 bits aléatoires, en base64url. Montré UNE fois (à la réponse de l'appairage). */
export function genererSecret(): string {
  return randomBytes(32).toString('base64url')
}

/** Empreinte du secret (haute entropie : un SHA-256 simple suffit). */
export function empreinteSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

/** Comparaison à temps constant de deux empreintes hexadécimales. */
export function memeEmpreinte(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8')
  const y = Buffer.from(b, 'utf8')
  return x.length === y.length && timingSafeEqual(x, y)
}

export type EtatCode = 'ACTIF' | 'EPUISE' | 'EXPIRE' | 'ANNULE'

/** Où en est un code : annulé > expiré > épuisé (tous ses postes sont appairés) > actif. */
export function etatCode(
  code: { annuleAt: Date | null; expireAt: Date; usagesMax: number },
  usagesFaits: number,
  maintenant: Date,
): EtatCode {
  if (code.annuleAt) return 'ANNULE'
  if (code.expireAt <= maintenant) return 'EXPIRE'
  if (usagesFaits >= code.usagesMax) return 'EPUISE'
  return 'ACTIF'
}

/**
 * Limite d'essais ratés par origine (adresse IP), en mémoire. Quarante bits ne se devinent pas à la main, mais rien
 * ne justifie de laisser un script essayer dix codes par minute pendant des jours : au-delà de `max` échecs dans la
 * fenêtre, l'origine est bloquée jusqu'à ce que les plus anciens échecs sortent de la fenêtre.
 */
export class LimiteurEchecs {
  private readonly echecs = new Map<string, number[]>()

  constructor(
    private readonly max = 15,
    private readonly fenetreMs = 15 * 60_000,
  ) {}

  private recents(cle: string, maintenant: number): number[] {
    const gardes = (this.echecs.get(cle) ?? []).filter((t) => maintenant - t < this.fenetreMs)
    if (gardes.length) this.echecs.set(cle, gardes)
    else this.echecs.delete(cle)
    return gardes
  }

  enregistrerEchec(cle: string, maintenant = Date.now()): void {
    const gardes = this.recents(cle, maintenant)
    gardes.push(maintenant)
    this.echecs.set(cle, gardes)
  }

  bloque(cle: string, maintenant = Date.now()): boolean {
    return this.recents(cle, maintenant).length >= this.max
  }

  /** Un succès efface l'ardoise de cette origine. */
  oublier(cle: string): void {
    this.echecs.delete(cle)
  }
}
