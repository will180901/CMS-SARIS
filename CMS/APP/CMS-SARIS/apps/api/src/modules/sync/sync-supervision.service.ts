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
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
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
    const { posteLocalId, siteId, userId, startedAt, applied, conflicts } = input
    const now = new Date()

    try {
      // 1. Poste connu + horodatage de la dernière synchro + DERNIER utilisateur connecté
      //    (traçabilité seule, pas de relation FK — cf. createdBy/updatedBy ailleurs au schéma).
      //    `masque: false` — un poste qui resynchronise redevient visible même s'il avait été
      //    retiré (dismiss) de la liste de supervision entre-temps.
      await this.prisma.posteLocal.upsert({
        where:  { id: posteLocalId },
        update: { derniereSyncAt: now, siteId, dernierUtilisateurId: userId, masque: false },
        create: { id: posteLocalId, siteId, libelle: this.defaultLibelle(posteLocalId), derniereSyncAt: now, dernierUtilisateurId: userId },
      })

      // 2. Journal du cycle (réussi / avec conflits).
      const journal = await this.prisma.journalSynchronisation.create({
        data: {
          posteLocalId,
          startedAt,
          finishedAt:  now,
          statut:      conflicts.length ? 'CONFLITS' : 'REUSSIE',
          nbMutations: applied,
          nbConflits:  conflicts.length,
        },
      })

      // 3. Conflits détaillés (valeur locale vs serveur, pour inspection).
      for (const c of conflicts) {
        await this.prisma.conflitSynchronisation.create({
          data: {
            journalId:     journal.id,
            mutationUuid:  c.id,
            entiteType:    c.model,
            entiteId:      c.id,
            typeConflit:   c.winner === 'incoming' ? 'LOCAL_GAGNE' : 'SERVEUR_GAGNE',
            valeurLocale:  (c.valeurLocale ?? {}) as object,
            valeurServeur: (c.valeurServeur ?? {}) as object,
          },
        })
      }

      // 4. État de synchro par poste.
      await this.prisma.syncState.upsert({
        where:  { posteLocalId_siteId: { posteLocalId, siteId } },
        update: { lastPushedAt: now },
        create: { posteLocalId, siteId, lastPushedAt: now },
      })
    } catch (e) {
      // La traçabilité ne doit jamais casser la synchro.
      this.logger.warn(`record() ignoré : ${(e as Error).message}`)
    }

    // 5. Temps réel : rafraîchit l'écran de supervision des administrateurs.
    this.notifications.broadcastLive('SYNC_ACTIVITY', { requiredPermission: 'synchronisation.read' })
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
   */
  async heartbeat(siteId: string, posteLocalId: string, libelle?: string): Promise<void> {
    if (this.isSqlite) return
    const now = new Date()
    try {
      await this.prisma.posteLocal.upsert({
        where:  { id: posteLocalId },
        update: { derniereSyncAt: now, siteId, masque: false },
        create: { id: posteLocalId, siteId, libelle: libelle?.trim() || this.defaultLibelle(posteLocalId), derniereSyncAt: now },
      })
    } catch (e) {
      this.logger.warn(`heartbeat() ignoré : ${(e as Error).message}`)
    }
    this.notifications.broadcastLive('SYNC_ACTIVITY', { requiredPermission: 'synchronisation.read' })
  }

  /** Renomme un poste (supervision admin) — nom UNIQUE au sein du site. */
  async renamePoste(siteId: string, posteId: string, libelle: string): Promise<{ libelle: string }> {
    const trimmed = libelle.trim()
    if (!trimmed) throw new BadRequestException('Le nom du poste est requis')

    const poste = await this.prisma.posteLocal.findFirst({ where: { id: posteId, siteId } })
    if (!poste) throw new NotFoundException('Poste introuvable')

    const doublon = await this.prisma.posteLocal.findFirst({
      where: { siteId, libelle: trimmed, id: { not: posteId } },
    })
    if (doublon) throw new BadRequestException('Ce nom est déjà utilisé par un autre poste')

    await this.prisma.posteLocal.update({ where: { id: posteId }, data: { libelle: trimmed } })
    this.notifications.broadcastLive('SYNC_ACTIVITY', { requiredPermission: 'synchronisation.read' })
    return { libelle: trimmed }
  }

  /** Données de l'écran de supervision (scope par site). Postes masqués (dismiss) exclus.
   *  `take` généreux (pas de vraie pagination serveur) : suffisant pour que la pagination
   *  CLIENT de l'écran (Activité/Conflits) reste utile à mesure que le parc de postes grossit,
   *  sans pour autant renvoyer un historique illimité. */
  async getSupervision(siteId: string) {
    const [postes, journaux, conflits] = await Promise.all([
      this.prisma.posteLocal.findMany({ where: { siteId, masque: false }, orderBy: { derniereSyncAt: 'desc' } }),
      this.prisma.journalSynchronisation.findMany({
        where:   { posteLocal: { siteId } },
        orderBy: { startedAt: 'desc' },
        take:    200,
        include: { posteLocal: { select: { libelle: true } } },
      }),
      this.prisma.conflitSynchronisation.findMany({
        where:   { statut: 'EN_ATTENTE', journal: { posteLocal: { siteId } } },
        orderBy: { createdAt: 'desc' },
        take:    200,
      }),
    ])

    return {
      postes: await this.enrichPostes(postes),
      journaux: journaux.map((j) => ({
        id:          j.id,
        poste:       j.posteLocal.libelle,
        startedAt:   j.startedAt,
        finishedAt:  j.finishedAt,
        statut:      j.statut,
        nbMutations: j.nbMutations,
        nbConflits:  j.nbConflits,
      })),
      conflits: conflits.map((c) => ({
        id:          c.id,
        entiteType:  c.entiteType,
        entiteId:    c.entiteId,
        typeConflit: c.typeConflit,
        createdAt:   c.createdAt,
      })),
    }
  }

  /**
   * Détail d'un poste (modale de supervision) : identité enrichie + fenêtre de la DERNIÈRE
   * session connectée (début → fin), déduite de la suite CONTIGUË de journaux de synchro la
   * plus récente (un écart > ONLINE_WINDOW_MS entre deux cycles marque une déconnexion).
   */
  async getPosteDetail(siteId: string, posteId: string) {
    const poste = await this.prisma.posteLocal.findFirst({ where: { id: posteId, siteId } })
    if (!poste) throw new NotFoundException('Poste introuvable')

    const journaux = await this.prisma.journalSynchronisation.findMany({
      where:   { posteLocalId: posteId },
      orderBy: { startedAt: 'desc' },
      take:    200,
    })

    let sessionDebut: Date | null = null
    let sessionFin:   Date | null = null
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

  /** Retire un poste de la liste de supervision (dismiss) — cf. record() pour le retour. */
  async masquerPoste(siteId: string, posteId: string): Promise<void> {
    const { count } = await this.prisma.posteLocal.updateMany({
      where: { id: posteId, siteId },
      data:  { masque: true },
    })
    if (!count) throw new NotFoundException('Poste introuvable')
  }

  /** Enrichit des postes avec le nom + rôle du DERNIER utilisateur connecté (nom lisible au lieu
   *  de l'identifiant machine). `dernierUtilisateurId` n'est PAS une relation Prisma (cf.
   *  createdBy/updatedBy ailleurs au schéma) → jointure manuelle, une seule requête groupée. */
  private async enrichPostes<T extends { id: string; libelle: string; dernierUtilisateurId: string | null; derniereSyncAt: Date | null }>(
    postes: T[],
  ) {
    const now = Date.now()
    const utilisateurIds = [...new Set(postes.map((p) => p.dernierUtilisateurId).filter((id): id is string => !!id))]
    const utilisateurs = utilisateurIds.length
      ? await this.prisma.utilisateur.findMany({
          where:  { id: { in: utilisateurIds } },
          select: {
            id:    true,
            login: true,
            personnelMedical: { select: { nom: true, prenom: true } },
            roles: { select: { role: { select: { code: true } } } },
          },
        })
      : []
    const utilisateurById = new Map(utilisateurs.map((u) => [u.id, u]))

    return postes.map((p) => {
      const u = p.dernierUtilisateurId ? utilisateurById.get(p.dernierUtilisateurId) : undefined
      const utilisateurNom = u
        ? (u.personnelMedical ? `${u.personnelMedical.prenom} ${u.personnelMedical.nom}` : u.login)
        : null
      const codes = u?.roles.map((r) => r.role.code) ?? []
      const utilisateurRole = ROLE_PRIORITY.find((r) => codes.includes(r)) ?? codes[0] ?? null
      return {
        id:              p.id,
        libelle:         p.libelle,
        utilisateurNom,
        utilisateurRole,
        derniereSyncAt:  p.derniereSyncAt,
        enLigne:         !!p.derniereSyncAt && now - +p.derniereSyncAt < ONLINE_WINDOW_MS,
      }
    })
  }
}
