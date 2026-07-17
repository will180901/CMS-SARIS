/**
 * messagerie.api.ts — messagerie interne chiffrée (REST).
 *
 * Contenu + pièces jointes chiffrés au repos côté serveur (AES-256-GCM),
 * rendus lisibles ici. Temps réel via le flux SSE des notifications
 * (chaque message émet une notification type MESSAGE).
 */
import { api, BASE_URL } from '@/lib/api'
import { useSessionStore } from '@/stores/session.store'

export type ConversationType = 'DIRECT' | 'GROUPE'

export interface Contact {
  id:    string
  nom:   string
  login: string
  role:  string | null
}

export interface ConversationItem {
  id:    string
  type:  ConversationType
  titre: string
  /** Photo de groupe (DIRECT reste `null` — l'avatar utilise l'interlocuteur). */
  photoUrl: string | null
  interlocuteur: { id: string; nom: string; role: string | null; enLigne?: boolean; vuLe?: string | null } | null
  participants:   string[]
  nbParticipants: number
  dernierMessage: {
    /** SYSTEME : pas de préfixe "auteur :", le texte est déjà une phrase complète. */
    type:      'TEXTE' | 'SYSTEME'
    apercu:    string | null
    auteur:    string
    createdAt: string
    deMoi:     boolean
  } | null
  nonLus:    number
  /** Notifications de CETTE conversation coupées pour l'utilisateur courant. */
  muted:     boolean
  updatedAt: string
}

export interface PieceJointeMeta {
  id:         string
  nomFichier: string
  mimeType:   string
  taille:     number
}

export interface ReplyPreview {
  id:     string
  auteur: string
  deMoi:  boolean
  apercu: string
}

export interface ReactionAgg {
  emoji: string
  count: number
  mine:  boolean
}

/** Fenêtre de modification / suppression d'un message (15 min) — alignée sur le backend. */
export const EDIT_DELETE_WINDOW_MS = 15 * 60 * 1000

export interface MessageItem {
  id:            string
  /** SYSTEME = événement de groupe (ajout/retrait/promotion/renommage…) : rendu en pastille centrée, pas en bulle. */
  type:          'TEXTE' | 'SYSTEME'
  contenu:       string
  expediteurId:  string
  expediteur:    string
  deMoi:         boolean
  edite:         boolean
  epingle:       boolean
  transfere:     boolean
  createdAt:     string
  piecesJointes: PieceJointeMeta[]
  reactions:     ReactionAgg[]
  replyTo:       ReplyPreview | null
  vu:            boolean
  vuAt:          string | null
  luPar:         number
  luParTous:     boolean
  remis:         boolean
  remisPar:      number
  modifiable:    boolean
  supprimable:   boolean
  /** Présent uniquement côté client pendant l'envoi optimiste. */
  pending?:      boolean
}

export interface MessageDetailsDestinataire {
  nom:     string
  remis:   boolean
  lu:      boolean
  luAt:    string | null
  enLigne: boolean
}
export interface MessageDetails {
  id:           string
  deMoi:        boolean
  expediteur:   string
  createdAt:    string
  editedAt:     string | null
  edite:        boolean
  aPieceJointe: boolean
  type:         ConversationType
  destinataires: MessageDetailsDestinataire[]
}

export interface MessagesPage {
  messages: MessageItem[]
  hasMore:  boolean
}

export interface PieceJointeContenu {
  nomFichier: string
  mimeType:   string
  taille:     number
  dataUrl:    string
}

// ── Gestion de groupe ─────────────────────────────────────────────────────────

export interface GroupMember {
  id:          string
  nom:         string
  role:        string | null
  estAdmin:    boolean
  estCreateur: boolean
  enLigne:     boolean
}

export interface GroupInfo {
  id:          string
  titre:       string | null
  description: string | null
  photoUrl:    string | null
  createdById: string | null
  monRole:     { estAdmin: boolean; estCreateur: boolean }
  membres:     GroupMember[]
}

export interface ReactionDetail {
  emoji:         string
  utilisateurId: string
  nom:           string
  mine:          boolean
  createdAt:     string
}

export interface PinnedMessage {
  id:         string
  contenu:    string
  expediteur: string
  createdAt:  string
}

export const messagerieApi = {
  contacts:      ()                       => api.get<Contact[]>('/messagerie/contacts'),
  conversations: ()                       => api.get<ConversationItem[]>('/messagerie/conversations'),
  unreadCount:   ()                       => api.get<{ count: number }>('/messagerie/unread-count'),
  start:         (destinataireId: string) => api.post<{ id: string; created: boolean }>('/messagerie/conversations', { destinataireId }),
  createGroup:   (titre: string, participantIds: string[]) =>
                   api.post<{ id: string; created: boolean }>('/messagerie/groupes', { titre, participantIds }),
  leave:         (conversationId: string) => api.post<{ left: boolean }>(`/messagerie/conversations/${conversationId}/quitter`, {}),
  typing:        (conversationId: string, kind?: 'audio') =>
                   api.post<void>(`/messagerie/conversations/${conversationId}/typing${kind === 'audio' ? '?kind=audio' : ''}`, {}),

  messages:      (conversationId: string, before?: string) =>
                   api.get<MessagesPage>(`/messagerie/conversations/${conversationId}/messages`, before ? { before } : undefined),

  /** Envoi multipart (texte et/ou pièces jointes, réponse optionnelle). */
  send:          (conversationId: string, contenu: string, fichiers: File[] = [], replyToId?: string) => {
    const fd = new FormData()
    if (contenu) fd.append('contenu', contenu)
    if (replyToId) fd.append('replyToId', replyToId)
    for (const f of fichiers) fd.append('fichiers', f)
    return api.upload<MessageItem>(`/messagerie/conversations/${conversationId}/messages`, fd)
  },

  update:        (messageId: string, contenu: string) =>
                   api.patch<{ id: string; contenu: string; edite: boolean }>(`/messagerie/messages/${messageId}`, { contenu }),
  remove:        (messageId: string) => api.delete<{ id: string; deleted: boolean }>(`/messagerie/messages/${messageId}`),
  hide:          (messageId: string) => api.post<{ id: string; hidden: boolean }>(`/messagerie/messages/${messageId}/masquer`, {}),
  batchHide:     (ids: string[]) => api.post<{ hidden: number }>('/messagerie/messages/batch-masquer', { ids }),
  batchDelete:   (ids: string[]) => api.post<{ deleted: number }>('/messagerie/messages/batch-delete', { ids }),
  react:         (messageId: string, emoji: string) =>
                   api.post<{ emoji: string; active: boolean }>(`/messagerie/messages/${messageId}/reactions`, { emoji }),
  details:       (messageId: string) => api.get<MessageDetails>(`/messagerie/messages/${messageId}/details`),
  piece:         (pieceId: string)   => api.get<PieceJointeContenu>(`/messagerie/pieces-jointes/${pieceId}`),

  // ── Gestion de groupe ─────────────────────────────────────────────────────
  groupInfo:        (conversationId: string) => api.get<GroupInfo>(`/messagerie/conversations/${conversationId}/groupe`),
  addParticipants:  (conversationId: string, participantIds: string[]) =>
                      api.post<{ added: number }>(`/messagerie/conversations/${conversationId}/participants`, { participantIds }),
  removeParticipant: (conversationId: string, userId: string) =>
                      api.delete<{ removed: boolean }>(`/messagerie/conversations/${conversationId}/participants/${userId}`),
  setAdmin:         (conversationId: string, userId: string, estAdmin: boolean) =>
                      api.patch<{ estAdmin: boolean }>(`/messagerie/conversations/${conversationId}/participants/${userId}/admin`, { estAdmin }),
  updateGroup:      (conversationId: string, dto: { titre?: string; description?: string }) =>
                      api.patch<GroupInfo>(`/messagerie/conversations/${conversationId}`, dto),
  uploadGroupPhoto: (conversationId: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.upload<{ photoUrl: string }>(`/messagerie/conversations/${conversationId}/photo`, fd)
  },
  removeGroupPhoto: (conversationId: string) => api.delete<{ photoUrl: null }>(`/messagerie/conversations/${conversationId}/photo`),
  setMuted:         (conversationId: string, muted: boolean) =>
                      api.patch<{ muted: boolean }>(`/messagerie/conversations/${conversationId}/mute`, { muted }),

  // ── Fil avancé : réactions détaillées, épinglage, transfert ───────────────
  reactionDetails:  (messageId: string) => api.get<ReactionDetail[]>(`/messagerie/messages/${messageId}/reactions`),
  togglePin:        (messageId: string) => api.post<{ epingle: boolean }>(`/messagerie/messages/${messageId}/epingler`, {}),
  pinned:           (conversationId: string) => api.get<PinnedMessage[]>(`/messagerie/conversations/${conversationId}/epingles`),
  forward:          (messageId: string, conversationIds: string[]) =>
                      api.post<{ forwarded: number }>(`/messagerie/messages/${messageId}/transferer`, { conversationIds }),
}

/** URL absolue d'une pièce jointe (réservé à un usage authentifié via fetch). */
export function pieceJointeUrl(pieceId: string): string {
  return `${BASE_URL}/messagerie/pieces-jointes/${pieceId}`
}

/** Récupère le token courant (pour fetch manuel d'une pièce jointe). */
export function authHeader(): Record<string, string> {
  const token = useSessionStore.getState().token
  return token ? { Authorization: `Bearer ${token}` } : {}
}
