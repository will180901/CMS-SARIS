/**
 * Les connexions du personnel au fil des journées : qui ouvre l'application à quelle heure, depuis
 * quel appareil et quelle adresse, quand la session est renouvelée, qui se déconnecte en partant et
 * qui ferme simplement son navigateur, qui se trompe de mot de passe, et la position que relève
 * l'appareil à chaque connexion.
 *
 * Il écrit les mêmes lignes que le serveur :
 *  - le JOURNAL des connexions (une ligne par tentative : réussie, échouée, déconnexion) ;
 *  - les SESSIONS, en chaîne par connexion : chaque renouvellement de jeton ferme la session en cours
 *    et en ouvre une neuve, au même `connexionId` (celui de la première ligne de la chaîne) ;
 *  - la règle de la SESSION UNIQUE : se connecter révoque la session ouverte du même compte ; depuis un
 *    AUTRE appareil, le serveur pose d'abord la question (« une session est déjà ouverte »), et la
 *    connexion n'a lieu qu'à la réponse.
 *
 * Ce qui doit rester le même d'un jour à l'autre — l'appareil de chacun, l'heure à laquelle il arrive
 * demain, s'il se déconnecte en partant — est tiré du générateur RACINE, sans état : la génération se
 * fait journée par journée, et la session que l'on laisse ouverte ce soir est fermée par la
 * connexion de demain matin, qu'une autre journée écrira. Les deux journées calculent donc la même
 * chose sans se parler.
 */
import type { Alea } from './alea'
import {
  fauxHashJeton,
  identifiantAppareil,
  userAgentOrdinateur,
  userAgentTelephone,
} from './catalogue-appareils'
import { ipCongolaise, positionDuSite } from './catalogue-reseau'
import {
  ajouterJours,
  estOuvert,
  horairesDuJour,
  instantSecondes,
  jourLocalDe,
  jourOuvertSuivant,
} from './calendrier'
import { ipHabituelle, type ContexteJour, type Soignant } from './contexte'
import { nouvelIdTest } from './marque-test'
import type { LignesJour } from './registre'

/** Durée de vie d'un jeton de rafraîchissement (7 jours), comme le serveur. */
const SEPT_JOURS_MS = 7 * 24 * 3600 * 1000
/** Durée de validité d'un jeton d'accès (paramètre `auth.session_timeout_minutes`, 480 par défaut). */
const JETON_S = 480 * 60

export type Appareil = 'PC' | 'MOBILE'

/** Ce que décide une personne un jour donné — et qui ne dépend que d'elle et du jour. */
export interface PlanJour {
  /** Heure (secondes locales) à laquelle elle saisit son mot de passe, avant l'ouverture du centre. */
  arriveeS: number
  /** Mots de passe faux avant la bonne saisie. */
  echecs: number
  /** Une faute de frappe dans l'identifiant avant le reste. */
  fauteDeFrappe: boolean
  /** Temps qu'elle met à répondre à la question « une session est déjà ouverte ». */
  delaiReponseS: number
  /** Le serveur lui fait confirmer son site de travail : un renouvellement de jeton aussitôt. */
  confirmationSite: boolean
  /** Dans la journée : le navigateur relancé (même poste) ou le passage sur le téléphone. */
  evenement: { type: 'RECONNEXION' | 'BASCULE'; s: number } | null
  /** Se déconnecte en partant (sinon ferme simplement son navigateur). */
  deconnexion: boolean
}

export function planDeJournee(
  racine: Alea,
  qui: Soignant,
  jour: string,
  finPeriode: string,
): PlanJour {
  const a = racine.sousFlux(`connexion|${qui.utilisateurId}|${jour}`)
  const h = horairesDuJour(jour)
  const ouverture = (h?.ouverture ?? 450) * 60
  const fermeture = (h?.fermeture ?? 990) * 60
  const arriveeS = ouverture - a.entier(2, 50) * 60 + a.entier(0, 59)
  const echecs = a.proba(0.04) ? (a.proba(0.2) ? 2 : 1) : 0
  const fauteDeFrappe = a.proba(0.015)
  const delaiReponseS = a.entier(8, 70)
  const confirmationSite = a.proba(0.08)
  const type = a.pondere([
    [null, 91],
    ['RECONNEXION', 6],
    ['BASCULE', 3],
  ] as const)
  const debutPlage = Math.max(arriveeS, ouverture) + 90 * 60
  const finPlage = fermeture - 30 * 60
  const evenement =
    type !== null && finPlage > debutPlage
      ? { type, s: a.entier(debutPlage, finPlage) }
      : null
  // Le dernier jour de la période, tout le monde se déconnecte : une session restée ouverte
  // gênerait la première connexion réelle de la personne (« une session est déjà ouverte »).
  const dernierJour = jourOuvertSuivant(jour) > finPeriode
  return {
    arriveeS,
    echecs,
    fauteDeFrappe,
    delaiReponseS,
    confirmationSite,
    evenement,
    deconnexion: dernierJour ? true : a.proba(0.65),
  }
}

/**
 * Le départ d'AUJOURD'HUI : ce qui tomberait après « maintenant » (le soir, après la fermeture) n'a pas
 * encore eu lieu. Le départ est ramené `tirageS` secondes avant maintenant — mais jamais avant le début
 * de la dernière connexion du jour (+ 2 minutes) ni avant le dernier geste (+ 2 minutes) : on ne part
 * pas avant d'être arrivé, ni avant d'avoir fini. Et jamais après maintenant : si le dernier geste est à
 * quelques secondes de maintenant, on part à maintenant.
 */
export function departAvantMaintenant(
  departS: number,
  limiteS: number,
  debutDerniereConnexionS: number,
  dernierGesteS: number,
  tirageS: number,
): number {
  if (departS <= limiteS - 60) return departS
  const voulu = Math.max(
    limiteS - tirageS,
    debutDerniereConnexionS + 120,
    dernierGesteS + 120,
  )
  return Math.min(limiteS, voulu)
}

/** Sur quel appareil la personne reste-t-elle connectée en partant ? */
export function appareilFinal(plan: PlanJour): Appareil {
  return plan.evenement?.type === 'BASCULE' ? 'MOBILE' : 'PC'
}

/**
 * Seconde (locale) à laquelle la première session du jour s'ouvre. Si la veille s'est terminée sur le
 * téléphone sans déconnexion, le serveur pose la question avant d'ouvrir : l'ouverture suit la
 * réponse.
 */
export function debutConnexionDuJour(
  plan: PlanJour,
  veille: PlanJour | null,
): number {
  const question =
    veille !== null && !veille.deconnexion && appareilFinal(veille) === 'MOBILE'
  return plan.arriveeS + (question ? plan.delaiReponseS : 0)
}

export function jourOuvertPrecedent(jour: string): string {
  let j = ajouterJours(jour, -1)
  for (let i = 0; i < 14 && !estOuvert(j); i++) j = ajouterJours(j, -1)
  return j
}

// ── L'équipement de chacun ───────────────────────────────────────────────────

type EtatPosition = 'OK' | 'REFUSEE' | 'INDISPONIBLE' | 'SILENCE'

interface Equipement {
  appareilId: string
  userAgent: string
  /** Ce que le navigateur de cet appareil répond d'habitude à la demande de position. */
  position: EtatPosition
  /** Décalage fixe de l'appareil autour du site (degrés). */
  dLat: number
  dLon: number
  /** Marge d'erreur annoncée d'habitude (mètres). */
  precisionM: number
}

/** Ordinateur et téléphone de la personne : identiques d'un jour à l'autre. */
function equipementDe(
  racine: Alea,
  qui: Soignant,
): Record<Appareil, Equipement> {
  const a = racine.sousFlux(`appareils|${qui.utilisateurId}`)
  const habitude = (): EtatPosition =>
    a.pondere([
      ['OK', 78],
      ['REFUSEE', 9],
      ['INDISPONIBLE', 4],
      ['SILENCE', 9],
    ] as const)
  return {
    PC: {
      appareilId: identifiantAppareil(a),
      userAgent: userAgentOrdinateur(a),
      position: habitude(),
      dLat: a.normaleBornee(0, 0.0007, -0.0015, 0.0015),
      dLon: a.normaleBornee(0, 0.0007, -0.0015, 0.0015),
      // Un ordinateur se situe par le wifi : quelques dizaines de mètres, parfois un kilomètre.
      precisionM: a.proba(0.7) ? a.entier(25, 180) : a.entier(900, 2500),
    },
    MOBILE: {
      appareilId: identifiantAppareil(a),
      userAgent: userAgentTelephone(a),
      position: habitude(),
      dLat: a.normaleBornee(0, 0.0015, -0.003, 0.003),
      dLon: a.normaleBornee(0, 0.0015, -0.003, 0.003),
      precisionM: a.entier(6, 40),
    },
  }
}

// ── Une journée de connexions ────────────────────────────────────────────────

interface Chaine {
  appareil: Appareil
  /** Seconde locale où la session s'ouvre. */
  debutS: number
  /** Comment elle s'ouvre : connexion simple, ou après la question « session ouverte ailleurs ». */
  ouverture: 'LOGIN' | 'REMPLACEE'
  /** Seconde locale où la question est posée (ouverture REMPLACEE). */
  questionS?: number
  /** Seconde locale où l'activité cesse dans la journée (relance, bascule, départ). */
  finActiviteS: number
  /** Instant où la session est révoquée : à la déconnexion, par la connexion suivante, ou jamais. */
  revocation: Date | null
  derniereActivite: Date
  ip: string | null
}

const instant = (jour: string, s: number): Date => instantSecondes(jour, s)

/**
 * Écrit les sessions et le journal des connexions de CHAQUE membre du personnel pour la journée :
 * tous travaillent tous les jours d'ouverture. Les heures de départ s'appuient sur ce qu'ils ont fait
 * dans la journée (le journal d'audit déjà écrit) : jamais de geste hors connexion.
 */
export function planifierConnexions(
  ctx: ContexteJour,
  lignes: LignesJour,
): void {
  const h = horairesDuJour(ctx.jour)
  if (!h) return
  const { racine, jour } = ctx
  const finPeriode = ctx.params.finPeriode
  const limite = ctx.params.limite ?? null
  const debutPeriode = ajouterJours(finPeriode, -(ctx.params.totalJours - 1))
  const precedent = jourOuvertPrecedent(jour)
  const suivant = jourOuvertSuivant(jour)
  const siteCode = new Map(ctx.equipes.map((e) => [e.siteId, e.siteCode]))
  const personnel = new Map<string, Soignant>()
  for (const e of ctx.equipes)
    for (const s of [...e.medecins, ...e.infirmiers])
      personnel.set(s.utilisateurId, s)
  const loginsConnus = new Set([...personnel.values()].map((s) => s.login))

  // Les gestes de la journée, par personne : jusqu'où l'application doit rester ouverte.
  const dernierGeste = new Map<string, number>()
  for (const l of lignes.JournalAudit) {
    if (!l.utilisateurId || !(l.createdAt instanceof Date)) continue
    if (jourLocalDe(l.createdAt) !== jour) continue
    const s =
      (l.createdAt.getTime() - instantSecondes(jour, 0).getTime()) / 1000
    if (s > (dernierGeste.get(l.utilisateurId) ?? -1))
      dernierGeste.set(l.utilisateurId, s)
  }

  for (const qui of personnel.values()) {
    const a = ctx.alea.sousFlux(`session|${qui.utilisateurId}`)
    const equipement = equipementDe(racine, qui)
    const planBrut = planDeJournee(racine, qui, jour, finPeriode)
    // Aujourd'hui : le navigateur relancé ou le passage sur le téléphone qui tomberait APRÈS maintenant
    // n'a pas encore eu lieu.
    const plan =
      limite && jour === limite.jour && planBrut.evenement && planBrut.evenement.s > limite.s - 300
        ? { ...planBrut, evenement: null }
        : planBrut
    const veille =
      precedent >= debutPeriode
        ? planDeJournee(racine, qui, precedent, finPeriode)
        : null
    const [latSite, lonSite] = positionDuSite(siteCode.get(qui.siteId) ?? '')
    const ipPC = ipHabituelle(ctx.ips, qui)

    // ── Les chaînes de la journée ──────────────────────────────────────────────
    const debut = debutConnexionDuJour(plan, veille)
    const question =
      veille !== null &&
      !veille.deconnexion &&
      appareilFinal(veille) === 'MOBILE'
    const chaines: Chaine[] = [
      {
        appareil: 'PC',
        debutS: debut,
        ouverture: question ? 'REMPLACEE' : 'LOGIN',
        questionS: question ? plan.arriveeS : undefined,
        finActiviteS: 0,
        revocation: null,
        derniereActivite: instant(jour, debut),
        ip: ipPC,
      },
    ]
    if (plan.evenement) {
      const ev = plan.evenement
      chaines[0].finActiviteS = ev.s
      chaines[0].revocation = instant(jour, ev.s)
      chaines[0].derniereActivite = instant(jour, ev.s - a.entier(1, 240))
      chaines.push(
        ev.type === 'RECONNEXION'
          ? {
              appareil: 'PC',
              debutS: ev.s,
              ouverture: 'LOGIN',
              finActiviteS: 0,
              revocation: null,
              derniereActivite: instant(jour, ev.s),
              ip: ipPC,
            }
          : {
              appareil: 'MOBILE',
              debutS: ev.s,
              ouverture: 'REMPLACEE',
              questionS: ev.s - plan.delaiReponseS,
              finActiviteS: 0,
              revocation: null,
              derniereActivite: instant(jour, ev.s),
              // Un téléphone change d'adresse au gré du réseau mobile.
              ip: ipCongolaise(a),
            },
      )
    }

    // ── Le départ : dernier geste, fermeture du centre, un peu de retard ────────
    const derniere = chaines[chaines.length - 1]
    const geste = dernierGeste.get(qui.utilisateurId) ?? 0
    let departS =
      Math.max(geste + 120, h.fermeture * 60 + 900) + a.entier(0, 2400)
    // Aujourd'hui, centre OUVERT : le personnel travaille encore (la file d'attente du moment est entre ses mains).
    // Il est connecté, sa dernière activité date de quelques secondes ; il ne s'est pas déconnecté.
    const centreOuvert = !!limite && jour === limite.jour && limite.s < h.fermeture * 60
    // Aujourd'hui, centre fermé : on ne part pas dans le futur.
    if (limite && centreOuvert)
      departS = Math.min(
        limite.s,
        Math.max(limite.s - a.entier(5, 90), derniere.debutS + 120, geste + 120),
      )
    else if (limite && jour === limite.jour)
      departS = departAvantMaintenant(
        departS,
        limite.s,
        derniere.debutS,
        geste,
        a.entier(60, 600),
      )
    derniere.finActiviteS = departS
    const seDeconnecte = plan.deconnexion && !centreOuvert
    if (seDeconnecte) {
      derniere.revocation = instant(jour, departS)
      derniere.derniereActivite = instant(jour, departS - a.entier(0, 120))
    } else {
      // Navigateur fermé : la session reste ouverte. La connexion du prochain jour d'ouverture la
      // fermera, à l'instant où elle s'ouvre elle-même.
      derniere.derniereActivite = instant(jour, departS)
      if (suivant <= finPeriode) {
        const demain = planDeJournee(racine, qui, suivant, finPeriode)
        derniere.revocation = instant(
          suivant,
          debutConnexionDuJour(demain, plan),
        )
      }
    }

    // ── Les lignes de chaque chaîne ────────────────────────────────────────────
    const echecsAvant = (s: number, appareil: Appareil, ip: string | null) => {
      const ua = equipement[appareil].userAgent
      let t = s
      for (let i = 0; i < plan.echecs; i++) {
        t -= a.entier(8, 40)
        lignes.JournalAuthentification.push({
          id: nouvelIdTest(),
          utilisateurId: qui.utilisateurId,
          login: qui.login,
          resultat: 'ECHEC_MOT_DE_PASSE',
          ipAdresse: ip,
          userAgent: ua,
          createdAt: instant(jour, t),
          connexionId: null,
          posteLocalId: null,
        })
      }
      if (plan.fauteDeFrappe) {
        t -= a.entier(15, 60)
        let tape =
          qui.login.length > 3 ? qui.login.slice(0, -1) : `${qui.login}1`
        if (loginsConnus.has(tape)) tape = `${qui.login}.`
        lignes.JournalAuthentification.push({
          id: nouvelIdTest(),
          utilisateurId: null,
          login: tape,
          resultat: 'ECHEC_LOGIN_INCONNU',
          ipAdresse: ip,
          userAgent: ua,
          createdAt: instant(jour, t),
          connexionId: null,
          posteLocalId: null,
        })
      }
    }

    chaines.forEach((c, k) => {
      const eq = equipement[c.appareil]
      // Les moments où la session est renouvelée : confirmation du site tout de suite, puis à
      // l'expiration du jeton d'accès (une longue journée).
      const renouvellements: number[] = []
      if (k === 0 && plan.confirmationSite)
        renouvellements.push(c.debutS + a.entier(4, 40))
      const expiration = c.debutS + JETON_S + a.entier(0, 900)
      if (expiration < c.finActiviteS) renouvellements.push(expiration)
      const instants = [c.debutS, ...renouvellements.sort((x, y) => x - y)]
      const premierId = nouvelIdTest()
      instants.forEach((t, i) => {
        const dernierRang = i === instants.length - 1
        const creee = instant(jour, t)
        const suiteS = dernierRang ? null : instants[i + 1]
        lignes.SessionUtilisateur.push({
          id: i === 0 ? premierId : nouvelIdTest(),
          utilisateurId: qui.utilisateurId,
          posteLocalId: null,
          refreshTokenHash: fauxHashJeton(a),
          ipAdresse: c.ip,
          userAgent: eq.userAgent,
          createdAt: creee,
          expiresAt: new Date(creee.getTime() + SEPT_JOURS_MS),
          revokedAt: dernierRang
            ? c.revocation
            : instant(jour, suiteS as number),
          // Une session renouvelée tout près de la fin de la connexion : son activité commence à son ouverture.
          derniereActiviteAt: dernierRang
            ? new Date(Math.max(+c.derniereActivite, +creee))
            : instant(jour, (suiteS as number) - a.entier(0, 4)),
          appareilId: eq.appareilId,
          connexionId: premierId,
        })
      })

      // Le journal : les échecs de la première saisie du jour, la question éventuelle, la connexion.
      if (k === 0) echecsAvant(c.questionS ?? c.debutS, c.appareil, c.ip)
      if (c.ouverture === 'REMPLACEE')
        lignes.JournalAuthentification.push({
          id: nouvelIdTest(),
          utilisateurId: qui.utilisateurId,
          login: qui.login,
          resultat: 'SUCCES_LOGIN_SESSION_ACTIVE',
          ipAdresse: c.ip,
          userAgent: eq.userAgent,
          createdAt: instant(jour, c.questionS as number),
          connexionId: null,
          posteLocalId: null,
        })
      lignes.JournalAuthentification.push({
        id: nouvelIdTest(),
        utilisateurId: qui.utilisateurId,
        login: qui.login,
        resultat:
          c.ouverture === 'REMPLACEE'
            ? 'SUCCES_LOGIN_SESSION_REMPLACEE'
            : 'SUCCES_LOGIN',
        ipAdresse: c.ip,
        userAgent: eq.userAgent,
        createdAt: instant(jour, c.debutS),
        connexionId: premierId,
        posteLocalId: null,
        ...positionDe(a, eq, latSite, lonSite, instant(jour, c.debutS)),
      })
      if (k === chaines.length - 1 && seDeconnecte)
        lignes.JournalAuthentification.push({
          id: nouvelIdTest(),
          utilisateurId: qui.utilisateurId,
          login: qui.login,
          resultat: 'SUCCES_LOGOUT',
          ipAdresse: c.ip,
          userAgent: eq.userAgent,
          createdAt: instant(jour, departS),
          connexionId: null,
          posteLocalId: null,
        })
    })
  }
}

/**
 * Ce que le navigateur répond à la demande de position, à la connexion. Un appareil répond presque
 * toujours la même chose (l'autorisation est mémorisée) ; de temps en temps, autre chose.
 */
function positionDe(
  alea: Alea,
  eq: Equipement,
  latSite: number,
  lonSite: number,
  connexion: Date,
): {
  positionStatut: string | null
  latitude: number | null
  longitude: number | null
  precisionM: number | null
  positionLe: Date | null
} {
  let etat = eq.position
  if (alea.proba(0.05))
    etat = alea.choisir(['OK', 'REFUSEE', 'INDISPONIBLE', 'SILENCE'] as const)
  const reponse = new Date(connexion.getTime() + alea.entier(3, 25) * 1000)
  if (etat === 'SILENCE')
    return {
      positionStatut: null,
      latitude: null,
      longitude: null,
      precisionM: null,
      positionLe: null,
    }
  if (etat !== 'OK')
    return {
      positionStatut: etat,
      latitude: null,
      longitude: null,
      precisionM: null,
      positionLe: reponse,
    }
  const arrondi = (x: number, n: number) => Math.round(x * 10 ** n) / 10 ** n
  return {
    positionStatut: 'OK',
    latitude: arrondi(latSite + eq.dLat + alea.normale(0, 0.00015), 6),
    longitude: arrondi(lonSite + eq.dLon + alea.normale(0, 0.00015), 6),
    precisionM: Math.round(eq.precisionM * (0.8 + alea.float() * 0.5)),
    positionLe: reponse,
  }
}
