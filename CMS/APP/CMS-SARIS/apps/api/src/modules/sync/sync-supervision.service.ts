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
 */
import { Injectable, Logger } from '@nestjs/common'
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

/** Un poste est considéré « en ligne » s'il s'est synchronisé dans les 3 dernières minutes. */
const ONLINE_WINDOW_MS = 3 * 60_000

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
      await this.prisma.posteLocal.upsert({
        where:  { id: posteLocalId },
        update: { derniereSyncAt: now, siteId, dernierUtilisateurId: userId },
        create: { id: posteLocalId, siteId, libelle: `Poste ${posteLocalId.slice(0, 8)}`, derniereSyncAt: now, dernierUtilisateurId: userId },
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

  /** Données de l'écran de supervision (scope par site). */
  async getSupervision(siteId: string) {
    const now = Date.now()
    const [postes, journaux, conflits] = await Promise.all([
      this.prisma.posteLocal.findMany({ where: { siteId }, orderBy: { derniereSyncAt: 'desc' } }),
      this.prisma.journalSynchronisation.findMany({
        where:   { posteLocal: { siteId } },
        orderBy: { startedAt: 'desc' },
        take:    30,
        include: { posteLocal: { select: { libelle: true } } },
      }),
      this.prisma.conflitSynchronisation.findMany({
        where:   { statut: 'EN_ATTENTE', journal: { posteLocal: { siteId } } },
        orderBy: { createdAt: 'desc' },
        take:    50,
      }),
    ])

    // Enrichissement : dernier utilisateur connecté par poste (nom + rôle affichés au lieu
    // de l'identifiant machine). `dernierUtilisateurId` n'est PAS une relation Prisma (cf.
    // createdBy/updatedBy ailleurs au schéma) → jointure manuelle, une seule requête groupée.
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

    return {
      postes: postes.map((p) => {
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
      }),
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
}
