/**
 * Contrôle du flux, côté POSTE : lire les ordres du serveur et décider quoi en faire.
 *
 * Isolé du client de synchronisation pour être testé SANS réseau ni base : ce sont des
 * décisions pures — « cette réponse dit-elle de suspendre ? », « faut-il retélécharger ? ».
 * Le client (sync-client.service.ts) ne fait que les appliquer.
 *
 * Deux ordres existent :
 *  - SUSPENSION : le serveur refuse les échanges du poste (HTTP 423, `POSTE_SUSPENDU`).
 *    Le poste cesse d'essayer, garde son travail en local, et reprend dès qu'un battement
 *    de vie lui dit qu'il est libéré ;
 *  - RESYNCHRONISATION COMPLÈTE : le poste retélécharge tout, puis l'accuse au serveur.
 */

/**
 * Niveau des ordres du serveur que CE poste comprend. Annoncé au serveur par chaque
 * battement de vie : tant qu'un poste ne l'annonce pas (version ancienne), le serveur ne lui
 * demande rien qu'il ignorerait, et l'interface n'offre pas de bouton sans effet.
 *   1 = suspension affichée + resynchronisation complète + identification à la réception.
 */
export const NIVEAU_CONTROLE = 1

/**
 * Curseur de réception d'une resynchronisation COMPLÈTE : l'origine des temps.
 *
 * Le curseur (`SyncState.lastPulledAt`) n'est PAS nullable — il vaut `now()` par défaut — :
 * « repartir de zéro » ne peut donc pas s'écrire `null` (la base le refuse, et le cycle
 * échouerait à chaque tentative). On le remet au 1er janvier 1970, ce qui demande au serveur
 * tout ce qui a changé depuis toujours — c'est-à-dire tout.
 */
export const CURSEUR_ORIGINE = new Date(0)

/** Ce que le serveur dit au poste, en réponse à un battement de vie. */
export interface OrdresServeur {
  suspendu: boolean
  motif: string | null
  /** Date (ISO) de la demande de resynchronisation complète, tant qu'elle n'est pas accomplie. */
  resyncDemandeeAt: string | null
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
  const demande = o['resyncDemandeeAt']
  return {
    suspendu: o['suspendu'] === true,
    motif: typeof o['motif'] === 'string' && o['motif'] ? o['motif'] : null,
    resyncDemandeeAt:
      typeof demande === 'string' && !Number.isNaN(Date.parse(demande))
        ? demande
        : null,
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
