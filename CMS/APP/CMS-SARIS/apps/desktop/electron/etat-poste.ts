/**
 * « État du poste » : un petit fichier que l'INSTALLATEUR lit sans démarrer l'application, pour dire à
 * la personne qui réinstalle ou désinstalle s'il reste du travail qui n'a pas atteint le serveur.
 *
 * Écrit dans le dossier de données (`%APPDATA%\CMS SARIS\etat-poste.ini`) au démarrage du service local,
 * puis chaque minute, puis à la fermeture. Format INI : NSIS sait le lire nativement (ReadINIStr).
 *   enAttente = nombre d'écritures locales non envoyées ; -1 = on ne sait pas (jamais présenté comme 0)
 *   plusDe    = 1 si le nombre est une borne (il y en a davantage)
 *   releve    = heure locale du relevé (affichée telle quelle par l'installateur)
 */
import fs from 'node:fs'
import path from 'node:path'

export const NOM_FICHIER_ETAT = 'etat-poste.ini'

export interface EtatPoste {
  version: string
  /** `null` = inconnu (base illisible, service local muet). */
  enAttente: number | null
  plusDe: boolean
  releve: Date
}

const deux = (n: number): string => String(n).padStart(2, '0')

/** « 2026-10-22 08:30 », à l'heure locale du poste. */
export function heureLocale(d: Date): string {
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())} ${deux(d.getHours())}:${deux(d.getMinutes())}`
}

export function formaterEtatPoste(e: EtatPoste): string {
  return [
    '[poste]',
    `version=${e.version}`,
    `enAttente=${e.enAttente === null ? -1 : e.enAttente}`,
    `plusDe=${e.plusDe ? 1 : 0}`,
    `releve=${heureLocale(e.releve)}`,
    '',
  ].join('\r\n')
}

/**
 * Interroge le service local : combien d'écritures restent à envoyer ?
 * `null` = on ne sait pas (service muet, réponse illisible, base illisible). `enabled: false`
 * (pas de synchronisation sur ce service) est traité comme « rien à envoyer ».
 */
export async function lireEnAttente(
  apiLocale: string,
  delaiMs = 2500,
): Promise<{ enAttente: number; plusDe: boolean } | null> {
  const ctrl = new AbortController()
  const minuteur = setTimeout(() => ctrl.abort(), delaiMs)
  try {
    const res = await fetch(`${apiLocale}/sync/en-attente`, { signal: ctrl.signal })
    if (!res.ok) return null
    const corps = (await res.json()) as { enabled?: boolean; enAttente?: number | null; plusDe?: boolean }
    if (corps.enabled === false) return { enAttente: 0, plusDe: false }
    if (typeof corps.enAttente !== 'number') return null
    return { enAttente: corps.enAttente, plusDe: corps.plusDe === true }
  } catch {
    return null
  } finally {
    clearTimeout(minuteur)
  }
}

/** Écrit le fichier d'état (écriture atomique : l'installateur ne lit jamais un fichier à moitié écrit). */
export function ecrireFichierEtat(dossier: string, etat: EtatPoste): void {
  const cible = path.join(dossier, NOM_FICHIER_ETAT)
  const temporaire = `${cible}.tmp`
  fs.writeFileSync(temporaire, formaterEtatPoste(etat), 'utf8')
  fs.renameSync(temporaire, cible)
}
