/**
 * MessagerieService — messagerie interne chiffrée entre agents.
 *
 * - Contenu des messages ET pièces jointes chiffrés AES-256-GCM en base.
 * - Conversations DIRECT (1↔1) et GROUPE (n participants) du même site.
 * - Chaque message émet une notification ciblée (sans le contenu).
 * - État « lu » par participant (lastReadAt) → non-lus + accusés de lecture.
 * - Messages paginés (curseur), pièces jointes servies à la demande.
 */
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationService } from '../notification/notification.service'
import { PresenceService } from '../notification/presence.service'
import { encryptMessage, decryptMessage, encryptBytes, decryptBytes } from '../../common/crypto/message-crypto'

const USER_SELECT = {
  id: true, login: true, lastSeenAt: true,
  personnelMedical: { select: { nom: true, prenom: true, role: true } },
} as const

const PJ_META_SELECT = { id: true, nomFichier: true, mimeType: true, taille: true } as const

const MESSAGE_PAGE_SIZE = 50

/** Fenêtre pendant laquelle un message reste modifiable / supprimable (15 min). */
export const EDIT_DELETE_WINDOW_MS = 15 * 60 * 1000

type UserLite = {
  id: string; login: string; lastSeenAt?: Date | null
  personnelMedical: { nom: string; prenom: string; role: string } | null
}

export interface UploadedPiece {
  nomFichier: string
  mimeType:   string
  taille:     number
  buffer:     Buffer
}

function displayName(u: UserLite | null | undefined): string {
  if (!u) return 'Utilisateur'
  if (u.personnelMedical) return `${u.personnelMedical.prenom} ${u.personnelMedical.nom}`.trim()
  return u.login
}

/**
 * Extrait les userId mentionnés depuis le texte brut d'un message.
 * Convention de token (posée par le composer front) : `@[Nom Affiché](userId)`.
 * Le userId (UUID) est l'unique source de vérité — le Nom n'est qu'un affichage.
 */
const MENTION_TOKEN = /@\[[^\]]+\]\(([0-9a-fA-F-]{36})\)/g
function parseMentionIds(texte: string): Set<string> {
  const ids = new Set<string>()
  if (!texte) return ids
  for (const m of texte.matchAll(MENTION_TOKEN)) ids.add(m[1]!)
  return ids
}

type ReplyRow = {
  id: string; expediteurId: string; contenuChiffre: string; deletedAt: Date | null
  expediteur: UserLite | null
  piecesJointes: { id: string }[]
} | null

/** Agrège les réactions d'un message par emoji (avec compteur + "mine"). */
function aggregateReactions(rows: { emoji: string; utilisateurId: string }[], userId: string) {
  const map = new Map<string, { emoji: string; count: number; mine: boolean }>()
  for (const r of rows) {
    const e = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false }
    e.count++
    if (r.utilisateurId === userId) e.mine = true
    map.set(r.emoji, e)
  }
  return [...map.values()]
}

/** Aperçu compact d'un message cité (pour la bulle de réponse). */
function replyPreview(rt: ReplyRow, currentUserId: string) {
  if (!rt) return null
  let apercu: string
  if (rt.deletedAt) apercu = 'Message supprimé'
  else if (rt.contenuChiffre) apercu = decryptMessage(rt.contenuChiffre).slice(0, 120)
  else if (rt.piecesJointes.length) apercu = '📎 Pièce jointe'
  else apercu = ''
  return {
    id:     rt.id,
    auteur: displayName(rt.expediteur),
    deMoi:  rt.expediteurId === currentUserId,
    apercu,
  }
}

@Injectable()
export class MessagerieService {
  constructor(
    private readonly prisma:    PrismaService,
    private readonly notif:     NotificationService,
    private readonly presence:  PresenceService,
  ) {}

  /** Marque l'utilisateur comme actif (présence). Best-effort. */
  private touchPresence(userId: string): void {
    this.prisma.utilisateur.update({ where: { id: userId }, data: { lastSeenAt: new Date() } }).catch(() => { /* best-effort */ })
  }

  // ── Contacts (autres agents du même site) ──────────────────────────────────

  async listContacts(userId: string, siteId: string) {
    const users = await this.prisma.utilisateur.findMany({
      where:   { id: { not: userId }, statut: 'ACTIF', siteId },
      select:  USER_SELECT,
      orderBy: { login: 'asc' },
    })
    return users.map(u => ({ id: u.id, nom: displayName(u), login: u.login, role: u.personnelMedical?.role ?? null }))
  }

  // ── Conversations ──────────────────────────────────────────────────────────

  private async assertParticipant(conversationId: string, userId: string) {
    const part = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_utilisateurId: { conversationId, utilisateurId: userId } },
    })
    if (!part) throw new ForbiddenException('Vous ne participez pas à cette conversation')
    return part
  }

  /** Non-lus par conversation pour un utilisateur, en UNE requête (pas de N+1). */
  private async unreadByConversation(userId: string): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRaw<{ conversationId: string; unread: bigint }[]>`
      SELECT m."conversationId" AS "conversationId", COUNT(*) AS "unread"
      FROM "Message" m
      JOIN "ConversationParticipant" cp
        ON cp."conversationId" = m."conversationId" AND cp."utilisateurId" = ${userId}
      WHERE m."deletedAt" IS NULL
        AND m."expediteurId" <> ${userId}
        AND (cp."lastReadAt" IS NULL OR m."createdAt" > cp."lastReadAt")
      GROUP BY m."conversationId"
    `
    return new Map(rows.map(r => [r.conversationId, Number(r.unread)]))
  }

  async listConversations(userId: string) {
    this.touchPresence(userId)
    const parts = await this.prisma.conversationParticipant.findMany({
      where:   { utilisateurId: userId },
      include: {
        conversation: {
          include: {
            participants: { include: { utilisateur: { select: USER_SELECT } } },
            messages:     {
              where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 1,
              include: { expediteur: { select: USER_SELECT }, piecesJointes: { select: PJ_META_SELECT } },
            },
          },
        },
      },
    })

    const unread = await this.unreadByConversation(userId)

    const result = parts.map((p) => {
      const conv = p.conversation
      const isGroupe = conv.type === 'GROUPE'
      const autres = conv.participants.filter(cp => cp.utilisateurId !== userId)
      const interlocuteur = autres[0]?.utilisateur as UserLite | undefined
      const dernier = conv.messages[0]

      let apercu: string | null = null
      if (dernier) {
        if (dernier.piecesJointes.length && !dernier.contenuChiffre) {
          apercu = `📎 ${dernier.piecesJointes[0]!.nomFichier}`
        } else {
          apercu = decryptMessage(dernier.contenuChiffre).slice(0, 80)
        }
      }

      return {
        id:    conv.id,
        type:  conv.type,
        titre: isGroupe ? (conv.titre ?? 'Groupe') : displayName(interlocuteur ?? null),
        interlocuteur: !isGroupe && interlocuteur
          ? {
              id: interlocuteur.id, nom: displayName(interlocuteur), role: interlocuteur.personnelMedical?.role ?? null,
              enLigne: this.presence.isOnline(interlocuteur.id), vuLe: interlocuteur.lastSeenAt ?? null,
            }
          : null,
        participants: autres.map(cp => displayName(cp.utilisateur as UserLite)),
        nbParticipants: conv.participants.length,
        dernierMessage: dernier ? {
          apercu,
          auteur:    displayName(dernier.expediteur as UserLite),
          createdAt: dernier.createdAt,
          deMoi:     dernier.expediteurId === userId,
        } : null,
        nonLus:    unread.get(conv.id) ?? 0,
        updatedAt: conv.updatedAt,
      }
    })

    // Une conversation DIRECTE n'apparaît dans la liste (des DEUX côtés) qu'à partir du
    // PREMIER message : ouvrir une conversation sans rien envoyer ne la fait pas apparaître
    // chez le destinataire. Les groupes, créés délibérément, restent visibles dès le départ.
    return result
      .filter(r => r.type === 'GROUPE' || r.dernierMessage !== null)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }

  /** Récupère (ou crée) la conversation directe entre l'utilisateur et un autre. */
  async getOrCreateDirect(userId: string, destinataireId: string, siteId: string) {
    if (userId === destinataireId) throw new BadRequestException('Impossible de démarrer une conversation avec soi-même')
    const dest = await this.prisma.utilisateur.findUnique({ where: { id: destinataireId } })
    // Cloisonnement par site (anti-IDOR cross-site) : on ne peut écrire qu'à un agent
    // ACTIF du MÊME site. Message d'erreur uniforme pour ne pas révéler l'existence d'un compte.
    if (!dest || dest.statut !== 'ACTIF' || dest.siteId !== siteId) throw new NotFoundException('Destinataire introuvable')

    const mesConv = await this.prisma.conversationParticipant.findMany({
      where:  { utilisateurId: userId, conversation: { type: 'DIRECT' } },
      select: { conversationId: true },
    })
    for (const c of mesConv) {
      const participants = await this.prisma.conversationParticipant.findMany({ where: { conversationId: c.conversationId } })
      if (participants.length === 2 && participants.some(p => p.utilisateurId === destinataireId)) {
        return { id: c.conversationId, created: false }
      }
    }

    const conv = await this.prisma.conversation.create({
      data: {
        type:        'DIRECT',
        siteId,
        createdById: userId,
        participants: { create: [{ utilisateurId: userId }, { utilisateurId: destinataireId }] },
      },
    })
    return { id: conv.id, created: true }
  }

  /** Crée une conversation de GROUPE (titre + participants, dont le créateur). */
  async createGroup(userId: string, titre: string, participantIds: string[], siteId: string) {
    const titreNet = titre.trim()
    if (!titreNet) throw new BadRequestException('Le titre du groupe est requis')
    const uniques = [...new Set(participantIds.filter(id => id && id !== userId))]
    if (uniques.length < 1) throw new BadRequestException('Sélectionnez au moins un participant')
    if (uniques.length > 50) throw new BadRequestException('Un groupe est limité à 50 participants')

    const membres = await this.prisma.utilisateur.findMany({
      where:  { id: { in: uniques }, statut: 'ACTIF', siteId },
      select: { id: true },
    })
    if (membres.length !== uniques.length) {
      throw new BadRequestException('Un ou plusieurs participants sont introuvables ou hors de votre site')
    }

    const conv = await this.prisma.conversation.create({
      data: {
        type:        'GROUPE',
        titre:       titreNet,
        siteId,
        createdById: userId,
        participants: { create: [{ utilisateurId: userId }, ...uniques.map(id => ({ utilisateurId: id }))] },
      },
    })
    return { id: conv.id, created: true }
  }

  /** Quitter une conversation (retire le participant). Interdit le DIRECT vide inutilement. */
  async leaveConversation(conversationId: string, userId: string) {
    await this.assertParticipant(conversationId, userId)
    await this.prisma.conversationParticipant.delete({
      where: { conversationId_utilisateurId: { conversationId, utilisateurId: userId } },
    })
    // Si plus aucun participant, on supprime la conversation. Avec le soft-delete global,
    // delete/deleteMany deviennent des updates {deletedAt} et ne déclenchent plus la cascade
    // DB : on soft-supprime donc explicitement les messages dans la même transaction.
    const reste = await this.prisma.conversationParticipant.count({ where: { conversationId } })
    if (reste === 0) {
      await this.prisma.$transaction([
        this.prisma.message.deleteMany({ where: { conversationId } }),
        this.prisma.conversation.delete({ where: { id: conversationId } }),
      ])
    }
    return { left: true }
  }

  // ── Messages ────────────────────────────────────────────────────────────────

  /**
   * Fil paginé (par curseur `before` = date du plus ancien message déjà chargé).
   * Renvoie les messages en ordre chronologique + `hasMore`. Marque comme lu.
   */
  async listMessages(conversationId: string, userId: string, before?: string) {
    const myPart = await this.assertParticipant(conversationId, userId)
    const oldLastRead = myPart.lastReadAt
    this.touchPresence(userId)
    this.presence.setViewing(userId, conversationId)  // l'utilisateur regarde cette conversation

    const beforeDate = before ? new Date(before) : null
    const rows = await this.prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        masques: { none: { utilisateurId: userId } },  // « supprimé pour moi »
        ...(beforeDate && !isNaN(beforeDate.getTime()) ? { createdAt: { lt: beforeDate } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take:    MESSAGE_PAGE_SIZE + 1,
      include: {
        expediteur:    { select: USER_SELECT },
        piecesJointes: { select: PJ_META_SELECT },
        reactions:     { select: { emoji: true, utilisateurId: true } },
        replyTo: {
          select: {
            id: true, expediteurId: true, contenuChiffre: true, deletedAt: true,
            expediteur: { select: USER_SELECT },
            piecesJointes: { select: { id: true } },
          },
        },
      },
    })

    const hasMore = rows.length > MESSAGE_PAGE_SIZE
    const page = (hasMore ? rows.slice(0, MESSAGE_PAGE_SIZE) : rows).reverse() // → ordre chronologique

    // Accusés : lastReadAt (lu) + lastSeenAt/présence (remis) des AUTRES participants.
    const autres = await this.prisma.conversationParticipant.findMany({
      where:  { conversationId, utilisateurId: { not: userId } },
      select: { utilisateurId: true, lastReadAt: true, utilisateur: { select: { lastSeenAt: true } } },
    })
    const nbAutres = autres.length

    // Marque la conversation comme lue jusqu'à maintenant.
    await this.prisma.conversationParticipant.update({
      where: { conversationId_utilisateurId: { conversationId, utilisateurId: userId } },
      data:  { lastReadAt: new Date() },
    })

    // La conversation est ouverte → marquer AUSSI lues ses notifications (nouveau
    // message, réaction) pour que la cloche se décrémente sans décalage. Uniquement
    // au chargement initial du fil (pas en pagination « plus anciens »).
    if (!before) {
      try { await this.notif.markReadForEntite(userId, 'conversation', conversationId) }
      catch { /* best-effort : ne doit pas bloquer l'affichage des messages */ }
    }

    // Temps réel : prévenir les EXPÉDITEURS des messages qu'on vient de lire
    // → leurs ✓✓ passent au bleu instantanément (pas d'attente du refetch).
    const expediteursALu = new Set<string>()
    for (const m of page) {
      if (m.expediteurId !== userId && (!oldLastRead || m.createdAt.getTime() > oldLastRead.getTime())) {
        expediteursALu.add(m.expediteurId)
      }
    }
    for (const sid of expediteursALu) this.notif.pushLive(sid, 'MESSAGE_STATUS', conversationId)

    const messages = page.map(m => {
      const deMoi = m.expediteurId === userId
      let vu = false, luPar = 0, remisPar = 0
      let vuAt: Date | null = null
      if (deMoi && nbAutres > 0) {
        const t = m.createdAt.getTime()
        for (const a of autres) {
          const seen = a.utilisateur?.lastSeenAt
          const read = a.lastReadAt
          const livre = this.presence.isOnline(a.utilisateurId)
            || (!!seen && seen.getTime() >= t) || (!!read && read.getTime() >= t)
          if (livre) remisPar++
          if (read && read.getTime() >= t) { luPar++; if (!vuAt || read < vuAt) vuAt = read }
        }
        vu = luPar > 0
      }
      const ageMs = Date.now() - m.createdAt.getTime()
      const fenetreOuverte = deMoi && ageMs <= EDIT_DELETE_WINDOW_MS
      return {
        id:           m.id,
        contenu:      m.contenuChiffre ? decryptMessage(m.contenuChiffre) : '',
        expediteurId: m.expediteurId,
        expediteur:   displayName(m.expediteur as UserLite),
        deMoi,
        edite:        !!m.editedAt,
        createdAt:    m.createdAt,
        piecesJointes: m.piecesJointes,
        reactions:    aggregateReactions(m.reactions, userId),
        replyTo:      replyPreview(m.replyTo as ReplyRow, userId),
        vu,
        vuAt,
        luPar,
        luParTous:    deMoi && nbAutres > 0 && luPar === nbAutres,
        remis:        deMoi && remisPar > 0,
        remisPar,
        modifiable:   fenetreOuverte,
        supprimable:  fenetreOuverte,
      }
    })

    return { messages, hasMore }
  }

  /**
   * « En train d'écrire » : pousse un événement TEMPS RÉEL éphémère (non persisté) aux
   * AUTRES participants de la conversation. Sécurisé : l'appelant doit en être membre.
   */
  async notifyTyping(conversationId: string, userId: string, kind: 'text' | 'audio' = 'text'): Promise<void> {
    const parts = await this.prisma.conversationParticipant.findMany({
      where:  { conversationId },
      select: { utilisateurId: true },
    })
    if (!parts.some(p => p.utilisateurId === userId)) return // non-membre → ignoré
    const type = kind === 'audio' ? 'TYPING_AUDIO' : 'TYPING'
    for (const p of parts) {
      if (p.utilisateurId !== userId) this.notif.pushLive(p.utilisateurId, type, conversationId)
    }
  }

  async sendMessage(conversationId: string, expediteurId: string, contenu: string, fichiers: UploadedPiece[] = [], replyToId?: string) {
    await this.assertParticipant(conversationId, expediteurId)
    const texte = (contenu ?? '').trim()
    if (!texte && fichiers.length === 0) throw new BadRequestException('Message vide')

    // Le message cité doit appartenir à la même conversation.
    let replyTo: string | null = null
    if (replyToId) {
      const rt = await this.prisma.message.findUnique({ where: { id: replyToId }, select: { conversationId: true, deletedAt: true } })
      if (rt && !rt.deletedAt && rt.conversationId === conversationId) replyTo = replyToId
    }

    const msg = await this.prisma.message.create({
      data: {
        conversationId,
        expediteurId,
        contenuChiffre: texte ? encryptMessage(texte) : '',
        ...(replyTo ? { replyToId: replyTo } : {}),
        ...(fichiers.length ? {
          piecesJointes: {
            create: fichiers.map(f => ({
              nomFichier:     f.nomFichier,
              mimeType:       f.mimeType,
              taille:         f.taille,
              contenuChiffre: encryptBytes(f.buffer),
            })),
          },
        } : {}),
      },
      include: {
        expediteur: { select: USER_SELECT },
        piecesJointes: { select: PJ_META_SELECT },
        replyTo: {
          select: {
            id: true, expediteurId: true, contenuChiffre: true, deletedAt: true,
            expediteur: { select: USER_SELECT },
            piecesJointes: { select: { id: true } },
          },
        },
      },
    })
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } })

    // Notifier les AUTRES participants (le contenu n'est pas recopié dans la notif).
    const expName = displayName(msg.expediteur as UserLite)
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } })
    const apercuNotif = conv?.type === 'GROUPE' && conv.titre ? ` (${conv.titre})` : ''
    const autres = await this.prisma.conversationParticipant.findMany({
      where:  { conversationId, utilisateurId: { not: expediteurId } },
      select: { utilisateurId: true },
    })
    // @mentions — les userId sont portés par des tokens `@[Nom](userId)` dans le texte
    // brut (avant chiffrement). On ne notifie spécifiquement QUE les vrais participants
    // mentionnés (≠ expéditeur) → notification dédiée AVERTISSEMENT (toast + son côté front),
    // même s'ils regardent déjà la conversation (une interpellation ne doit pas être muette).
    const mentionIds = parseMentionIds(texte)
    let remisPar = 0
    for (const p of autres) {
      const mentioned = mentionIds.has(p.utilisateurId)
      if (this.presence.isOnline(p.utilisateurId)) remisPar++  // remis immédiat si en ligne
      // Déjà dans cette conversation ET non mentionné → live silencieux (pas de cloche).
      if (!mentioned && this.presence.isViewing(p.utilisateurId, conversationId)) {
        this.notif.pushLive(p.utilisateurId, 'MESSAGE_NEW', conversationId)
        continue
      }
      await this.notif.emit({
        type:           'MESSAGE',
        niveau:         mentioned ? 'AVERTISSEMENT' : 'INFO',
        titre:          mentioned ? 'Vous avez été mentionné' : 'Nouveau message',
        message:        mentioned
          ? `${expName} vous a mentionné${apercuNotif}`
          : `${expName} vous a envoyé un message${apercuNotif}`,
        destinataireId: p.utilisateurId,
        entiteType:     'conversation',
        entiteId:       conversationId,
        lien:           `/messagerie?c=${conversationId}`,
        createdById:    expediteurId,
      })
    }

    return {
      id:           msg.id,
      contenu:      texte,
      expediteurId: msg.expediteurId,
      expediteur:   expName,
      deMoi:        true,
      edite:        false,
      createdAt:    msg.createdAt,
      piecesJointes: msg.piecesJointes,
      reactions:    [] as { emoji: string; count: number; mine: boolean }[],
      replyTo:      replyPreview(msg.replyTo as ReplyRow, expediteurId),
      vu:           false,
      vuAt:         null,
      luPar:        0,
      luParTous:    false,
      remis:        remisPar > 0,
      remisPar,
      modifiable:   true,
      supprimable:  true,
    }
  }

  /** Détails d'un message (statut par destinataire) — pour la fiche « Détails ». */
  async getMessageDetails(messageId: string, userId: string) {
    const m = await this.prisma.message.findUnique({
      where:   { id: messageId },
      include: {
        conversation: { include: { participants: { include: { utilisateur: { select: USER_SELECT } } } } },
        piecesJointes: { select: { id: true } },
      },
    })
    if (!m || m.deletedAt) throw new NotFoundException('Message introuvable')
    await this.assertParticipant(m.conversationId, userId)

    const t = m.createdAt.getTime()
    const destinataires = m.conversation.participants
      .filter(p => p.utilisateurId !== m.expediteurId)
      .map(p => {
        const u = p.utilisateur as UserLite
        const seen = u.lastSeenAt
        const read = p.lastReadAt
        const remis = this.presence.isOnline(p.utilisateurId)
          || (!!seen && seen.getTime() >= t) || (!!read && read.getTime() >= t)
        return {
          nom:   displayName(u),
          remis,
          lu:    !!read && read.getTime() >= t,
          luAt:  read && read.getTime() >= t ? read : null,
          enLigne: this.presence.isOnline(p.utilisateurId),
        }
      })

    return {
      id:          m.id,
      deMoi:       m.expediteurId === userId,
      expediteur:  displayName(m.conversation.participants.find(p => p.utilisateurId === m.expediteurId)?.utilisateur as UserLite),
      createdAt:   m.createdAt,
      editedAt:    m.editedAt,
      edite:       !!m.editedAt,
      aPieceJointe: m.piecesJointes.length > 0,
      type:        m.conversation.type,
      destinataires,
    }
  }

  async updateMessage(messageId: string, userId: string, contenu: string) {
    const m = await this.prisma.message.findUnique({ where: { id: messageId } })
    if (!m || m.deletedAt) throw new NotFoundException('Message introuvable')
    if (m.expediteurId !== userId) throw new ForbiddenException('Vous ne pouvez modifier que vos propres messages')
    if (Date.now() - m.createdAt.getTime() > EDIT_DELETE_WINDOW_MS) {
      throw new ForbiddenException('Le délai de modification (15 min) est dépassé')
    }
    const texte = contenu.trim()
    if (!texte) throw new BadRequestException('Le message ne peut pas être vide')
    await this.prisma.message.update({
      where: { id: messageId },
      data:  { contenuChiffre: encryptMessage(texte), editedAt: new Date() },
    })
    return { id: messageId, contenu: texte, edite: true }
  }

  /** Supprimer pour TOUT LE MONDE : son propre message, dans les 15 min (soft delete). */
  async deleteMessage(messageId: string, userId: string) {
    const m = await this.prisma.message.findUnique({ where: { id: messageId } })
    if (!m || m.deletedAt) throw new NotFoundException('Message introuvable')
    if (m.expediteurId !== userId) throw new ForbiddenException('Vous ne pouvez supprimer que vos propres messages')
    if (Date.now() - m.createdAt.getTime() > EDIT_DELETE_WINDOW_MS) {
      throw new ForbiddenException('Le délai de suppression (15 min) est dépassé')
    }
    await this.prisma.message.update({ where: { id: messageId }, data: { deletedAt: new Date() } })
    return { id: messageId, deleted: true }
  }

  /** Supprimer POUR MOI : masque le message pour cet utilisateur (tout message, tout âge). */
  async hideForMe(messageId: string, userId: string) {
    const m = await this.prisma.message.findUnique({ where: { id: messageId }, select: { conversationId: true, deletedAt: true } })
    if (!m || m.deletedAt) throw new NotFoundException('Message introuvable')
    await this.assertParticipant(m.conversationId, userId)
    await this.prisma.messageMasque.upsert({
      where:  { messageId_utilisateurId: { messageId, utilisateurId: userId } },
      update: {},
      create: { messageId, utilisateurId: userId },
    })
    return { id: messageId, hidden: true }
  }

  /** Suppression MULTIPLE « pour moi » (masque chaque message, ≤ 200). Best-effort. */
  async batchHideForMe(ids: string[], userId: string) {
    const uniq = [...new Set((ids ?? []).filter(Boolean))].slice(0, 200)
    let hidden = 0
    for (const id of uniq) { try { await this.hideForMe(id, userId); hidden++ } catch { /* ignore les inéligibles */ } }
    return { hidden }
  }

  /** Suppression MULTIPLE « pour tout le monde » (les siens, ≤ 15 min ; ≤ 200). Best-effort. */
  async batchDelete(ids: string[], userId: string) {
    const uniq = [...new Set((ids ?? []).filter(Boolean))].slice(0, 200)
    let deleted = 0
    for (const id of uniq) { try { await this.deleteMessage(id, userId); deleted++ } catch { /* ignore les inéligibles */ } }
    return { deleted }
  }

  /** Ajoute/retire (toggle) une réaction emoji sur un message. */
  async toggleReaction(messageId: string, userId: string, emoji: string) {
    const e = (emoji ?? '').trim().slice(0, 16)
    if (!e) throw new BadRequestException('Emoji requis')
    const m = await this.prisma.message.findUnique({ where: { id: messageId }, select: { conversationId: true, deletedAt: true, expediteurId: true } })
    if (!m || m.deletedAt) throw new NotFoundException('Message introuvable')
    await this.assertParticipant(m.conversationId, userId)
    const existing = await this.prisma.messageReaction.findUnique({
      where: { messageId_utilisateurId_emoji: { messageId, utilisateurId: userId, emoji: e } },
    })
    // Réaction ACTIVE (non supprimée) → on la retire (suppression logique propagée par la synchro).
    if (existing && !existing.deletedAt) {
      await this.prisma.messageReaction.delete({ where: { id: existing.id } })
      return { emoji: e, active: false }
    }
    // Aucune réaction active : on (re)pose la réaction. `upsert` RESSUSCITE un éventuel
    // tombstone (`deletedAt: null`) — sans quoi le `@@unique([message,user,emoji])` bloquerait
    // la recréation après un soft-delete (re-réagir au même emoji).
    await this.prisma.messageReaction.upsert({
      where:  { messageId_utilisateurId_emoji: { messageId, utilisateurId: userId, emoji: e } },
      create: { messageId, utilisateurId: userId, emoji: e },
      update: { deletedAt: null },
    })

    // Notifier l'AUTEUR du message (façon WhatsApp) — sauf réaction sur son propre message.
    if (m.expediteurId !== userId) {
      if (this.presence.isViewing(m.expediteurId, m.conversationId)) {
        // L'auteur regarde la conversation → MAJ du fil en direct, sans notification comptée.
        this.notif.pushLive(m.expediteurId, 'MESSAGE_NEW', m.conversationId)
      } else {
        const reacteur = await this.prisma.utilisateur.findUnique({ where: { id: userId }, select: USER_SELECT })
        const nom = displayName(reacteur as UserLite)
        await this.notif.emit({
          type:           'MESSAGE',
          niveau:         'INFO',
          titre:          'Nouvelle réaction',
          message:        `${nom} a réagi ${e} à votre message`,
          destinataireId: m.expediteurId,
          entiteType:     'conversation',
          entiteId:       m.conversationId,
          lien:           `/messagerie?c=${m.conversationId}`,
          createdById:    userId,
        }).catch(() => { /* notif best-effort */ })
      }
    }
    return { emoji: e, active: true }
  }

  /** Sert une pièce jointe déchiffrée (data URL) à un participant autorisé. */
  async getPieceJointe(pieceId: string, userId: string) {
    const pj = await this.prisma.messagePieceJointe.findUnique({
      where:   { id: pieceId },
      include: { message: { select: { conversationId: true, deletedAt: true } } },
    })
    if (!pj || pj.message.deletedAt) throw new NotFoundException('Pièce jointe introuvable')
    await this.assertParticipant(pj.message.conversationId, userId)
    let bytes: Buffer
    try { bytes = decryptBytes(pj.contenuChiffre) }
    catch { throw new NotFoundException('Pièce jointe illisible') }
    return {
      nomFichier: pj.nomFichier,
      mimeType:   pj.mimeType,
      taille:     pj.taille,
      dataUrl:    `data:${pj.mimeType};base64,${bytes.toString('base64')}`,
    }
  }

  /** Nombre total de messages non lus (badge global), en une requête. */
  async totalUnread(userId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*) AS "total"
      FROM "Message" m
      JOIN "ConversationParticipant" cp
        ON cp."conversationId" = m."conversationId" AND cp."utilisateurId" = ${userId}
      WHERE m."deletedAt" IS NULL
        AND m."expediteurId" <> ${userId}
        AND (cp."lastReadAt" IS NULL OR m."createdAt" > cp."lastReadAt")
    `
    return Number(rows[0]?.total ?? 0)
  }
}
