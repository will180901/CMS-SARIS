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
import { useUploadProgressStore } from '@/stores/uploadProgress.store'

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
    mutationFn: ({ conversationId, newPrincipalId }: { conversationId: string; newPrincipalId?: string }) =>
      messagerieApi.leave(conversationId, newPrincipalId),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: MSG_KEY }) },
  })
}

let tempCounter = 0

type SendMessageVars = { contenu: string; fichiers: File[]; replyToId?: string; replyPreview?: MessageItem['replyTo'] }
type SendMessageInternalVars = SendMessageVars & { tempId: string }

/**
 * `onMutate` (crée la bulle optimiste) et `mutationFn` (fait l'upload) ne partagent
 * aucun contexte React Query commun — le `tempId` est donc généré en AMONT (dans le
 * wrapper mutate/mutateAsync ci-dessous) et injecté dans les variables, pour que la
 * progression de l'upload (indexée par cet id, cf. uploadProgress.store.ts) retombe
 * sur la bonne bulle dans PieceJointe.tsx.
 */
export function useSendMessage(conversationId: string) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ contenu, fichiers, replyToId, tempId }: SendMessageInternalVars) =>
      messagerieApi.send(conversationId, contenu, fichiers, replyToId,
        fichiers.length ? (pct) => useUploadProgressStore.getState().setProgress(tempId, pct) : undefined),

    // Envoi optimiste : la bulle apparaît immédiatement (statut « en cours »).
    onMutate: async ({ contenu, fichiers, replyPreview, tempId }: SendMessageInternalVars) => {
      const key = threadKey(conversationId)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData(key)
      const temp: MessageItem = {
        id:           tempId,
        type:         'TEXTE',
        contenu,
        expediteurId: 'me',
        expediteur:   'Moi',
        deMoi:        true,
        edite:        false,
        epingle:      false,
        transfere:    false,
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
      return { prev, key, tempId }
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev)
      if (ctx?.tempId) useUploadProgressStore.getState().clear(ctx.tempId)
    },
    onSettled: (_data, _err, _vars, ctx) => {
      qc.invalidateQueries({ queryKey: threadKey(conversationId) })
      qc.invalidateQueries({ queryKey: convKey })
      if (ctx?.tempId) useUploadProgressStore.getState().clear(ctx.tempId)
    },
  })

  const withTempId = (vars: SendMessageVars): SendMessageInternalVars => ({ ...vars, tempId: `temp-${++tempCounter}` })
  return {
    ...mutation,
    mutate:      (vars: SendMessageVars) => mutation.mutate(withTempId(vars)),
    mutateAsync: (vars: SendMessageVars) => mutation.mutateAsync(withTempId(vars)),
  }
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

export function useReactionDetails(messageId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...MSG_KEY, 'reaction-details', messageId],
    queryFn:  () => messagerieApi.reactionDetails(messageId!),
    enabled:  enabled && !!messageId,
    staleTime: 5_000,
  })
}

// ── Gestion de groupe ─────────────────────────────────────────────────────────

const groupInfoKey = (conversationId: string) => [...MSG_KEY, 'groupe', conversationId] as const

export function useGroupInfo(conversationId: string | null, enabled = true) {
  return useQuery({
    queryKey: groupInfoKey(conversationId ?? '∅'),
    queryFn:  () => messagerieApi.groupInfo(conversationId!),
    enabled:  enabled && !!conversationId,
    staleTime: 10_000,
  })
}

/** Invalide tout ce qu'un événement de groupe peut affecter : infos, fil (message système), liste. */
function invalidateGroup(qc: ReturnType<typeof useQueryClient>, conversationId: string) {
  qc.invalidateQueries({ queryKey: groupInfoKey(conversationId) })
  qc.invalidateQueries({ queryKey: threadKey(conversationId) })
  qc.invalidateQueries({ queryKey: convKey })
}

export function useAddParticipants(conversationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (participantIds: string[]) => messagerieApi.addParticipants(conversationId, participantIds),
    onSuccess:  () => invalidateGroup(qc, conversationId),
  })
}

export function useRemoveParticipant(conversationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => messagerieApi.removeParticipant(conversationId, userId),
    onSuccess:  () => invalidateGroup(qc, conversationId),
  })
}

export function useSetAdmin(conversationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, estAdmin }: { userId: string; estAdmin: boolean }) => messagerieApi.setAdmin(conversationId, userId, estAdmin),
    onSuccess:  () => invalidateGroup(qc, conversationId),
  })
}

export function useUpdateGroup(conversationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: { titre?: string; description?: string }) => messagerieApi.updateGroup(conversationId, dto),
    onSuccess:  () => invalidateGroup(qc, conversationId),
  })
}

export function useUploadGroupPhoto(conversationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => messagerieApi.uploadGroupPhoto(conversationId, file),
    onSuccess:  () => invalidateGroup(qc, conversationId),
  })
}

export function useRemoveGroupPhoto(conversationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => messagerieApi.removeGroupPhoto(conversationId),
    onSuccess:  () => invalidateGroup(qc, conversationId),
  })
}

export function useSetMuted(conversationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (muted: boolean) => messagerieApi.setMuted(conversationId, muted),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: convKey }) },
  })
}

// ── Fil avancé : épinglage, transfert ─────────────────────────────────────────

export function useTogglePin(conversationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (messageId: string) => messagerieApi.togglePin(messageId),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: threadKey(conversationId) })
      qc.invalidateQueries({ queryKey: [...MSG_KEY, 'epingles', conversationId] })
    },
  })
}

export function usePinnedMessages(conversationId: string | null) {
  return useQuery({
    queryKey: [...MSG_KEY, 'epingles', conversationId ?? '∅'],
    queryFn:  () => messagerieApi.pinned(conversationId!),
    enabled:  !!conversationId,
    staleTime: 5_000,
  })
}

export function useForwardMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ messageId, conversationIds }: { messageId: string; conversationIds: string[] }) =>
      messagerieApi.forward(messageId, conversationIds),
    onSuccess: () => { qc.invalidateQueries({ queryKey: MSG_KEY }) },
  })
}
