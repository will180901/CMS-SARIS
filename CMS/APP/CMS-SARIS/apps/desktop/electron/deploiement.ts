/**
 * Déploiement sur plusieurs postes : ce que l'installateur laisse au poste pour qu'il n'ait presque rien à demander.
 *
 * L'installateur écrit `%APPDATA%\CMS SARIS\deploiement.ini` à partir de ses options (`/SERVEUR=`, `/SITE=`, `/POSTE=`)
 * et/ou d'un fichier `deploiement.ini` placé À CÔTÉ de l'installateur (clé USB ou dossier partagé : une seule
 * préparation, puis un double-clic par poste). Format INI, lisible et modifiable au Bloc-notes :
 *
 *     [deploiement]
 *     serveur=https://cms-saris.example.org
 *     site=BZV-01
 *     poste=Accueil {MACHINE}
 *
 *  - serveur : adresse du serveur central — pré-remplit l'écran de configuration ;
 *  - site    : CODE (ou libellé) du site de rattachement — pré-sélectionné à l'étape 2 ;
 *  - poste   : nom du poste ; `{MACHINE}` est remplacé par le nom de l'ordinateur.
 *
 * Ce fichier ne contient JAMAIS d'identifiant ni de mot de passe. Il ne sert que de valeur par défaut : dès que le poste
 * est configuré, ce sont ses propres réglages (`config.json`) qui font foi. Module sans dépendance (testable seul).
 */

export interface Deploiement {
  serveur?: string
  site?: string
  poste?: string
}

const MAX_TEXTE = 80

/**
 * Décode les octets d'un `deploiement.ini`. Le fichier peut venir du Bloc-notes (UTF-8, ou UTF-16 « Unicode ») ou de
 * l'installateur, dont les fonctions INI de Windows écrivent en ANSI (Windows-1252). Les deux peuvent se retrouver dans le
 * MÊME fichier (un fichier du Bloc-notes, complété par une option de l'installateur) : on décode donc LIGNE PAR LIGNE,
 * en UTF-8 strict, à défaut en Windows-1252 — un « é » ne doit pas devenir « Ã© » dans le nom d'un poste.
 */
export function decoderFichier(octets: Uint8Array): string {
  if (octets[0] === 0xff && octets[1] === 0xfe) return new TextDecoder('utf-16le').decode(octets)
  const utf8 = new TextDecoder('utf-8', { fatal: true })
  const ansi = new TextDecoder('windows-1252')
  const lignes: string[] = []
  let debut = 0
  for (let i = 0; i <= octets.length; i++) {
    if (i < octets.length && octets[i] !== 0x0a) continue
    const ligne = octets.subarray(debut, i)
    try {
      lignes.push(utf8.decode(ligne))
    } catch {
      lignes.push(ansi.decode(ligne))
    }
    debut = i + 1
  }
  return lignes.join('\n')
}

/** Lit le contenu d'un `deploiement.ini`. Toute valeur absente ou invalide est simplement ignorée. */
export function analyserDeploiement(texte: string, nomMachine: string): Deploiement {
  const resultat: Deploiement = {}
  let section = ''
  for (const brut of texte.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const ligne = brut.trim()
    if (!ligne || ligne.startsWith(';') || ligne.startsWith('#')) continue
    const entete = /^\[(.+)\]$/.exec(ligne)
    if (entete) {
      section = entete[1]!.trim().toLowerCase()
      continue
    }
    if (section && section !== 'deploiement') continue
    const egal = ligne.indexOf('=')
    if (egal < 1) continue
    const cle = ligne.slice(0, egal).trim().toLowerCase()
    let valeur = ligne.slice(egal + 1).trim()
    if (valeur.length >= 2 && valeur.startsWith('"') && valeur.endsWith('"')) valeur = valeur.slice(1, -1).trim()
    if (!valeur) continue

    if (cle === 'serveur') {
      const url = valeur.replace(/\/+$/, '')
      if (/^https?:\/\/[^\s/]+/i.test(url)) resultat.serveur = url
    } else if (cle === 'site') {
      resultat.site = valeur.slice(0, MAX_TEXTE)
    } else if (cle === 'poste') {
      const nom = valeur.replace(/\{machine\}/gi, nomMachine).trim().slice(0, MAX_TEXTE)
      if (nom) resultat.poste = nom
    }
  }
  return resultat
}

const sansCasse = (s: string): string => s.trim().toLowerCase()

/**
 * Le site demandé par le déploiement, parmi les sites du serveur. On cherche d'abord le CODE (exact, sans tenir compte de la
 * casse), puis le libellé exact : jamais une correspondance « approximative » — pré-sélectionner un mauvais site ferait
 * rattacher un poste, et tous ses actes, au mauvais site.
 */
export function trouverSite<S extends { id: string; code: string; libelle: string }>(
  sites: readonly S[],
  souhait: string | undefined,
): S | null {
  const voulu = sansCasse(souhait ?? '')
  if (!voulu) return null
  return (
    sites.find((s) => sansCasse(s.code) === voulu) ??
    sites.find((s) => sansCasse(s.libelle) === voulu) ??
    null
  )
}
