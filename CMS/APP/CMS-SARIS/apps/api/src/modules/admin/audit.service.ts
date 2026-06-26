/**
 * AuditService — lecture des journaux d'audit et d'authentification.
 *
 * Read-only. L'écriture se fait depuis les services métier eux-mêmes
 * (JournalAudit) et depuis SecurityService (JournalAuthentification).
 */

import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { resolveGeo } from '../../common/geo/geo.util'

interface AuditQuery {
  module?:        string
  action?:        string
  utilisateurId?: string
  entiteType?:    string
  entiteId?:      string
  dateMin?:       string
  dateMax?:       string
  limit?:         number
}

// ── Bornes de dates inclusives ────────────────────────────────────────────────
// Un filtre "Date max = 30/05" doit inclure TOUTE la journée du 30 (jusqu'à
// 23:59:59), sinon une borne à minuit exclut toutes les entrées de ce jour.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
function dayStart(s: string): Date { return DATE_ONLY.test(s) ? new Date(`${s}T00:00:00`)     : new Date(s) }
function dayEnd(s: string):   Date { return DATE_ONLY.test(s) ? new Date(`${s}T23:59:59.999`) : new Date(s) }

interface AuthQuery {
  utilisateurId?: string
  resultat?:      string
  dateMin?:       string
  dateMax?:       string
  limit?:         number
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Journal d'audit métier ────────────────────────────────────────────────

  async findAudit(q: AuditQuery) {
    const where: any = {}
    if (q.module)        where.module        = q.module
    if (q.action)        where.action        = q.action
    if (q.utilisateurId) where.utilisateurId = q.utilisateurId
    if (q.entiteType)    where.entiteType    = q.entiteType
    if (q.entiteId)      where.entiteId      = q.entiteId
    if (q.dateMin || q.dateMax) {
      where.createdAt = {}
      if (q.dateMin) where.createdAt.gte = dayStart(q.dateMin)
      if (q.dateMax) where.createdAt.lte = dayEnd(q.dateMax)
    }

    const limit = Math.min(Math.max(Number.isFinite(q.limit) ? Number(q.limit) : 100, 1), 500)

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
    if (q.resultat)      where.resultat      = q.resultat
    if (q.dateMin || q.dateMax) {
      where.createdAt = {}
      if (q.dateMin) where.createdAt.gte = dayStart(q.dateMin)
      if (q.dateMax) where.createdAt.lte = dayEnd(q.dateMax)
    }

    const limit = Math.min(Math.max(Number.isFinite(q.limit) ? Number(q.limit) : 100, 1), 500)

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
    const data = await Promise.all(rows.map(async r => ({ ...r, localisation: await resolveGeo(r.ipAdresse) })))
    return { data, total }
  }
}
