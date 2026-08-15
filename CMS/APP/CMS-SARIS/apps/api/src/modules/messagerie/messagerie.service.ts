/**
 * MessagerieService — messagerie interne chiffrée entre agents.
 *
 * - Contenu des messages ET pièces jointes chiffrés AES-256-GCM en base.
 * - Conversations DIRECT (1↔1) et GROUPE (n participants) du même site.
 * - Chaque message émet une notification ciblée (sans le contenu).
 * - État « lu » par participant (lastReadAt) → non-lus + accusés de lecture.
 * - Messages paginés (curseur), pièces jointes servies à la demande.
 */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import sharp from 'sharp'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationService } from '../notification/notification.service'
import { PresenceService } from '../notification/presence.service'
import {
  encryptMessage,
  decryptMessage,
  encryptBytes,
  decryptBytes,
} from '../../common/crypto/message-crypto'

const USER_SELECT = {
  id: true,
  login: true,
  lastSeenAt: true,
  personnelMedical: { select: { nom: true, prenom: true, role: true } },
} as const

const PJ_META_SELECT = {
  id: true,
  nomFichier: true,
  mimeType: true,
  taille: true,
} as const

const MESSAGE_PAGE_SIZE = 50

/** Fenêtre pendant laquelle un message reste modifiable / supprimable (15 min). */
export const EDIT_DELETE_WINDOW_MS = 15 * 60 * 1000

type UserLite = {
  id: string
  login: string
  lastSeenAt?: Date | null
  personnelMedical: { nom: string; prenom: string; role: string } | null
}

export interface UploadedPiece {
  nomFichier: string
  mimeType: string
  taille: number
  buffer: Buffer
}

function displayName(u: UserLite | null | undefined): string {
  if (!u) return 'Utilisateur'
  if (u.personnelMedical)
    return `${u.personnelMedical.prenom} ${u.personnelMedical.nom}`.trim()
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
  for (const m of texte.matchAll(MENTION_TOKEN)) ids.add(m[1])
  return ids
}

// Même token que MENTION_TOKEN, mais capture le NOM plutôt que l'id — pour les
// contextes texte BRUT (notification OS) qui ne peuvent pas styliser le token
// comme le fait `renderRich` côté front : on l'humanise en `@Nom`.
const MENTION_DISPLAY = /@\[([^\]]+)\]\([0-9a-fA-F-]{36}\)/g
function humanizeMentions(texte: string): string {
  return texte.replace(MENTION_DISPLAY, (_m, nom: string) => `@${nom}`)
}

type ReplyRow = {
  id: string
  expediteurId: string
  contenuChiffre: string
  deletedAt: Date | null
  expediteur: UserLite | null
  piecesJointes: { id: string }[]
} | null

/**
 * Aperçu du contenu d'un message (texte tronqué ou type de média, façon WhatsApp) —
 * utilisé pour les notifications ET l'aperçu de la liste des conversations, pour
 * ne jamais exposer un nom de fichier technique brut (ex. `note-vocale-0m38s.webm`).
 */
function contentPreview(
  texteBrut: string,
  fichiers: { nomFichier: string; mimeType: string }[],
): string {
  const texte = humanizeMentions(texteBrut)
  if (texte) return texte.length > 80 ? `${texte.slice(0, 80)}…` : texte
  const f = fichiers[0]
  if (!f) return ''
  if (f.mimeType.startsWith('image/')) return '📷 Photo'
  if (f.mimeType.startsWith('video/')) return '🎥 Vidéo'
  if (f.mimeType.startsWith('audio/')) return '🎤 Message vocal'
  return `📎 ${f.nomFichier}`
}

/** Agrège les réactions d'un message par emoji (avec compteur + "mine"). */
function aggregateReactions(
  rows: { emoji: string; utilisateurId: string }[],
  userId: string,
) {
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
  else if (rt.contenuChiffre)
    apercu = decryptMessage(rt.contenuChiffre).slice(0, 120)
  else if (rt.piecesJointes.length) apercu = '📎 Pièce jointe'
  else apercu = ''
  return {
    id: rt.id,
    auteur: displayName(rt.expediteur),
    deMoi: rt.expediteurId === currentUserId,
    apercu,
  }
}

@Injectable()
export class MessagerieService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notif: NotificationService,
    private readonly presence: PresenceService,
  ) {}

  /** Marque l'utilisateur comme actif (présence). Best-effort. */
  private touchPresence(userId: string): void {
    this.prisma.utilisateur
      .update({ where: { id: userId }, data: { lastSeenAt: new Date() } })
      .catch(() => {
        /* best-effort */
      })
  }

  // ── Contacts (tous les agents actifs — gouverné par permission, pas par site) ──

  async listContacts(userId: string) {
    const users = await this.prisma.utilisateur.findMany({
      where: { id: { not: userId }, statut: 'ACTIF' },
      select: USER_SELECT,
      orderBy: { login: 'asc' },
    })
    return users.map((u) => ({
      id: u.id,
      nom: displayName(u),
      login: u.login,
      role: u.personnelMedical?.role ?? null,
    }))
  }

  // ── Conversations ──────────────────────────────────────────────────────────

  private async assertParticipant(conversationId: string, userId: string) {
    const part = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_utilisateurId: { conversationId, utilisateurId: userId },
      },
    })
    if (!part)
      throw new ForbiddenException(
        'Vous ne participez pas à cette conversation',
      )
    return part
  }

  private async getUserLite(userId: string): Promise<UserLite> {
    const u = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
      select: USER_SELECT,
    })
    return (
      (u as UserLite | null) ?? {
        id: userId,
        login: 'Utilisateur',
        personnelMedical: null,
      }
    )
  }

  /**
   * Un membre est habilité à administrer le groupe (ajouter/retirer/promouvoir,
   * renommer, changer photo/description) s'il est le CRÉATEUR (toujours admin
   * implicite, non dupliqué dans `estAdmin`) ou marqué `estAdmin`. Volontairement
   * plus strict que WhatsApp par défaut : toute gestion du groupe est réservée
   * aux administrateurs (pas de délégation aux simples membres), plus adapté à
   * un usage professionnel.
   */
  private async assertGroupAdmin(conversationId: string, userId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    })
    if (!conv || conv.type !== 'GROUPE')
      throw new NotFoundException('Groupe introuvable')
    const part = await this.assertParticipant(conversationId, userId)
    const isCreateur = conv.createdById === userId
    if (!isCreateur && !part.estAdmin)
      throw new ForbiddenException('Réservé aux administrateurs du groupe')
    return { conv, part, isCreateur }
  }

  /**
   * Insère un message SYSTÈME (événement de groupe : ajout/retrait/promotion/
   * renommage/photo/départ) — jamais exposé en écriture directe au client, donc
   * personne ne peut forger un faux événement. Chiffré comme un message normal
   * (même colonne) ; c'est le champ `type` qui commande son rendu spécial côté
   * frontend (pastille centrée, pas de bulle).
   */
  private async systemMessage(
    conversationId: string,
    actorId: string,
    texte: string,
  ) {
    await this.prisma.message.create({
      data: {
        conversationId,
        expediteurId: actorId,
        type: 'SYSTEME',
        contenuChiffre: encryptMessage(texte),
      },
    })
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    })
    const parts = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { utilisateurId: true },
    })
    for (const p of parts)
      this.notif.pushLive(p.utilisateurId, 'MESSAGE_NEW', conversationId)
  }

  /** Non-lus par conversation pour un utilisateur, en UNE requête (pas de N+1). */
  private async unreadByConversation(
    userId: string,
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRaw<
      { conversationId: string; unread: bigint }[]
    >`
      SELECT m."conversationId" AS "conversationId", COUNT(*) AS "unread"
      FROM "Message" m
      JOIN "ConversationParticipant" cp
        ON cp."conversationId" = m."conversationId" AND cp."utilisateurId" = ${userId}
      WHERE m."deletedAt" IS NULL
        AND m."expediteurId" <> ${userId}
        AND (cp."lastReadAt" IS NULL OR m."createdAt" > cp."lastReadAt")
      GROUP BY m."conversationId"
    `
    return new Map(rows.map((r) => [r.conversationId, Number(r.unread)]))
  }

  async listConversations(userId: string) {
    this.touchPresence(userId)
    const parts = await this.prisma.conversationParticipant.findMany({
      where: { utilisateurId: userId },
      include: {
        conversation: {
          include: {
            participants: { include: { utilisateur: { select: USER_SELECT } } },
            messages: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                expediteur: { select: USER_SELECT },
                piecesJointes: { select: PJ_META_SELECT },
              },
            },
          },
        },
      },
    })

    const unread = await this.unreadByConversation(userId)

    // LIEN ROMPU À RATTRAPER. Supprimer une conversation directe DÉTRUIT la ligne de
    // participation de celui qui supprime — `ConversationParticipant` n'est pas en
    // soft-delete, la ligne part pour de bon. Chez l'autre, il ne reste alors plus
    // personne « en face » : le nom retombait sur « Utilisateur » et la conversation
    // perdait son identité, alors qu'elle est toujours bien vivante de son côté.
    //
    // L'interlocuteur reste pourtant identifiable : ses MESSAGES sont là, et ils portent
    // son auteur. On le retrouve par là, en une seule requête pour toutes les
    // conversations concernées.
    const orphelines = parts
      .filter(
        (p) =>
          p.conversation.type !== 'GROUPE' &&
          !p.conversation.participants.some((cp) => cp.utilisateurId !== userId),
      )
      .map((p) => p.conversation.id)

    const rattrapes = new Map<string, UserLite>()
    if (orphelines.length) {
      // Client BRUT : un message supprimé porte encore l'identité de son auteur, et c'est
      // la seule chose dont on ait besoin ici.
      const traces = await this.prisma.raw.message.findMany({
        where: {
          conversationId: { in: orphelines },
          expediteurId: { not: userId },
        },
        distinct: ['conversationId'],
        orderBy: { createdAt: 'desc' },
        select: { conversationId: true, expediteur: { select: USER_SELECT } },
      })
      for (const tr of traces)
        if (tr.expediteur)
          rattrapes.set(tr.conversationId, tr.expediteur as UserLite)
    }

    const result = parts.map((p) => {
      const conv = p.conversation
      const isGroupe = conv.type === 'GROUPE'
      const autres = conv.participants.filter(
        (cp) => cp.utilisateurId !== userId,
      )
      const interlocuteur =
        (autres[0]?.utilisateur as UserLite | undefined) ??
        (isGroupe ? undefined : rattrapes.get(conv.id))
      const dernier = conv.messages[0]

      let apercu: string | null = null
      if (dernier) {
        if (dernier.type === 'SYSTEME') {
          apercu = dernier.contenuChiffre
            ? decryptMessage(dernier.contenuChiffre)
            : ''
        } else {
          const texte = dernier.contenuChiffre
            ? decryptMessage(dernier.contenuChiffre)
            : ''
          apercu = contentPreview(texte, dernier.piecesJointes)
        }
      }

      return {
        id: conv.id,
        type: conv.type,
        titre: isGroupe
          ? (conv.titre ?? 'Groupe')
          : displayName(interlocuteur ?? null),
        photoUrl: isGroupe ? conv.photoUrl : null,
        interlocuteur:
          !isGroupe && interlocuteur
            ? {
                id: interlocuteur.id,
                nom: displayName(interlocuteur),
                role: interlocuteur.personnelMedical?.role ?? null,
                enLigne: this.presence.isOnline(interlocuteur.id),
                vuLe: interlocuteur.lastSeenAt ?? null,
              }
            : null,
        participants: autres.map((cp) =>
          displayName(cp.utilisateur as UserLite),
        ),
        nbParticipants: conv.participants.length,
        dernierMessage: dernier
          ? {
              type: dernier.type as 'TEXTE' | 'SYSTEME',
              apercu,
              auteur: displayName(dernier.expediteur as UserLite),
              createdAt: dernier.createdAt,
              deMoi: dernier.expediteurId === userId,
            }
          : null,
        nonLus: unread.get(conv.id) ?? 0,
        muted: p.muted,
        updatedAt: conv.updatedAt,
      }
    })

    // Une conversation DIRECTE n'apparaît dans la liste (des DEUX côtés) qu'à partir du
    // PREMIER message : ouvrir une conversation sans rien envoyer ne la fait pas apparaître
    // chez le destinataire. Les groupes, créés délibérément, restent visibles dès le départ.
    return result
      .filter((r) => r.type === 'GROUPE' || r.dernierMessage !== null)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
  }

  /** Récupère (ou crée) la conversation directe entre l'utilisateur et un autre. */
  async getOrCreateDirect(
    userId: string,
    destinataireId: string,
    siteId: string,
  ) {
    if (userId === destinataireId)
      throw new BadRequestException(
        'Impossible de démarrer une conversation avec soi-même',
      )
    const dest = await this.prisma.utilisateur.findUnique({
      where: { id: destinataireId },
    })
    // N'importe quel agent ACTIF (tous sites) peut être contacté directement — l'accès est
    // gouverné par permission, pas par site. Message d'erreur uniforme pour ne pas révéler
    // l'existence d'un compte.
    if (!dest || dest.statut !== 'ACTIF')
      throw new NotFoundException('Destinataire introuvable')

    const mesConv = await this.prisma.conversationParticipant.findMany({
      where: { utilisateurId: userId, conversation: { type: 'DIRECT' } },
      select: { conversationId: true },
    })
    for (const c of mesConv) {
      const participants = await this.prisma.conversationParticipant.findMany({
        where: { conversationId: c.conversationId },
      })
      if (
        participants.length === 2 &&
        participants.some((p) => p.utilisateurId === destinataireId)
      ) {
        return { id: c.conversationId, created: false }
      }
    }

    const conv = await this.prisma.conversation.create({
      data: {
        type: 'DIRECT',
        siteId,
        createdById: userId,
        participants: {
          create: [
            { utilisateurId: userId },
            { utilisateurId: destinataireId },
          ],
        },
      },
    })
    return { id: conv.id, created: true }
  }

  /** Crée une conversation de GROUPE (titre + participants, dont le créateur). */
  async createGroup(
    userId: string,
    titre: string,
    participantIds: string[],
    siteId: string,
  ) {
    const titreNet = titre.trim()
    if (!titreNet)
      throw new BadRequestException('Le titre du groupe est requis')
    const uniques = [
      ...new Set(participantIds.filter((id) => id && id !== userId)),
    ]
    if (uniques.length < 1)
      throw new BadRequestException('Sélectionnez au moins un participant')
    if (uniques.length > 50)
      throw new BadRequestException('Un groupe est limité à 50 participants')

    const membres = await this.prisma.utilisateur.findMany({
      where: { id: { in: uniques }, statut: 'ACTIF' },
      select: { id: true },
    })
    if (membres.length !== uniques.length) {
      throw new BadRequestException(
        'Un ou plusieurs participants sont introuvables',
      )
    }

    const conv = await this.prisma.conversation.create({
      data: {
        type: 'GROUPE',
        titre: titreNet,
        siteId,
        createdById: userId,
        participants: {
          create: [
            { utilisateurId: userId },
            ...uniques.map((id) => ({ utilisateurId: id })),
          ],
        },
      },
    })
    return { id: conv.id, created: true }
  }

  /**
   * Quitter une conversation (retire le participant).
   *
   * Succession d'administrateur principal : le CRÉATEUR d'un groupe qui compte
   * encore d'autres membres ne peut pas simplement partir (groupe orphelin sans
   * admin principal). Il doit d'abord désigner un administrateur SECONDAIRE
   * existant (`newPrincipalId`) qui hérite du rôle — jamais un simple membre,
   * jamais automatique. Sans successeur valide fourni, on bloque explicitement
   * (le frontend guide alors vers la promotion d'un admin ou le choix d'un successeur).
   */
  async leaveConversation(
    conversationId: string,
    userId: string,
    newPrincipalId?: string,
  ) {
    await this.assertParticipant(conversationId, userId)
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    })
    if (!conv) throw new NotFoundException('Conversation introuvable')
    const actorName = displayName(await this.getUserLite(userId))

    if (conv.type === 'GROUPE' && conv.createdById === userId) {
      const autresCount = await this.prisma.conversationParticipant.count({
        where: { conversationId, utilisateurId: { not: userId } },
      })
      if (autresCount > 0) {
        if (!newPrincipalId) {
          throw new BadRequestException(
            'SUCCESSION_REQUISE : désignez un administrateur secondaire avant de quitter le groupe',
          )
        }
        if (newPrincipalId === userId) {
          throw new BadRequestException(
            'Choisissez un autre membre pour hériter du rôle',
          )
        }
        const successeur = await this.prisma.conversationParticipant.findUnique(
          {
            where: {
              conversationId_utilisateurId: {
                conversationId,
                utilisateurId: newPrincipalId,
              },
            },
          },
        )
        if (!successeur)
          throw new BadRequestException(
            'Le membre choisi ne fait pas partie du groupe',
          )
        if (!successeur.estAdmin)
          throw new BadRequestException(
            'Le nouvel administrateur principal doit déjà être administrateur secondaire',
          )

        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { createdById: newPrincipalId },
        })
        const successeurName = displayName(
          await this.getUserLite(newPrincipalId),
        )
        await this.systemMessage(
          conversationId,
          userId,
          `${actorName} a transmis le rôle d'administrateur principal à ${successeurName}`,
        )
      }
    }

    await this.prisma.conversationParticipant.delete({
      where: {
        conversationId_utilisateurId: { conversationId, utilisateurId: userId },
      },
    })
    // Si plus aucun participant, on supprime la conversation. Avec le soft-delete global,
    // delete/deleteMany deviennent des updates {deletedAt} et ne déclenchent plus la cascade
    // DB : on soft-supprime donc explicitement les messages dans la même transaction.
    const reste = await this.prisma.conversationParticipant.count({
      where: { conversationId },
    })
    if (reste === 0) {
      await this.prisma.$transaction([
        this.prisma.message.deleteMany({ where: { conversationId } }),
        this.prisma.conversation.delete({ where: { id: conversationId } }),
      ])
    } else if (conv?.type === 'GROUPE') {
      await this.systemMessage(
        conversationId,
        userId,
        `${actorName} a quitté le groupe`,
      )
    }
    return { left: true }
  }

  // ── Gestion de groupe (membres, rôles, infos) ────────────────────────────────

  /** Infos du groupe + membres (visible par TOUT participant, pas seulement les admins). */
  async getGroupInfo(conversationId: string, userId: string) {
    await this.assertParticipant(conversationId, userId)
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: { include: { utilisateur: { select: USER_SELECT } } },
      },
    })
    if (!conv || conv.type !== 'GROUPE')
      throw new NotFoundException('Groupe introuvable')

    const membres = conv.participants
      .map((p) => {
        const u = p.utilisateur as UserLite
        return {
          id: p.utilisateurId,
          nom: displayName(u),
          role: u.personnelMedical?.role ?? null,
          estAdmin: p.estAdmin,
          estCreateur: p.utilisateurId === conv.createdById,
          enLigne: this.presence.isOnline(p.utilisateurId),
        }
      })
      .sort(
        (a, b) =>
          Number(b.estCreateur) - Number(a.estCreateur) ||
          Number(b.estAdmin) - Number(a.estAdmin) ||
          a.nom.localeCompare(b.nom),
      )

    const moi = conv.participants.find((p) => p.utilisateurId === userId)
    return {
      id: conv.id,
      titre: conv.titre,
      description: conv.description,
      photoUrl: conv.photoUrl,
      createdById: conv.createdById,
      monRole: {
        estAdmin: !!moi?.estAdmin || conv.createdById === userId,
        estCreateur: conv.createdById === userId,
      },
      membres,
    }
  }

  /** Ajoute des membres à un groupe existant (admins uniquement). */
  async addParticipants(
    conversationId: string,
    actorId: string,
    participantIds: string[],
  ) {
    const { conv } = await this.assertGroupAdmin(conversationId, actorId)
    const uniques = [...new Set(participantIds.filter(Boolean))]
    if (!uniques.length)
      throw new BadRequestException('Sélectionnez au moins un participant')

    const existants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { utilisateurId: true },
    })
    const existantsIds = new Set(existants.map((e) => e.utilisateurId))
    const aAjouter = uniques.filter((id) => !existantsIds.has(id))
    if (!aAjouter.length)
      throw new BadRequestException(
        'Ces utilisateurs sont déjà membres du groupe',
      )
    if (existants.length + aAjouter.length > 50)
      throw new BadRequestException('Un groupe est limité à 50 participants')

    const membres = await this.prisma.utilisateur.findMany({
      where: { id: { in: aAjouter }, statut: 'ACTIF' },
      select: USER_SELECT,
    })
    if (membres.length !== aAjouter.length)
      throw new BadRequestException(
        'Un ou plusieurs participants sont introuvables',
      )

    await this.prisma.conversationParticipant.createMany({
      data: aAjouter.map((id) => ({ conversationId, utilisateurId: id })),
    })

    const actorName = displayName(await this.getUserLite(actorId))
    for (const m of membres) {
      await this.systemMessage(
        conversationId,
        actorId,
        `${actorName} a ajouté ${displayName(m as UserLite)}`,
      )
    }
    for (const id of aAjouter) {
      await this.notif
        .emit({
          type: 'MESSAGE',
          niveau: 'INFO',
          titre: conv.titre ?? 'Groupe',
          message: `${actorName} vous a ajouté au groupe « ${conv.titre} »`,
          destinataireId: id,
          entiteType: 'conversation',
          entiteId: conversationId,
          lien: `/messagerie?c=${conversationId}`,
          createdById: actorId,
        })
        .catch(() => {
          /* notif best-effort */
        })
    }
    return { added: aAjouter.length }
  }

  /** Retire un membre d'un groupe (admins uniquement). Le créateur est protégé. */
  async removeParticipant(
    conversationId: string,
    actorId: string,
    targetUserId: string,
  ) {
    const { conv } = await this.assertGroupAdmin(conversationId, actorId)
    if (targetUserId === conv.createdById)
      throw new ForbiddenException(
        'Le créateur du groupe ne peut pas être retiré',
      )
    if (targetUserId === actorId)
      throw new BadRequestException(
        'Utilisez « Quitter le groupe » pour vous retirer vous-même',
      )

    const target = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_utilisateurId: {
          conversationId,
          utilisateurId: targetUserId,
        },
      },
      include: { utilisateur: { select: USER_SELECT } },
    })
    if (!target)
      throw new NotFoundException('Ce membre ne fait pas partie du groupe')

    await this.prisma.conversationParticipant.delete({
      where: { id: target.id },
    })
    const actorName = displayName(await this.getUserLite(actorId))
    await this.systemMessage(
      conversationId,
      actorId,
      `${actorName} a retiré ${displayName(target.utilisateur as UserLite)}`,
    )
    await this.notif
      .emit({
        type: 'MESSAGE',
        niveau: 'AVERTISSEMENT',
        titre: conv.titre ?? 'Groupe',
        message: `${actorName} vous a retiré du groupe « ${conv.titre} »`,
        destinataireId: targetUserId,
        entiteType: 'conversation',
        entiteId: conversationId,
        lien: '/messagerie',
        createdById: actorId,
      })
      .catch(() => {
        /* notif best-effort */
      })
    return { removed: true }
  }

  /** Promeut/rétrograde un admin de groupe (admins uniquement). Le créateur est protégé. */
  async setAdmin(
    conversationId: string,
    actorId: string,
    targetUserId: string,
    estAdmin: boolean,
  ) {
    const { conv } = await this.assertGroupAdmin(conversationId, actorId)
    if (targetUserId === conv.createdById)
      throw new ForbiddenException(
        'Le créateur est déjà administrateur et ne peut pas être rétrogradé',
      )

    const target = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_utilisateurId: {
          conversationId,
          utilisateurId: targetUserId,
        },
      },
      include: { utilisateur: { select: USER_SELECT } },
    })
    if (!target)
      throw new NotFoundException('Ce membre ne fait pas partie du groupe')
    if (target.estAdmin === estAdmin) return { estAdmin }

    await this.prisma.conversationParticipant.update({
      where: { id: target.id },
      data: { estAdmin },
    })
    const actorName = displayName(await this.getUserLite(actorId))
    const cibleNom = displayName(target.utilisateur as UserLite)
    await this.systemMessage(
      conversationId,
      actorId,
      estAdmin
        ? `${actorName} a nommé ${cibleNom} administrateur`
        : `${actorName} a retiré les droits d'administrateur de ${cibleNom}`,
    )
    if (estAdmin) {
      await this.notif
        .emit({
          type: 'MESSAGE',
          niveau: 'SUCCES',
          titre: conv.titre ?? 'Groupe',
          message: `${actorName} vous a nommé administrateur du groupe « ${conv.titre} »`,
          destinataireId: targetUserId,
          entiteType: 'conversation',
          entiteId: conversationId,
          lien: `/messagerie?c=${conversationId}`,
          createdById: actorId,
        })
        .catch(() => {
          /* notif best-effort */
        })
    }
    return { estAdmin }
  }

  /** Renomme le groupe / modifie sa description (admins uniquement). */
  async updateGroupInfo(
    conversationId: string,
    actorId: string,
    dto: { titre?: string; description?: string },
  ) {
    const { conv } = await this.assertGroupAdmin(conversationId, actorId)
    const data: { titre?: string; description?: string | null } = {}
    const changements: string[] = []
    const actorName = displayName(await this.getUserLite(actorId))

    if (dto.titre !== undefined && dto.titre !== conv.titre) {
      data.titre = dto.titre
      changements.push(
        `${actorName} a changé le nom du groupe en « ${dto.titre} »`,
      )
    }
    if (dto.description !== undefined) {
      const d = dto.description || null
      if (d !== conv.description) {
        data.description = d
        changements.push(`${actorName} a modifié la description du groupe`)
      }
    }
    if (Object.keys(data).length) {
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data,
      })
      for (const texte of changements)
        await this.systemMessage(conversationId, actorId, texte)
    }
    return this.getGroupInfo(conversationId, actorId)
  }

  /** Change la photo du groupe (admins uniquement) — même convention que les autres photos (carré recadré, Base64). */
  async setGroupPhoto(conversationId: string, actorId: string, buffer: Buffer) {
    await this.assertGroupAdmin(conversationId, actorId)
    let jpeg: Buffer
    try {
      jpeg = await sharp(buffer)
        .rotate()
        .resize(512, 512, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer()
    } catch {
      throw new BadRequestException('Image illisible ou corrompue')
    }
    const photoUrl = `data:image/jpeg;base64,${jpeg.toString('base64')}`
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { photoUrl },
    })
    const actorName = displayName(await this.getUserLite(actorId))
    await this.systemMessage(
      conversationId,
      actorId,
      `${actorName} a changé la photo du groupe`,
    )
    return { photoUrl }
  }

  /** Retire la photo du groupe (admins uniquement). */
  async removeGroupPhoto(conversationId: string, actorId: string) {
    await this.assertGroupAdmin(conversationId, actorId)
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { photoUrl: null },
    })
    const actorName = displayName(await this.getUserLite(actorId))
    await this.systemMessage(
      conversationId,
      actorId,
      `${actorName} a retiré la photo du groupe`,
    )
    return { photoUrl: null }
  }

  /** Coupe/rétablit les notifications d'UNE conversation, pour l'utilisateur courant seulement. */
  async setMuted(conversationId: string, userId: string, muted: boolean) {
    const part = await this.assertParticipant(conversationId, userId)
    await this.prisma.conversationParticipant.update({
      where: { id: part.id },
      data: { muted },
    })
    return { muted }
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
    this.presence.setViewing(userId, conversationId) // l'utilisateur regarde cette conversation

    const beforeDate = before ? new Date(before) : null
    // CLIENT BRUT, volontairement. L'extension soft-delete masque partout les lignes
    // `deletedAt` — ici on a besoin de les VOIR : un message « supprimé pour tout le
    // monde » doit rester dans le fil sous forme de trace, comme dans WhatsApp. Sans
    // cela il s'évaporait, et la conversation devenait incompréhensible pour l'autre :
    // on ne distingue pas un message retiré d'un message jamais envoyé.
    // (Même raison que la synchronisation, qui passe déjà par `raw` pour ses tombstones.)
    const rows = await this.prisma.raw.message.findMany({
      where: {
        conversationId,
        masques: { none: { utilisateurId: userId } }, // « supprimé pour moi »
        ...(beforeDate && !isNaN(beforeDate.getTime())
          ? { createdAt: { lt: beforeDate } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: MESSAGE_PAGE_SIZE + 1,
      include: {
        expediteur: { select: USER_SELECT },
        piecesJointes: { select: PJ_META_SELECT },
        // `where` OBLIGATOIRE : l'extension de soft-delete ne couvre pas les relations
        // incluses (cf. prisma/soft-delete.extension.ts). Sans lui, une réaction retirée
        // — donc seulement marquée `deletedAt` — continuait d'être renvoyée, et la
        // pastille restait affichée alors que le serveur avait bien enregistré le retrait.
        reactions: {
          where:  { deletedAt: null },
          select: { emoji: true, utilisateurId: true },
        },
        replyTo: {
          select: {
            id: true,
            expediteurId: true,
            contenuChiffre: true,
            deletedAt: true,
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
      where: { conversationId, utilisateurId: { not: userId } },
      select: {
        utilisateurId: true,
        lastReadAt: true,
        utilisateur: { select: { lastSeenAt: true } },
      },
    })
    const nbAutres = autres.length

    // Marque la conversation comme lue jusqu'à maintenant.
    await this.prisma.conversationParticipant.update({
      where: {
        conversationId_utilisateurId: { conversationId, utilisateurId: userId },
      },
      data: { lastReadAt: new Date() },
    })

    // La conversation est ouverte → marquer AUSSI lues ses notifications (nouveau
    // message, réaction) pour que la cloche se décrémente sans décalage. Uniquement
    // au chargement initial du fil (pas en pagination « plus anciens »).
    if (!before) {
      try {
        await this.notif.markReadForEntite(
          userId,
          'conversation',
          conversationId,
        )
      } catch {
        /* best-effort : ne doit pas bloquer l'affichage des messages */
      }
    }

    // Temps réel : prévenir les EXPÉDITEURS des messages qu'on vient de lire
    // → leurs ✓✓ passent au bleu instantanément (pas d'attente du refetch).
    const expediteursALu = new Set<string>()
    for (const m of page) {
      if (
        m.expediteurId !== userId &&
        (!oldLastRead || m.createdAt.getTime() > oldLastRead.getTime())
      ) {
        expediteursALu.add(m.expediteurId)
      }
    }
    for (const sid of expediteursALu)
      this.notif.pushLive(sid, 'MESSAGE_STATUS', conversationId)

    const messages = page.map((m) => {
      const deMoi = m.expediteurId === userId

      // TRACE d'un message supprimé pour tout le monde. On renvoie une coquille : ni
      // texte, ni pièce jointe, ni réaction, ni citation — le contenu est réellement
      // hors de portée, seule subsiste l'information « il y avait un message ici ».
      // Aucune action possible dessus non plus (ni modifier, ni resupprimer).
      if (m.deletedAt) {
        return {
          id: m.id,
          type: 'TEXTE' as const,
          contenu: '',
          expediteurId: m.expediteurId,
          expediteur: displayName(m.expediteur as UserLite),
          deMoi,
          supprime: true,
          edite: false,
          epingle: false,
          transfere: false,
          createdAt: m.createdAt,
          piecesJointes: [],
          reactions: [],
          replyTo: null,
          vu: false,
          vuAt: null,
          luPar: 0,
          luParTous: false,
          remis: false,
          remisPar: 0,
          modifiable: false,
          supprimable: false,
        }
      }
      let vu = false,
        luPar = 0,
        remisPar = 0
      let vuAt: Date | null = null
      if (deMoi && nbAutres > 0) {
        const t = m.createdAt.getTime()
        for (const a of autres) {
          const seen = a.utilisateur?.lastSeenAt
          const read = a.lastReadAt
          const livre =
            this.presence.isOnline(a.utilisateurId) ||
            (!!seen && seen.getTime() >= t) ||
            (!!read && read.getTime() >= t)
          if (livre) remisPar++
          if (read && read.getTime() >= t) {
            luPar++
            if (!vuAt || read < vuAt) vuAt = read
          }
        }
        vu = luPar > 0
      }
      const ageMs = Date.now() - m.createdAt.getTime()
      const fenetreOuverte =
        deMoi && ageMs <= EDIT_DELETE_WINDOW_MS && m.type === 'TEXTE'
      return {
        id: m.id,
        type: m.type as 'TEXTE' | 'SYSTEME',
        contenu: m.contenuChiffre ? decryptMessage(m.contenuChiffre) : '',
        expediteurId: m.expediteurId,
        expediteur: displayName(m.expediteur as UserLite),
        deMoi,
        supprime: false,
        edite: !!m.editedAt,
        epingle: m.epingle,
        transfere: m.transfere,
        createdAt: m.createdAt,
        piecesJointes: m.piecesJointes,
        reactions: aggregateReactions(m.reactions, userId),
        replyTo: replyPreview(m.replyTo as ReplyRow, userId),
        vu,
        vuAt,
        luPar,
        luParTous: deMoi && nbAutres > 0 && luPar === nbAutres,
        remis: deMoi && remisPar > 0,
        remisPar,
        modifiable: fenetreOuverte,
        supprimable: fenetreOuverte,
      }
    })

    return { messages, hasMore }
  }

  /**
   * « En train d'écrire » : pousse un événement TEMPS RÉEL éphémère (non persisté) aux
   * AUTRES participants de la conversation. Sécurisé : l'appelant doit en être membre.
   */
  async notifyTyping(
    conversationId: string,
    userId: string,
    kind: 'text' | 'audio' = 'text',
  ): Promise<void> {
    const parts = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { utilisateurId: true },
    })
    if (!parts.some((p) => p.utilisateurId === userId)) return // non-membre → ignoré
    const type = kind === 'audio' ? 'TYPING_AUDIO' : 'TYPING'
    for (const p of parts) {
      if (p.utilisateurId !== userId)
        this.notif.pushLive(p.utilisateurId, type, conversationId)
    }
  }

  async sendMessage(
    conversationId: string,
    expediteurId: string,
    contenu: string,
    fichiers: UploadedPiece[] = [],
    replyToId?: string,
  ) {
    await this.assertParticipant(conversationId, expediteurId)
    const texte = (contenu ?? '').trim()
    if (!texte && fichiers.length === 0)
      throw new BadRequestException('Message vide')

    // Le message cité doit appartenir à la même conversation.
    let replyTo: string | null = null
    if (replyToId) {
      const rt = await this.prisma.message.findUnique({
        where: { id: replyToId },
        select: { conversationId: true, deletedAt: true },
      })
      if (rt && !rt.deletedAt && rt.conversationId === conversationId)
        replyTo = replyToId
    }

    const msg = await this.prisma.message.create({
      data: {
        conversationId,
        expediteurId,
        contenuChiffre: texte ? encryptMessage(texte) : '',
        ...(replyTo ? { replyToId: replyTo } : {}),
        ...(fichiers.length
          ? {
              piecesJointes: {
                create: fichiers.map((f) => ({
                  nomFichier: f.nomFichier,
                  mimeType: f.mimeType,
                  taille: f.taille,
                  contenuChiffre: encryptBytes(f.buffer),
                })),
              },
            }
          : {}),
      },
      include: {
        expediteur: { select: USER_SELECT },
        piecesJointes: { select: PJ_META_SELECT },
        replyTo: {
          select: {
            id: true,
            expediteurId: true,
            contenuChiffre: true,
            deletedAt: true,
            expediteur: { select: USER_SELECT },
            piecesJointes: { select: { id: true } },
          },
        },
      },
    })
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    })

    // Notifier les AUTRES participants (le contenu réel reste dans un APERÇU tronqué,
    // jamais recopié en entier — façon WhatsApp : "Jean : Salut !" / "Jean : 📷 Photo").
    const expName = displayName(msg.expediteur as UserLite)
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    })
    const groupTitre = conv?.type === 'GROUPE' ? (conv.titre ?? 'Groupe') : null
    const apercu = contentPreview(texte, fichiers)
    const autres = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, utilisateurId: { not: expediteurId } },
      select: { utilisateurId: true, muted: true },
    })
    // @mentions — les userId sont portés par des tokens `@[Nom](userId)` dans le texte
    // brut (avant chiffrement). On ne notifie spécifiquement QUE les vrais participants
    // mentionnés (≠ expéditeur) → notification dédiée AVERTISSEMENT (toast + son côté front),
    // même s'ils regardent déjà la conversation (une interpellation ne doit pas être muette).
    const mentionIds = parseMentionIds(texte)
    let remisPar = 0
    for (const p of autres) {
      const mentioned = mentionIds.has(p.utilisateurId)
      if (this.presence.isOnline(p.utilisateurId)) remisPar++ // remis immédiat si en ligne
      // Déjà dans cette conversation ET non mentionné → live silencieux (pas de cloche).
      if (
        !mentioned &&
        this.presence.isViewing(p.utilisateurId, conversationId)
      ) {
        this.notif.pushLive(p.utilisateurId, 'MESSAGE_NEW', conversationId)
        continue
      }
      // Conversation mise en sourdine par CE destinataire → aucune notification (même mention).
      if (p.muted) continue
      const corps = mentioned
        ? `${expName} vous a mentionné : ${apercu}`
        : `${expName} : ${apercu}`
      await this.notif.emit({
        type: 'MESSAGE',
        niveau: mentioned ? 'AVERTISSEMENT' : 'INFO',
        titre: groupTitre ?? expName,
        message: corps,
        destinataireId: p.utilisateurId,
        entiteType: 'conversation',
        entiteId: conversationId,
        lien: `/messagerie?c=${conversationId}`,
        createdById: expediteurId,
      })
    }

    return {
      id: msg.id,
      type: 'TEXTE' as const,
      contenu: texte,
      expediteurId: msg.expediteurId,
      expediteur: expName,
      deMoi: true,
      edite: false,
      epingle: false,
      transfere: false,
      createdAt: msg.createdAt,
      piecesJointes: msg.piecesJointes,
      reactions: [] as { emoji: string; count: number; mine: boolean }[],
      replyTo: replyPreview(msg.replyTo as ReplyRow, expediteurId),
      vu: false,
      vuAt: null,
      luPar: 0,
      luParTous: false,
      remis: remisPar > 0,
      remisPar,
      modifiable: true,
      supprimable: true,
    }
  }

  /** Détails d'un message (statut par destinataire) — pour la fiche « Détails ». */
  async getMessageDetails(messageId: string, userId: string) {
    const m = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          include: {
            participants: { include: { utilisateur: { select: USER_SELECT } } },
          },
        },
        piecesJointes: { select: { id: true } },
      },
    })
    if (!m || m.deletedAt) throw new NotFoundException('Message introuvable')
    await this.assertParticipant(m.conversationId, userId)

    const t = m.createdAt.getTime()
    const destinataires = m.conversation.participants
      .filter((p) => p.utilisateurId !== m.expediteurId)
      .map((p) => {
        const u = p.utilisateur as UserLite
        const seen = u.lastSeenAt
        const read = p.lastReadAt
        const remis =
          this.presence.isOnline(p.utilisateurId) ||
          (!!seen && seen.getTime() >= t) ||
          (!!read && read.getTime() >= t)
        return {
          nom: displayName(u),
          remis,
          lu: !!read && read.getTime() >= t,
          luAt: read && read.getTime() >= t ? read : null,
          enLigne: this.presence.isOnline(p.utilisateurId),
        }
      })

    return {
      id: m.id,
      deMoi: m.expediteurId === userId,
      expediteur: displayName(
        m.conversation.participants.find(
          (p) => p.utilisateurId === m.expediteurId,
        )?.utilisateur as UserLite,
      ),
      createdAt: m.createdAt,
      editedAt: m.editedAt,
      edite: !!m.editedAt,
      aPieceJointe: m.piecesJointes.length > 0,
      type: m.conversation.type,
      destinataires,
    }
  }

  async updateMessage(messageId: string, userId: string, contenu: string) {
    const m = await this.prisma.message.findUnique({ where: { id: messageId } })
    if (!m || m.deletedAt) throw new NotFoundException('Message introuvable')
    if (m.expediteurId !== userId)
      throw new ForbiddenException(
        'Vous ne pouvez modifier que vos propres messages',
      )
    if (Date.now() - m.createdAt.getTime() > EDIT_DELETE_WINDOW_MS) {
      throw new ForbiddenException(
        'Le délai de modification (15 min) est dépassé',
      )
    }
    const texte = contenu.trim()
    if (!texte)
      throw new BadRequestException('Le message ne peut pas être vide')
    await this.prisma.message.update({
      where: { id: messageId },
      data: { contenuChiffre: encryptMessage(texte), editedAt: new Date() },
    })
    return { id: messageId, contenu: texte, edite: true }
  }

  /** Supprimer pour TOUT LE MONDE : son propre message, dans les 15 min (soft delete). */
  async deleteMessage(messageId: string, userId: string) {
    const m = await this.prisma.message.findUnique({ where: { id: messageId } })
    if (!m || m.deletedAt) throw new NotFoundException('Message introuvable')
    if (m.expediteurId !== userId)
      throw new ForbiddenException(
        'Vous ne pouvez supprimer que vos propres messages',
      )
    if (Date.now() - m.createdAt.getTime() > EDIT_DELETE_WINDOW_MS) {
      throw new ForbiddenException(
        'Le délai de suppression (15 min) est dépassé',
      )
    }
    await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    })
    // TEMPS RÉEL. Sans ce signal, les autres continuent de voir le message INTACT
    // jusqu'à leur prochain rafraîchissement — ils peuvent même y répondre alors qu'il
    // n'existe plus. La trace doit apparaître chez eux au moment où on supprime.
    void this.diffuserChangementMessagerie(m.conversationId, userId)
    return { id: messageId, deleted: true }
  }

  /**
   * Prévient les AUTRES participants qu'un contenu de la conversation a changé, pour que
   * leur écran se mette à jour sans attendre. Volontairement silencieux : ce n'est pas un
   * nouveau message, il ne doit ni sonner ni allumer la cloche.
   *
   * Best-effort : un échec de diffusion ne doit jamais faire échouer l'action elle-même,
   * qui, elle, est déjà enregistrée.
   */
  private async diffuserChangementMessagerie(
    conversationId: string,
    sauf: string,
  ): Promise<void> {
    try {
      const parts = await this.prisma.conversationParticipant.findMany({
        where: { conversationId, utilisateurId: { not: sauf } },
        select: { utilisateurId: true },
      })
      for (const p of parts)
        this.notif.pushLive(p.utilisateurId, 'LIVE_MESSAGERIE', conversationId)
    } catch {
      /* best-effort */
    }
  }

  /** Supprimer POUR MOI : masque le message pour cet utilisateur (tout message, tout âge). */
  async hideForMe(messageId: string, userId: string) {
    const m = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { conversationId: true, deletedAt: true },
    })
    // Une TRACE de suppression reste masquable pour soi : sans cela elle s'incrusterait
    // définitivement dans le fil, sans aucun moyen de la retirer de sa propre vue.
    if (!m) throw new NotFoundException('Message introuvable')
    await this.assertParticipant(m.conversationId, userId)
    await this.prisma.messageMasque.upsert({
      where: { messageId_utilisateurId: { messageId, utilisateurId: userId } },
      update: {},
      create: { messageId, utilisateurId: userId },
    })
    return { id: messageId, hidden: true }
  }

  /** Suppression MULTIPLE « pour moi » (masque chaque message, ≤ 200). Best-effort. */
  async batchHideForMe(ids: string[], userId: string) {
    const uniq = [...new Set((ids ?? []).filter(Boolean))].slice(0, 200)
    let hidden = 0
    for (const id of uniq) {
      try {
        await this.hideForMe(id, userId)
        hidden++
      } catch {
        /* ignore les inéligibles */
      }
    }
    return { hidden }
  }

  /** Suppression MULTIPLE « pour tout le monde » (les siens, ≤ 15 min ; ≤ 200). Best-effort. */
  async batchDelete(ids: string[], userId: string) {
    const uniq = [...new Set((ids ?? []).filter(Boolean))].slice(0, 200)
    let deleted = 0
    for (const id of uniq) {
      try {
        await this.deleteMessage(id, userId)
        deleted++
      } catch {
        /* ignore les inéligibles */
      }
    }
    return { deleted }
  }

  /** Ajoute/retire (toggle) une réaction emoji sur un message. */
  async toggleReaction(messageId: string, userId: string, emoji: string) {
    const e = (emoji ?? '').trim().slice(0, 16)
    if (!e) throw new BadRequestException('Emoji requis')
    const m = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { conversationId: true, deletedAt: true, expediteurId: true },
    })
    if (!m || m.deletedAt) throw new NotFoundException('Message introuvable')
    await this.assertParticipant(m.conversationId, userId)
    const existing = await this.prisma.messageReaction.findUnique({
      where: {
        messageId_utilisateurId_emoji: {
          messageId,
          utilisateurId: userId,
          emoji: e,
        },
      },
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
      where: {
        messageId_utilisateurId_emoji: {
          messageId,
          utilisateurId: userId,
          emoji: e,
        },
      },
      create: { messageId, utilisateurId: userId, emoji: e },
      update: { deletedAt: null },
    })

    // Notifier l'AUTEUR du message (façon WhatsApp) — sauf réaction sur son propre message.
    if (m.expediteurId !== userId) {
      if (this.presence.isViewing(m.expediteurId, m.conversationId)) {
        // L'auteur regarde la conversation → MAJ du fil en direct, sans notification comptée.
        this.notif.pushLive(m.expediteurId, 'MESSAGE_NEW', m.conversationId)
      } else {
        const reacteur = await this.prisma.utilisateur.findUnique({
          where: { id: userId },
          select: USER_SELECT,
        })
        const nom = displayName(reacteur as UserLite)
        await this.notif
          .emit({
            type: 'MESSAGE',
            niveau: 'INFO',
            titre: 'Nouvelle réaction',
            message: `${nom} a réagi ${e} à votre message`,
            destinataireId: m.expediteurId,
            entiteType: 'conversation',
            entiteId: m.conversationId,
            lien: `/messagerie?c=${m.conversationId}`,
            createdById: userId,
          })
          .catch(() => {
            /* notif best-effort */
          })
      }
    }
    return { emoji: e, active: true }
  }

  /** Détail nominatif des réactions d'un message (qui a réagi, avec quel emoji, quand). */
  async getReactionDetails(messageId: string, userId: string) {
    const m = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { conversationId: true, deletedAt: true },
    })
    if (!m || m.deletedAt) throw new NotFoundException('Message introuvable')
    await this.assertParticipant(m.conversationId, userId)

    const rows = await this.prisma.messageReaction.findMany({
      where: { messageId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    })
    const userIds = [...new Set(rows.map((r) => r.utilisateurId))]
    const users = userIds.length
      ? await this.prisma.utilisateur.findMany({
          where: { id: { in: userIds } },
          select: USER_SELECT,
        })
      : []
    const nomMap = new Map(users.map((u) => [u.id, displayName(u as UserLite)]))
    return rows.map((r) => ({
      emoji: r.emoji,
      utilisateurId: r.utilisateurId,
      nom: nomMap.get(r.utilisateurId) ?? 'Utilisateur',
      mine: r.utilisateurId === userId,
      createdAt: r.createdAt,
    }))
  }

  /** Épingle/désépingle un message (max 3 par conversation, façon WhatsApp). */
  async togglePin(messageId: string, userId: string) {
    const m = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { conversationId: true, deletedAt: true, epingle: true },
    })
    if (!m || m.deletedAt) throw new NotFoundException('Message introuvable')
    await this.assertParticipant(m.conversationId, userId)
    const next = !m.epingle
    if (next) {
      const count = await this.prisma.message.count({
        where: {
          conversationId: m.conversationId,
          epingle: true,
          deletedAt: null,
        },
      })
      if (count >= 3)
        throw new BadRequestException(
          'Maximum 3 messages épinglés par conversation — désépinglez-en un d’abord',
        )
    }
    await this.prisma.message.update({
      where: { id: messageId },
      data: { epingle: next },
    })
    for (const p of await this.prisma.conversationParticipant.findMany({
      where: { conversationId: m.conversationId },
      select: { utilisateurId: true },
    })) {
      this.notif.pushLive(p.utilisateurId, 'MESSAGE_NEW', m.conversationId)
    }
    return { epingle: next }
  }

  /** Liste les messages épinglés d'une conversation (bandeau en haut du fil). */
  async listPinned(conversationId: string, userId: string) {
    await this.assertParticipant(conversationId, userId)
    const rows = await this.prisma.message.findMany({
      where: { conversationId, epingle: true, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        expediteur: { select: USER_SELECT },
        piecesJointes: { select: { id: true } },
      },
    })
    return rows.map((m) => ({
      id: m.id,
      contenu: m.contenuChiffre
        ? decryptMessage(m.contenuChiffre).slice(0, 160)
        : m.piecesJointes.length
          ? '📎 Pièce jointe'
          : '',
      expediteur: displayName(m.expediteur as UserLite),
      createdAt: m.createdAt,
    }))
  }

  /** Transfère un message existant vers d'autres conversations (le contenu chiffré est recopié tel quel). */
  async forwardMessage(
    messageId: string,
    userId: string,
    targetConversationIds: string[],
  ) {
    const m = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { piecesJointes: true },
    })
    if (!m || m.deletedAt) throw new NotFoundException('Message introuvable')
    await this.assertParticipant(m.conversationId, userId)

    const cibles = [...new Set(targetConversationIds.filter(Boolean))].slice(
      0,
      10,
    )
    if (!cibles.length)
      throw new BadRequestException('Sélectionnez au moins une conversation')

    const actorName = displayName(await this.getUserLite(userId))
    let forwarded = 0
    for (const conversationId of cibles) {
      await this.assertParticipant(conversationId, userId) // il faut aussi être membre de la conversation cible
      await this.prisma.message.create({
        data: {
          conversationId,
          expediteurId: userId,
          contenuChiffre: m.contenuChiffre,
          transfere: true,
          ...(m.piecesJointes.length
            ? {
                piecesJointes: {
                  create: m.piecesJointes.map((pj) => ({
                    nomFichier: pj.nomFichier,
                    mimeType: pj.mimeType,
                    taille: pj.taille,
                    contenuChiffre: pj.contenuChiffre,
                  })),
                },
              }
            : {}),
        },
      })
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      })
      forwarded++

      const conv = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      })
      const groupTitre =
        conv?.type === 'GROUPE' ? (conv.titre ?? 'Groupe') : null
      const autres = await this.prisma.conversationParticipant.findMany({
        where: { conversationId, utilisateurId: { not: userId } },
        select: { utilisateurId: true, muted: true },
      })
      for (const p of autres) {
        if (p.muted) continue
        if (this.presence.isViewing(p.utilisateurId, conversationId)) {
          this.notif.pushLive(p.utilisateurId, 'MESSAGE_NEW', conversationId)
          continue
        }
        await this.notif
          .emit({
            type: 'MESSAGE',
            niveau: 'INFO',
            titre: groupTitre ?? actorName,
            message: `${actorName} : message transféré`,
            destinataireId: p.utilisateurId,
            entiteType: 'conversation',
            entiteId: conversationId,
            lien: `/messagerie?c=${conversationId}`,
            createdById: userId,
          })
          .catch(() => {
            /* notif best-effort */
          })
      }
    }
    return { forwarded }
  }

  /** Sert une pièce jointe déchiffrée (data URL) à un participant autorisé. */
  async getPieceJointe(pieceId: string, userId: string) {
    const pj = await this.prisma.messagePieceJointe.findUnique({
      where: { id: pieceId },
      include: {
        message: { select: { conversationId: true, deletedAt: true } },
      },
    })
    if (!pj || pj.message.deletedAt)
      throw new NotFoundException('Pièce jointe introuvable')
    await this.assertParticipant(pj.message.conversationId, userId)
    let bytes: Buffer
    try {
      bytes = decryptBytes(pj.contenuChiffre)
    } catch {
      throw new NotFoundException('Pièce jointe illisible')
    }
    return {
      nomFichier: pj.nomFichier,
      mimeType: pj.mimeType,
      taille: pj.taille,
      dataUrl: `data:${pj.mimeType};base64,${bytes.toString('base64')}`,
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
