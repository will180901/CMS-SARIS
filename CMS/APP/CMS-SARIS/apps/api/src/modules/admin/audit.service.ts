/**
 * AuditService — lecture des journaux d'audit et d'authentification, et purge.
 *
 * L'écriture ordinaire se fait depuis les services métier eux-mêmes (JournalAudit)
 * et depuis SecurityService (JournalAuthentification) : ce service ne fait que lire.
 * Seule exception, la PURGE — voir `purger()`, qui laisse toujours une trace d'elle-même.
 */

import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { resolveGeo } from '../../common/geo/geo.util'

/** Ce que la purge doit effacer. */
export type PortailPurge = 'actions' | 'authentifications' | 'tout'

export interface ResultatPurge {
  actions: number
  authentifications: number
}

interface AuditQuery {
  module?: string
  action?: string
  utilisateurId?: string
  entiteType?: string
  entiteId?: string
  dateMin?: string
  dateMax?: string
  limit?: number
}

// ── Bornes de dates inclusives ────────────────────────────────────────────────
// Un filtre "Date max = 30/05" doit inclure TOUTE la journée du 30 (jusqu'à
// 23:59:59), sinon une borne à minuit exclut toutes les entrées de ce jour.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
function dayStart(s: string): Date {
  return DATE_ONLY.test(s) ? new Date(`${s}T00:00:00`) : new Date(s)
}
function dayEnd(s: string): Date {
  return DATE_ONLY.test(s) ? new Date(`${s}T23:59:59.999`) : new Date(s)
}

interface AuthQuery {
  utilisateurId?: string
  resultat?: string
  dateMin?: string
  dateMax?: string
  limit?: number
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit')

  constructor(private readonly prisma: PrismaService) {}

  // ── Journal d'audit métier ────────────────────────────────────────────────

  async findAudit(q: AuditQuery) {
    const where: any = {}
    if (q.module) where.module = q.module
    if (q.action) where.action = q.action
    if (q.utilisateurId) where.utilisateurId = q.utilisateurId
    if (q.entiteType) where.entiteType = q.entiteType
    if (q.entiteId) where.entiteId = q.entiteId
    if (q.dateMin || q.dateMax) {
      where.createdAt = {}
      if (q.dateMin) where.createdAt.gte = dayStart(q.dateMin)
      if (q.dateMax) where.createdAt.lte = dayEnd(q.dateMax)
    }

    const limit = Math.min(
      Math.max(Number.isFinite(q.limit) ? Number(q.limit) : 100, 1),
      500,
    )

    // `total` = nombre RÉEL d'entrées correspondant aux filtres (≠ taille du
    // lot renvoyé, plafonné à `limit`). Permet aux compteurs UI d'afficher la
    // vérité et d'évoluer au lieu de rester figés sur le plafond.
    const [data, total] = await Promise.all([
      this.prisma.journalAudit.findMany({
        where,
        include: {
          utilisateur: { select: { id: true, login: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.journalAudit.count({ where }),
    ])
    return { data, total }
  }

  // ── Journal d'authentification ────────────────────────────────────────────

  async findAuth(q: AuthQuery) {
    const where: any = {}
    if (q.utilisateurId) where.utilisateurId = q.utilisateurId
    if (q.resultat) where.resultat = q.resultat
    if (q.dateMin || q.dateMax) {
      where.createdAt = {}
      if (q.dateMin) where.createdAt.gte = dayStart(q.dateMin)
      if (q.dateMax) where.createdAt.lte = dayEnd(q.dateMax)
    }

    const limit = Math.min(
      Math.max(Number.isFinite(q.limit) ? Number(q.limit) : 100, 1),
      500,
    )

    const [rows, total] = await Promise.all([
      this.prisma.journalAuthentification.findMany({
        where,
        include: {
          utilisateur: { select: { id: true, login: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.journalAuthentification.count({ where }),
    ])
    // Localisation (ville + coordonnées) dérivée de l'IP — ajoutée à la lecture.
    const data = await Promise.all(
      rows.map(async (r) => ({
        ...r,
        localisation: await resolveGeo(r.ipAdresse),
      })),
    )
    return { data, total }
  }

  // ── Purge ─────────────────────────────────────────────────────────────────

  /**
   * Vide les journaux, en totalité ou au-delà d'une ancienneté.
   *
   * UNE TRACE SURVIT TOUJOURS. La purge se journalise elle-même APRÈS coup, dans
   * le journal des actions : sans cela, effacer l'audit effacerait la preuve qu'on
   * l'a effacé, et le journal ne vaudrait plus rien comme instrument de contrôle.
   * C'est aussi pour cette raison que le droit `audit.purge` est distinct de la
   * simple lecture, et réservé à l'administrateur système.
   *
   * @param avant Ne supprimer que ce qui est antérieur à cette date (purge
   *              automatique). Absent = tout, quelle que soit l'ancienneté.
   */
  async purger(
    portee: PortailPurge,
    auteurId: string | null,
    options: { avant?: Date; automatique?: boolean } = {},
  ): Promise<ResultatPurge> {
    const where = options.avant ? { createdAt: { lt: options.avant } } : {}

    const actions =
      portee === 'actions' || portee === 'tout'
        ? (await this.prisma.journalAudit.deleteMany({ where })).count
        : 0
    const authentifications =
      portee === 'authentifications' || portee === 'tout'
        ? (await this.prisma.journalAuthentification.deleteMany({ where })).count
        : 0

    await this.tracerPurge(portee, auteurId, options, {
      actions,
      authentifications,
    })

    this.logger.log(
      `Purge ${options.automatique ? 'automatique' : 'manuelle'} (${portee})` +
        `${options.avant ? ` antérieur à ${options.avant.toISOString()}` : ' — TOTALE'}` +
        ` : ${actions} action(s), ${authentifications} authentification(s)`,
    )
    return { actions, authentifications }
  }

  /** Écrit la trace de la purge — jamais bloquante pour la purge elle-même. */
  private async tracerPurge(
    portee: PortailPurge,
    auteurId: string | null,
    options: { avant?: Date; automatique?: boolean },
    resultat: ResultatPurge,
  ): Promise<void> {
    try {
      await this.prisma.journalAudit.create({
        data: {
          utilisateurId: auteurId,
          action: options.automatique ? 'PURGE_AUTO' : 'PURGE',
          module: 'audit',
          entiteType: 'JournalAudit',
          statut: 'SUCCES',
          apresJson: {
            portee,
            avant: options.avant?.toISOString() ?? null,
            actionsSupprimees: resultat.actions,
            authentificationsSupprimees: resultat.authentifications,
          },
        },
      })
    } catch (error) {
      this.logger.error('La purge n’a pas pu être tracée', error)
    }
  }
}
