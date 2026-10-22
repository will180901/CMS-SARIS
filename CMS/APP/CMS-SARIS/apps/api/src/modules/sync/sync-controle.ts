/**
 * Contrôle du flux, côté POSTE : lire les ordres du serveur et décider quoi en faire.
 *
 * Isolé du client de synchronisation pour être testé SANS réseau ni base : ce sont des
 * décisions pures — « cette réponse dit-elle de suspendre ? », « faut-il retélécharger ? ».
 * Le client (sync-client.service.ts) ne fait que les appliquer.
 *
 * Trois ordres existent :
 *  - SUSPENSION : le serveur refuse les échanges du poste (HTTP 423, `POSTE_SUSPENDU`).
 *    Le poste cesse d'essayer, garde son travail en local, et reprend dès qu'un battement
 *    de vie lui dit qu'il est libéré ;
 *  - RESYNCHRONISATION COMPLÈTE : le poste retélécharge tout, puis l'accuse au serveur ;
 *  - VIDAGE : le serveur a vidé ses données métier ; le poste vide sa copie locale, puis l'accuse.
 *    Tant que ce n'est pas accusé, le serveur refuse ses échanges (HTTP 423, `VIDAGE_EN_ATTENTE`).
 */

/**
 * Niveau des ordres du serveur que CE poste comprend. Annoncé au serveur par chaque
 * battement de vie : tant qu'un poste ne l'annonce pas (version ancienne), le serveur ne lui
 * demande rien qu'il ignorerait, et l'interface n'offre pas de bouton sans effet.
 *   1 = suspension affichée + resynchronisation complète + identification à la réception.
 *   2 = vidage des données métier (vide sa copie locale puis l'accuse).
 */
export const NIVEAU_CONTROLE = 2

/**
 * Ligne RÉSERVÉE de la table des paramètres LOCALE du poste : la date du dernier vidage que ce poste
 * a effectué. C'est ce qui l'empêche de vider DEUX FOIS la même demande — après un redémarrage entre
 * son vidage et son accusé, il ne doit ni revider (le travail fait depuis serait perdu) ni oublier
 * d'accuser.
 */
export const CLE_VIDAGE_APPLIQUE = 'systeme.vidage_applique'

/**
 * Curseur de réception d'une resynchronisation COMPLÈTE : l'origine des temps.
 *
 * Le curseur (`SyncState.lastPulledAt`) n'est PAS nullable — il vaut `now()` par défaut — :
 * « repartir de zéro » ne peut donc pas s'écrire `null` (la base le refuse, et le cycle
 * échouerait à chaque tentative). On le remet au 1er janvier 1970, ce qui demande au serveur
 * tout ce qui a changé depuis toujours — c'est-à-dire tout.
 */
export const CURSEUR_ORIGINE = new Date(0)

// ── Le curseur d'ENVOI (poste → central) ─────────────────────────────────────
//
// `SyncState.lastPushedAt` dit « tout ce que ce poste a écrit AVANT cet instant est parti ».
// Il se COMPARE à l'`updatedAt` des lignes écrites sur le poste — donc à l'HORLOGE DU POSTE. Il
// était placé à l'heure du SERVEUR, relevée à la FIN de l'échange : deux défauts.
//  - une écriture faite pendant l'envoi (entre la collecte et la réponse) était datée AVANT ce
//    curseur : jugée « déjà partie », elle ne repartait jamais ;
//  - un poste dont l'horloge retarde sur celle du serveur de quelques minutes perdait, de la même
//    façon, tout ce qu'il écrivait dans cet intervalle après chaque envoi.
// Le curseur est maintenant le DÉBUT de la collecte, lu sur le poste lui-même.

/**
 * Marge de sécurité (ms) sous le début de la collecte. Une ligne datée juste avant ce début peut
 * n'avoir été validée en base qu'un instant après la lecture ; la revoir au prochain envoi ne coûte
 * rien (« le plus récent gagne » : une ligne identique ne change rien côté serveur).
 */
export const MARGE_CURSEUR_ENVOI_MS = 1000

/**
 * Délai (ms) entre une écriture sur le poste et son envoi : assez court pour que l'équipe voie
 * le travail presque tout de suite, assez long pour regrouper une rafale d'écritures en un échange.
 */
export const DELAI_ENVOI_APRES_ECRITURE_MS = 1500

/**
 * D'où collecter ce qui reste à envoyer. `undefined` = depuis toujours (aucun envoi encore).
 *
 * Un curseur situé dans le FUTUR du poste (son horloge a été remise en arrière, ou le curseur
 * date d'une version qui le plaçait à l'heure du serveur) ferait ignorer toute écriture à venir.
 * On le recule alors de l'écart constaté, plus une minute : au pire des lignes déjà parties sont
 * renvoyées (sans effet), jamais une ligne n'est oubliée.
 */
export function curseurEnvoiDepuis(
  lastPushedAt: string | undefined,
  maintenant: number,
): string | undefined {
  if (!lastPushedAt) return undefined
  const t = Date.parse(lastPushedAt)
  if (Number.isNaN(t)) return undefined
  if (t <= maintenant) return lastPushedAt
  return new Date(maintenant - (t - maintenant) - 60_000).toISOString()
}

/** Le curseur à enregistrer après un envoi réussi : le DÉBUT de la collecte (heure du poste), moins la marge. */
export function curseurApresEnvoi(debutCollecte: string): Date {
  return new Date(Date.parse(debutCollecte) - MARGE_CURSEUR_ENVOI_MS)
}

/**
 * À partir de quand une écriture locale reste-t-elle « à envoyer » ? Les lignes de la marge ont
 * déjà été prises par le dernier envoi (on ne les relit que par précaution) : elles ne comptent
 * pas comme du travail en attente.
 */
export function debutAEnvoyer(
  lastPushedAt: string | undefined,
  maintenant: number,
): string | undefined {
  const depuis = curseurEnvoiDepuis(lastPushedAt, maintenant)
  return depuis
    ? new Date(Date.parse(depuis) + MARGE_CURSEUR_ENVOI_MS).toISOString()
    : undefined
}

/** Ce que le serveur dit au poste, en réponse à un battement de vie. */
export interface OrdresServeur {
  suspendu: boolean
  motif: string | null
  /** Date (ISO) de la demande de resynchronisation complète, tant qu'elle n'est pas accomplie. */
  resyncDemandeeAt: string | null
  /** Date (ISO) du vidage des données métier que le poste n'a pas encore fait et accusé. */
  vidageDemandeAt: string | null
}

/** Une date ISO lisible, sinon `null` : une valeur illisible ne doit jamais déclencher un ordre. */
function dateIso(valeur: unknown): string | null {
  return typeof valeur === 'string' && !Number.isNaN(Date.parse(valeur))
    ? valeur
    : null
}

/**
 * Lit la réponse d'un battement de vie.
 *
 * `null` = AUCUNE information (serveur ancien, réponse illisible, erreur passagère côté
 * serveur) : le poste garde son état tel quel. Surtout pas « libéré » — une suspension ne
 * se lève pas parce qu'une réponse était vide.
 */
export function lireOrdres(corps: unknown): OrdresServeur | null {
  if (!corps || typeof corps !== 'object') return null
  const c = (corps as { controle?: unknown }).controle
  if (!c || typeof c !== 'object') return null
  const o = c as Record<string, unknown>
  return {
    suspendu: o['suspendu'] === true,
    motif: typeof o['motif'] === 'string' && o['motif'] ? o['motif'] : null,
    resyncDemandeeAt: dateIso(o['resyncDemandeeAt']),
    vidageDemandeAt: dateIso(o['vidageDemandeAt']),
  }
}

/**
 * Le MODE du système (production / test) annoncé par le serveur dans la réponse d'un battement de
 * vie. `null` = aucune information (serveur ancien, réponse illisible) : le poste garde le mode
 * qu'il connaît — il ne retombe pas en « production » parce qu'une réponse était vide.
 */
export function lireMode(corps: unknown): 'PRODUCTION' | 'TEST' | null {
  if (!corps || typeof corps !== 'object') return null
  const m = (corps as { mode?: unknown }).mode
  return m === 'TEST' || m === 'PRODUCTION' ? m : null
}

/**
 * Faut-il engager une resynchronisation complète ?
 *
 * Oui si le serveur en demande une que ce poste n'a ni en cours ni déjà accomplie, et qu'il
 * n'est pas suspendu (il ne pourrait de toute façon rien recevoir : la demande attend la
 * levée de la suspension). `dejaPrise` = la demande en cours de traitement, ou la dernière
 * accomplie : on ne refait jamais la MÊME demande, même si le serveur tarde à l'effacer.
 */
export function resyncAEngager(
  ordres: OrdresServeur,
  dejaPrise: string | null,
): boolean {
  return (
    !ordres.suspendu &&
    !!ordres.resyncDemandeeAt &&
    ordres.resyncDemandeeAt !== dejaPrise
  )
}

/**
 * Faut-il vider la copie locale ?
 *
 * Oui si le serveur en demande un que ce poste n'a ni en cours ni déjà accompli, et qu'il n'est pas
 * suspendu (il ne pourrait pas accuser : la demande attend la levée de la suspension). `dejaPris` =
 * la demande en cours de traitement, ou la dernière accomplie : on ne refait jamais la MÊME demande,
 * même si le serveur tarde à l'effacer.
 */
export function vidageAEngager(
  ordres: OrdresServeur,
  dejaPris: string | null,
): boolean {
  return (
    !ordres.suspendu &&
    !!ordres.vidageDemandeAt &&
    ordres.vidageDemandeAt !== dejaPris
  )
}

/**
 * Le vidage a-t-il déjà eu lieu SUR CE POSTE pour cette demande ? `fait` = la date rangée dans la
 * base locale à la fin du vidage. Une demande plus récente que celle-là n'est pas faite ; la même
 * (ou une plus ancienne) l'est — il ne reste alors qu'à l'accuser.
 */
export function vidageDejaFait(
  demande: string,
  fait: string | null | undefined,
): boolean {
  if (!fait) return false
  const f = Date.parse(fait)
  const d = Date.parse(demande)
  if (Number.isNaN(f) || Number.isNaN(d)) return false
  return f >= d
}

/** Refus « vidage en attente » du serveur : ce poste doit d'abord vider sa copie et l'accuser. */
export class VidageEnAttenteError extends Error {
  constructor() {
    super('Vidage des données métier en attente')
    this.name = 'VidageEnAttenteError'
  }
}

/** La réponse du serveur est-elle ce refus ? (HTTP 423 ET code `VIDAGE_EN_ATTENTE`.) */
export function refusDeVidage(
  status: number,
  corps: unknown,
): VidageEnAttenteError | null {
  if (status !== 423 || !corps || typeof corps !== 'object') return null
  return (corps as { code?: unknown }).code === 'VIDAGE_EN_ATTENTE'
    ? new VidageEnAttenteError()
    : null
}

/** Refus « poste suspendu » du serveur : le poste cesse d'essayer au lieu de s'acharner. */
export class PosteSuspenduError extends Error {
  constructor(readonly motif: string | null) {
    super('Échanges suspendus par un administrateur')
    this.name = 'PosteSuspenduError'
  }
}

/**
 * La réponse du serveur est-elle un refus pour cause de suspension ?
 * (HTTP 423 ET code `POSTE_SUSPENDU` : un 423 venu d'ailleurs — un relais, une plateforme —
 * ne doit pas passer pour une décision d'administrateur.)
 */
export function refusDeSuspension(
  status: number,
  corps: unknown,
): PosteSuspenduError | null {
  if (status !== 423 || !corps || typeof corps !== 'object') return null
  const c = corps as { code?: unknown; motif?: unknown }
  if (c.code !== 'POSTE_SUSPENDU') return null
  return new PosteSuspenduError(
    typeof c.motif === 'string' && c.motif ? c.motif : null,
  )
}
