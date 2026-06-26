/**
 * MessageriePage — messagerie interne chiffrée (style « split panel » de Triage).
 *
 * Gauche : liste des conversations (recherche + non-lus). Droite : fil de la
 * conversation sélectionnée (ou état vide). « Nouveau message » ouvre un popover
 * permettant de démarrer une conversation directe OU de créer un groupe.
 * Temps réel via le flux SSE des notifications (type MESSAGE).
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { MessageSquare, Plus, Search, X, Lock, Send, Users, Check } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Popover, PopoverContent, PopoverTrigger } from '@workspace/ui/components/popover'
import { toast } from '@workspace/ui/components/sonner'
import { Avatar } from '@/components/saris'
import { isOfflineQueued } from '@/lib/api'
import { formatTime } from '@/lib/intl'
import { useIsCompact } from '@/hooks/useMediaQuery'
import { useConversations, useContacts, useStartConversation, useCreateGroup, useLeaveConversation } from '../hooks/useMessagerie'
import { ConversationCard } from '../components/ConversationCard'
import { MessageThread } from '../components/MessageThread'
import { PrivacyCurtain } from '@/components/PrivacyCurtain'
import type { ConversationItem, Contact } from '../api/messagerie.api'

function useClock() {
  const [t, setT] = useState(new Date())
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id) }, [])
  return formatTime(t, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function MessageriePage() {
  const { t } = useTranslation()
  const clock = useClock()
  const [params, setParams] = useSearchParams()
  const { data: conversations = [], isLoading } = useConversations()
  const leaveMut = useLeaveConversation()
  const isCompact = useIsCompact()

  const [selectedId, setSelectedId] = useState<string | null>(params.get('c'))
  const [pendingConv, setPendingConv] = useState<ConversationItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ConversationItem | null>(null)
  const [search, setSearch] = useState('')
  const [newOpen, setNewOpen] = useState(false)

  useEffect(() => {
    const c = params.get('c')
    if (c && c !== selectedId) setSelectedId(c)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  useEffect(() => {
    // Sur mobile, on affiche d'abord la LISTE (un seul panneau) : pas d'auto-sélection.
    if (!selectedId && !isCompact && conversations.length > 0) setSelectedId(conversations[0]!.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations.length])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter(c => c.titre.toLowerCase().includes(q))
  }, [conversations, search])

  const selectedConv: ConversationItem | null =
    conversations.find(c => c.id === selectedId)
    ?? (pendingConv && pendingConv.id === selectedId ? pendingConv : null)

  const totalNonLus = conversations.reduce((s, c) => s + c.nonLus, 0)

  const splitRef = useRef<HTMLDivElement>(null)
  const [listWidth, setListWidth] = useState(360)
  const [isResizing, setIsResizing] = useState(false)
  useEffect(() => {
    if (!isResizing) return
    function onMove(e: MouseEvent) {
      if (!splitRef.current) return
      const rect = splitRef.current.getBoundingClientRect()
      setListWidth(Math.max(280, Math.min(560, e.clientX - rect.left)))
    }
    function onUp() { setIsResizing(false) }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'
    return () => {
      document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''; document.body.style.userSelect = ''
    }
  }, [isResizing])

  function handleSelect(id: string) {
    setSelectedId(id)
    if (params.get('c')) { params.delete('c'); setParams(params, { replace: true }) }
  }

  function handleStarted(conv: ConversationItem) {
    setPendingConv(conv); setSelectedId(conv.id); setNewOpen(false)
  }

  function handleLeft() {
    setSelectedId(null); setPendingConv(null)
  }

  async function confirmDeleteConversation() {
    const conv = deleteTarget
    if (!conv) return
    setDeleteTarget(null)
    const isGroupe = conv.type === 'GROUPE'
    try {
      await leaveMut.mutateAsync(conv.id)
      if (selectedId === conv.id) { setSelectedId(null); setPendingConv(null) }
      toast.success(isGroupe ? t('messagerie.groupLeft') : t('messagerie.conversationDeleted'))
    } catch (e) {
      if (!isOfflineQueued(e)) toast.error(t('messagerie.actionImpossible'))
    }
  }

  return (
    <>
      <style>{`
        .msg-resize:hover           { background: var(--ap-50) !important; }
        .msg-resize:hover > div     { background: var(--ap-400) !important; }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

        {/* ── En-tête ───────────────────────────────────────────────────── */}
        <div style={{ padding: 'var(--espace-4) var(--espace-6) 0', flexShrink: 0, borderBottom: '1px solid var(--bordure-legere)', background: 'var(--fond-surface)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--ap-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <MessageSquare size={16} style={{ color: 'var(--ap-600)' }} />
              </div>
              <div>
                <h1 style={{ fontSize: 'var(--font-size-h2)', fontWeight: 600, color: 'var(--texte-primaire)', margin: 0 }}>{t('messagerie.pageTitle')}</h1>
                <p style={{ fontSize: 13, color: 'var(--texte-tertiaire)', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: 'monospace' }}>{clock}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Lock size={11} /> {t('messagerie.encrypted')}</span>
                  {totalNonLus > 0 && <span>{t('messagerie.unreadCount', { count: totalNonLus })}</span>}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Popover open={newOpen} onOpenChange={setNewOpen}>
                <PopoverTrigger asChild>
                  <Button size="sm" style={{ background: 'var(--ap-400)', color: '#fff', fontSize: 13, height: 34, gap: 6 }}>
                    <Plus size={14} strokeWidth={2.5} /> {t('messagerie.newMessage')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" sideOffset={6} style={{ width: 340, maxWidth: 'calc(100vw - 24px)', padding: 0, background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.12)' }}>
                  <NewConversationPanel onStarted={handleStarted} />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* ── Corps split panel ─────────────────────────────────────────── */}
        <div ref={splitRef} style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
          {/* Liste — colonne fixe (bureau) / pleine largeur cachée si un fil est ouvert (compact) */}
          {(!isCompact || !selectedConv) && (
          <div style={{ width: isCompact ? '100%' : `${listWidth}px`, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--fond-surface)' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--bordure-legere)', flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--texte-tertiaire)', pointerEvents: 'none' }} />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('messagerie.searchConversation')}
                  style={{ paddingLeft: 32, paddingRight: search ? 32 : 12, height: 32, fontSize: 12, background: 'var(--fond-surface)', border: '1px solid var(--bordure-normale)', borderRadius: 6 }} />
                {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texte-tertiaire)', display: 'flex', padding: 2 }}><X size={12} /></button>}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {isLoading ? (
                <p style={{ textAlign: 'center', color: 'var(--texte-tertiaire)', fontSize: 12, marginTop: 24 }}>{t('messagerie.loading')}</p>
              ) : filtered.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <MessageSquare size={30} style={{ margin: '0 auto 12px', color: 'var(--texte-tertiaire)', opacity: 0.3, display: 'block' }} />
                  <p style={{ fontSize: 13, color: 'var(--texte-secondaire)', margin: '0 0 4px' }}>{t('messagerie.noConversation')}</p>
                  <p style={{ fontSize: 11, color: 'var(--texte-tertiaire)', margin: 0 }}>{search ? t('messagerie.tryAnotherName') : t('messagerie.startWithNew')}</p>
                </div>
              ) : (
                filtered.map(c => <ConversationCard key={c.id} conv={c} selected={c.id === selectedId} onClick={() => handleSelect(c.id)} onDelete={setDeleteTarget} />)
              )}
            </div>
          </div>
          )}

          {/* Poignée de redimensionnement — bureau uniquement */}
          {!isCompact && (
          <div onMouseDown={() => setIsResizing(true)} onDoubleClick={() => setListWidth(360)} className="msg-resize" title={t('messagerie.resizeHandle')}
            style={{ width: 5, flexShrink: 0, cursor: 'col-resize', position: 'relative', background: isResizing ? 'var(--ap-50)' : 'transparent', transition: 'background 0.15s' }}>
            <div style={{ position: 'absolute', left: 2, top: 0, bottom: 0, width: 1, background: isResizing ? 'var(--ap-400)' : 'var(--bordure-legere)' }} />
          </div>
          )}

          {/* Fil / état vide — pleine largeur (compact, si un fil est ouvert) */}
          {(!isCompact || selectedConv) && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--fond-page)' }}>
            {selectedConv
              ? <PrivacyCurtain><MessageThread key={selectedConv.id} conv={selectedConv} onLeft={handleLeft} onBack={isCompact ? () => { setSelectedId(null); setPendingConv(null) } : undefined} /></PrivacyCurtain>
              : <EmptyThread onNew={() => setNewOpen(true)} />}
          </div>
          )}
        </div>
      </div>

      {deleteTarget && createPortal(
        <div onClick={() => setDeleteTarget(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
            style={{ width: 380, maxWidth: '100%', background: 'var(--fond-surface)', borderRadius: 14, border: '1px solid var(--bordure-legere)', boxShadow: '0 24px 60px rgba(15,23,42,0.28)', padding: '20px 22px' }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--texte-primaire)' }}>
              {deleteTarget.type === 'GROUPE' ? t('messagerie.leaveGroupTitle') : t('messagerie.deleteConversationTitle')}
            </p>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--texte-secondaire)', lineHeight: 1.5 }}>
              {deleteTarget.type === 'GROUPE' ? t('messagerie.confirmLeaveGroup', { titre: deleteTarget.titre }) : t('messagerie.confirmDeleteConversation', { titre: deleteTarget.titre })}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button onClick={() => setDeleteTarget(null)}
                style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 9999, background: 'var(--fond-surface-2)', color: 'var(--texte-secondaire)', border: '1px solid var(--bordure-normale)', cursor: 'pointer' }}>
                {t('messagerie.cancel')}
              </button>
              <button onClick={confirmDeleteConversation}
                style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 9999, background: 'var(--erreur-accent)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                {deleteTarget.type === 'GROUPE' ? t('messagerie.leaveGroup') : t('messagerie.delete')}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

// ── Panneau « Nouveau message » : direct ou groupe ──────────────────────────

function NewConversationPanel({ onStarted }: { onStarted: (conv: ConversationItem) => void }) {
  const { t } = useTranslation()
  const { data: contacts = [], isLoading } = useContacts()
  const startMut  = useStartConversation()
  const groupMut  = useCreateGroup()
  const [mode, setMode] = useState<'direct' | 'groupe'>('direct')
  const [q, setQ] = useState('')
  const [titre, setTitre] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return contacts
    return contacts.filter(c => c.nom.toLowerCase().includes(s) || c.login.toLowerCase().includes(s))
  }, [contacts, q])

  async function pickDirect(c: Contact) {
    try {
      const res = await startMut.mutateAsync(c.id)
      onStarted({
        id: res.id, type: 'DIRECT', titre: c.nom,
        interlocuteur: { id: c.id, nom: c.nom, role: c.role },
        participants: [c.nom], nbParticipants: 2,
        dernierMessage: null, nonLus: 0, updatedAt: new Date().toISOString(),
      })
    } catch (e) { if (!isOfflineQueued(e)) toast.error(t('messagerie.startConversationError')) }
  }

  function toggle(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function createGroup() {
    const ids = [...selected]
    if (!titre.trim() || ids.length < 1) return
    try {
      const res = await groupMut.mutateAsync({ titre: titre.trim(), participantIds: ids })
      const noms = contacts.filter(c => selected.has(c.id)).map(c => c.nom)
      onStarted({
        id: res.id, type: 'GROUPE', titre: titre.trim(), interlocuteur: null,
        participants: noms, nbParticipants: ids.length + 1,
        dernierMessage: null, nonLus: 0, updatedAt: new Date().toISOString(),
      })
    } catch (e) { if (!isOfflineQueued(e)) toast.error(t('messagerie.createGroupError')) }
  }

  return (
    <div>
      {/* En-tête + bascule mode */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--bordure-legere)', background: 'var(--fond-surface-2)' }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {([{ k: 'direct', label: t('messagerie.directMessage'), icon: Send }, { k: 'groupe', label: t('messagerie.group'), icon: Users }] as const).map(opt => {
            const active = mode === opt.k
            return (
              <button key={opt.k} onClick={() => setMode(opt.k)}
                style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, height: 30, borderRadius: 6, fontSize: 12, fontWeight: active ? 600 : 500, cursor: 'pointer', background: active ? 'var(--ap-50)' : 'var(--fond-surface)', color: active ? 'var(--ap-700)' : 'var(--texte-secondaire)', border: `1px solid ${active ? 'var(--ap-200)' : 'var(--bordure-normale)'}` }}>
                <opt.icon size={12} /> {opt.label}
              </button>
            )
          })}
        </div>
        {mode === 'groupe' && (
          <Input value={titre} onChange={e => setTitre(e.target.value)} placeholder={t('messagerie.groupNamePlaceholder')} maxLength={120}
            style={{ height: 32, fontSize: 12, marginBottom: 8, background: 'var(--fond-surface)', border: '1px solid var(--bordure-normale)', borderRadius: 6 }} />
        )}
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--texte-tertiaire)' }} />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder={t('messagerie.searchAgent')} autoFocus
            style={{ paddingLeft: 32, height: 32, fontSize: 12, background: 'var(--fond-surface)', border: '1px solid var(--bordure-normale)', borderRadius: 6 }} />
        </div>
      </div>

      {/* Liste des contacts */}
      <div style={{ maxHeight: 260, overflowY: 'auto' }}>
        {isLoading ? (
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--texte-tertiaire)', padding: 16 }}>{t('messagerie.loading')}</p>
        ) : filtered.length === 0 ? (
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--texte-tertiaire)', padding: 16 }}>{t('messagerie.noAgent')}</p>
        ) : (
          filtered.map(c => {
            const checked = selected.has(c.id)
            return (
              <button key={c.id} onClick={() => mode === 'direct' ? pickDirect(c) : toggle(c.id)} disabled={startMut.isPending}
                style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: checked ? 'var(--ap-50)' : 'transparent', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--bordure-legere)' }}
                onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'var(--fond-surface-2)' }}
                onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent' }}>
                <Avatar nom={c.nom} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--texte-primaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nom}</p>
                  {c.role && <p style={{ margin: 0, fontSize: 11, color: 'var(--texte-tertiaire)' }}>{c.role}</p>}
                </div>
                {mode === 'direct'
                  ? <Send size={13} style={{ color: 'var(--texte-tertiaire)', flexShrink: 0 }} />
                  : <span style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: checked ? 'var(--ap-400)' : 'transparent', border: `1px solid ${checked ? 'var(--ap-400)' : 'var(--bordure-normale)'}` }}>{checked && <Check size={12} style={{ color: '#fff' }} />}</span>}
              </button>
            )
          })
        )}
      </div>

      {/* Pied : créer le groupe */}
      {mode === 'groupe' && (
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--bordure-legere)', background: 'var(--fond-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--texte-tertiaire)' }}>{t('messagerie.selectedCount', { count: selected.size })}</span>
          <Button size="sm" onClick={createGroup} disabled={!titre.trim() || selected.size < 1 || groupMut.isPending}
            style={{ background: 'var(--ap-400)', color: '#fff', fontSize: 12, height: 30, gap: 5 }}>
            <Users size={13} /> {t('messagerie.createGroup')}
          </Button>
        </div>
      )}
    </div>
  )
}

// ── État vide ────────────────────────────────────────────────────────────────

function EmptyThread({ onNew }: { onNew: () => void }) {
  const { t } = useTranslation()
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 32 }}>
      <div style={{ width: 56, height: 56, borderRadius: 10, background: 'var(--ap-50)', border: '1px solid var(--bordure-legere)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <MessageSquare size={24} style={{ color: 'var(--ap-600)' }} />
      </div>
      <p style={{ fontSize: 13, color: 'var(--texte-secondaire)', textAlign: 'center', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{t('messagerie.emptySelectOrStart')}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--texte-tertiaire)' }}><Lock size={12} /> {t('messagerie.emptyEncryptedNote')}</div>
      <Button size="sm" onClick={onNew} style={{ background: 'var(--ap-400)', color: '#fff', fontSize: 13, height: 34, gap: 6 }}><Plus size={14} strokeWidth={2.5} /> {t('messagerie.newMessage')}</Button>
    </div>
  )
}
