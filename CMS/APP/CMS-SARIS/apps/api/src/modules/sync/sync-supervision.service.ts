/**
 * SyncSupervisionService — traçabilité + supervision de la synchronisation,
 * côté SERVEUR CENTRAL uniquement.
 *
 *  - record()        : à chaque lot reçu d'un poste, enregistre le poste (dernière synchro),
 *                      un journal (JournalSynchronisation), les conflits détaillés
 *                      (ConflitSynchronisation) et l'état par poste (SyncState), puis
 *                      pousse un événement TEMPS RÉEL (broadcastLive) pour rafraîchir l'UI.
 *  - getSupervision(): postes (en ligne/hors-ligne + dernière synchro), activité récente
 *                      (journaux) et conflits en attente — pour l'écran de supervision.
 *  - getPosteDetail() : détail d'un poste (modale) — dernière session connectée (début/fin).
 *  - masquerPoste()   : retire un poste de la liste (dismiss) ; réapparaît à sa prochaine synchro.
 *  - getActiviteParPoste / getBilanPoste / getConflitsPoste : l'activité regroupée PAR POSTE et
 *                      la fiche d'un poste (réussites, refus, conflits) — jamais le contenu des fiches.
 *  - purgerActivite() : vide l'historique des échanges (la quarantaine est conservée par défaut).
 *  - CONTRÔLE DU FLUX : suspendrePoste / reprendrePoste (le serveur refuse alors les échanges du
 *                      poste, cf. assertPosteActif), demanderResync / annulerResync / accuserResync
 *                      (resynchronisation complète). Les ordres parviennent au poste dans la
 *                      réponse de son battement de vie (heartbeat). Chaque décision est tracée.
 */
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { CI, parMots } from '../../common/prisma/search'
import { NotificationService } from '../notification/notification.service'

export interface SyncConflictDetail {
  /** uuid de la mutation / id de l'entité en conflit */
  id: string
  model: string
  winner: 'incoming' | 'existing'
  valeurLocale: unknown
  valeurServeur: unknown
}

export interface SyncRecordInput {
  posteLocalId: string
  siteId: string
  userId: string
  startedAt: Date
  applied: number
  conflicts: SyncConflictDetail[]
  /** Changements refusés par le serveur : mis en QUARANTAINE (type REJET_SERVEUR, à revoir
   *  dans la supervision) avec la donnée du poste — rien n'est perdu en silence. */
  rejets?: {
    id: string
    model: string
    raison: string
    valeurLocale: Record<string, unknown>
  }[]
}

/** Un poste est considéré « en ligne » s'il a donné signe de vie (battement ou synchro) dans
 *  les 90 dernières secondes — aligné sur le battement du poste (~30 s, cf. sync-client.service),
 *  avec une marge de 2 battements manqués avant de basculer « hors ligne ». */
export const ONLINE_WINDOW_MS = 90_000

/** Ordre de priorité d'affichage quand un utilisateur porte plusieurs rôles (même ordre que
 *  `getPrimaryRole` côté web, apps/web/src/config/navigation.config.ts). */
const ROLE_PRIORITY = ['ADMIN_SYSTEME', 'MEDECIN_CHEF', 'INFIRMIER']

/** Niveau des ordres du serveur à partir duquel un poste comprend la resynchronisation
 *  complète (et affiche sa suspension). Un poste plus ancien les ignore. */
export const NIVEAU_CONTROLE_RESYNC = 1

/** Niveau à partir duquel un poste sait vider sa copie locale quand le serveur a vidé la sienne. */
export const NIVEAU_CONTROLE_VIDAGE = 2

/** HTTP 423 « Locked » : la ressource existe mais est verrouillée — ici, un poste suspendu. */
const HTTP_LOCKED = 423

/** Ce que le serveur dit à un poste, en réponse à chacun de ses battements de vie. */
export interface ControlePoste {
  suspendu: boolean
  motif: string | null
  /** Date (ISO) de la resynchronisation complète demandée, tant que le poste ne l'a pas faite. */
  resyncDemandeeAt: string | null
  /** Date (ISO) du vidage des données métier que le poste doit encore faire (puis accuser). */
  vidageDemandeAt: string | null
}

/** Bilan des échanges d'un poste, cumulé à partir des lignes groupées du journal. */
interface BilanEchanges {
  nbEchanges: number
  /** Échanges sans aucun désaccord ni refus. */
  nbReussis: number
  /** Échanges ayant produit au moins un conflit ou un refus. */
  nbAvecConflits: number
  nbMutations: number
  /** Somme des conflits et refus de tous les échanges. */
  nbConflits: number
  premierEchangeAt: Date | null
  dernierEchangeAt: Date | null
}

/** Une ligne du regroupement du journal, par statut d'échange. */
interface LigneGroupee {
  statut: string
  _count: { _all: number }
  _sum: { nbMutations: number | null; nbConflits: number | null }
  _min: { startedAt: Date | null }
  _max: { startedAt: Date | null }
}

function bilanVide(): BilanEchanges {
  return {
    nbEchanges: 0,
    nbReussis: 0,
    nbAvecConflits: 0,
    nbMutations: 0,
    nbConflits: 0,
    premierEchangeAt: null,
    dernierEchangeAt: null,
  }
}

function cumuler(b: BilanEchanges, g: LigneGroupee): void {
  b.nbEchanges += g._count._all
  if (g.statut === 'REUSSIE') b.nbReussis += g._count._all
  if (g.statut === 'CONFLITS') b.nbAvecConflits += g._count._all
  b.nbMutations += g._sum.nbMutations ?? 0
  b.nbConflits += g._sum.nbConflits ?? 0
  const debut = g._min.startedAt
  if (debut && (!b.premierEchangeAt || debut < b.premierEchangeAt))
    b.premierEchangeAt = debut
  const fin = g._max.startedAt
  if (fin && (!b.dernierEchangeAt || fin > b.dernierEchangeAt))
    b.dernierEchangeAt = fin
}

/** Raison d'un refus, telle que `record()` l'a rangée dans `valeurServeur` (`{ erreur }`). */
function raisonDuRefus(valeurServeur: unknown): string | null {
  if (valeurServeur && typeof valeurServeur === 'object') {
    const erreur = (valeurServeur as { erreur?: unknown }).erreur
    if (typeof erreur === 'string') return erreur
  }
  return null
}

@Injectable()
export class SyncSupervisionService {
  private readonly logger = new Logger('SyncSupervision')

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  private get isSqlite(): boolean {
    return process.env['DATABASE_PROVIDER'] === 'sqlite'
  }

  /** Enregistre un cycle de synchro reçu d'un poste (no-op sur un poste local SQLite). */
  async record(input: SyncRecordInput): Promise<void> {
    if (this.isSqlite) return
    const { posteLocalId, siteId, userId, startedAt, applied, conflicts } =
      input
    const rejets = input.rejets ?? []
    const now = new Date()

    try {
      // 1. Poste connu + horodatage de la dernière synchro + DERNIER utilisateur connecté
      //    (traçabilité seule, pas de relation FK — cf. createdBy/updatedBy ailleurs au schéma).
      //    `masque: false` — un poste qui resynchronise redevient visible même s'il avait été
      //    retiré (dismiss) de la liste de supervision entre-temps.
      //    Le `siteId` reçu est celui de l'utilisateur connecté : il ne sert qu'à la
      //    CRÉATION, jamais à la mise à jour — sinon un soignant de passage déplacerait
      //    le poste sur son propre site (cf. heartbeat()).
      await this.prisma.posteLocal.upsert({
        where: { id: posteLocalId },
        update: {
          derniereSyncAt: now,
          dernierUtilisateurId: userId,
          masque: false,
        },
        create: {
          id: posteLocalId,
          siteId,
          libelle: this.defaultLibelle(posteLocalId),
          derniereSyncAt: now,
          dernierUtilisateurId: userId,
        },
      })

      // 2. Journal du cycle (réussi / avec conflits).
      const journal = await this.prisma.journalSynchronisation.create({
        data: {
          posteLocalId,
          startedAt,
          finishedAt: now,
          statut: conflicts.length + rejets.length ? 'CONFLITS' : 'REUSSIE',
          nbMutations: applied,
          nbConflits: conflicts.length + rejets.length,
        },
      })

      // 3. Conflits détaillés (valeur locale vs serveur, pour inspection).
      for (const c of conflicts) {
        await this.prisma.conflitSynchronisation.create({
          data: {
            journalId: journal.id,
            mutationUuid: c.id,
            entiteType: c.model,
            entiteId: c.id,
            typeConflit:
              c.winner === 'incoming' ? 'LOCAL_GAGNE' : 'SERVEUR_GAGNE',
            valeurLocale: (c.valeurLocale ?? {}) as object,
            valeurServeur: (c.valeurServeur ?? {}) as object,
          },
        })
      }

      // 3 bis. Quarantaine : chaque changement refusé, avec la donnée du poste et la
      //        raison du refus. Avant, un seul refus faisait échouer TOUT le lot, et le poste
      //        renvoyait indéfiniment le même lot sans plus jamais rien remonter.
      for (const r of rejets) {
        await this.prisma.conflitSynchronisation.create({
          data: {
            journalId: journal.id,
            mutationUuid: r.id,
            entiteType: r.model,
            entiteId: r.id,
            typeConflit: 'REJET_SERVEUR',
            valeurLocale: r.valeurLocale as object,
            valeurServeur: { erreur: r.raison } as object,
          },
        })
      }

      // 4. État de synchro par poste.
      await this.prisma.syncState.upsert({
        where: { posteLocalId_siteId: { posteLocalId, siteId } },
        update: { lastPushedAt: now },
        create: { posteLocalId, siteId, lastPushedAt: now },
      })
    } catch (e) {
      // La traçabilité ne doit jamais casser la synchro.
      this.logger.warn(`record() ignoré : ${(e as Error).message}`)
    }

    // 5. Temps réel : rafraîchit l'écran de supervision des administrateurs.
    this.notifications.broadcastLive('SYNC_ACTIVITY', {
      requiredPermission: 'synchronisation.read',
    })
  }

  /** Nom par défaut d'un poste jamais nommé (ni par lui-même, ni par un admin). */
  private defaultLibelle(posteLocalId: string): string {
    return `Poste ${posteLocalId.slice(0, 8)}`
  }

  /**
   * Battement de vie d'un poste (no-op sur un poste local SQLite) — INDÉPENDANT de toute
   * donnée à synchroniser : c'est ce qui fait apparaître le poste dès l'installation (avant
   * même son premier push) et rend le statut en ligne/hors ligne réellement vivant.
   *
   * `libelle` ne sert QU'À LA CRÉATION — jamais d'écrasement d'un nom déjà connu, pour ne
   * jamais effacer un renommage fait depuis la supervision (cf. renamePoste()).
   *
   * `siteId` NON PLUS ne sert qu'à la création. Le site reçu ici est celui de l'utilisateur
   * connecté, pas celui du poste : l'écrire à chaque battement déplacerait le poste dès
   * qu'un soignant d'un autre site s'y connecte, et le site choisi à l'installation ne
   * survivrait pas 30 secondes. Le site d'un poste ne change que par `configurerPoste()`.
   */
  async heartbeat(
    siteId: string,
    posteLocalId: string,
    libelle?: string,
    info: { versionApp?: string; niveauControle?: number } = {},
  ): Promise<ControlePoste | null> {
    if (this.isSqlite) return null
    const now = new Date()
    let controle: ControlePoste | null = null
    try {
      const poste = await this.prisma.posteLocal.upsert({
        where: { id: posteLocalId },
        update: {
          derniereSyncAt: now,
          masque: false,
          // Renseignés seulement s'ils sont dits : un poste ancien n'en dit rien, et ne doit
          // pas effacer ce qu'un battement plus récent aurait appris.
          ...(info.versionApp ? { versionApp: info.versionApp } : {}),
          ...(info.niveauControle !== undefined
            ? { niveauControle: info.niveauControle }
            : {}),
        },
        // Repli pour un poste jamais déclaré (installation ancienne, ou configuration
        // perdue) : mieux vaut le site de l'appelant que pas de poste du tout.
        create: {
          id: posteLocalId,
          siteId,
          libelle: libelle?.trim() || this.defaultLibelle(posteLocalId),
          derniereSyncAt: now,
          versionApp: info.versionApp ?? null,
          niveauControle: info.niveauControle ?? null,
        },
      })
      // Les ordres du serveur voyagent dans la réponse du battement : le poste les apprend
      // en moins de 30 s, sans canal de plus, et sans que le serveur ait à le joindre.
      controle = {
        suspendu: !!poste.suspenduAt,
        motif: poste.suspensionMotif,
        resyncDemandeeAt: poste.resyncDemandeeAt?.toISOString() ?? null,
        vidageDemandeAt: poste.vidageDemandeAt?.toISOString() ?? null,
      }
    } catch (e) {
      // Aucun ordre en cas d'erreur (et non « pas suspendu ») : une base occupée un instant ne
      // doit pas lever une suspension côté poste.
      this.logger.warn(`heartbeat() ignoré : ${(e as Error).message}`)
    }
    this.notifications.broadcastLive('SYNC_ACTIVITY', {
      requiredPermission: 'synchronisation.read',
    })
    return controle
  }

  /**
   * Rattache un poste à son site, à la première installation.
   *
   * Différence essentielle avec `heartbeat` : ici le site est CHOISI et fait
   * autorité, alors que le battement de vie se contente de refléter celui de
   * l'utilisateur connecté. C'est ce choix qui permet ensuite aux actes de porter
   * le site où ils ont réellement eu lieu, et non celui du compte qui les saisit.
   *
   * Le site doit exister : on ne crée jamais un site au passage — ils se gèrent
   * dans Référentiels → Sites, et nulle part ailleurs.
   */
  async configurerPoste(
    posteLocalId: string,
    siteId: string,
    libelle?: string,
    position?: { latitude: number; longitude: number; precisionM?: number },
  ) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true, libelle: true },
    })
    if (!site) throw new NotFoundException('Site introuvable')

    // Position relevée à l'installation. Écrite SEULEMENT si elle est fournie : un
    // poste déjà positionné qu'on reconfigure sans réautoriser la géolocalisation
    // garde la sienne, plutôt que de la perdre silencieusement.
    const champsPosition = position
      ? {
          latitude: position.latitude,
          longitude: position.longitude,
          precisionM:
            position.precisionM !== undefined
              ? Math.round(position.precisionM)
              : null,
          positionAt: new Date(),
        }
      : {}

    const poste = await this.prisma.posteLocal.upsert({
      where: { id: posteLocalId },
      // Reconfiguration assumée : un poste peut être déplacé d'un site à l'autre.
      update: {
        siteId,
        ...(libelle?.trim() ? { libelle: libelle.trim() } : {}),
        ...champsPosition,
        masque: false,
      },
      create: {
        id: posteLocalId,
        siteId,
        libelle: libelle?.trim() || this.defaultLibelle(posteLocalId),
        ...champsPosition,
      },
    })

    this.notifications.broadcastLive('SYNC_ACTIVITY', {
      requiredPermission: 'synchronisation.read',
    })
    return { ...poste, site }
  }

  /**
   * État de configuration d'un poste. Renvoie null s'il n'est pas encore déclaré —
   * c'est ce que le client interroge au démarrage pour savoir s'il doit demander
   * son site.
   */
  async lirePoste(posteLocalId: string) {
    const poste = await this.prisma.posteLocal.findUnique({
      where: { id: posteLocalId },
    })
    if (!poste) return null
    // `PosteLocal` ne déclare pas de relation vers Site (simple colonne) : on
    // résout le libellé séparément pour l'afficher.
    const site = await this.prisma.site.findUnique({
      where: { id: poste.siteId },
      select: { id: true, code: true, libelle: true },
    })
    return { id: poste.id, libelle: poste.libelle, siteId: poste.siteId, site }
  }

  /** Renomme un poste (supervision admin) — nom UNIQUE au sein du site.
   *
   *  Pas de filtre sur le site de l'appelant : la supervision couvre TOUT le parc depuis
   *  le retrait du cloisonnement, et un poste visible dans la liste doit être gérable.
   *  Le contraire donnait un « Poste introuvable » sur une machine affichée à l'écran. */
  async renamePoste(
    posteId: string,
    libelle: string,
  ): Promise<{ libelle: string }> {
    const trimmed = libelle.trim()
    if (!trimmed) throw new BadRequestException('Le nom du poste est requis')

    const poste = await this.prisma.posteLocal.findUnique({
      where: { id: posteId },
    })
    if (!poste) throw new NotFoundException('Poste introuvable')

    // Unicité au sein du site DU POSTE, et non de celui qui renomme : deux sites
    // peuvent tous deux avoir un « Bureau Accueil » sans que cela prête à confusion.
    const doublon = await this.prisma.posteLocal.findFirst({
      where: { siteId: poste.siteId, libelle: trimmed, id: { not: posteId } },
    })
    if (doublon)
      throw new BadRequestException(
        'Ce nom est déjà utilisé par un autre poste',
      )

    await this.prisma.posteLocal.update({
      where: { id: posteId },
      data: { libelle: trimmed },
    })
    this.notifications.broadcastLive('SYNC_ACTIVITY', {
      requiredPermission: 'synchronisation.read',
    })
    return { libelle: trimmed }
  }

  /** Données de l'écran de supervision (scope par site). Postes masqués (dismiss) exclus.
   *  `take` généreux (pas de vraie pagination serveur) : suffisant pour que la pagination
   *  CLIENT de l'écran (Activité/Conflits) reste utile à mesure que le parc de postes grossit,
   *  sans pour autant renvoyer un historique illimité. */
  /**
   * Supervision du PARC — tous sites confondus.
   *
   * Le filtre par site a ete retire : superviser un parc, c'est voir toutes les machines,
   * pas seulement celles du site ou l'on se trouve. Un administrateur connecte a Moutela
   * ne voyait pas qu'un poste de Nkayi etait muet depuis deux jours — precisement
   * l'information que cette page existe pour donner. La visibilite reste gouvernee par la
   * permission `synchronisation.read`, comme partout ailleurs depuis le passage au
   * multi-site sans cloisonnement.
   */
  async getSupervision() {
    const [postes, conflits] = await Promise.all([
      this.prisma.posteLocal.findMany({
        where: { masque: false },
        orderBy: { derniereSyncAt: 'desc' },
      }),
      this.prisma.conflitSynchronisation.findMany({
        where: { statut: 'EN_ATTENTE' },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    ])

    return {
      postes: await this.enrichPostes(postes),
      conflits: conflits.map((c) => ({
        id: c.id,
        entiteType: c.entiteType,
        entiteId: c.entiteId,
        typeConflit: c.typeConflit,
        createdAt: c.createdAt,
      })),
    }
  }

  /**
   * Journal d'activité — PAGINÉ ET FILTRÉ CÔTÉ SERVEUR.
   *
   * Il était auparavant livré avec le reste de la supervision, plafonné aux 200 dernières
   * entrées. Une entrée est écrite à chaque envoi réel de données par un poste : sur un
   * parc de 200 machines en activité, ces 200 lignes ne couvrent plus qu'une vingtaine de
   * minutes. Le journal cessait d'être un journal pour devenir un fil d'actualité.
   *
   * Relever le plafond ne réglerait rien : renvoyer 5 000 lignes pour en afficher 25 est
   * un gaspillage, et l'on ne consulte jamais un journal « en entier » — on y cherche
   * quelque chose de précis. D'où le filtrage ici plutôt qu'un `take` plus généreux.
   */
  async getActivite(params: {
    page?: number
    pageSize?: number
    posteId?: string
    /** 'CONFLITS' pour ne garder que les cycles ayant produit un désaccord. */
    statut?: string
    /** Borne basse sur la date de début (ISO) — « depuis lundi ». */
    depuis?: string
  }) {
    const pageSize = Math.min(Math.max(params.pageSize ?? 25, 1), 200)
    const page = Math.max(params.page ?? 1, 1)

    const where: Prisma.JournalSynchronisationWhereInput = {}
    if (params.posteId) where.posteLocalId = params.posteId
    if (params.statut) where.statut = params.statut
    if (params.depuis) {
      const d = new Date(params.depuis)
      // Une date illisible est ignorée plutôt que de faire échouer la requête : l'écran
      // doit rester consultable même si un paramètre d'URL a été bricolé.
      if (!Number.isNaN(+d)) where.startedAt = { gte: d }
    }

    const [items, total] = await Promise.all([
      this.prisma.journalSynchronisation.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { posteLocal: { select: { libelle: true } } },
      }),
      this.prisma.journalSynchronisation.count({ where }),
    ])

    return {
      items: items.map((j) => ({
        id: j.id,
        poste: j.posteLocal.libelle,
        startedAt: j.startedAt,
        finishedAt: j.finishedAt,
        statut: j.statut,
        nbMutations: j.nbMutations,
        nbConflits: j.nbConflits,
      })),
      total,
      page,
      pageSize,
    }
  }

  /**
   * Activité REGROUPÉE PAR POSTE : une ligne par machine.
   *
   * Le journal écrit un cycle à chaque envoi de données ; sur un poste actif ils se
   * comptent par dizaines, et les lire à plat revenait à chercher « le poste de Nkayi »
   * parmi vingt lignes identiques. Ici chaque machine tient en UNE ligne de bilan ; le
   * détail de ses cycles se lit à la demande (`getActivite` filtré sur le poste).
   *
   * Ne figurent que les postes qui ont déjà échangé quelque chose : « activité » parle
   * d'échanges. Un poste muet depuis toujours est dans la liste des postes, signalé « à
   * surveiller » — pas ici.
   *
   * Le bilan vient d'UNE lecture groupée du journal (jamais une requête par poste) ; seule
   * la page affichée est ensuite enrichie (dernier utilisateur, site).
   */
  async getActiviteParPoste(params: {
    page?: number
    pageSize?: number
    recherche?: string
    statut?: 'CONFLITS'
  }) {
    const pageSize = Math.min(Math.max(params.pageSize ?? 25, 1), 200)
    const page = Math.max(params.page ?? 1, 1)

    const [groupes, quarantaine, conflitsAuto, echangesAvecRefus] =
      await Promise.all([
      this.prisma.journalSynchronisation.groupBy({
        by: ['posteLocalId', 'statut'],
        _count: { _all: true },
        _sum: { nbMutations: true, nbConflits: true },
        _min: { startedAt: true },
        _max: { startedAt: true },
      }),
      this.prisma.conflitSynchronisation.count({
        where: { typeConflit: 'REJET_SERVEUR' },
      }),
      this.prisma.conflitSynchronisation.count({
        where: { typeConflit: { not: 'REJET_SERVEUR' } },
      }),
      // Les échanges qui portent un refus : le vidage par défaut les CONSERVE.
      this.prisma.journalSynchronisation.count({
        where: { conflits: { some: { typeConflit: 'REJET_SERVEUR' } } },
      }),
    ])

    const bilans = new Map<string, BilanEchanges>()
    for (const g of groupes) {
      let b = bilans.get(g.posteLocalId)
      if (!b) {
        b = bilanVide()
        bilans.set(g.posteLocalId, b)
      }
      cumuler(b, g)
    }

    // Les totaux du parc ne dépendent d'aucun filtre : ils servent à annoncer ce qu'un
    // vidage effacerait, pas à décrire la page affichée.
    let echanges = 0
    for (const b of bilans.values()) echanges += b.nbEchanges

    let ids = [...bilans.keys()]
    if (params.statut === 'CONFLITS')
      ids = ids.filter((id) => (bilans.get(id)?.nbAvecConflits ?? 0) > 0)

    const postes = ids.length
      ? await this.prisma.posteLocal.findMany({
          where: {
            id: { in: ids },
            ...parMots(params.recherche, (mot) => [
              { libelle: { contains: mot, ...CI } },
            ]),
          },
        })
      : []

    const dernier = (id: string) =>
      bilans.get(id)?.dernierEchangeAt?.getTime() ?? 0
    // Le plus récemment actif d'abord ; à égalité, ordre alphabétique pour que la liste
    // ne saute pas d'un rafraîchissement à l'autre.
    postes.sort(
      (a, b) =>
        dernier(b.id) - dernier(a.id) || a.libelle.localeCompare(b.libelle),
    )

    const pagePostes = postes.slice((page - 1) * pageSize, page * pageSize)
    const retire = new Map(pagePostes.map((p) => [p.id, p.masque] as const))
    const enrichis = await this.enrichPostes(pagePostes)

    return {
      items: enrichis.map((p) => ({
        ...p,
        retire: retire.get(p.id) ?? false,
        ...(bilans.get(p.id) ?? bilanVide()),
      })),
      total: postes.length,
      page,
      pageSize,
      totaux: { echanges, quarantaine, conflitsAuto, echangesAvecRefus },
    }
  }

  /**
   * Bilan d'UN poste, pour sa fiche : identité, réussites, échanges avec conflits,
   * changements refusés, flux des dernières 24 heures.
   *
   * Un échange « avec conflits » est un échange qui a abouti mais où le serveur et le poste
   * n'étaient pas d'accord (le plus récent l'emporte) ; un changement REFUSÉ est autre chose :
   * le serveur l'a écarté et l'a mis en quarantaine. Les deux sont comptés à part.
   */
  async getBilanPoste(posteId: string) {
    const poste = await this.getPosteDetail(posteId)
    const depuis = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const [groupes, recents, quarantaine, conflitsAuto] = await Promise.all([
      this.prisma.journalSynchronisation.groupBy({
        by: ['statut'],
        where: { posteLocalId: posteId },
        _count: { _all: true },
        _sum: { nbMutations: true, nbConflits: true },
        _min: { startedAt: true },
        _max: { startedAt: true },
      }),
      this.prisma.journalSynchronisation.aggregate({
        where: { posteLocalId: posteId, startedAt: { gte: depuis } },
        _count: { _all: true },
        _sum: { nbMutations: true },
      }),
      this.prisma.conflitSynchronisation.count({
        where: {
          typeConflit: 'REJET_SERVEUR',
          journal: { posteLocalId: posteId },
        },
      }),
      this.prisma.conflitSynchronisation.count({
        where: {
          typeConflit: { not: 'REJET_SERVEUR' },
          journal: { posteLocalId: posteId },
        },
      }),
    ])

    const bilan = bilanVide()
    for (const g of groupes) cumuler(bilan, g)

    return {
      poste,
      bilan: {
        ...bilan,
        quarantaine,
        conflitsAuto,
        dernieres24h: {
          echanges: recents._count._all,
          mutations: recents._sum.nbMutations ?? 0,
        },
      },
    }
  }

  /**
   * Conflits et refus d'UN poste, du plus récent au plus ancien.
   *
   * Ni `valeurLocale` ni `valeurServeur` ne sortent d'ici : ce sont des fiches COMPLÈTES
   * (un dossier patient entier). La supervision a besoin de savoir QUOI a été écarté et
   * POURQUOI — pas de relire la fiche, qui reste, elle, dans la base du poste.
   */
  async getConflitsPoste(
    posteId: string,
    params: {
      page?: number
      pageSize?: number
      type?: 'QUARANTAINE' | 'CONFLITS'
    },
  ) {
    const existe = await this.prisma.posteLocal.findUnique({
      where: { id: posteId },
      select: { id: true },
    })
    if (!existe) throw new NotFoundException('Poste introuvable')

    const pageSize = Math.min(Math.max(params.pageSize ?? 10, 1), 100)
    const page = Math.max(params.page ?? 1, 1)
    const where: Prisma.ConflitSynchronisationWhereInput = {
      journal: { posteLocalId: posteId },
    }
    if (params.type === 'QUARANTAINE') where.typeConflit = 'REJET_SERVEUR'
    else if (params.type === 'CONFLITS')
      where.typeConflit = { not: 'REJET_SERVEUR' }

    const [lignes, total] = await Promise.all([
      this.prisma.conflitSynchronisation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          entiteType: true,
          entiteId: true,
          typeConflit: true,
          createdAt: true,
          valeurServeur: true,
        },
      }),
      this.prisma.conflitSynchronisation.count({ where }),
    ])

    return {
      items: lignes.map((l) => ({
        id: l.id,
        entiteType: l.entiteType,
        entiteId: l.entiteId,
        typeConflit: l.typeConflit,
        createdAt: l.createdAt,
        raison:
          l.typeConflit === 'REJET_SERVEUR'
            ? raisonDuRefus(l.valeurServeur)
            : null,
      })),
      total,
      page,
      pageSize,
    }
  }

  /**
   * Vide l'historique des échanges.
   *
   * La QUARANTAINE est un cas à part. Un changement refusé par le serveur n'est ni perdu
   * ni rejoué : le poste fait avancer son curseur, et la copie gardée ici est la seule
   * qui reste côté serveur. L'effacer en même temps que le bruit des échanges réussis
   * ferait disparaître, sans que personne l'ait décidé, de quoi retrouver une donnée
   * refusée. Par défaut (`echanges`) elle est donc CONSERVÉE — avec les échanges qui la
   * portent, car un refus ne vit pas sans l'échange qui l'a produit. `tout` l'efface aussi.
   *
   * Le vidage se trace lui-même, après coup : effacer l'historique ne doit pas effacer la
   * preuve que quelqu'un l'a fait (même principe que la purge du journal d'audit).
   */
  async purgerActivite(
    portee: 'echanges' | 'tout',
    auteurId: string | null,
    ip: string | null = null,
  ) {
    const [conflits, journaux, quarantaineConservee] =
      portee === 'tout'
        ? await this.prisma.$transaction([
            this.prisma.conflitSynchronisation.deleteMany({}),
            this.prisma.journalSynchronisation.deleteMany({}),
            this.prisma.conflitSynchronisation.count({
              where: { typeConflit: 'REJET_SERVEUR' },
            }),
          ])
        : await this.prisma.$transaction([
            this.prisma.conflitSynchronisation.deleteMany({
              where: { typeConflit: { not: 'REJET_SERVEUR' } },
            }),
            // Un échange qui porte encore un refus reste : le refus en dépend.
            this.prisma.journalSynchronisation.deleteMany({
              where: { conflits: { none: {} } },
            }),
            this.prisma.conflitSynchronisation.count({
              where: { typeConflit: 'REJET_SERVEUR' },
            }),
          ])

    const resultat = {
      echanges: journaux.count,
      conflits: conflits.count,
      quarantaineConservee,
    }

    try {
      await this.prisma.journalAudit.create({
        data: {
          utilisateurId: auteurId,
          action: 'PURGE',
          module: 'synchronisation',
          entiteType: 'JournalSynchronisation',
          ipAdresse: ip,
          statut: 'SUCCES',
          apresJson: { portee, ...resultat },
        },
      })
    } catch (e) {
      // La trace ne doit jamais faire échouer le vidage déjà effectué.
      this.logger.error(
        `Le vidage n'a pas pu être tracé : ${(e as Error).message}`,
      )
    }
    this.logger.log(
      `Historique de synchronisation vidé (${portee}) : ${resultat.echanges} échange(s), ` +
        `${resultat.conflits} conflit(s), ${resultat.quarantaineConservee} refus conservé(s)`,
    )

    this.notifications.broadcastLive('SYNC_ACTIVITY', {
      requiredPermission: 'synchronisation.read',
    })
    return resultat
  }

  /**
   * Détail d'un poste (modale de supervision) : identité enrichie + fenêtre de la DERNIÈRE
   * session connectée (début → fin), déduite de la suite CONTIGUË de journaux de synchro la
   * plus récente (un écart > ONLINE_WINDOW_MS entre deux cycles marque une déconnexion).
   */
  async getPosteDetail(posteId: string) {
    // Tout le parc est visible dans la liste : tout poste de la liste doit s'ouvrir.
    const poste = await this.prisma.posteLocal.findUnique({
      where: { id: posteId },
    })
    if (!poste) throw new NotFoundException('Poste introuvable')

    const journaux = await this.prisma.journalSynchronisation.findMany({
      where: { posteLocalId: posteId },
      orderBy: { startedAt: 'desc' },
      take: 200,
    })

    let sessionDebut: Date | null = null
    let sessionFin: Date | null = null
    if (journaux.length) {
      sessionFin = journaux[0].finishedAt ?? journaux[0].startedAt
      sessionDebut = journaux[0].startedAt
      let curseur = journaux[0].startedAt.getTime()
      for (let i = 1; i < journaux.length; i++) {
        const fin = journaux[i].finishedAt ?? journaux[i].startedAt
        if (curseur - +fin > ONLINE_WINDOW_MS) break // écart trop grand → fin de la session
        sessionDebut = journaux[i].startedAt
        curseur = journaux[i].startedAt.getTime()
      }
    }

    const [enrichi] = await this.enrichPostes([poste])
    return { ...enrichi, sessionDebut, sessionFin }
  }

  /** Retire un poste de la liste de supervision (dismiss) — cf. record() pour le retour.
   *  Sans filtre de site, pour la même raison que getPosteDetail. */
  async masquerPoste(posteId: string): Promise<void> {
    const { count } = await this.prisma.posteLocal.updateMany({
      where: { id: posteId },
      data: { masque: true },
    })
    if (!count) throw new NotFoundException('Poste introuvable')
  }

  // ── Contrôle du flux : suspension et resynchronisation complète ─────────────

  /**
   * Refuse (HTTP 423) les échanges d'un poste SUSPENDU. Appelé avant tout envoi, et avant
   * toute réception pour les postes qui se font connaître.
   *
   * Un poste inconnu n'est pas suspendu : il n'a encore jamais été vu, et sa première
   * synchronisation ne doit pas dépendre d'une ligne qui n'existe pas. Sur la base locale
   * d'un poste, la table est vide — rien n'est jamais refusé.
   *
   * La réponse porte `code: 'POSTE_SUSPENDU'` : un poste à jour y reconnaît une suspension
   * (et l'affiche) au lieu d'une panne ; un poste ancien y voit une simple erreur et réessaie.
   */
  async assertPosteActif(posteLocalId: string | null | undefined): Promise<void> {
    if (!posteLocalId) return
    const p = await this.prisma.posteLocal.findUnique({
      where: { id: posteLocalId },
      select: {
        suspenduAt: true,
        suspensionMotif: true,
        vidageDemandeAt: true,
      },
    })
    if (p?.suspenduAt)
      throw new HttpException(
        {
          statusCode: HTTP_LOCKED,
          code: 'POSTE_SUSPENDU',
          message:
            'Ce poste est suspendu par un administrateur : ses échanges sont refusés.',
          motif: p.suspensionMotif ?? null,
          depuis: p.suspenduAt,
        },
        HTTP_LOCKED,
      )
    // Le serveur a été vidé et ce poste n'a pas encore vidé sa copie : tout ce qu'il enverrait
    // ressusciterait ce qui vient d'être effacé, tout ce qu'il recevrait se mêlerait à des lignes
    // périmées. Il vide d'abord (l'ordre lui parvient par son battement de vie, jamais refusé), puis
    // il l'accuse.
    if (p?.vidageDemandeAt) throw this.refusVidageEnAttente(p.vidageDemandeAt)
  }

  /** Le refus (423) d'un poste dont le vidage n'est pas accusé — même réponse pour tous ses échanges. */
  private refusVidageEnAttente(depuis: Date): HttpException {
    return new HttpException(
      {
        statusCode: HTTP_LOCKED,
        code: 'VIDAGE_EN_ATTENTE',
        message:
          'Les données du centre ont été vidées : ce poste doit d’abord vider sa copie locale.',
        depuis,
      },
      HTTP_LOCKED,
    )
  }

  /** Ce que la supervision a besoin de savoir de l'état de contrôle d'un poste. */
  private etatControle(p: {
    suspenduAt: Date | null
    suspensionMotif: string | null
    resyncDemandeeAt: Date | null
    resyncFaiteAt: Date | null
    vidageDemandeAt: Date | null
    vidageFaitAt: Date | null
  }) {
    return {
      suspendu: !!p.suspenduAt,
      suspenduAt: p.suspenduAt,
      motif: p.suspensionMotif,
      resyncDemandeeAt: p.resyncDemandeeAt,
      resyncFaiteAt: p.resyncFaiteAt,
      vidageDemandeAt: p.vidageDemandeAt,
      vidageFaitAt: p.vidageFaitAt,
    }
  }

  private async posteOuErreur(posteId: string) {
    const poste = await this.prisma.posteLocal.findUnique({
      where: { id: posteId },
    })
    if (!poste) throw new NotFoundException('Poste introuvable')
    return poste
  }

  /**
   * Trace une décision de contrôle dans le journal d'audit : qui a agi, sur quel poste,
   * quand, d'où. Couper les échanges d'une machine est un geste qu'on doit pouvoir
   * retrouver. Jamais bloquant : la trace ne fait pas échouer ce qu'elle raconte.
   * (Le `@Audit` global ne couvre pas SyncController — trafic machine à machine.)
   */
  private async tracerControle(
    action: string,
    poste: { id: string; libelle: string },
    auteurId: string | null,
    ip: string | null,
    apres: Record<string, string | number | boolean | null> = {},
  ): Promise<void> {
    try {
      await this.prisma.journalAudit.create({
        data: {
          utilisateurId: auteurId,
          action,
          module: 'synchronisation',
          entiteType: 'PosteLocal',
          entiteId: poste.id,
          ipAdresse: ip,
          statut: 'SUCCES',
          apresJson: { poste: poste.libelle, ...apres },
        },
      })
    } catch (e) {
      this.logger.error(`Contrôle non tracé : ${(e as Error).message}`)
    }
  }

  private signalerControle(): void {
    this.notifications.broadcastLive('SYNC_ACTIVITY', {
      requiredPermission: 'synchronisation.read',
    })
  }

  /**
   * SUSPEND les échanges d'un poste. Le serveur refuse dès cet instant ce qu'il envoie (et
   * ce qu'il demande, s'il se fait connaître) ; le poste, lui, continue de travailler avec sa
   * base locale et rattrape tout à la reprise — rien n'est perdu, seulement retardé.
   *
   * Sans effet (et sans trace) si le poste est déjà suspendu : on ne réécrit ni la date, ni
   * l'auteur, ni le motif d'une suspension en cours.
   */
  async suspendrePoste(
    posteId: string,
    motif: string | undefined,
    auteurId: string | null,
    ip: string | null = null,
  ) {
    const poste = await this.posteOuErreur(posteId)
    if (poste.suspenduAt) return this.etatControle(poste)

    const maj = await this.prisma.posteLocal.update({
      where: { id: posteId },
      data: {
        suspenduAt: new Date(),
        suspenduPar: auteurId,
        suspensionMotif: motif?.trim() || null,
      },
    })
    await this.tracerControle('SUSPEND', poste, auteurId, ip, {
      motif: maj.suspensionMotif,
    })
    this.signalerControle()
    return this.etatControle(maj)
  }

  /** LÈVE la suspension : le poste reprend ses échanges à son prochain battement de vie. */
  async reprendrePoste(
    posteId: string,
    auteurId: string | null,
    ip: string | null = null,
  ) {
    const poste = await this.posteOuErreur(posteId)
    if (!poste.suspenduAt) return this.etatControle(poste)

    const maj = await this.prisma.posteLocal.update({
      where: { id: posteId },
      data: { suspenduAt: null, suspenduPar: null, suspensionMotif: null },
    })
    await this.tracerControle('RESUME', poste, auteurId, ip, {
      suspenduDepuis: poste.suspenduAt.toISOString(),
    })
    this.signalerControle()
    return this.etatControle(maj)
  }

  /**
   * DEMANDE une resynchronisation COMPLÈTE : le poste retéléchargera toutes les données du
   * serveur à son prochain battement de vie, puis l'accusera. Ce qu'il n'a pas encore envoyé
   * est conservé — le rattrapage de la réception ne supprime rien de local.
   *
   * Refusée (409) pour un poste qui ne comprend pas cet ordre : la demande resterait sans fin
   * « en attente », et l'administrateur croirait la reprise lancée. Un poste qui n'a jamais
   * dit son niveau (poste ancien) est dans ce cas.
   */
  async demanderResync(
    posteId: string,
    auteurId: string | null,
    ip: string | null = null,
  ) {
    const poste = await this.posteOuErreur(posteId)
    if ((poste.niveauControle ?? 0) < NIVEAU_CONTROLE_RESYNC)
      throw new ConflictException({
        code: 'POSTE_NON_COMPATIBLE',
        message:
          'Ce poste n’a pas encore la version qui comprend cette demande : mettez-le à jour.',
      })
    // Déjà demandée et pas encore prise en compte : rien à redemander.
    if (poste.resyncDemandeeAt) return this.etatControle(poste)

    const maj = await this.prisma.posteLocal.update({
      where: { id: posteId },
      data: { resyncDemandeeAt: new Date() },
    })
    await this.tracerControle('RESYNC_REQUEST', poste, auteurId, ip)
    this.signalerControle()
    return this.etatControle(maj)
  }

  /** Retire une demande de resynchronisation que le poste n'a pas encore prise en compte. */
  async annulerResync(
    posteId: string,
    auteurId: string | null,
    ip: string | null = null,
  ) {
    const poste = await this.posteOuErreur(posteId)
    if (!poste.resyncDemandeeAt) return this.etatControle(poste)

    const maj = await this.prisma.posteLocal.update({
      where: { id: posteId },
      data: { resyncDemandeeAt: null },
    })
    await this.tracerControle('RESYNC_CANCEL', poste, auteurId, ip)
    this.signalerControle()
    return this.etatControle(maj)
  }

  /**
   * ACCUSÉ du poste : la resynchronisation complète est faite.
   *
   * On note toujours la date (le poste a bel et bien tout retéléchargé), mais on n'efface la
   * demande en cours que si l'accusé porte SA date : si l'administrateur en a refait une
   * entre-temps, celle-là reste à accomplir.
   */
  async accuserResync(posteId: string, demandeeAt: Date, auteurId: string | null) {
    const poste = await this.posteOuErreur(posteId)
    const correspond =
      !!poste.resyncDemandeeAt &&
      +poste.resyncDemandeeAt === +demandeeAt

    await this.prisma.posteLocal.update({
      where: { id: posteId },
      data: {
        resyncFaiteAt: new Date(),
        ...(correspond ? { resyncDemandeeAt: null } : {}),
      },
    })
    await this.tracerControle('RESYNC_DONE', poste, auteurId, null, {
      demandeeAt: demandeeAt.toISOString(),
      demandeSoldee: correspond,
    })
    this.signalerControle()
    return { ok: true, demandeSoldee: correspond }
  }

  /**
   * ACCUSÉ du poste : il a vidé sa copie locale des données métier.
   *
   * On note toujours la date (le poste a bel et bien vidé), mais on n'efface la demande en cours que
   * si l'accusé porte SA date : si le centre a été vidé une seconde fois entre-temps, ce nouveau
   * vidage reste à accomplir — et les échanges du poste restent refusés d'ici là.
   */
  async accuserVidage(posteId: string, demandeeAt: Date, auteurId: string | null) {
    const poste = await this.posteOuErreur(posteId)
    const correspond =
      !!poste.vidageDemandeAt && +poste.vidageDemandeAt === +demandeeAt

    await this.prisma.posteLocal.update({
      where: { id: posteId },
      data: {
        vidageFaitAt: new Date(),
        ...(correspond ? { vidageDemandeAt: null } : {}),
      },
    })
    await this.tracerControle('VIDAGE_DONE', poste, auteurId, null, {
      demandeeAt: demandeeAt.toISOString(),
      demandeSoldee: correspond,
    })
    this.signalerControle()
    return { ok: true, demandeSoldee: correspond }
  }

  /** Enrichit des postes avec le nom + rôle du DERNIER utilisateur connecté (nom lisible au lieu
   *  de l'identifiant machine) et le LIBELLÉ de leur site de rattachement.
   *
   *  Ni `dernierUtilisateurId` ni `siteId` ne sont des relations Prisma sur PosteLocal
   *  (cf. createdBy/updatedBy ailleurs au schéma) → jointures manuelles, une requête
   *  groupée chacune. Deux requêtes fixes quel que soit le nombre de postes : sur un parc
   *  de 200 machines, une jointure par poste en ferait 400.
   *
   *  Le site est renvoyé parce que l'écran de supervision raisonne par site : « Nkayi ne
   *  remonte plus » est une phrase qu'un humain prononce, « poste-47 est muet » non. */
  private async enrichPostes<
    T extends {
      id: string
      libelle: string
      siteId: string
      dernierUtilisateurId: string | null
      derniereSyncAt: Date | null
      suspenduAt: Date | null
      suspenduPar: string | null
      suspensionMotif: string | null
      resyncDemandeeAt: Date | null
      resyncFaiteAt: Date | null
      vidageDemandeAt: Date | null
      vidageFaitAt: Date | null
      versionApp: string | null
      niveauControle: number | null
    },
  >(postes: T[]) {
    const now = Date.now()
    // Le dernier utilisateur ET l'auteur d'une suspension : une seule requête pour les deux.
    const utilisateurIds = [
      ...new Set(
        postes
          .flatMap((p) => [p.dernierUtilisateurId, p.suspenduPar])
          .filter((id): id is string => !!id),
      ),
    ]
    const siteIds = [...new Set(postes.map((p) => p.siteId).filter(Boolean))]

    // Promesses nommées plutôt qu'un littéral dans Promise.all : mélanger une promesse
    // et un tableau vide dans le même littéral fait perdre l'inférence de TypeScript,
    // qui retombe alors sur `{}` pour les éléments.
    const utilisateursP = utilisateurIds.length
      ? this.prisma.utilisateur.findMany({
          where: { id: { in: utilisateurIds } },
          select: {
            id: true,
            login: true,
            personnelMedical: { select: { nom: true, prenom: true } },
            roles: { select: { role: { select: { code: true } } } },
          },
        })
      : Promise.resolve([])
    const sitesP = siteIds.length
      ? this.prisma.site.findMany({
          where: { id: { in: siteIds } },
          select: { id: true, libelle: true },
        })
      : Promise.resolve([])
    const [utilisateurs, sites] = await Promise.all([utilisateursP, sitesP])
    // `as const` : sans lui, `.map()` produit un tableau et non un couple, et le Map
    // retombe sur Map<unknown, unknown> — d'où des `{}` à la lecture plus bas.
    const utilisateurById = new Map(utilisateurs.map((u) => [u.id, u] as const))
    const siteById = new Map(sites.map((s) => [s.id, s.libelle] as const))

    const nomDe = (id: string | null) => {
      const u = id ? utilisateurById.get(id) : undefined
      if (!u) return null
      return u.personnelMedical
        ? `${u.personnelMedical.prenom} ${u.personnelMedical.nom}`
        : u.login
    }

    return postes.map((p) => {
      const u = p.dernierUtilisateurId
        ? utilisateurById.get(p.dernierUtilisateurId)
        : undefined
      const utilisateurNom = nomDe(p.dernierUtilisateurId)
      const codes = u?.roles.map((r) => r.role.code) ?? []
      const utilisateurRole =
        ROLE_PRIORITY.find((r) => codes.includes(r)) ?? codes[0] ?? null
      return {
        id: p.id,
        libelle: p.libelle,
        siteId: p.siteId,
        // Un site supprimé depuis laisse ses postes orphelins : on le dit plutôt que
        // d'afficher un identifiant technique ou un blanc.
        siteLibelle: siteById.get(p.siteId) ?? null,
        utilisateurNom,
        utilisateurRole,
        derniereSyncAt: p.derniereSyncAt,
        enLigne:
          !!p.derniereSyncAt && now - +p.derniereSyncAt < ONLINE_WINDOW_MS,
        // Contrôle du flux : ce qu'un administrateur a décidé pour ce poste, et ce que le
        // poste est capable de comprendre (version) — la fiche s'en sert pour n'offrir que
        // des boutons qui ont un effet.
        suspendu: !!p.suspenduAt,
        suspenduAt: p.suspenduAt,
        suspenduParNom: nomDe(p.suspenduPar),
        suspensionMotif: p.suspensionMotif,
        resyncDemandeeAt: p.resyncDemandeeAt,
        resyncFaiteAt: p.resyncFaiteAt,
        vidageDemandeAt: p.vidageDemandeAt,
        vidageFaitAt: p.vidageFaitAt,
        versionApp: p.versionApp,
        niveauControle: p.niveauControle,
      }
    })
  }
}
