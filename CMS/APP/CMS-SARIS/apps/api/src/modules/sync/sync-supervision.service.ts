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
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
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
}

/** Un poste est considéré « en ligne » s'il a donné signe de vie (battement ou synchro) dans
 *  les 90 dernières secondes — aligné sur le battement du poste (~30 s, cf. sync-client.service),
 *  avec une marge de 2 battements manqués avant de basculer « hors ligne ». */
const ONLINE_WINDOW_MS = 90_000

/** Ordre de priorité d'affichage quand un utilisateur porte plusieurs rôles (même ordre que
 *  `getPrimaryRole` côté web, apps/web/src/config/navigation.config.ts). */
const ROLE_PRIORITY = ['ADMIN_SYSTEME', 'MEDECIN_CHEF', 'INFIRMIER']

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
          statut: conflicts.length ? 'CONFLITS' : 'REUSSIE',
          nbMutations: applied,
          nbConflits: conflicts.length,
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
  ): Promise<void> {
    if (this.isSqlite) return
    const now = new Date()
    try {
      await this.prisma.posteLocal.upsert({
        where: { id: posteLocalId },
        update: { derniereSyncAt: now, masque: false },
        // Repli pour un poste jamais déclaré (installation ancienne, ou configuration
        // perdue) : mieux vaut le site de l'appelant que pas de poste du tout.
        create: {
          id: posteLocalId,
          siteId,
          libelle: libelle?.trim() || this.defaultLibelle(posteLocalId),
          derniereSyncAt: now,
        },
      })
    } catch (e) {
      this.logger.warn(`heartbeat() ignoré : ${(e as Error).message}`)
    }
    this.notifications.broadcastLive('SYNC_ACTIVITY', {
      requiredPermission: 'synchronisation.read',
    })
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
  ) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true, libelle: true },
    })
    if (!site) throw new NotFoundException('Site introuvable')

    const poste = await this.prisma.posteLocal.upsert({
      where: { id: posteLocalId },
      // Reconfiguration assumée : un poste peut être déplacé d'un site à l'autre.
      update: {
        siteId,
        ...(libelle?.trim() ? { libelle: libelle.trim() } : {}),
        masque: false,
      },
      create: {
        id: posteLocalId,
        siteId,
        libelle: libelle?.trim() || this.defaultLibelle(posteLocalId),
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
    },
  >(postes: T[]) {
    const now = Date.now()
    const utilisateurIds = [
      ...new Set(
        postes
          .map((p) => p.dernierUtilisateurId)
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

    return postes.map((p) => {
      const u = p.dernierUtilisateurId
        ? utilisateurById.get(p.dernierUtilisateurId)
        : undefined
      const utilisateurNom = u
        ? u.personnelMedical
          ? `${u.personnelMedical.prenom} ${u.personnelMedical.nom}`
          : u.login
        : null
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
      }
    })
  }
}
