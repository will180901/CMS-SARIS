/**
 * AuditService — lecture des journaux d'audit et d'authentification, et purge.
 *
 * L'écriture ordinaire se fait depuis les services métier eux-mêmes (JournalAudit)
 * et depuis SecurityService (JournalAuthentification) : ce service ne fait que lire.
 * Seule exception, la PURGE — voir `purger()`, qui laisse toujours une trace d'elle-même.
 */

import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CI, parMots, variantes } from '../../common/prisma/search'
import { resolveGeo } from '../../common/geo/geo.util'
import { resumerConnexions, resumePosition } from '../security/connexions.util'

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
  /** Taille de page (1 à 500, 100 par défaut). */
  limit?: number
  /** Numéro de page, à partir de 1 (1 par défaut : sans lui, la requête rend les `limit` plus récentes). */
  page?: number
  /** Recherche par mots, insensible à la casse, faite par le SERVEUR sur tout le journal. */
  search?: string
}

const LIMITE_DEFAUT = 100
const LIMITE_MAX = 500

/** Taille de page demandée, ramenée entre 1 et 500 (entière). */
function borneLimite(limit?: number): number {
  const brute = Number.isFinite(limit) ? Math.floor(Number(limit)) : LIMITE_DEFAUT
  return Math.min(Math.max(brute, 1), LIMITE_MAX)
}

/**
 * Les plus récentes d'abord, et à instant égal l'identifiant : sans ce départage, deux lignes écrites
 * à la même milliseconde pourraient tomber de part et d'autre d'une coupure de page dans un ordre
 * que la base ne garantit pas — l'une serait vue deux fois, l'autre jamais.
 */
const PLUS_RECENTS_D_ABORD = [{ createdAt: 'desc' as const }, { id: 'desc' as const }]

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
  page?: number
  search?: string
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

    // Recherche par mots, côté serveur : tout le journal est cherché, pas seulement la page à l'écran.
    Object.assign(
      where,
      parMots(q.search, (mot) => {
        const { contient, exacts } = variantes(mot)
        return [
          ...contient.flatMap((v) => [
            { action: { contains: v, ...CI } },
            { module: { contains: v, ...CI } },
            { entiteType: { contains: v, ...CI } },
            { entiteId: { contains: v, ...CI } },
            { utilisateur: { login: { contains: v, ...CI } } },
          ]),
          // les codes d'actions, de modules et d'entités que porte le libellé tapé : une condition chacun
          ...(exacts.length
            ? [
                { action: { in: exacts } },
                { module: { in: exacts } },
                { entiteType: { in: exacts } },
              ]
            : []),
        ]
      }),
    )

    const limit = borneLimite(q.limit)
    const page = q.page ?? 1

    // `total` = nombre RÉEL d'entrées correspondant aux filtres (≠ taille de la page
    // rendue) : il numérote les pages et alimente les compteurs de l'écran.
    const [data, total] = await Promise.all([
      this.prisma.journalAudit.findMany({
        where,
        include: {
          utilisateur: { select: { id: true, login: true, email: true } },
        },
        orderBy: PLUS_RECENTS_D_ABORD,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.journalAudit.count({ where }),
    ])
    return { data, total, page, limit }
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

    Object.assign(
      where,
      parMots(q.search, (mot) => {
        const { contient, exacts } = variantes(mot)
        return [
          ...contient.flatMap((v) => [
            { resultat: { contains: v, ...CI } },
            { login: { contains: v, ...CI } },
            { ipAdresse: { contains: v, ...CI } },
          ]),
          ...(exacts.length ? [{ resultat: { in: exacts } }] : []),
        ]
      }),
    )

    const limit = borneLimite(q.limit)
    const page = q.page ?? 1

    const [rows, total] = await Promise.all([
      this.prisma.journalAuthentification.findMany({
        where,
        include: {
          utilisateur: { select: { id: true, login: true, email: true } },
        },
        orderBy: PLUS_RECENTS_D_ABORD,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.journalAuthentification.count({ where }),
    ])
    // Durée de la connexion ouverte par chaque évènement, et poste desktop d'origine.
    const connexions = await resumerConnexions(
      this.prisma,
      rows.map((r) => r.connexionId).filter((x): x is string => !!x),
    )
    const postesIds = [
      ...new Set(
        rows.map((r) => r.posteLocalId).filter((x): x is string => !!x),
      ),
    ]
    const postes = postesIds.length
      ? await this.prisma.posteLocal.findMany({
          where: { id: { in: postesIds } },
          select: { id: true, libelle: true },
        })
      : []
    const nomPoste = new Map(postes.map((p) => [p.id, p.libelle]))
    // Localisation (ville + coordonnées) dérivée de l'IP — ajoutée à la lecture.
    const data = await Promise.all(
      rows.map(async (r) => {
        const c = r.connexionId ? connexions.get(r.connexionId) : undefined
        const {
          positionStatut,
          latitude,
          longitude,
          precisionM,
          positionLe,
          ...reste
        } = r
        // Position de l'APPAREIL, seulement sur la ligne qui ouvre une connexion (les
        // échecs et les déconnexions n'en portent pas).
        const position = r.connexionId
          ? resumePosition({
              posteLocalId: r.posteLocalId,
              positionStatut,
              latitude,
              longitude,
              precisionM,
              positionLe,
            })
          : null
        return {
          ...reste,
          position,
          localisation: await resolveGeo(r.ipAdresse),
          connexion: c
            ? {
                etat: c.etat,
                dureeMinutes: c.dureeMinutes,
                fin: c.fin,
                derniereActivite: c.derniereActivite,
              }
            : null,
          poste: r.posteLocalId
            ? {
                id: r.posteLocalId,
                libelle: nomPoste.get(r.posteLocalId) ?? null,
              }
            : null,
        }
      }),
    )
    return { data, total, page, limit }
  }

  // ── Comptes présents au journal ───────────────────────────────────────────

  /**
   * Les comptes qui figurent à l'un OU l'autre journal : de quoi remplir le filtre « Utilisateur »
   * sans charger les journaux et sans détenir `utilisateur.read` (le médecin chef lit l'audit sans
   * lister les comptes). Un compte qui n'a jamais rien fait n'a rien à filtrer.
   */
  async utilisateursDuJournal() {
    const [actions, auths] = await Promise.all([
      this.prisma.journalAudit.groupBy({
        by: ['utilisateurId'],
        where: { utilisateurId: { not: null } },
      }),
      this.prisma.journalAuthentification.groupBy({
        by: ['utilisateurId'],
        where: { utilisateurId: { not: null } },
      }),
    ])
    const ids = [
      ...new Set(
        [...actions, ...auths]
          .map((x) => x.utilisateurId)
          .filter((x): x is string => !!x),
      ),
    ]
    if (ids.length === 0) return []
    return this.prisma.utilisateur.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        login: true,
        personnelMedical: { select: { nom: true, prenom: true } },
      },
      orderBy: { login: 'asc' },
    })
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
        ? (await this.prisma.journalAuthentification.deleteMany({ where }))
            .count
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
