/**
 * Hooks messagerie : contacts, conversations, fil paginé, envoi optimiste,
 * édition/suppression, groupes, pièces jointes.
 *
 * Temps réel via le flux SSE des notifications (monté dans le TopHeader) :
 * à la réception d'une notification type MESSAGE, les queries ['messagerie']
 * sont invalidées → liste, fil et compteur se rafraîchissent instantanément.
 */
import { useEffect } from 'react'
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { messagerieApi, type MessageItem, type MessagesPage } from '../api/messagerie.api'

export const MSG_KEY = ['messagerie'] as const
const threadKey = (id: string) => [...MSG_KEY, 'thread', id] as const
const convKey   = [...MSG_KEY, 'conversations'] as const

export function useContacts(enabled = true) {
  return useQuery({
    queryKey: [...MSG_KEY, 'contacts'],
    queryFn:  () => messagerieApi.contacts(),
    enabled,
    staleTime: 60_000,
  })
}

export function useConversations() {
  return useQuery({
    queryKey: convKey,
    queryFn:  () => messagerieApi.conversations(),
    staleTime: 10_000,
    refetchInterval: 60_000,
  })
}

export function useMessagerieUnread(enabled = true) {
  return useQuery({
    queryKey: [...MSG_KEY, 'unread'],
    queryFn:  () => messagerieApi.unreadCount(),
    enabled,
    staleTime: 10_000,
    refetchInterval: 60_000,
  })
}

/** Fil paginé. Page 0 = messages les plus récents ; pages suivantes = plus anciens. */
export function useMessagesThread(conversationId: string | null) {
  const qc = useQueryClient()
  const q = useInfiniteQuery({
    queryKey:        threadKey(conversationId ?? '∅'),
    queryFn:         ({ pageParam }) => messagerieApi.messages(conversationId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: MessagesPage) =>
      lastPage.hasMore && lastPage.messages.length > 0 ? lastPage.messages[0]!.createdAt : undefined,
    enabled:   !!conversationId,
    staleTime: 5_000,
    refetchInterval: 30_000,
  })
  // Ouvrir/charger le fil marque la conversation LUE côté serveur (listMessages).
  // On rafraîchit alors le compteur de non-lus + la liste → le badge se met à jour
  // INSTANTANÉMENT (sans attendre le refetch périodique de 60 s).
  useEffect(() => {
    if (conversationId && q.isSuccess) {
      qc.invalidateQueries({ queryKey: [...MSG_KEY, 'unread'] })
      qc.invalidateQueries({ queryKey: convKey })
      // Le serveur a aussi marqué lues les notifications de cette conversation
      // (nouveau message, réaction) → on rafraîchit la cloche pour qu'elle se
      // décrémente immédiatement, sans décalage.
      qc.invalidateQueries({ queryKey: ['notifications'] })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, q.dataUpdatedAt, q.isSuccess])
  return q
}

/** Aplati les pages en ordre chronologique (ancien → récent). */
export function flattenThread(pages: MessagesPage[] | undefined): MessageItem[] {
  if (!pages) return []
  return [...pages].reverse().flatMap(p => p.messages)
}

export function useStartConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (destinataireId: string) => messagerieApi.start(destinataireId),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: MSG_KEY }) },
  })
}

export function useCreateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ titre, participantIds }: { titre: string; participantIds: string[] }) =>
      messagerieApi.createGroup(titre, participantIds),
    onSuccess: () => { qc.invalidateQueries({ queryKey: MSG_KEY }) },
  })
}

export function useLeaveConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (conversationId: string) => messagerieApi.leave(conversationId),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: MSG_KEY }) },
  })
}

let tempCounter = 0

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ contenu, fichiers, replyToId }: { contenu: string; fichiers: File[]; replyToId?: string; replyPreview?: MessageItem['replyTo'] }) =>
      messagerieApi.send(conversationId, contenu, fichiers, replyToId),

    // Envoi optimiste : la bulle apparaît immédiatement (statut « en cours »).
    onMutate: async ({ contenu, fichiers, replyPreview }) => {
      const key = threadKey(conversationId)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData(key)
      const temp: MessageItem = {
        id:           `temp-${++tempCounter}`,
        contenu,
        expediteurId: 'me',
        expediteur:   'Moi',
        deMoi:        true,
        edite:        false,
        createdAt:    new Date().toISOString(),
        piecesJointes: fichiers.map((f, i) => ({ id: `temp-pj-${i}`, nomFichier: f.name, mimeType: f.type, taille: f.size })),
        reactions:    [],
        replyTo:      replyPreview ?? null,
        vu: false, vuAt: null, luPar: 0, luParTous: false,
        remis: false, remisPar: 0,
        modifiable: true, supprimable: true,
        pending: true,
      }
      qc.setQueryData(key, (old: { pages: MessagesPage[]; pageParams: unknown[] } | undefined) => {
        if (!old?.pages?.length) return old
        const pages = old.pages.slice()
        pages[0] = { ...pages[0]!, messages: [...pages[0]!.messages, temp] }
        return { ...old, pages }
      })
      return { prev, key }
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: threadKey(conversationId) })
      qc.invalidateQueries({ queryKey: convKey })
    },
  })
}

export function useUpdateMessage(conversationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, contenu }: { id: string; contenu: string }) => messagerieApi.update(id, contenu),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: threadKey(conversationId) })
      qc.invalidateQueries({ queryKey: convKey })
    },
  })
}

export function useDeleteMessage(conversationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => messagerieApi.remove(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: threadKey(conversationId) })
      qc.invalidateQueries({ queryKey: convKey })
    },
  })
}

export function useHideMessage(conversationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => messagerieApi.hide(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: threadKey(conversationId) })
      qc.invalidateQueries({ queryKey: convKey })
    },
  })
}

/** Suppression MULTIPLE de messages : « pour moi » (hide) ou « pour tout le monde » (delete). */
export function useBatchDeleteMessages(conversationId: string) {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: threadKey(conversationId) })
    qc.invalidateQueries({ queryKey: convKey })
  }
  const forMe = useMutation({ mutationFn: (ids: string[]) => messagerieApi.batchHide(ids), onSuccess: invalidate })
  const forEveryone = useMutation({ mutationFn: (ids: string[]) => messagerieApi.batchDelete(ids), onSuccess: invalidate })
  return { forMe, forEveryone }
}

export function useMessageDetails(messageId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...MSG_KEY, 'details', messageId],
    queryFn:  () => messagerieApi.details(messageId!),
    enabled:  enabled && !!messageId,
    staleTime: 5_000,
  })
}

export function useToggleReaction(conversationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) => messagerieApi.react(messageId, emoji),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: threadKey(conversationId) }) },
  })
}
