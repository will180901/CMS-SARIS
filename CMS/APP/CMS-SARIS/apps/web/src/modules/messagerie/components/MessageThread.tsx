/**
 * MessageThread — fil d'une conversation, façon WhatsApp.
 *
 * En-tête (DIRECT/GROUPE) + chiffrement ; pagination ; regroupement des messages ;
 * réponses/citations ; menu d'actions ouvert par un CHEVRON BAS placé dans le coin
 * de la bulle (réactions rapides + Répondre/Copier/Modifier/Supprimer ≤ 15 min) ;
 * réactions emoji sous les bulles ; accusés de lecture ; pièces jointes ; emojis,
 * stickers, menu de pièces jointes (Photos/Document) ; rendu géant des emojis seuls ;
 * liens cliquables ; envoi optimiste ; bouton « descendre ».
 */
import { useState, useRef, useLayoutEffect, useCallback, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  Send, Pencil, Trash2, Check, CheckCheck, X, ShieldCheck,
  Users, Paperclip, ChevronUp, ChevronDown, Clock, Loader2,
  Reply, Copy, Image as ImageIcon, FileText, Sticker, Smile, Info, Music, Mic, ListChecks, Plus, ChevronLeft,
} from 'lucide-react'
import { Avatar } from '@/components/saris'
import { Popover, PopoverContent, PopoverTrigger } from '@workspace/ui/components/popover'
import { toast } from '@workspace/ui/components/sonner'
import { isOfflineQueued } from '@/lib/api'
import {
  useMessagesThread, flattenThread,
  useSendMessage, useUpdateMessage, useDeleteMessage, useHideMessage, useToggleReaction, useMessageDetails,
  useBatchDeleteMessages,
} from '../hooks/useMessagerie'
import { messagerieApi, EDIT_DELETE_WINDOW_MS, type ConversationItem, type MessageItem, type ReplyPreview, type PieceJointeMeta } from '../api/messagerie.api'
import { PieceJointe, MediaThumb } from './PieceJointe'
import { MediaPreview } from './MediaPreview'
import { MediaViewer } from './MediaViewer'
import { VoiceRecorder } from './VoiceRecorder'
import { playSound } from '@/lib/sounds'
import { formatTime, formatDate, formatDateTime } from '@/lib/intl'
import { useTypingStore } from '@/stores/typing.store'
import { EmojiPicker } from './EmojiPicker'
import { Twemoji, renderRich } from './twemoji'
import { STICKERS, isEmojiOnly, splitGraphemes } from './emojiData'

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

// Réactions personnalisées : emojis ajoutés par l'utilisateur (« + ») à la liste
// rapide, mémorisés par appareil. Les défauts ne sont jamais dupliqués.
const CUSTOM_REACT_KEY = 'saris.reactions.custom'
function getCustomReactions(): string[] {
  try {
    const a = JSON.parse(localStorage.getItem(CUSTOM_REACT_KEY) || '[]')
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string' && !QUICK_REACTIONS.includes(x)).slice(0, 6) : []
  } catch { return [] }
}
function addCustomReaction(emoji: string): string[] {
  if (QUICK_REACTIONS.includes(emoji)) return getCustomReactions()
  const next = [emoji, ...getCustomReactions().filter(x => x !== emoji)].slice(0, 6)
  try { localStorage.setItem(CUSTOM_REACT_KEY, JSON.stringify(next)) } catch { /* noop */ }
  return next
}
const ACCEPT_MEDIA = 'image/*,video/*'
const ACCEPT_AUDIO = 'audio/*'
const ACCEPT_DOC = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,application/pdf'

function formatHour(iso: string): string { return formatTime(iso) }
function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1) }
/** Libellé de date « intelligent » façon WhatsApp. */
function formatDayLabel(iso: string, t: TFunction): string {
  const d = new Date(iso), now = new Date()
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOf(now) - startOf(d)) / 86400000)
  if (days === 0) return t('messagerie.today')
  if (days === 1) return t('messagerie.yesterday')
  if (days > 1 && days < 7) return cap(formatDate(d, { weekday: 'long' }))
  return cap(formatDate(d, { weekday: 'long', day: 'numeric', month: 'long', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) }))
}
const withinWindow = (iso: string) => Date.now() - new Date(iso).getTime() <= EDIT_DELETE_WINDOW_MS

/** « Vu » relatif pour le statut d'en-tête. */
function formatLastSeen(iso: string, t: TFunction): string {
  const d = new Date(iso), now = new Date()
  if (d.toDateString() === now.toDateString()) return t('messagerie.seenToday', { heure: formatHour(iso) })
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return t('messagerie.seenYesterday', { heure: formatHour(iso) })
  return t('messagerie.seenOn', { date: formatDate(iso, { day: '2-digit', month: '2-digit' }), heure: formatHour(iso) })
}

export function MessageThread({ conv, onLeft, onBack }: { conv: ConversationItem; onLeft?: () => void; onBack?: () => void }) {
  void onLeft
  const { t } = useTranslation()
  const conversationId = conv.id
  const isGroupe = conv.type === 'GROUPE'
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useMessagesThread(conversationId)
  const messages = flattenThread(data?.pages)

  const sendMut   = useSendMessage(conversationId)
  const updateMut = useUpdateMessage(conversationId)
  const deleteMut = useDeleteMessage(conversationId)
  const hideMut   = useHideMessage(conversationId)
  const reactMut  = useToggleReaction(conversationId)
  const batchMut  = useBatchDeleteMessages(conversationId)

  const [draft, setDraft]       = useState('')
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [viewerPj, setViewerPj]     = useState<PieceJointeMeta | null>(null)
  const [recording, setRecording]   = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [replyTo, setReplyTo]   = useState<ReplyPreview | null>(null)
  const [showScrollDown, setShowScrollDown] = useState(false)
  const [emojiOpen, setEmojiOpen]   = useState(false)
  const [stickerOpen, setStickerOpen] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  const [detailsId, setDetailsId]   = useState<string | null>(null)
  const [delTarget, setDelTarget]   = useState<MessageItem | null>(null)
  const [selectMode, setSelectMode]   = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [multiDel, setMultiDel]       = useState(false)

  // ── « En train d'écrire / d'enregistrer » (temps réel, façon WhatsApp) ──────
  // Réception : bulle animée tant que le TTL court (réarmé par l'événement SSE).
  // Le TYPE (texte/audio) choisit l'animation : 3 points OU micro + onde.
  const typingMap = useTypingStore(s => s.typing)
  const [typingNow, setTypingNow] = useState(() => Date.now())
  const typingEntry  = typingMap[conversationId]
  const someoneTyping = !!typingEntry && typingEntry.until > typingNow
  const typingKind    = typingEntry?.kind ?? 'text'
  useEffect(() => {
    const exp = typingMap[conversationId]?.until
    if (!exp || exp <= Date.now()) return
    const id = setTimeout(() => setTypingNow(Date.now()), exp - Date.now() + 60)
    return () => clearTimeout(id)
  }, [typingMap, conversationId])
  // Émission : un ping à chaque frappe (le 1er immédiat → démarrage instantané), au plus
  // toutes les ~0,6 s. À l'arrêt, le dernier ping expire (TTL ~1,4 s) → la bulle disparaît
  // « net », sans signal de fin explicite. `kind=audio` pour les notes vocales.
  const lastTypingPing = useRef(0)
  const pingTyping = useCallback((kind?: 'audio') => {
    const t0 = Date.now()
    if (t0 - lastTypingPing.current > 600) {
      lastTypingPing.current = t0
      void messagerieApi.typing(conversationId, kind).catch(() => { /* best-effort */ })
    }
  }, [conversationId])

  // Pendant l'enregistrement d'une note vocale : on signale « en train d'enregistrer »
  // (kind=audio) toutes les ~0,9 s tant que le micro tourne → bulle micro chez l'autre.
  useEffect(() => {
    if (!recording) return
    lastTypingPing.current = 0
    pingTyping('audio')
    const id = setInterval(() => pingTyping('audio'), 900)
    return () => clearInterval(id)
  }, [recording, pingTyping])

  const imgInputRef   = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const docInputRef   = useRef<HTMLInputElement>(null)
  const composerRef   = useRef<HTMLTextAreaElement>(null)
  const scrollRef   = useRef<HTMLDivElement>(null)
  const distFromBottomRef = useRef(0)
  const loadingOlderRef   = useRef(false)

  const nom = isGroupe ? conv.titre : (conv.interlocuteur?.nom ?? conv.titre)
  const lastOwnId = [...messages].reverse().find(m => m.deMoi && !m.pending)?.id ?? null

  // ── @mentions (groupes) — picker de participants dans le composer ────────────
  // Candidats = contacts du même site, restreints aux MEMBRES du groupe (même
  // displayName que conv.participants). On insère un token stable `@[Nom](userId)`
  // que le serveur parse pour notifier le mentionné (cf. parseMentionIds back).
  const [mention, setMention] = useState<{ q: string; start: number } | null>(null)
  const { data: contacts = [] } = useQuery({
    queryKey: ['messagerie', 'contacts'],
    queryFn:  () => messagerieApi.contacts(),
    enabled:  isGroupe,
    staleTime: 60_000,
  })
  const mentionCandidates = useMemo(() => {
    if (!mention || !isGroupe) return []
    const members = new Set(conv.participants)
    const q = mention.q.trim().toLowerCase()
    return contacts
      .filter(c => members.has(c.nom))
      .filter(c => !q || c.nom.toLowerCase().includes(q))
      .slice(0, 6)
  }, [mention, isGroupe, contacts, conv.participants])

  // Détecte un « @mot » en cours de frappe juste avant le curseur.
  function detectMention(value: string, caret: number) {
    if (!isGroupe) { setMention(null); return }
    const before = value.slice(0, caret)
    const m = before.match(/(^|\s)@([^\s@]{0,40})$/)
    if (m) setMention({ q: m[2] ?? '', start: caret - (m[2]?.length ?? 0) - 1 })
    else setMention(null)
  }
  function onComposerChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value
    setDraft(value)
    if (value) pingTyping()
    detectMention(value, e.target.selectionStart ?? value.length)
  }
  function pickMention(c: { id: string; nom: string }) {
    const ta = composerRef.current
    const caret = ta?.selectionStart ?? draft.length
    if (!mention) return
    const token = `@[${c.nom}](${c.id}) `
    const next = draft.slice(0, mention.start) + token + draft.slice(caret)
    setDraft(next)
    setMention(null)
    requestAnimationFrame(() => {
      if (!ta) return
      const pos = mention.start + token.length
      ta.focus(); ta.setSelectionRange(pos, pos)
    })
  }

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (loadingOlderRef.current) { el.scrollTop = el.scrollHeight - distFromBottomRef.current; loadingOlderRef.current = false }
    else el.scrollTop = el.scrollHeight
  }, [messages.length, conversationId])

  // Si la bulle « en train d'écrire » apparaît alors qu'on est déjà en bas du fil, on
  // défile pour la garder visible — comme à l'arrivée d'un vrai message.
  useEffect(() => {
    if (!someoneTyping) return
    const el = scrollRef.current
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 140) el.scrollTop = el.scrollHeight
  }, [someoneTyping])

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (el) setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 220)
  }, [])

  function scrollToBottom() { const el = scrollRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }) }
  function scrollToMessage(id: string) {
    const el = document.getElementById(`msg-${id}`)
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.style.transition = 'background 0.2s'; el.style.background = 'var(--ap-50)'; setTimeout(() => { el.style.background = '' }, 900) }
  }
  function loadMore() {
    const el = scrollRef.current
    if (el) distFromBottomRef.current = el.scrollHeight - el.scrollTop
    loadingOlderRef.current = true; fetchNextPage()
  }

  function openPreview(list: FileList | null) {
    setAttachOpen(false)
    if (!list?.length) return
    setMediaFiles(Array.from(list))
    if (imgInputRef.current) imgInputRef.current.value = ''
    if (audioInputRef.current) audioInputRef.current.value = ''
    if (docInputRef.current) docInputRef.current.value = ''
  }

  async function sendMedia(processed: File[], caption: string) {
    setMediaFiles([])
    if (!processed.length) return
    try { await sendMut.mutateAsync({ contenu: caption, fichiers: processed }); playSound('sent') }
    catch (e) { if (!isOfflineQueued(e)) { toast.error(t('messagerie.sendError')); playSound('error') } }
  }

  async function sendVoice(file: File) {
    setRecording(false)
    try { await sendMut.mutateAsync({ contenu: '', fichiers: [file] }); playSound('sent') }
    catch (e) { if (!isOfflineQueued(e)) { toast.error(t('messagerie.voiceSendError')); playSound('error') } }
  }

  function insertEmoji(emoji: string) {
    const ta = composerRef.current
    if (!ta) { setDraft(d => d + emoji); return }
    const start = ta.selectionStart ?? draft.length
    const end = ta.selectionEnd ?? draft.length
    setDraft(draft.slice(0, start) + emoji + draft.slice(end))
    requestAnimationFrame(() => { ta.focus(); const pos = start + emoji.length; ta.setSelectionRange(pos, pos) })
  }

  async function handleSend() {
    const texte = draft.trim()
    if (!texte || sendMut.isPending) return
    const rep = replyTo
    setDraft(''); setReplyTo(null); setMention(null)
    try { await sendMut.mutateAsync({ contenu: texte, fichiers: [], replyToId: rep?.id, replyPreview: rep }) }
    catch (e) { if (!isOfflineQueued(e)) { toast.error(t('messagerie.sendError')); setDraft(texte); setReplyTo(rep) } }
  }

  async function sendSticker(emoji: string) {
    setStickerOpen(false)
    try { await sendMut.mutateAsync({ contenu: emoji, fichiers: [] }) }
    catch (e) { if (!isOfflineQueued(e)) toast.error(t('messagerie.sendError')) }
  }

  async function handleUpdate() {
    const texte = editText.trim()
    if (!texte) return
    try { await updateMut.mutateAsync({ id: editId!, contenu: texte }); setEditId(null); setEditText('') }
    catch (e: any) { toast.error(e?.serverMessage || t('messagerie.updateError')) }
  }
  async function deleteForMe(id: string) {
    setDelTarget(null)
    try { await hideMut.mutateAsync(id) } catch (e: any) { if (!isOfflineQueued(e)) toast.error(e?.serverMessage || t('messagerie.deleteError')) }
  }
  async function deleteForEveryone(id: string) {
    setDelTarget(null)
    try { await deleteMut.mutateAsync(id) } catch (e: any) { if (!isOfflineQueued(e)) toast.error(e?.serverMessage || t('messagerie.deleteError')) }
  }
  function startReply(m: MessageItem) {
    setReplyTo({ id: m.id, auteur: m.deMoi ? t('messagerie.you') : m.expediteur, deMoi: m.deMoi, apercu: m.contenu || (m.piecesJointes.length ? t('messagerie.attachmentPreview') : '') })
    composerRef.current?.focus()
  }
  async function copyMessage(m: MessageItem) { try { await navigator.clipboard.writeText(m.contenu); toast.success(t('messagerie.copied')) } catch { /* ignore */ } }
  function react(m: MessageItem, emoji: string) { reactMut.mutate({ messageId: m.id, emoji }) }

  // ── Sélection multiple (suppression en lot) ─────────────────────────────────
  function enterSelect(id: string) { setSelectMode(true); setSelectedIds(new Set([id])) }
  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function exitSelect() { setSelectMode(false); setSelectedIds(new Set()); setMultiDel(false) }
  // Au moins un des messages sélectionnés est-il à moi & ≤ 15 min (→ « pour tout le monde » possible) ?
  const canDeleteEveryone = messages.some(m => selectedIds.has(m.id) && m.deMoi && withinWindow(m.createdAt))
  async function multiDeleteForMe() {
    const ids = [...selectedIds]; exitSelect()
    if (!ids.length) return
    try { await batchMut.forMe.mutateAsync(ids); playSound('tap') } catch { toast.error(t('messagerie.deleteError')) }
  }
  async function multiDeleteForEveryone() {
    const ids = [...selectedIds]; exitSelect()
    if (!ids.length) return
    try { await batchMut.forEveryone.mutateAsync(ids); playSound('tap') } catch { toast.error(t('messagerie.deleteError')) }
  }


  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', flexShrink: 0, borderBottom: '1px solid var(--bordure-legere)', background: 'color-mix(in srgb, var(--fond-surface) 82%, transparent)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
        {onBack && (
          <button onClick={onBack} title={t('common.back')} aria-label={t('common.back')}
            style={{ width: 34, height: 34, flexShrink: 0, marginLeft: -6, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--texte-secondaire)' }}>
            <ChevronLeft size={22} />
          </button>
        )}
        {isGroupe
          ? <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--ap-100)', color: 'var(--ap-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Users size={18} /></div>
          : <Avatar nom={nom} size={40} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--texte-primaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nom}</p>
          <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--texte-tertiaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isGroupe
              ? t('messagerie.groupHeaderParticipants', { count: conv.nbParticipants, noms: conv.participants.join(', ') })
              : conv.interlocuteur?.enLigne
                ? <span style={{ color: 'var(--succes-accent)', fontWeight: 600 }}>{t('messagerie.online')}</span>
                : conv.interlocuteur?.vuLe
                  ? formatLastSeen(conv.interlocuteur.vuLe, t)
                  : (conv.interlocuteur?.role ?? '')}
          </p>
        </div>
      </div>

      {/* ── Fil ──────────────────────────────────────────────────────────── */}
      <div ref={scrollRef} onScroll={onScroll} className="saris-grain" style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '16px 20px', background: 'var(--fond-page)', position: 'relative' }}>
        {isLoading ? (
          <p style={{ textAlign: 'center', color: 'var(--texte-tertiaire)', fontSize: 12, marginTop: 24 }}>{t('messagerie.loading')}</p>
        ) : messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 48 }}>
            <ShieldCheck size={28} style={{ color: 'var(--texte-tertiaire)', opacity: 0.4 }} />
            <p style={{ fontSize: 13, color: 'var(--texte-secondaire)', margin: 0 }}>{t('messagerie.conversationStart')}</p>
          </div>
        ) : (
          <>
            {hasNextPage && (
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <button onClick={loadMore} disabled={isFetchingNextPage}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, padding: '6px 14px', borderRadius: 9999, background: 'var(--fond-surface)', border: '1px solid var(--bordure-normale)', color: 'var(--texte-secondaire)', cursor: 'pointer' }}>
                  {isFetchingNextPage ? <Loader2 size={13} className="animate-spin" /> : <ChevronUp size={13} />} {t('messagerie.previousMessages')}
                </button>
              </div>
            )}
            <MessageList
              t={t}
              messages={messages} isGroupe={isGroupe} lastOwnId={lastOwnId}
              editId={editId} editText={editText} setEditText={setEditText}
              onStartEdit={(m) => { setEditId(m.id); setEditText(m.contenu) }}
              onCancelEdit={() => { setEditId(null); setEditText('') }}
              onSaveEdit={handleUpdate} onDelete={(m) => setDelTarget(m)}
              onReply={startReply} onCopy={copyMessage} onQuoteClick={scrollToMessage} onReact={react}
              onDetails={(m) => setDetailsId(m.id)} onOpenMedia={setViewerPj}
              selectMode={selectMode} selectedIds={selectedIds} onToggleSelect={toggleSelect} onEnterSelect={enterSelect}
            />
          </>
        )}

        {/* Activité en cours — la bulle du PROCHAIN message (façon WhatsApp) : petite bulle
            entrante animée, en bas du fil. Texte = 3 points ; note vocale = micro + onde. */}
        {someoneTyping && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: messages.length ? 8 : 0, paddingLeft: isGroupe ? 38 : 0 }}>
            <style>{'@keyframes saris-typing{0%,60%,100%{opacity:0.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}@keyframes saris-rec-wave{0%,100%{transform:scaleY(0.34)}50%{transform:scaleY(1)}}@keyframes saris-rec-mic{0%,100%{opacity:1}50%{opacity:0.4}}'}</style>
            <span aria-label={typingKind === 'audio' ? t('messagerie.recordingAudio') : t('messagerie.typing')}
              title={typingKind === 'audio' ? t('messagerie.recordingAudio') : t('messagerie.typing')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: typingKind === 'audio' ? 7 : 5, padding: '11px 14px', borderRadius: '4px 16px 16px 16px', background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)', boxShadow: '0 1px 1.5px rgba(15,23,42,0.06)' }}>
              {typingKind === 'audio' ? (
                <>
                  <Mic size={14} style={{ color: 'var(--erreur-accent)', animation: 'saris-rec-mic 1s infinite ease-in-out', flexShrink: 0 }} />
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, height: 14 }}>
                    {[0, 0.16, 0.32, 0.48, 0.22].map((d, i) => (
                      <i key={i} style={{ width: 3, height: 14, borderRadius: 9999, background: 'var(--ap-400)', display: 'inline-block', transformOrigin: 'center', animation: 'saris-rec-wave 0.9s infinite ease-in-out', animationDelay: d + 's' }} />
                    ))}
                  </span>
                </>
              ) : (
                [0, 0.16, 0.32].map((d) => (
                  <i key={d} style={{ width: 6, height: 6, borderRadius: 9999, background: 'var(--texte-tertiaire)', display: 'inline-block', animation: 'saris-typing 1.1s infinite ease-in-out', animationDelay: d + 's' }} />
                ))
              )}
            </span>
          </div>
        )}
      </div>

      {showScrollDown && (
        <button onClick={scrollToBottom} title={t('messagerie.scrollDown')}
          style={{ position: 'absolute', right: 24, bottom: replyTo ? 150 : 86, width: 38, height: 38, borderRadius: 9999, background: 'var(--fond-surface)', border: '1px solid var(--bordure-normale)', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--texte-secondaire)', zIndex: 5 }}>
          <ChevronDown size={18} />
        </button>
      )}

      {/* ── Barre de réponse ─────────────────────────────────────────────── */}
      {replyTo && (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderTop: '1px solid var(--bordure-legere)', background: 'var(--fond-surface-2)' }}>
          <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: 'var(--ap-400)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--ap-700)' }}>{t('messagerie.replyTo', { auteur: replyTo.auteur })}</p>
            <p style={{ margin: '1px 0 0', fontSize: 12, color: 'var(--texte-tertiaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{replyTo.apercu}</p>
          </div>
          <button onClick={() => setReplyTo(null)} title={t('messagerie.cancel')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texte-tertiaire)', display: 'flex', padding: 4 }}><X size={15} /></button>
        </div>
      )}

      {/* ── Barre de sélection multiple ──────────────────────────────────── */}
      {selectMode && (
        <div style={{ flexShrink: 0, padding: '10px 16px', borderTop: '1px solid var(--bordure-legere)', background: 'var(--fond-surface)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--texte-primaire)', flex: 1 }}>
            {t('messagerie.selectedMessages', { count: selectedIds.size })}
          </span>
          <button onClick={exitSelect} style={{ fontSize: 12.5, fontWeight: 600, padding: '7px 12px', borderRadius: 9999, background: 'var(--fond-surface-2)', border: '1px solid var(--bordure-normale)', color: 'var(--texte-secondaire)', cursor: 'pointer' }}>{t('messagerie.cancel')}</button>
          <button onClick={multiDeleteForMe} disabled={selectedIds.size === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, padding: '7px 12px', borderRadius: 9999, background: 'var(--erreur-fond)', border: '1px solid var(--erreur-accent)', color: 'var(--erreur-accent)', cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer', opacity: selectedIds.size === 0 ? 0.5 : 1 }}>
            <Trash2 size={14} /> {t('messagerie.deleteForMe')}
          </button>
          {canDeleteEveryone && (
            <button onClick={() => setMultiDel(true)} disabled={selectedIds.size === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, padding: '7px 12px', borderRadius: 9999, background: 'var(--erreur-accent)', border: '1px solid var(--erreur-accent)', color: '#fff', cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer', opacity: selectedIds.size === 0 ? 0.5 : 1 }}>
              <Trash2 size={14} /> {t('messagerie.deleteForEveryone')}
            </button>
          )}
        </div>
      )}

      {/* ── Composeur ────────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, padding: '12px 16px', borderTop: replyTo ? 'none' : '1px solid var(--bordure-legere)', background: 'var(--fond-surface)', display: selectMode ? 'none' : 'flex', alignItems: 'flex-end', gap: 6 }}>
        <input ref={imgInputRef}   type="file" multiple accept={ACCEPT_MEDIA} style={{ display: 'none' }} onChange={e => openPreview(e.target.files)} />
        <input ref={audioInputRef} type="file" multiple accept={ACCEPT_AUDIO} style={{ display: 'none' }} onChange={e => openPreview(e.target.files)} />
        <input ref={docInputRef}   type="file" multiple accept={ACCEPT_DOC}   style={{ display: 'none' }} onChange={e => openPreview(e.target.files)} />

        {recording ? (
          <VoiceRecorder onCancel={() => setRecording(false)} onSend={sendVoice} />
        ) : (
        <>
        {/* Emoji */}
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <button title={t('messagerie.emoji')} style={composerBtn}><Smile size={18} /></button>
          </PopoverTrigger>
          <PopoverContent align="start" side="top" sideOffset={8} style={{ padding: 0, background: 'transparent', border: 'none', boxShadow: 'none', width: 'auto' }}>
            <EmojiPicker onPick={insertEmoji} />
          </PopoverContent>
        </Popover>

        {/* Stickers */}
        <Popover open={stickerOpen} onOpenChange={setStickerOpen}>
          <PopoverTrigger asChild>
            <button title={t('messagerie.stickers')} style={composerBtn}><Sticker size={18} /></button>
          </PopoverTrigger>
          <PopoverContent align="start" side="top" sideOffset={8} style={{ ...popoverBox, width: 300 }}>
            <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--bordure-legere)', fontSize: 12, fontWeight: 600, color: 'var(--texte-primaire)' }}>{t('messagerie.stickers')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, padding: 10, maxHeight: 240, overflowY: 'auto' }}>
              {STICKERS.map((s, i) => (
                <button key={s + i} onClick={() => sendSticker(s)} title={t('messagerie.send')}
                  style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: 'none', transition: 'transform .08s, background .12s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--fond-surface-2)'; e.currentTarget.style.transform = 'scale(1.12)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'scale(1)' }}>
                  <Twemoji emoji={s} size={34} />
                </button>
              ))}
            </div>
            <div style={{ padding: '5px 10px', borderTop: '1px solid var(--bordure-legere)', fontSize: 9, color: 'var(--texte-tertiaire)', textAlign: 'center' }}>
              {t('messagerie.emojiCredit')}
            </div>
          </PopoverContent>
        </Popover>

        {/* Pièces jointes (menu Photos / Document) */}
        <Popover open={attachOpen} onOpenChange={setAttachOpen}>
          <PopoverTrigger asChild>
            <button title={t('messagerie.attach')} style={composerBtn}><Paperclip size={17} /></button>
          </PopoverTrigger>
          <PopoverContent align="start" side="top" sideOffset={8} style={{ ...popoverBox, width: 210, padding: 4 }}>
            <AttachRow icon={<ImageIcon size={15} style={{ color: 'var(--ap-600)' }} />} label={t('messagerie.photosAndVideos')} onClick={() => imgInputRef.current?.click()} />
            <AttachRow icon={<Music size={15} style={{ color: 'var(--ap-600)' }} />} label={t('messagerie.audio')} onClick={() => audioInputRef.current?.click()} />
            <AttachRow icon={<FileText size={15} style={{ color: 'var(--ap-600)' }} />} label={t('messagerie.document')} onClick={() => docInputRef.current?.click()} />
          </PopoverContent>
        </Popover>

        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          {mention && mentionCandidates.length > 0 && (
            <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0, background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.14)', overflow: 'hidden', zIndex: 30 }}>
              {mentionCandidates.map(c => (
                <button key={c.id} type="button"
                  onMouseDown={e => { e.preventDefault(); pickMention(c) }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--fond-surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <Avatar nom={c.nom} size={24} />
                  <span style={{ fontSize: 13, color: 'var(--texte-primaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nom}</span>
                  {c.role && <span style={{ fontSize: 10, color: 'var(--texte-tertiaire)', marginLeft: 'auto', flexShrink: 0 }}>{c.role}</span>}
                </button>
              ))}
            </div>
          )}
          <textarea
            ref={composerRef} value={draft} onChange={onComposerChange}
            onKeyDown={e => {
              if (mention && mentionCandidates.length > 0 && (e.key === 'Enter' || e.key === 'Tab')) { e.preventDefault(); pickMention(mentionCandidates[0]!); return }
              if (e.key === 'Escape' && mention) { setMention(null); return }
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
            }}
            onClick={e => detectMention(draft, (e.target as HTMLTextAreaElement).selectionStart ?? draft.length)}
            onBlur={() => setTimeout(() => setMention(null), 120)}
            placeholder={t('messagerie.composerPlaceholder')} rows={1}
            style={{ width: '100%', boxSizing: 'border-box', resize: 'none', maxHeight: 120, minHeight: 38, padding: '9px 14px', borderRadius: 20, fontSize: 13, lineHeight: 1.4, border: '1px solid var(--bordure-normale)', background: 'var(--fond-surface)', color: 'var(--texte-primaire)', fontFamily: 'inherit', outline: 'none' }}
          />
        </div>
        {draft.trim() ? (
          <button onClick={handleSend} disabled={sendMut.isPending} title={t('messagerie.send')}
            style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ap-400)', color: '#fff', border: 'none', cursor: 'pointer', transition: 'background 0.12s' }}>
            <Send size={16} />
          </button>
        ) : (
          <button onClick={() => setRecording(true)} title={t('messagerie.voiceNote')} style={{ ...composerBtn, color: 'var(--ap-600)' }}>
            <Mic size={19} />
          </button>
        )}
        </>
        )}
      </div>

      {mediaFiles.length > 0 && (
        <MediaPreview initialFiles={mediaFiles} onCancel={() => setMediaFiles([])} onSend={sendMedia} />
      )}

      {viewerPj && (
        <MediaViewer pj={viewerPj} onClose={() => setViewerPj(null)} />
      )}

      {detailsId && <MessageDetailsModal messageId={detailsId} onClose={() => setDetailsId(null)} />}
      {delTarget && (
        <DeleteChoiceDialog
          message={delTarget}
          onClose={() => setDelTarget(null)}
          onForMe={() => deleteForMe(delTarget.id)}
          onForEveryone={() => deleteForEveryone(delTarget.id)}
        />
      )}

      {multiDel && (
        <div onClick={() => setMultiDel(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 350, background: 'var(--fond-surface)', borderRadius: 14, border: '1px solid var(--bordure-legere)', boxShadow: '0 20px 50px rgba(0,0,0,0.25)', padding: 18 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--texte-primaire)' }}>{t('messagerie.deleteForEveryoneTitle')}</p>
            <p style={{ margin: '8px 0 16px', fontSize: 13, color: 'var(--texte-secondaire)', lineHeight: 1.5 }}>
              {t('messagerie.multiDeleteBody', { count: selectedIds.size })}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setMultiDel(false)} style={{ fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 9999, background: 'var(--fond-surface-2)', border: '1px solid var(--bordure-normale)', color: 'var(--texte-secondaire)', cursor: 'pointer' }}>{t('messagerie.cancel')}</button>
              <button onClick={multiDeleteForEveryone} style={{ fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 9999, background: 'var(--erreur-accent)', border: 'none', color: '#fff', cursor: 'pointer' }}>{t('messagerie.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const composerBtn: React.CSSProperties = { width: 36, height: 38, flexShrink: 0, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'var(--texte-secondaire)', cursor: 'pointer' }
const popoverBox: React.CSSProperties = { padding: 0, background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.14)', width: 312, maxWidth: 'calc(100vw - 24px)' }

function AttachRow({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 7, fontSize: 13, color: 'var(--texte-secondaire)', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--fond-surface-2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      {icon}{label}
    </button>
  )
}

// ── Liste des bulles ─────────────────────────────────────────────────────────

function MessageList(props: {
  t: TFunction
  messages: MessageItem[]; isGroupe: boolean; lastOwnId: string | null
  editId: string | null; editText: string; setEditText: (v: string) => void
  onStartEdit: (m: MessageItem) => void; onCancelEdit: () => void
  onSaveEdit: () => void; onDelete: (m: MessageItem) => void
  onReply: (m: MessageItem) => void; onCopy: (m: MessageItem) => void; onQuoteClick: (id: string) => void
  onReact: (m: MessageItem, emoji: string) => void; onDetails: (m: MessageItem) => void
  onOpenMedia: (pj: PieceJointeMeta) => void
  selectMode: boolean; selectedIds: Set<string>; onToggleSelect: (id: string) => void; onEnterSelect: (id: string) => void
}) {
  const { t, messages, lastOwnId } = props
  // Regroupement par jour → sections avec en-tête de date STICKY (façon WhatsApp).
  const sections: { day: string; label: string; items: MessageItem[] }[] = []
  for (const m of messages) {
    const day = new Date(m.createdAt).toDateString()
    const last = sections[sections.length - 1]
    if (last && last.day === day) last.items.push(m)
    else sections.push({ day, label: formatDayLabel(m.createdAt, t), items: [m] })
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {sections.map(sec => (
        <div key={sec.day} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'sticky', top: 4, zIndex: 3, textAlign: 'center', margin: '6px 0 10px', pointerEvents: 'none' }}>
            <span style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 600, color: 'var(--texte-secondaire)', background: 'color-mix(in srgb, var(--fond-surface) 92%, transparent)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', padding: '4px 12px', borderRadius: 9999, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              {sec.label}
            </span>
          </div>
          {sec.items.map((m, idx) => {
            const prev = sec.items[idx - 1]
            const grouped = !!prev && prev.expediteurId === m.expediteurId && prev.deMoi === m.deMoi &&
              (new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 4 * 60 * 1000)
            return (
              <div key={m.id} id={`msg-${m.id}`} style={{ marginTop: idx === 0 ? 0 : grouped ? 2 : 10, borderRadius: 6 }}>
                <Bubble m={m} grouped={grouped} isLastOwn={m.id === lastOwnId} {...props} />
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** Album média façon WhatsApp : 1 = naturel ; 2/4 = grille 2 col ; 3 = 3 col ; >4 = 4 + « +N ». */
function MediaGrid({ items, onOpen }: { items: PieceJointeMeta[]; onOpen: (pj: PieceJointeMeta) => void }) {
  const n = items.length
  if (n === 1) return <MediaThumb pj={items[0]} onOpen={onOpen} single />
  const cols = n === 3 ? 3 : 2
  const shown = items.slice(0, 4)
  const extra = n - 4
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 2, width: '100%', maxWidth: 300 }}>
      {shown.map((pj, i) => (
        <MediaThumb key={pj.id} pj={pj} onOpen={onOpen} overlay={i === 3 && extra > 0 ? extra : 0} />
      ))}
    </div>
  )
}

function Bubble({
  t, m, isGroupe, grouped, isLastOwn, editId, editText, setEditText,
  onStartEdit, onCancelEdit, onSaveEdit, onDelete, onReply, onCopy, onQuoteClick, onReact, onDetails, onOpenMedia,
  selectMode, selectedIds, onToggleSelect, onEnterSelect,
}: {
  t: TFunction
  m: MessageItem; isGroupe: boolean; grouped: boolean; isLastOwn: boolean
  editId: string | null; editText: string; setEditText: (v: string) => void
  onStartEdit: (m: MessageItem) => void; onCancelEdit: () => void; onSaveEdit: () => void
  onDelete: (m: MessageItem) => void; onReply: (m: MessageItem) => void; onCopy: (m: MessageItem) => void
  onQuoteClick: (id: string) => void; onReact: (m: MessageItem, emoji: string) => void; onDetails: (m: MessageItem) => void
  onOpenMedia: (pj: PieceJointeMeta) => void
  selectMode: boolean; selectedIds: Set<string>; onToggleSelect: (id: string) => void; onEnterSelect: (id: string) => void
}) {
  const [hover, setHover] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const mine = m.deMoi
  const isEditing = editId === m.id
  const canEdit = mine && !m.pending && !!m.contenu && withinWindow(m.createdAt)
  const giant = !isEditing && isEmojiOnly(m.contenu) && m.piecesJointes.length === 0 && !m.replyTo
  const isSel = selectedIds.has(m.id)

  return (
    <div
      onClick={selectMode && !m.pending ? () => onToggleSelect(m.id) : undefined}
      style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'center', cursor: selectMode && !m.pending ? 'pointer' : undefined, background: isSel ? 'color-mix(in srgb, var(--ap-400) 14%, transparent)' : undefined, borderRadius: 8, padding: selectMode ? '2px 6px' : undefined }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {selectMode && !m.pending && (
        <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 9999, border: `2px solid ${isSel ? 'var(--ap-400)' : 'var(--bordure-normale)'}`, background: isSel ? 'var(--ap-400)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', order: mine ? 2 : 0 }}>
          {isSel && <Check size={13} />}
        </span>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', maxWidth: '74%', gap: 3, position: 'relative', pointerEvents: selectMode ? 'none' : undefined }}>
        {!mine && isGroupe && !grouped && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ap-600)', paddingLeft: 4 }}>{m.expediteur}</span>}

        {/* Corps du message : emoji géant, OU une SEULE bulle façon WhatsApp
            (réponse citée + album média + cartes audio/doc + légende texte). */}
        {giant ? (
          <div style={{ position: 'relative', display: 'flex', gap: 2, padding: '2px 6px' }}>
            {splitGraphemes(m.contenu).map((g, i) => <Twemoji key={i} emoji={g} size={46} />)}
            <ChevronMenu {...{ t, m, mine, hover, menuOpen, setMenuOpen, canEdit, onStartEdit, onCopy, onReply, onDelete, onReact, onDetails, onEnterSelect }} giant />
          </div>
        ) : (() => {
          const isVisual = (pj: PieceJointeMeta) => pj.mimeType.startsWith('image/') || pj.mimeType.startsWith('video/')
          const visuals = m.piecesJointes.filter(isVisual)
          const others = m.piecesJointes.filter(pj => !isVisual(pj))
          const hasMedia = m.piecesJointes.length > 0
          const hasText = !!m.contenu
          if (!hasMedia && !hasText && !isEditing && !m.replyTo) return null
          return (
            <div style={{
              position: 'relative', borderRadius: 12, overflow: 'hidden',
              borderBottomRightRadius: mine && !grouped ? 3 : 12, borderBottomLeftRadius: !mine && !grouped ? 3 : 12,
              background: mine ? 'var(--ap-400)' : 'var(--fond-surface)', color: mine ? '#fff' : 'var(--texte-primaire)',
              border: mine ? 'none' : '1px solid var(--bordure-legere)', opacity: m.pending ? 0.75 : 1,
              boxShadow: mine ? 'none' : '0 1px 1px rgba(0,0,0,0.04)', maxWidth: hasMedia ? 320 : undefined,
            }}>
              {/* Réponse citée */}
              {m.replyTo && (
                <div onClick={() => onQuoteClick(m.replyTo!.id)} title={t('messagerie.goToMessage')}
                  style={{ display: 'flex', gap: 8, margin: hasMedia ? '6px 6px 0' : '7px 8px 0', padding: '5px 8px', borderRadius: 6, cursor: 'pointer', background: mine ? 'rgba(255,255,255,0.16)' : 'var(--fond-surface-2)' }}>
                  <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: mine ? 'rgba(255,255,255,0.6)' : 'var(--ap-400)', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: mine ? 'rgba(255,255,255,0.9)' : 'var(--ap-700)' }}>{m.replyTo.deMoi ? t('messagerie.you') : m.replyTo.auteur}</p>
                    <p style={{ margin: 0, fontSize: 11, opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{m.replyTo.apercu}</p>
                  </div>
                </div>
              )}

              {/* Album média (collé aux bords) — ou cartes « envoi… » si optimiste */}
              {m.pending && hasMedia ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8 }}>
                  {m.piecesJointes.map(pj => <PieceJointe key={pj.id} pj={pj} mine={mine} pending onOpen={onOpenMedia} />)}
                </div>
              ) : visuals.length > 0 && <MediaGrid items={visuals} onOpen={onOpenMedia} />}

              {/* Pièces non visuelles (audio / document) */}
              {!m.pending && others.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8 }}>
                  {others.map(pj => <PieceJointe key={pj.id} pj={pj} mine={mine} onOpen={onOpenMedia} />)}
                </div>
              )}

              {/* Légende / texte / éditeur — DANS la même bulle */}
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px' }}>
                  <textarea value={editText} onChange={e => setEditText(e.target.value)} autoFocus rows={2}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSaveEdit() } if (e.key === 'Escape') onCancelEdit() }}
                    style={{ resize: 'vertical', minWidth: 220, padding: 6, borderRadius: 6, border: '1px solid var(--bordure-normale)', fontSize: 13, fontFamily: 'inherit', color: 'var(--texte-primaire)', background: '#fff' }} />
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button onClick={onCancelEdit} title={t('messagerie.cancel')} style={iconBtn('var(--texte-tertiaire)')}><X size={14} /></button>
                    <button onClick={onSaveEdit} title={t('messagerie.save')} style={iconBtn('var(--succes-accent)')}><Check size={14} /></button>
                  </div>
                </div>
              ) : hasText ? (
                <div style={{ padding: hasMedia ? '5px 10px 7px' : '8px 12px', fontSize: 13, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{renderRich(m.contenu)}</div>
              ) : null}

              {!isEditing && <ChevronMenu {...{ t, m, mine, hover, menuOpen, setMenuOpen, canEdit, onStartEdit, onCopy, onReply, onDelete, onReact, onDetails, onEnterSelect }} />}
            </div>
          )
        })()}

        {/* Réactions */}
        {m.reactions.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 1 }}>
            {m.reactions.map(r => (
              <button key={r.emoji} onClick={() => onReact(m, r.emoji)} title={r.mine ? t('messagerie.removeReaction') : t('messagerie.react')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 22, padding: '0 7px', borderRadius: 9999, fontSize: 12, cursor: 'pointer', background: r.mine ? 'var(--ap-50)' : 'var(--fond-surface-2)', border: `1px solid ${r.mine ? 'var(--ap-200)' : 'var(--bordure-legere)'}`, color: 'var(--texte-secondaire)' }}>
                <Twemoji emoji={r.emoji} size={15} /><span style={{ fontSize: 10, fontWeight: 600 }}>{r.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Méta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 15, paddingInline: 2 }}>
          <span style={{ fontSize: 10, color: 'var(--texte-tertiaire)' }}>{m.pending ? t('messagerie.sending') : formatHour(m.createdAt)}</span>
          {m.edite && <span style={{ fontSize: 10, color: 'var(--texte-tertiaire)', fontStyle: 'italic' }}>{t('messagerie.edited')}</span>}
          {mine && m.pending && <Clock size={11} style={{ color: 'var(--texte-tertiaire)' }} />}
          {mine && !m.pending && (
            m.vu
              ? <CheckCheck size={14} style={{ color: 'var(--ap-600)' }} />
              : m.remis
                ? <CheckCheck size={14} style={{ color: 'var(--texte-tertiaire)' }} />
                : <Check size={14} style={{ color: 'var(--texte-tertiaire)' }} />
          )}
        </div>

        {mine && isLastOwn && !m.pending && (
          <span style={{ fontSize: 10, color: m.vu ? 'var(--ap-600)' : 'var(--texte-tertiaire)', paddingInline: 2 }}>
            {isGroupe
              ? (m.luPar > 0 ? t('messagerie.readBy', { count: m.luPar }) : m.remisPar > 0 ? t('messagerie.deliveredTo', { count: m.remisPar }) : t('messagerie.sent'))
              : (m.vu ? (m.vuAt ? t('messagerie.readAt', { heure: formatHour(m.vuAt) }) : t('messagerie.read')) : m.remis ? t('messagerie.delivered') : t('messagerie.sent'))}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Chevron-bas (coin de la bulle) + menu réactions/actions ──────────────────

function ChevronMenu({
  t, m, mine, hover, menuOpen, setMenuOpen, canEdit, giant,
  onStartEdit, onCopy, onReply, onDelete, onReact, onDetails, onEnterSelect,
}: {
  t: TFunction
  m: MessageItem; mine: boolean; hover: boolean; menuOpen: boolean; setMenuOpen: (b: boolean) => void
  canEdit: boolean; giant?: boolean
  onStartEdit: (m: MessageItem) => void; onCopy: (m: MessageItem) => void; onReply: (m: MessageItem) => void
  onDelete: (m: MessageItem) => void; onReact: (m: MessageItem, emoji: string) => void; onDetails: (m: MessageItem) => void
  onEnterSelect: (id: string) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [custom, setCustom] = useState<string[]>(getCustomReactions)
  if (m.pending) return null
  const visible = hover || menuOpen
  const onColor = mine && !giant
  const reactList = [...QUICK_REACTIONS, ...custom]
  const reacted = (e: string) => m.reactions.some(r => r.emoji === e && r.mine)
  function pickCustom(emoji: string) { onReact(m, emoji); setCustom(addCustomReaction(emoji)); setPickerOpen(false); setMenuOpen(false) }
  return (
    <div style={{ position: 'absolute', top: giant ? -2 : 2, right: giant ? -2 : 4, opacity: visible ? 1 : 0, transition: 'opacity 0.12s', pointerEvents: visible ? 'auto' : 'none' }}>
      <Popover open={menuOpen} onOpenChange={o => { setMenuOpen(o); if (!o) setPickerOpen(false) }}>
        <PopoverTrigger asChild>
          <button title={t('messagerie.actions')} style={{
            width: 22, height: 18, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            background: onColor ? 'rgba(255,255,255,0.18)' : 'var(--fond-surface-2)',
            border: 'none', color: onColor ? 'rgba(255,255,255,0.95)' : 'var(--texte-secondaire)',
          }}>
            <ChevronDown size={14} />
          </button>
        </PopoverTrigger>
        <PopoverContent align={mine ? 'end' : 'start'} sideOffset={4} style={{ width: pickerOpen ? 'auto' : 248, padding: 0, background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.16)', overflow: 'hidden' }}>
          {pickerOpen ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 8px', borderBottom: '1px solid var(--bordure-legere)' }}>
                <button onClick={() => setPickerOpen(false)} title={t('messagerie.back')} style={{ ...iconBtn('var(--texte-secondaire)'), padding: 4 }}><ChevronLeft size={16} /></button>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--texte-primaire)' }}>{t('messagerie.addReaction')}</span>
              </div>
              <EmojiPicker onPick={pickCustom} />
            </div>
          ) : (
            <>
              {/* Réactions rapides (défauts + perso + « + ») */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: 6, borderBottom: '1px solid var(--bordure-legere)' }}>
                {reactList.map(e => (
                  <button key={e} onClick={() => { onReact(m, e); setMenuOpen(false) }} title={t('messagerie.reactWith', { emoji: e })}
                    style={{ width: 30, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, cursor: 'pointer', background: reacted(e) ? 'var(--ap-50)' : 'transparent', border: 'none', transition: 'transform .08s' }}
                    onMouseEnter={ev => { ev.currentTarget.style.background = 'var(--fond-surface-2)'; ev.currentTarget.style.transform = 'scale(1.15)' }}
                    onMouseLeave={ev => { ev.currentTarget.style.background = reacted(e) ? 'var(--ap-50)' : 'transparent'; ev.currentTarget.style.transform = 'scale(1)' }}>
                    <Twemoji emoji={e} size={22} />
                  </button>
                ))}
                <button onClick={() => setPickerOpen(true)} title={t('messagerie.addEmoji')}
                  style={{ width: 30, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, cursor: 'pointer', background: 'var(--fond-surface-2)', color: 'var(--texte-secondaire)', border: 'none' }}
                  onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--ap-50)')}
                  onMouseLeave={ev => (ev.currentTarget.style.background = 'var(--fond-surface-2)')}>
                  <Plus size={17} />
                </button>
              </div>
              {/* Actions */}
              <div style={{ padding: 4 }}>
                <MenuRow icon={<Reply size={14} />} label={t('messagerie.reply')} onClick={() => { onReply(m); setMenuOpen(false) }} />
                {!!m.contenu && <MenuRow icon={<Copy size={14} />} label={t('messagerie.copy')} onClick={() => { onCopy(m); setMenuOpen(false) }} />}
                <MenuRow icon={<Info size={14} />} label={t('messagerie.details')} onClick={() => { onDetails(m); setMenuOpen(false) }} />
                <MenuRow icon={<ListChecks size={14} />} label={t('messagerie.select')} onClick={() => { setMenuOpen(false); onEnterSelect(m.id) }} />
                {canEdit && <MenuRow icon={<Pencil size={14} />} label={t('messagerie.edit')} onClick={() => { onStartEdit(m); setMenuOpen(false) }} />}
                <MenuRow icon={<Trash2 size={14} />} label={t('messagerie.delete')} tone="danger" onClick={() => { setMenuOpen(false); onDelete(m) }} />
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

function MenuRow({ icon, label, onClick, tone }: { icon: React.ReactNode; label: string; onClick: () => void; tone?: 'danger' }) {
  const color = tone === 'danger' ? 'var(--erreur-accent)' : 'var(--texte-secondaire)'
  const hoverBg = tone === 'danger' ? 'var(--erreur-fond)' : 'var(--fond-surface-2)'
  return (
    <button onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, fontSize: 13, color, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      onMouseEnter={e => (e.currentTarget.style.background = hoverBg)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      {icon}{label}
    </button>
  )
}

function iconBtn(color: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, color }
}

// ── Modale « Détails du message » ────────────────────────────────────────────

function fullDateTime(iso: string): string {
  return formatDateTime(iso, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function MessageDetailsModal({ messageId, onClose }: { messageId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const { data, isLoading } = useMessageDetails(messageId, true)
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 380, maxWidth: '94vw', maxHeight: '82vh', overflowY: 'auto', background: 'var(--fond-surface)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.32)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--bordure-legere)', position: 'sticky', top: 0, background: 'var(--fond-surface)' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--texte-primaire)' }}>{t('messagerie.messageDetails')}</span>
          <button onClick={onClose} title={t('messagerie.close')} style={iconBtn('var(--texte-tertiaire)')}><X size={17} /></button>
        </div>
        {isLoading || !data ? (
          <p style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--texte-tertiaire)' }}>{t('messagerie.loading')}</p>
        ) : (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <DetailRow label={t('messagerie.detailSent')} value={fullDateTime(data.createdAt)} />
            {data.edite && data.editedAt && <DetailRow label={t('messagerie.detailEdited')} value={fullDateTime(data.editedAt)} />}
            {data.aPieceJointe && <DetailRow label={t('messagerie.detailAttachment')} value={t('messagerie.yesValue')} />}
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--texte-tertiaire)', margin: '8px 0 2px' }}>
              {data.type === 'GROUPE' ? t('messagerie.recipientsCount', { count: data.destinataires.length }) : t('messagerie.recipient')}
            </p>
            {data.destinataires.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--bordure-legere)' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--texte-primaire)' }}>{d.nom}</p>
                  {d.enLigne && <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--succes-accent)', fontWeight: 600 }}>{t('messagerie.online')}</p>}
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, flexShrink: 0, color: d.lu ? 'var(--ap-600)' : 'var(--texte-tertiaire)' }}>
                  {d.lu
                    ? <><CheckCheck size={14} /> {d.luAt ? t('messagerie.detailReadAt', { heure: formatHour(d.luAt) }) : t('messagerie.detailRead')}</>
                    : d.remis
                      ? <><CheckCheck size={14} /> {t('messagerie.detailDelivered')}</>
                      : <><Check size={14} /> {t('messagerie.detailSentStatus')}</>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
      <span style={{ color: 'var(--texte-tertiaire)' }}>{label}</span>
      <span style={{ fontWeight: 500, color: 'var(--texte-primaire)', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

// ── Dialogue « Supprimer » (pour moi / pour tout le monde) façon WhatsApp ─────

function DeleteChoiceDialog({ message, onClose, onForMe, onForEveryone }: { message: MessageItem; onClose: () => void; onForMe: () => void; onForEveryone: () => void }) {
  const { t } = useTranslation()
  const canForAll = message.deMoi && !message.pending && withinWindow(message.createdAt)
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 340, maxWidth: '92vw', background: 'var(--fond-surface)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.32)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px 8px' }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--texte-primaire)' }}>{t('messagerie.deleteMessageTitle')}</p>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--texte-tertiaire)', lineHeight: 1.4 }}>
            {canForAll
              ? t('messagerie.deleteMessageBodyAll')
              : t('messagerie.deleteMessageBodyMe')}
          </p>
        </div>
        <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {canForAll && <DialogBtn label={t('messagerie.deleteForEveryoneAction')} tone="danger" onClick={onForEveryone} />}
          <DialogBtn label={t('messagerie.deleteForMeAction')} tone="danger" onClick={onForMe} />
          <DialogBtn label={t('messagerie.cancel')} onClick={onClose} />
        </div>
      </div>
    </div>
  )
}

function DialogBtn({ label, onClick, tone }: { label: string; onClick: () => void; tone?: 'danger' }) {
  const color = tone === 'danger' ? 'var(--erreur-accent)' : 'var(--texte-secondaire)'
  return (
    <button onClick={onClick}
      style={{ width: '100%', textAlign: 'center', padding: '11px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, color, background: 'transparent', border: 'none', cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--fond-surface-2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      {label}
    </button>
  )
}
