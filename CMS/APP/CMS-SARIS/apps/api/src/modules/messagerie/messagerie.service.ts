/**
 * MessagerieService — messagerie interne chiffrée entre agents.
 *
 * - Contenu des messages ET pièces jointes chiffrés AES-256-GCM en base.
 * - Conversations DIRECT (1↔1, UNE SEULE par paire) et GROUPE (n participants), tous sites.
 * - Chaque message émet une notification ciblée (sans le contenu).
 * - Lecture MESSAGE PAR MESSAGE (MessageLecture) → non-lus + accusés de lecture : jamais
 *   déduits d'une heure de dernière lecture, qui se trompait pour un message arrivé en retard.
 * - Messages paginés (curseur createdAt + id), pièces jointes servies à la demande.
 */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import sharp from 'sharp'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationService } from '../notification/notification.service'
import { PresenceService } from '../notification/presence.service'
import {
  idConversationDirecte,
  idLecture,
  idParticipationDirecte,
} from '../../common/id-deterministe'
import {
  encryptMessage,
  decryptMessage,
  encryptBytes,
  decryptBytes,
} from '../../common/crypto/message-crypto'

const USER_SELECT = {
  id: true,
  login: true,
  statut: true,
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

/** Taille maximale d'une recherche dans une conversation (messages examinés). */
const RECHERCHE_MAX_MESSAGES = 5000
const RECHERCHE_MAX_RESULTATS = 50

/** Ce que renvoie un message qu'on vient d'envoyer (et que le client affiche tout de suite). */
const MESSAGE_INCLUDE = {
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
} as const

/**
 * Curseur de pagination « avant » : `ISO~id`. L'identifiant départage deux messages de la
 * même milliseconde — sans lui, une page se terminant au milieu d'une égalité en perdait un.
 * L'ancien format (l'heure seule) reste accepté.
 */
function analyserCurseur(
  before?: string,
): { createdAt: Date; id?: string } | null {
  if (!before) return null
  const [t, id] = before.split('~')
  const d = new Date(t ?? '')
  if (isNaN(d.getTime())) return null
  return { createdAt: d, ...(id ? { id } : {}) }
}

/** Minuscules et sans accents : « Réunion » se trouve en tapant « reunion ». */
function sansAccents(texte: string): string {
  return texte.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** Fenêtre pendant laquelle un message reste modifiable / supprimable (15 min). */
export const EDIT_DELETE_WINDOW_MS = 15 * 60 * 1000

type UserLite = {
  id: string
  login: string
  statut?: string
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

  /**
   * Non-lus par conversation pour un utilisateur, en UNE requête (pas de N+1).
   *
   * Un message est « non lu » tant que son lecteur n'a pas d'accusé (MessageLecture). Le
   * calcul ne dépend plus d'une HEURE de dernière lecture, qui prenait pour lu tout message
   * arrivé en retard (écrit hors ligne, donc daté d'avant). Ne comptent pas : les événements
   * de groupe, ses propres messages, les messages supprimés ou masqués pour soi, et tout ce
   * qui précède son arrivée dans le groupe ou la suppression de la conversation.
   */
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
       AND cp."deletedAt" IS NULL
      WHERE m."deletedAt" IS NULL
        AND m."type" <> 'SYSTEME'
        AND m."expediteurId" <> ${userId}
        AND m."createdAt" >= cp."joinedAt"
        AND (cp."viderLe" IS NULL OR m."createdAt" > cp."viderLe")
        AND NOT EXISTS (
          SELECT 1 FROM "MessageLecture" l
          WHERE l."messageId" = m."id" AND l."utilisateurId" = ${userId})
        AND NOT EXISTS (
          SELECT 1 FROM "MessageMasque" mm
          WHERE mm."messageId" = m."id" AND mm."utilisateurId" = ${userId})
      GROUP BY m."conversationId"
    `
    return new Map(rows.map((r) => [r.conversationId, Number(r.unread)]))
  }

  async listConversations(userId: string) {
    this.touchPresence(userId)
    // `deletedAt: null` sur les participants INCLUS : l'extension de suppression logique ne couvre
    // pas les relations incluses (une personne qui a quitté le groupe y figurerait encore).
    const parts = await this.prisma.conversationParticipant.findMany({
      where: { utilisateurId: userId, conversation: { deletedAt: null } },
      include: {
        conversation: {
          include: {
            participants: {
              where: { deletedAt: null },
              include: { utilisateur: { select: USER_SELECT } },
            },
          },
        },
      },
    })

    const unread = await this.unreadByConversation(userId)

    // Dernier message VISIBLE POUR MOI : ni masqué pour moi (« supprimer pour moi » doit aussi
    // vider l'aperçu), ni d'avant mon arrivée dans le groupe, ni d'avant que je supprime la
    // conversation. La TRACE d'un message supprimé pour tous compte : la conversation reste
    // dans la liste, comme dans WhatsApp, au lieu de disparaître chez les deux.
    // Client brut : l'extension de suppression logique cacherait cette trace.
    const derniers = new Map<
      string,
      Awaited<ReturnType<typeof this.dernierMessageVisible>>
    >()
    await Promise.all(
      parts.map(async (p) => {
        const m = await this.dernierMessageVisible(p, userId)
        if (m) derniers.set(p.conversationId, m)
      }),
    )

    // LIEN ROMPU À RATTRAPER (anciennes suppressions). Supprimer une conversation directe
    // retirait autrefois la ligne de participation de celui qui supprime : chez l'autre, il ne
    // restait plus personne « en face » et la conversation perdait son identité. L'interlocuteur
    // reste pourtant identifiable par ses MESSAGES, en une requête pour toutes les conversations
    // concernées. (Les suppressions d'aujourd'hui ne retirent plus rien : elles masquent.)
    const orphelines = parts
      .filter(
        (p) =>
          p.conversation.type !== 'GROUPE' &&
          !p.conversation.participants.some((cp) => cp.utilisateurId !== userId),
      )
      .map((p) => p.conversation.id)

    const rattrapes = new Map<string, UserLite>()
    if (orphelines.length) {
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
      const dernier = derniers.get(conv.id)

      let apercu: string | null = null
      if (dernier) {
        if (dernier.deletedAt) {
          apercu = 'Message supprimé'
        } else if (dernier.type === 'SYSTEME') {
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
                // Compte désactivé : écrire n'atteindrait personne (le serveur le refuse).
                actif: interlocuteur.statut === undefined || interlocuteur.statut === 'ACTIF',
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
              supprime: !!dernier.deletedAt,
            }
          : null,
        nonLus: unread.get(conv.id) ?? 0,
        muted: p.muted,
        archivee: p.archivee,
        updatedAt: conv.updatedAt,
      }
    })

    // Une conversation DIRECTE n'apparaît dans la liste (des DEUX côtés) qu'à partir du
    // PREMIER message visible : ouvrir une conversation sans rien envoyer ne la fait pas
    // apparaître chez le destinataire, et une conversation SUPPRIMÉE chez soi n'y revient
    // qu'avec un nouveau message. Les groupes, créés délibérément, restent visibles dès le départ.
    return result
      .filter((r) => r.type === 'GROUPE' || r.dernierMessage !== null)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
  }

  /** Dernier message d'une conversation que CETTE personne a le droit de voir (cf. listConversations). */
  private async dernierMessageVisible(
    p: { conversationId: string; joinedAt: Date; viderLe: Date | null },
    userId: string,
  ) {
    return this.prisma.raw.message.findFirst({
      where: {
        conversationId: p.conversationId,
        createdAt: {
          gte: p.joinedAt,
          ...(p.viderLe ? { gt: p.viderLe } : {}),
        },
        masques: { none: { utilisateurId: userId } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        expediteur: { select: USER_SELECT },
        piecesJointes: { select: PJ_META_SELECT },
      },
    })
  }

  /**
   * Récupère (ou crée) LA conversation directe entre l'utilisateur et un autre.
   *
   * Une seule par paire, quoi qu'il arrive :
   *  - son identifiant est DÉTERMINISTE (le même pour les deux personnes) : deux ouvertures
   *    simultanées — ou deux postes hors ligne — créent la même ligne au lieu de deux ;
   *  - une conversation plus ancienne (identifiant aléatoire) entre les deux est reprise telle quelle ;
   *  - une conversation « abandonnée » par l'un des deux (ancienne suppression qui retirait sa
   *    ligne de participation) est rattachée de nouveau — sans lui rendre l'historique.
   */
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

    const existante = await this.trouverDirecte(userId, destinataireId)
    if (existante) return { id: existante, created: false }

    const id = idConversationDirecte(userId, destinataireId)
    try {
      await this.prisma.conversation.create({
        data: {
          id,
          type: 'DIRECT',
          siteId,
          createdById: userId,
          participants: {
            create: [userId, destinataireId].map((u) => ({
              id: idParticipationDirecte(id, u),
              utilisateurId: u,
            })),
          },
        },
      })
      return { id, created: true }
    } catch (e) {
      // Une autre ouverture (ou l'autre personne) l'a créée entre-temps : c'est la même.
      if ((e as { code?: string }).code === 'P2002') {
        const deja = await this.trouverDirecte(userId, destinataireId)
        if (deja) return { id: deja, created: false }
      }
      throw e
    }
  }

  /** La conversation directe entre deux personnes, si elle existe (cf. getOrCreateDirect). */
  private async trouverDirecte(a: string, b: string): Promise<string | null> {
    const det = await this.prisma.conversation.findUnique({
      where: { id: idConversationDirecte(a, b) },
      select: { id: true },
    })
    if (det) return det.id
    const ancienne = await this.prisma.conversation.findFirst({
      where: {
        type: 'DIRECT',
        AND: [
          { participants: { some: { utilisateurId: a, deletedAt: null } } },
          { participants: { some: { utilisateurId: b, deletedAt: null } } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    if (ancienne) return ancienne.id
    return this.reprendreOrpheline(a, b)
  }

  /**
   * Conversation directe dont l'un des deux a perdu sa ligne de participation (ancienne
   * suppression) : l'autre y écrivait dans le vide. On le rattache de nouveau, avec
   * l'historique déjà masqué pour lui, de sorte que seuls les nouveaux messages lui arrivent.
   * Il est retrouvé par ses MESSAGES : ils portent leur auteur.
   */
  private async reprendreOrpheline(
    a: string,
    b: string,
  ): Promise<string | null> {
    for (const [present, absent] of [
      [b, a],
      [a, b],
    ] as const) {
      const [orpheline] = await this.prisma.conversation.findMany({
        where: {
          type: 'DIRECT',
          messages: { some: { expediteurId: absent } },
          AND: [
            { participants: { some: { utilisateurId: present, deletedAt: null } } },
            { participants: { none: { utilisateurId: absent, deletedAt: null } } },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { id: true },
      })
      if (orpheline) {
        const dernier = await this.prisma.raw.message.findFirst({
          where: { conversationId: orpheline.id },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        })
        await this.rattacherDirecte(orpheline.id, absent, dernier?.createdAt ?? null)
        return orpheline.id
      }
    }
    return null
  }

  /** Rattache (ou rattache de nouveau) une personne à une conversation directe, sans lui rendre l'historique. */
  private async rattacherDirecte(
    conversationId: string,
    utilisateurId: string,
    viderLe: Date | null,
  ) {
    // Client brut : une ligne supprimée logiquement doit être RESSUSCITÉE, pas dupliquée.
    await this.prisma.raw.conversationParticipant.upsert({
      where: {
        conversationId_utilisateurId: { conversationId, utilisateurId },
      },
      create: {
        id: idParticipationDirecte(conversationId, utilisateurId),
        conversationId,
        utilisateurId,
        viderLe,
      },
      update: { deletedAt: null, viderLe },
    })
  }

  /**
   * (Rat)tache le correspondant d'une conversation directe ancienne dont il manque une ligne :
   * il est identifié par ses messages. Sans cela on écrirait à personne.
   */
  private async completerDirecte(conversationId: string, moi: string) {
    const autres = await this.prisma.raw.message.findFirst({
      where: { conversationId, expediteurId: { not: moi } },
      select: { expediteurId: true },
    })
    if (!autres) return
    const dernier = await this.prisma.raw.message.findFirst({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })
    await this.rattacherDirecte(conversationId, autres.expediteurId, dernier?.createdAt ?? null)
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
    const maPart = await this.assertParticipant(conversationId, userId)
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    })
    if (!conv) throw new NotFoundException('Conversation introuvable')

    // Conversation DIRECTE : « supprimer la conversation » la supprime POUR SOI, comme dans
    // WhatsApp. Retirer la ligne de participation faisait perdre à l'autre son interlocuteur : il
    // continuait d'écrire sans que personne ne reçoive rien, et rouvrir la discussion en créait une
    // seconde. On masque donc tout ce qui précède ; un nouveau message la fait revenir, seul.
    if (conv.type === 'DIRECT') {
      await this.prisma.conversationParticipant.update({
        where: { id: maPart.id },
        data: { viderLe: new Date(), archivee: false },
      })
      return { left: true }
    }
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
        participants: {
          where: { deletedAt: null },
          include: { utilisateur: { select: USER_SELECT } },
        },
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

    // Client brut + upsert : une personne qui avait QUITTÉ le groupe y est rajoutée en
    // ressuscitant sa ligne (unique conversation + utilisateur). `joinedAt` repart de maintenant :
    // elle ne voit rien de ce qui s'est dit avant son arrivée (ni cette fois-ci, ni la précédente).
    const arrivee = new Date()
    for (const id of aAjouter) {
      await this.prisma.raw.conversationParticipant.upsert({
        where: {
          conversationId_utilisateurId: { conversationId, utilisateurId: id },
        },
        create: { conversationId, utilisateurId: id, joinedAt: arrivee },
        update: {
          deletedAt: null,
          joinedAt: arrivee,
          estAdmin: false,
          muted: false,
          archivee: false,
          lastReadAt: null,
          viderLe: null,
        },
      })
    }

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
   * Un fil de messages, par pages (les plus récents d'abord, rendus en ordre chronologique).
   *
   * LECTURE SEULE : consulter le fil ne marque RIEN comme lu et ne dit pas « je regarde cette
   * conversation ». Avant, tout chargement — y compris l'actualisation automatique d'un onglet
   * masqué — passait la conversation entière en « lu » (coches bleues chez l'expéditeur) et
   * coupait la cloche. C'est maintenant l'écran qui le déclare, quand il est réellement sous les
   * yeux (cf. marquerLu), en nommant les messages vus.
   *
   * Un membre ne voit que ce qui date de son arrivée (ou d'après la suppression de la conversation
   * chez lui) : l'historique d'un groupe ne se transmet pas aux nouveaux venus.
   */
  async listMessages(conversationId: string, userId: string, before?: string) {
    const myPart = await this.assertParticipant(conversationId, userId)
    this.touchPresence(userId)

    const curseur = analyserCurseur(before)
    // CLIENT BRUT, volontairement. L'extension soft-delete masque partout les lignes
    // `deletedAt` — ici on a besoin de les VOIR : un message « supprimé pour tout le
    // monde » doit rester dans le fil sous forme de trace, comme dans WhatsApp. Sans
    // cela il s'évaporait, et la conversation devenait incompréhensible pour l'autre :
    // on ne distingue pas un message retiré d'un message jamais envoyé.
    // (Même raison que la synchronisation, qui passe déjà par `raw` pour ses tombstones.)
    const rows = await this.prisma.raw.message.findMany({
      where: {
        conversationId,
        createdAt: {
          gte: myPart.joinedAt,
          ...(myPart.viderLe ? { gt: myPart.viderLe } : {}),
        },
        masques: { none: { utilisateurId: userId } }, // « supprimé pour moi »
        ...(curseur
          ? {
              OR: [
                { createdAt: { lt: curseur.createdAt } },
                ...(curseur.id
                  ? [{ createdAt: curseur.createdAt, id: { lt: curseur.id } }]
                  : []),
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MESSAGE_PAGE_SIZE + 1,
      include: {
        expediteur: { select: USER_SELECT },
        piecesJointes: { select: PJ_META_SELECT },
        // `where` OBLIGATOIRE : l'extension de soft-delete ne couvre pas les relations
        // incluses (cf. prisma/soft-delete.extension.ts). Sans lui, une réaction retirée
        // — donc seulement marquée `deletedAt` — continuait d'être renvoyée, et la
        // pastille restait affichée alors que le serveur avait bien enregistré le retrait.
        reactions: {
          where: { deletedAt: null },
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

    const autres = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, utilisateurId: { not: userId } },
      select: {
        utilisateurId: true,
        utilisateur: { select: { lastSeenAt: true } },
      },
    })
    const nbAutres = autres.length

    // Accusés : un par message et par lecteur (MessageLecture) — jamais une comparaison d'heures.
    const vivants = page.filter((m) => !m.deletedAt)
    const idsAutrui = vivants
      .filter((m) => m.expediteurId !== userId && m.type === 'TEXTE')
      .map((m) => m.id)
    const idsMiens = vivants
      .filter((m) => m.expediteurId === userId && m.type === 'TEXTE')
      .map((m) => m.id)
    const mesLectures = new Set(
      idsAutrui.length
        ? (
            await this.prisma.messageLecture.findMany({
              where: { utilisateurId: userId, messageId: { in: idsAutrui } },
              select: { messageId: true },
            })
          ).map((l) => l.messageId)
        : [],
    )
    const lecturesDesAutres = new Map<
      string,
      { utilisateurId: string; luLe: Date }[]
    >()
    if (idsMiens.length && nbAutres) {
      for (const l of await this.prisma.messageLecture.findMany({
        where: {
          messageId: { in: idsMiens },
          utilisateurId: { in: autres.map((a) => a.utilisateurId) },
        },
        select: { messageId: true, utilisateurId: true, luLe: true },
      })) {
        const liste = lecturesDesAutres.get(l.messageId) ?? []
        liste.push({ utilisateurId: l.utilisateurId, luLe: l.luLe })
        lecturesDesAutres.set(l.messageId, liste)
      }
    }
    const mesFavoris = new Set(
      vivants.length
        ? (
            await this.prisma.messageFavori.findMany({
              where: {
                utilisateurId: userId,
                messageId: { in: vivants.map((m) => m.id) },
              },
              select: { messageId: true },
            })
          ).map((f) => f.messageId)
        : [],
    )
    // Poste de bureau : un message pas encore REMONTÉ au central n'est pas « remis », quoi
    // qu'on sache du destinataire — sinon un message écrit hors ligne affichait « remis ».
    const dernierEnvoi = await this.dernierEnvoiVersCentral()

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
          favori: false,
          nonLu: false,
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
      if (deMoi && nbAutres > 0 && m.type === 'TEXTE') {
        const lecs = lecturesDesAutres.get(m.id) ?? []
        const parti =
          dernierEnvoi === undefined ||
          (dernierEnvoi !== null && m.updatedAt.getTime() <= dernierEnvoi.getTime())
        const t = m.createdAt.getTime()
        luPar = lecs.length
        for (const l of lecs) if (!vuAt || l.luLe < vuAt) vuAt = l.luLe
        for (const a of autres) {
          const seen = a.utilisateur?.lastSeenAt
          const lu = lecs.some((l) => l.utilisateurId === a.utilisateurId)
          const livre =
            lu ||
            (parti &&
              (this.presence.isOnline(a.utilisateurId) ||
                (!!seen && seen.getTime() >= t)))
          if (livre) remisPar++
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
        favori: mesFavoris.has(m.id),
        nonLu: !deMoi && m.type === 'TEXTE' && !mesLectures.has(m.id),
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
   * Poste de bureau : date du dernier envoi réussi vers le central, pour savoir ce qui n'est PAS
   * encore parti. `undefined` sur le serveur central : rien n'y attend.
   */
  private async dernierEnvoiVersCentral(): Promise<Date | null | undefined> {
    if (process.env['DATABASE_PROVIDER'] !== 'sqlite') return undefined
    const etat = await this.prisma.syncState.findFirst({
      where: { posteLocalId: process.env['POSTE_LOCAL_ID'] ?? 'poste-local' },
      select: { lastPushedAt: true },
    })
    return etat?.lastPushedAt ?? null
  }

  /**
   * L'écran DÉCLARE ce qu'il a réellement sous les yeux : il nomme les messages vus (ceux qu'il
   * a affichés comme « non lus »), et seulement quand l'onglet est visible et la fenêtre active.
   * Chacun reçoit un accusé de lecture à son nom — un message arrivé plus tard, même daté d'avant,
   * reste non lu. Sans message nommé, c'est un simple « je regarde cette conversation »
   * (la cloche se tait pour elle, pendant 45 s au plus).
   */
  async marquerLu(
    conversationId: string,
    userId: string,
    messageIds: string[] = [],
  ) {
    const myPart = await this.assertParticipant(conversationId, userId)
    this.touchPresence(userId)
    this.presence.setViewing(userId, conversationId)

    const ids = [...new Set((messageIds ?? []).filter(Boolean))].slice(0, 200)
    let lus = 0
    if (ids.length) {
      // Seuls comptent des messages de CETTE conversation, d'un autre, vivants et visibles pour moi.
      const messages = await this.prisma.message.findMany({
        where: {
          id: { in: ids },
          conversationId,
          type: 'TEXTE',
          expediteurId: { not: userId },
          createdAt: { gte: myPart.joinedAt },
        },
        select: { id: true, expediteurId: true },
      })
      const deja = new Set(
        (
          await this.prisma.messageLecture.findMany({
            where: {
              utilisateurId: userId,
              messageId: { in: messages.map((m) => m.id) },
            },
            select: { messageId: true },
          })
        ).map((l) => l.messageId),
      )
      const aMarquer = messages.filter((m) => !deja.has(m.id))
      if (aMarquer.length) {
        const donnees = aMarquer.map((m) => ({
          id: idLecture(m.id, userId),
          messageId: m.id,
          utilisateurId: userId,
        }))
        try {
          await this.prisma.messageLecture.createMany({ data: donnees })
        } catch {
          // Course avec un autre poste qui marque le même message : on retombe sur le détail,
          // ligne à ligne (l'identifiant déterministe fait que c'est la même ligne).
          for (const d of donnees)
            await this.prisma.messageLecture
              .upsert({ where: { id: d.id }, create: d, update: {} })
              .catch(() => undefined)
        }
        lus = aMarquer.length
        await this.prisma.conversationParticipant.update({
          where: { id: myPart.id },
          data: { lastReadAt: new Date() },
        })
        // Temps réel : les EXPÉDITEURS voient leurs coches passer au bleu tout de suite.
        for (const sid of new Set(aMarquer.map((m) => m.expediteurId)))
          this.notif.pushLive(sid, 'MESSAGE_STATUS', conversationId)
      }
    }

    const restants = (await this.unreadByConversation(userId)).get(conversationId) ?? 0
    if (restants === 0) {
      // Plus rien à lire ici : les notifications (cloche) de cette conversation le sont aussi.
      try {
        await this.notif.markReadForEntite(userId, 'conversation', conversationId)
      } catch {
        /* best-effort : ne doit pas bloquer */
      }
    }
    return { lus, nonLus: restants }
  }

  /** L'utilisateur ne regarde plus cette conversation (il en sort, change d'onglet…) : la cloche reprend. */
  async quitterVue(conversationId: string, userId: string) {
    await this.assertParticipant(conversationId, userId)
    this.presence.clearViewing(userId, conversationId)
    return { ok: true }
  }

  /** Archive / désarchive la conversation POUR CETTE PERSONNE (un nouveau message la désarchive). */
  async setArchivee(conversationId: string, userId: string, archivee: boolean) {
    const part = await this.assertParticipant(conversationId, userId)
    if (part.archivee !== archivee)
      await this.prisma.conversationParticipant.update({
        where: { id: part.id },
        data: { archivee },
      })
    return { archivee }
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
    clientId?: string,
  ) {
    await this.assertParticipant(conversationId, expediteurId)
    const texte = (contenu ?? '').trim()
    if (!texte && fichiers.length === 0)
      throw new BadRequestException('Message vide')

    // Renvoi du MÊME message (coupure après l'enregistrement, nouvel essai, rejeu hors ligne) :
    // le client l'identifie par `clientId`, on rend celui qui existe au lieu d'en créer un second.
    if (clientId) {
      const deja = await this.prisma.message.findFirst({
        where: { expediteurId, clientId },
        include: MESSAGE_INCLUDE,
      })
      if (deja) return this.formaterEnvoye(deja, expediteurId, 0)
    }

    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    })
    if (!conv) throw new NotFoundException('Conversation introuvable')
    if (conv.type === 'DIRECT')
      await this.verifierInterlocuteur(conversationId, expediteurId)

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

    let msg
    try {
      // Le message, la remontée de la conversation en tête de liste et son désarchivage chez
      // tous : ensemble, ou pas du tout.
      msg = await this.prisma.$transaction(async (tx) => {
        const cree = await tx.message.create({
          data: {
            conversationId,
            expediteurId,
            contenuChiffre: texte ? encryptMessage(texte) : '',
            ...(replyTo ? { replyToId: replyTo } : {}),
            ...(clientId ? { clientId } : {}),
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
          include: MESSAGE_INCLUDE,
        })
        await tx.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        })
        await tx.conversationParticipant.updateMany({
          where: { conversationId, archivee: true },
          data: { archivee: false },
        })
        return cree
      })
    } catch (e) {
      // Deux envois simultanés du même `clientId` : la contrainte d'unicité tranche, on rend le premier.
      if (clientId && (e as { code?: string }).code === 'P2002') {
        const deja = await this.prisma.message.findFirst({
          where: { expediteurId, clientId },
          include: MESSAGE_INCLUDE,
        })
        if (deja) return this.formaterEnvoye(deja, expediteurId, 0)
      }
      throw e
    }

    // Notifier les AUTRES participants (le contenu réel reste dans un APERÇU tronqué,
    // jamais recopié en entier — façon WhatsApp : "Jean : Salut !" / "Jean : 📷 Photo").
    const expName = displayName(msg.expediteur as UserLite)
    const groupTitre = conv.type === 'GROUPE' ? (conv.titre ?? 'Groupe') : null
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

    return this.formaterEnvoye(msg, expediteurId, remisPar)
  }

  /** Ce que reçoit l'expéditeur pour un message qu'il vient d'envoyer. */
  private formaterEnvoye(
    msg: {
      id: string
      expediteurId: string
      contenuChiffre: string
      createdAt: Date
      expediteur: unknown
      piecesJointes: { id: string; nomFichier: string; mimeType: string; taille: number }[]
      replyTo: unknown
    },
    expediteurId: string,
    remisPar: number,
  ) {
    return {
      id: msg.id,
      type: 'TEXTE' as const,
      contenu: msg.contenuChiffre ? decryptMessage(msg.contenuChiffre) : '',
      expediteurId: msg.expediteurId,
      expediteur: displayName(msg.expediteur as UserLite),
      deMoi: true,
      edite: false,
      epingle: false,
      transfere: false,
      favori: false,
      nonLu: false,
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

  /**
   * Conversation directe : il faut un interlocuteur, et un interlocuteur dont le compte est
   * ACTIF — un message adressé à un compte désactivé n'arriverait à personne, sans que
   * l'expéditeur ne le sache.
   */
  private async verifierInterlocuteur(conversationId: string, moi: string) {
    const lire = () =>
      this.prisma.conversationParticipant.findMany({
        where: { conversationId, utilisateurId: { not: moi } },
        select: { utilisateur: { select: { statut: true } } },
      })
    let autres = await lire()
    if (autres.length === 0) {
      // Ancienne suppression qui avait retiré la ligne de l'autre : on le rattache.
      await this.completerDirecte(conversationId, moi)
      autres = await lire()
    }
    if (autres.length === 0)
      throw new ConflictException({
        code: 'INTERLOCUTEUR_INTROUVABLE',
        message:
          'Cette discussion n’a plus d’interlocuteur : rouvrez-la depuis les contacts.',
      })
    if (!autres.some((a) => a.utilisateur?.statut === 'ACTIF'))
      throw new ForbiddenException({
        code: 'COMPTE_DESACTIVE',
        message:
          'Ce compte est désactivé : votre message ne serait lu par personne.',
      })
  }

  async getMessageDetails(messageId: string, userId: string) {
    const m = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          include: {
            participants: {
              where: { deletedAt: null },
              include: { utilisateur: { select: USER_SELECT } },
            },
          },
        },
        piecesJointes: { select: { id: true } },
      },
    })
    if (!m || m.deletedAt) throw new NotFoundException('Message introuvable')
    const maPart = await this.assertParticipant(m.conversationId, userId)
    if (m.createdAt < maPart.joinedAt)
      throw new NotFoundException('Message introuvable')

    const lectures = new Map(
      (
        await this.prisma.messageLecture.findMany({
          where: { messageId },
          select: { utilisateurId: true, luLe: true },
        })
      ).map((l) => [l.utilisateurId, l.luLe]),
    )
    const dernierEnvoi = await this.dernierEnvoiVersCentral()
    const parti =
      dernierEnvoi === undefined ||
      (dernierEnvoi !== null && m.updatedAt.getTime() <= dernierEnvoi.getTime())
    const t = m.createdAt.getTime()
    const destinataires = m.conversation.participants
      .filter((p) => p.utilisateurId !== m.expediteurId)
      .map((p) => {
        const u = p.utilisateur as UserLite
        const seen = u.lastSeenAt
        const luAt = lectures.get(p.utilisateurId) ?? null
        const remis =
          !!luAt ||
          (parti &&
            (this.presence.isOnline(p.utilisateurId) ||
              (!!seen && seen.getTime() >= t)))
        return {
          nom: displayName(u),
          remis,
          lu: !!luAt,
          luAt,
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
    // Sorti du groupe, on ne touche plus à ce qu'on y a écrit.
    await this.assertParticipant(m.conversationId, userId)
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
    // TEMPS RÉEL, comme la suppression : sans ce signal les autres gardaient l'ancien texte
    // jusqu'à leur prochain rafraîchissement.
    void this.diffuserChangementMessagerie(m.conversationId, userId)
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
    await this.assertParticipant(m.conversationId, userId)
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

  async listPinned(conversationId: string, userId: string) {
    const myPart = await this.assertParticipant(conversationId, userId)
    const rows = await this.prisma.message.findMany({
      where: {
        conversationId,
        epingle: true,
        deletedAt: null,
        createdAt: {
          gte: myPart.joinedAt,
          ...(myPart.viderLe ? { gt: myPart.viderLe } : {}),
        },
        masques: { none: { utilisateurId: userId } },
      },
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

  /**
   * Cherche un mot dans une conversation (sans tenir compte des majuscules ni des accents),
   * parmi les messages que cette personne a le droit de voir. Les contenus sont chiffrés en base :
   * la recherche les déchiffre un à un, d'où une borne (les plus récents d'abord).
   */
  async rechercherMessages(conversationId: string, userId: string, q: string) {
    const myPart = await this.assertParticipant(conversationId, userId)
    const terme = sansAccents((q ?? '').trim())
    if (terme.length < 2)
      throw new BadRequestException('Saisissez au moins 2 caractères')
    const rows = await this.prisma.message.findMany({
      where: {
        conversationId,
        type: 'TEXTE',
        createdAt: {
          gte: myPart.joinedAt,
          ...(myPart.viderLe ? { gt: myPart.viderLe } : {}),
        },
        masques: { none: { utilisateurId: userId } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: RECHERCHE_MAX_MESSAGES,
      include: {
        expediteur: { select: USER_SELECT },
        piecesJointes: { select: PJ_META_SELECT },
      },
    })
    const resultats: {
      id: string
      createdAt: Date
      expediteur: string
      deMoi: boolean
      extrait: string
    }[] = []
    for (const m of rows) {
      const texte = humanizeMentions(
        m.contenuChiffre ? decryptMessage(m.contenuChiffre) : '',
      )
      const noms = m.piecesJointes.map((p) => p.nomFichier).join(' ')
      const cible = texte || noms
      const i = sansAccents(cible).indexOf(terme)
      if (i === -1) continue
      const debut = Math.max(0, i - 30)
      const fin = Math.min(cible.length, i + terme.length + 60)
      resultats.push({
        id: m.id,
        createdAt: m.createdAt,
        expediteur: displayName(m.expediteur as UserLite),
        deMoi: m.expediteurId === userId,
        extrait:
          (debut > 0 ? '…' : '') +
          cible.slice(debut, fin) +
          (fin < cible.length ? '…' : ''),
      })
      if (resultats.length >= RECHERCHE_MAX_RESULTATS) break
    }
    return {
      resultats,
      // Plus de messages que la borne : les plus anciens n'ont pas été examinés.
      incomplet: rows.length >= RECHERCHE_MAX_MESSAGES,
    }
  }

  /** Met / retire un message des favoris (étoile) — propre à cette personne. */
  async toggleFavori(messageId: string, userId: string) {
    const m = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { conversationId: true, deletedAt: true, createdAt: true },
    })
    if (!m || m.deletedAt) throw new NotFoundException('Message introuvable')
    const part = await this.assertParticipant(m.conversationId, userId)
    if (m.createdAt < part.joinedAt)
      throw new NotFoundException('Message introuvable')
    const cle = { messageId_utilisateurId: { messageId, utilisateurId: userId } }
    const existant = await this.prisma.messageFavori.findUnique({ where: cle })
    if (existant) {
      await this.prisma.messageFavori.delete({ where: { id: existant.id } })
      return { favori: false }
    }
    // `upsert` RESSUSCITE un éventuel favori retiré (suppression logique), sans quoi la
    // contrainte d'unicité bloquerait de remettre le même message en favori.
    await this.prisma.messageFavori.upsert({
      where: cle,
      create: { messageId, utilisateurId: userId },
      update: { deletedAt: null },
    })
    return { favori: true }
  }

  /** Les favoris de cette personne, tous fils confondus (les plus récemment ajoutés d'abord). */
  async listFavoris(userId: string) {
    const rows = await this.prisma.messageFavori.findMany({
      where: { utilisateurId: userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        message: {
          include: {
            expediteur: { select: USER_SELECT },
            piecesJointes: { select: PJ_META_SELECT },
            conversation: {
              include: {
                participants: {
                  where: { deletedAt: null },
                  include: { utilisateur: { select: USER_SELECT } },
                },
              },
            },
          },
        },
      },
    })
    const favoris: {
      id: string
      conversationId: string
      conversation: string
      expediteur: string
      deMoi: boolean
      apercu: string
      createdAt: Date
    }[] = []
    for (const f of rows) {
      const m = f.message
      // Relations incluses : l'extension de suppression logique ne les filtre pas.
      if (!m || m.deletedAt || m.conversation.deletedAt) continue
      const moi = m.conversation.participants.find((p) => p.utilisateurId === userId)
      if (!moi || m.createdAt < moi.joinedAt) continue
      if (moi.viderLe && m.createdAt <= moi.viderLe) continue
      const autre = m.conversation.participants.find((p) => p.utilisateurId !== userId)
      favoris.push({
        id: m.id,
        conversationId: m.conversationId,
        conversation:
          m.conversation.type === 'GROUPE'
            ? (m.conversation.titre ?? 'Groupe')
            : displayName((autre?.utilisateur as UserLite | undefined) ?? null),
        expediteur: displayName(m.expediteur as UserLite),
        deMoi: m.expediteurId === userId,
        apercu: contentPreview(
          m.contenuChiffre ? decryptMessage(m.contenuChiffre) : '',
          m.piecesJointes,
        ),
        createdAt: m.createdAt,
      })
    }
    return favoris
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
    // Un événement de groupe (« X a quitté ») ne se transfère pas : il passerait pour un vrai message.
    if (m.type === 'SYSTEME')
      throw new BadRequestException('Un événement de groupe ne peut pas être transféré')
    const source = await this.assertParticipant(m.conversationId, userId)
    if (m.createdAt < source.joinedAt)
      throw new NotFoundException('Message introuvable')

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
      await this.prisma.conversationParticipant.updateMany({
        where: { conversationId, archivee: true },
        data: { archivee: false },
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

  /** Nombre total de messages non lus (badge global), en une requête — même règle que ci-dessus. */
  async totalUnread(userId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*) AS "total"
      FROM "Message" m
      JOIN "ConversationParticipant" cp
        ON cp."conversationId" = m."conversationId" AND cp."utilisateurId" = ${userId}
       AND cp."deletedAt" IS NULL
      WHERE m."deletedAt" IS NULL
        AND m."type" <> 'SYSTEME'
        AND m."expediteurId" <> ${userId}
        AND m."createdAt" >= cp."joinedAt"
        AND (cp."viderLe" IS NULL OR m."createdAt" > cp."viderLe")
        AND NOT EXISTS (
          SELECT 1 FROM "MessageLecture" l
          WHERE l."messageId" = m."id" AND l."utilisateurId" = ${userId})
        AND NOT EXISTS (
          SELECT 1 FROM "MessageMasque" mm
          WHERE mm."messageId" = m."id" AND mm."utilisateurId" = ${userId})
    `
    return Number(rows[0]?.total ?? 0)
  }
}
