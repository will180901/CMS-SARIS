/**
 * NotificationService — système de notifications temps réel.
 *
 * - emit() : crée une notification (individuelle ou diffusion) et la pousse sur
 *   le flux SSE. Best-effort : ne casse jamais le flux métier en cas d'erreur.
 * - Portée : individuelle (destinataireId) OU diffusion (destinataireId null +
 *   siteId/requiredPermission). La visibilité respecte site + permission de
 *   l'utilisateur → confidentialité par rôle/permission garantie.
 * - L'état « lu » est par-utilisateur (NotificationLecture), compatible diffusion.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Subject, type Observable } from 'rxjs'
import { filter, map } from 'rxjs/operators'
import type { MessageEvent } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ParametresService } from '../parametres/parametres.service'

export type NiveauNotif = 'INFO' | 'SUCCES' | 'AVERTISSEMENT' | 'CRITIQUE'
export type CategorieNotif = 'clinique' | 'sortie' | 'administratif' | 'systeme'

export interface EmitInput {
  type:                string
  niveau?:             NiveauNotif
  /** Catégorie → bascule de Paramètres consultée avant émission (admin système). */
  category?:           CategorieNotif
  titre:               string
  message:             string
  /** Cible une seule personne. Si absent → diffusion (voir siteId/requiredPermission). */
  destinataireId?:     string | null
  /** Diffusion : restreint à un site (null = tous les sites = système global). */
  siteId?:             string | null
  /** Diffusion : permission requise pour voir (respect des rôles/permissions). */
  requiredPermission?: string | null
  entiteType?:         string | null
  entiteId?:           string | null
  lien?:               string | null
  createdById?:        string | null
}

export interface NotifAudience {
  userId:      string
  siteId:      string
  permissions: string[]
}

interface NotifRow {
  id: string; createdAt: Date; destinataireId: string | null; siteId: string | null
  requiredPermission: string | null; type: string; niveau: string; titre: string; message: string
  entiteType: string | null; entiteId: string | null; lien: string | null; createdById: string | null
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger('Notifications')
  private readonly stream$ = new Subject<NotifRow>()

  constructor(
    private readonly prisma:  PrismaService,
    private readonly params:  ParametresService,
  ) {}

  // Catégorie → clé de paramètre (bascule système). 'systeme' = toujours actif.
  private static readonly CAT_PARAM: Record<CategorieNotif, string | null> = {
    clinique:      'notif.evenements_cliniques',
    sortie:        'notif.sorties_critiques',
    administratif: 'notif.evenements_administratifs',
    systeme:       null,
  }

  /** Les notifications de cette catégorie sont-elles activées (réglages admin) ? */
  private async categoryEnabled(category?: CategorieNotif): Promise<boolean> {
    try {
      if (!(await this.params.getBool('notif.app_enabled'))) return false
      if (!category) return true
      const cle = NotificationService.CAT_PARAM[category]
      return cle ? await this.params.getBool(cle) : true
    } catch {
      return true // en cas de doute (param absent), on n'empêche pas la notification
    }
  }

  // ── Émission ────────────────────────────────────────────────────────────────

  async emit(input: EmitInput): Promise<NotifRow | null> {
    try {
      if (!(await this.categoryEnabled(input.category))) return null
      const n = await this.prisma.notification.create({
        data: {
          type:               input.type,
          niveau:             input.niveau ?? 'INFO',
          titre:              input.titre,
          message:            input.message,
          destinataireId:     input.destinataireId ?? null,
          siteId:             input.siteId ?? null,
          requiredPermission: input.requiredPermission ?? null,
          entiteType:         input.entiteType ?? null,
          entiteId:           input.entiteId ?? null,
          lien:               input.lien ?? null,
          createdById:        input.createdById ?? null,
        },
      })
      this.stream$.next(n as NotifRow)
      return n as NotifRow
    } catch (e) {
      // Une notification ne doit jamais faire échouer l'action métier.
      this.logger.warn(`emit() a échoué (ignoré) : ${(e as Error).message}`)
      return null
    }
  }

  // ── Visibilité / filtres ──────────────────────────────────────────────────────

  private visibleFor(n: NotifRow, a: NotifAudience): boolean {
    // Notification ciblée : visible uniquement par sa cible.
    if (n.destinataireId) return n.destinataireId === a.userId
    // Diffusion : l'AUTEUR de l'action ne reçoit PAS de notification de sa
    // propre action (il en est déjà conscient → évite le bruit / l'ambiguïté).
    if (n.createdById && n.createdById === a.userId) return false
    if (n.siteId && n.siteId !== a.siteId) return false
    if (n.requiredPermission && !a.permissions.includes(n.requiredPermission)) return false
    return true
  }

  private whereFor(a: NotifAudience) {
    return {
      OR: [
        { destinataireId: a.userId },
        {
          destinataireId: null,
          AND: [
            { OR: [{ siteId: null }, { siteId: a.siteId }] },
            { OR: [{ requiredPermission: null }, { requiredPermission: { in: a.permissions } }] },
            // L'auteur de l'action ne se notifie pas lui-même.
            { OR: [{ createdById: null }, { NOT: { createdById: a.userId } }] },
          ],
        },
      ],
    }
  }

  // ── Lecture ────────────────────────────────────────────────────────────────

  async list(a: NotifAudience, limit = 40) {
    const rows = await this.prisma.notification.findMany({
      where:   this.whereFor(a),
      orderBy: { createdAt: 'desc' },
      take:    Math.min(limit, 100),
      include: { lectures: { where: { utilisateurId: a.userId }, select: { id: true, masque: true } } },
    })
    // On masque du feed les notifications « supprimées pour moi ».
    return rows
      .filter(r => !r.lectures.some(l => l.masque))
      .map(({ lectures, ...n }) => ({ ...n, lu: lectures.length > 0 }))
  }

  async unreadCount(a: NotifAudience): Promise<number> {
    const rows = await this.prisma.notification.findMany({
      where:   this.whereFor(a),
      orderBy: { createdAt: 'desc' },
      take:    100,
      select:  { id: true, lectures: { where: { utilisateurId: a.userId }, select: { id: true } } },
    })
    return rows.filter(r => r.lectures.length === 0).length
  }

  async markRead(id: string, userId: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id }, select: { id: true } })
    if (!notif) throw new NotFoundException('Notification introuvable')
    await this.prisma.notificationLecture.upsert({
      where:  { notificationId_utilisateurId: { notificationId: id, utilisateurId: userId } },
      update: {},
      create: { notificationId: id, utilisateurId: userId },
    })
    return { ok: true }
  }

  async markAllRead(a: NotifAudience) {
    const rows = await this.prisma.notification.findMany({
      where:   this.whereFor(a),
      orderBy: { createdAt: 'desc' },
      take:    200,
      select:  { id: true, lectures: { where: { utilisateurId: a.userId }, select: { id: true } } },
    })
    const unread = rows.filter(r => r.lectures.length === 0).map(r => r.id)
    if (unread.length) {
      await this.prisma.notificationLecture.createMany({
        data:          unread.map(notificationId => ({ notificationId, utilisateurId: a.userId })),
        skipDuplicates: true,
      })
    }
    return { marked: unread.length }
  }

  /**
   * Marque lues les notifications d'une entité (ex. une conversation) pour un
   * utilisateur. Sert à vider la cloche des notifications « nouveau message » /
   * « réaction » dès que l'utilisateur ouvre la conversation concernée — évite le
   * décalage où le compteur restait malgré l'ouverture de la conversation.
   */
  async markReadForEntite(userId: string, entiteType: string, entiteId: string) {
    const rows = await this.prisma.notification.findMany({
      where:  { destinataireId: userId, entiteType, entiteId, lectures: { none: { utilisateurId: userId } } },
      select: { id: true },
      take:   200,
    })
    if (!rows.length) return { marked: 0 }
    await this.prisma.notificationLecture.createMany({
      data:           rows.map(r => ({ notificationId: r.id, utilisateurId: userId })),
      skipDuplicates: true,
    })
    return { marked: rows.length }
  }

  /** Suppression définitive d'une notification (réservé admin système). */
  async remove(id: string) {
    await this.prisma.notificationLecture.deleteMany({ where: { notificationId: id } })
    await this.prisma.notification.delete({ where: { id } })
    return { ok: true }
  }

  /** « Supprimer pour moi » : masque la notification du feed de cet utilisateur (lue ou non). */
  async dismissForUser(id: string, userId: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id }, select: { id: true } })
    if (!notif) throw new NotFoundException('Notification introuvable')
    await this.prisma.notificationLecture.upsert({
      where:  { notificationId_utilisateurId: { notificationId: id, utilisateurId: userId } },
      update: { masque: true },
      create: { notificationId: id, utilisateurId: userId, masque: true },
    })
    return { ok: true }
  }

  /** « Supprimer pour moi » en lot (≤ 200). */
  async dismissManyForUser(ids: string[], userId: string) {
    const uniq = [...new Set(ids.filter(Boolean))].slice(0, 200)
    if (!uniq.length) return { dismissed: 0 }
    // Ne garder que les ids EXISTANTS : un id inconnu violerait la FK (P2003) et ferait
    // échouer tout le lot. On ignore silencieusement les notifications introuvables.
    const existants = await this.prisma.notification.findMany({ where: { id: { in: uniq } }, select: { id: true } })
    const ids2 = existants.map(n => n.id)
    if (!ids2.length) return { dismissed: 0 }
    await this.prisma.$transaction(ids2.map(notificationId =>
      this.prisma.notificationLecture.upsert({
        where:  { notificationId_utilisateurId: { notificationId, utilisateurId: userId } },
        update: { masque: true },
        create: { notificationId, utilisateurId: userId, masque: true },
      }),
    ))
    return { dismissed: ids2.length }
  }

  /** « Tout supprimer pour moi » : masque toutes les notifications visibles de l'utilisateur. */
  async dismissAllForUser(a: NotifAudience) {
    const rows = await this.prisma.notification.findMany({
      where:   this.whereFor(a),
      orderBy: { createdAt: 'desc' },
      take:    200,
      select:  { id: true },
    })
    return this.dismissManyForUser(rows.map(r => r.id), a.userId)
  }

  /**
   * Diffuse un événement TEMPS RÉEL SILENCIEUX (non persisté) à une audience :
   * sert à rafraîchir les listes côté clients (référentiels, acteurs, etc.) SANS
   * cloche ni son ni toast. Le frontend traite les types `LIVE_*` à part.
   * `siteId` null = tous les sites ; `requiredPermission` restreint la visibilité.
   */
  broadcastLive(type: string, opts?: { siteId?: string | null; requiredPermission?: string | null }): void {
    this.stream$.next({
      id: `live-${type}`, createdAt: new Date(), destinataireId: null,
      siteId: opts?.siteId ?? null, requiredPermission: opts?.requiredPermission ?? null,
      type, niveau: 'INFO', titre: '', message: '', entiteType: null, entiteId: null,
      lien: null, createdById: null,
    } as NotifRow)
  }

  /**
   * Pousse un événement TEMPS RÉEL non persisté à un utilisateur précis (ex.
   * mise à jour d'accusés de réception). N'apparaît pas dans le feed (pas en BDD).
   */
  pushLive(destinataireId: string, type: string, entiteId?: string): void {
    this.stream$.next({
      id: `live-${type}`, createdAt: new Date(), destinataireId,
      siteId: null, requiredPermission: null, type, niveau: 'INFO',
      titre: '', message: '', entiteType: 'conversation', entiteId: entiteId ?? null,
      lien: null, createdById: null,
    } as NotifRow)
  }

  /**
   * SESSION UNIQUE : déconnecte INSTANTANÉMENT les postes dont la session vient d'être
   * révoquée (connexion ailleurs). Pousse un événement SESSION_REVOKED à TOUTES les
   * connexions SSE de l'utilisateur (filtrées par destinataireId). Chaque poste compare
   * SON sid (décodé de son token) à la liste `entiteId` (sids révoqués, séparés par des
   * virgules) → seul l'ANCIEN poste se déconnecte ; le NOUVEAU (qui vient de se connecter)
   * n'est pas dans la liste et l'ignore.
   */
  pushSessionRevoked(userId: string, revokedSids: string[]): void {
    if (!revokedSids.length) return
    this.stream$.next({
      id: `revoke-${Date.now()}`, createdAt: new Date(), destinataireId: userId,
      siteId: null, requiredPermission: null, type: 'SESSION_REVOKED', niveau: 'CRITIQUE',
      titre: 'Session fermée', message: 'Votre compte a été ouvert sur un autre poste.',
      entiteType: 'session', entiteId: revokedSids.join(','), lien: null, createdById: null,
    } as NotifRow)
  }

  // ── Temps réel (SSE) ──────────────────────────────────────────────────────────

  /** Flux SSE filtré : seules les notifications visibles par cet utilisateur. */
  streamFor(a: NotifAudience): Observable<MessageEvent> {
    return this.stream$.pipe(
      filter(n => this.visibleFor(n, a)),
      map(n => ({ data: { ...n, lu: false } }) as MessageEvent),
    )
  }
}
