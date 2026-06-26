/**
 * NotificationDrawer — panneau latéral droit (460px) listant les notifications.
 * Clic = marquée lue + navigation. Suppression « pour moi » : au survol (corbeille),
 * en multi-sélection, ou tout supprimer. Temps réel via SSE (cloche + feed).
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Bell, X, CheckCheck, Info, CheckCircle2, AlertTriangle, Siren, ChevronRight,
  Trash2, ListChecks, Check, Megaphone,
} from 'lucide-react'
import i18n from '@/i18n/config'
import { toast } from '@workspace/ui/components/sonner'
import { IconButton, EmptyState, Modal, Button, TextInput, SelectBox, Textarea, Field } from '@/components/saris'
import {
  useNotificationsFeed, useMarkAllRead, useMarkNotificationRead,
  useDismissNotification, useDismissManyNotifications, useDismissAllNotifications,
  useCreateAnnonce,
} from '@/modules/notifications/hooks/useNotifications'
import { usePermissions } from '@/hooks/usePermissions'
import { playSound } from '@/lib/sounds'
import type { NotificationItem, NiveauNotif } from '@/modules/notifications/api/notifications.api'

const NIVEAU: Record<NiveauNotif, { icon: typeof Info; tint: string; bg: string }> = {
  INFO:          { icon: Info,         tint: 'var(--info-texte)',   bg: 'var(--info-fond)'   },
  SUCCES:        { icon: CheckCircle2, tint: 'var(--succes-texte)', bg: 'var(--succes-fond)' },
  AVERTISSEMENT: { icon: AlertTriangle,tint: 'var(--avert-texte)',  bg: 'var(--avert-fond)'  },
  CRITIQUE:      { icon: Siren,        tint: 'var(--erreur-texte)', bg: 'var(--erreur-fond)' },
}

function tempsRelatif(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1)  return i18n.t('shell.timeNow')
  if (min < 60) return i18n.t('shell.timeMinutes', { count: min })
  const h = Math.floor(min / 60)
  if (h < 24)   return i18n.t('shell.timeHours', { count: h })
  const j = Math.floor(h / 24)
  if (j < 7)    return i18n.t('shell.timeDays', { count: j })
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'
  return new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
}

export function NotificationDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: items = [], isLoading } = useNotificationsFeed(open)
  const markAll   = useMarkAllRead()
  const markRead  = useMarkNotificationRead()
  const dismissOne  = useDismissNotification()
  const dismissMany = useDismissManyNotifications()
  const dismissAll  = useDismissAllNotifications()

  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const { has } = usePermissions()
  const canAnnonce = has('notification.create')
  const [annonceOpen, setAnnonceOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])

  // Réinitialise la sélection à la fermeture.
  useEffect(() => { if (!open) { setSelecting(false); setSelected(new Set()) } }, [open])

  if (!open) return null

  const nbNonLus = items.filter(n => !n.lu).length

  function clearSel() { setSelected(new Set()); setSelecting(false) }
  function toggleSel(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function deleteSelected() {
    if (selected.size) { dismissMany.mutate([...selected]); playSound('tap') }
    clearSel()
  }
  function deleteOne(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    dismissOne.mutate(id); playSound('tap')
  }
  function handleClick(n: NotificationItem) {
    if (selecting) { toggleSel(n.id); return }
    if (!n.lu) markRead.mutate(n.id)
    if (n.lien) { navigate(n.lien); onClose() }
  }

  const allSelected = items.length > 0 && selected.size === items.length

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.40)', backdropFilter: 'blur(3px)' }} />
      <aside role="dialog" aria-modal="true" aria-label={t('shell.notificationsAria')} className="saris-grain"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 1001,
          width: 460, maxWidth: 'calc(100vw - 24px)',
          backgroundColor: 'var(--fond-surface)', borderLeft: '1px solid var(--bordure-legere)',
          boxShadow: '-12px 0 40px rgba(15,23,42,0.18)', display: 'flex', flexDirection: 'column',
          animation: 'notif-slide-in 0.18s ease-out',
        }}>
        <style>{`@keyframes notif-slide-in { from { transform: translateX(24px); opacity: 0.4 } to { transform: translateX(0); opacity: 1 } }`}</style>

        {/* En-tête */}
        <div style={{ flexShrink: 0, padding: '14px 16px', borderBottom: '1px solid var(--bordure-legere)', display: 'flex', alignItems: 'center', gap: 10, background: 'color-mix(in srgb, var(--fond-surface-2) 80%, transparent)', backdropFilter: 'blur(8px)' }}>
          <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-lg)', flexShrink: 0, background: 'var(--ap-50)', color: 'var(--ap-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bell size={17} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-h4)', fontWeight: 700, color: 'var(--texte-primaire)' }}>{t('shell.notificationsTitle')}</p>
            <p style={{ margin: '1px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
              {selecting ? t('shell.selectedCount', { count: selected.size }) : nbNonLus > 0 ? t('shell.unreadCount', { count: nbNonLus }) : t('shell.allUpToDate')}
            </p>
          </div>
          {canAnnonce && (
            <IconButton aria-label={t('shell.annonceNew')} title={t('shell.annonceNew')} icon={<Megaphone size={15} />} onClick={() => setAnnonceOpen(true)} />
          )}
          <IconButton aria-label={t('shell.close')} icon={<X size={15} />} onClick={onClose} />
        </div>

        {annonceOpen && <AnnonceModal onClose={() => setAnnonceOpen(false)} />}

        {/* Barre d'actions */}
        {items.length > 0 && (
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderBottom: '1px solid var(--bordure-legere)' }}>
            {selecting ? (
              <>
                <Chip onClick={() => setSelected(allSelected ? new Set() : new Set(items.map(n => n.id)))}>
                  {allSelected ? t('shell.selectNone') : t('shell.selectAll')}
                </Chip>
                <span style={{ flex: 1 }} />
                <Chip tone="danger" disabled={selected.size === 0 || dismissMany.isPending} onClick={deleteSelected}>
                  <Trash2 size={13} /> {selected.size ? t('shell.deleteWithCount', { count: selected.size }) : t('shell.delete')}
                </Chip>
                <Chip onClick={clearSel}>{t('shell.cancel')}</Chip>
              </>
            ) : (
              <>
                {nbNonLus > 0 && (
                  <Chip onClick={() => { markAll.mutate(); playSound('success') }} disabled={markAll.isPending}>
                    <CheckCheck size={13} /> {t('shell.markAllRead')}
                  </Chip>
                )}
                <span style={{ flex: 1 }} />
                <Chip onClick={() => setSelecting(true)}><ListChecks size={13} /> {t('shell.select')}</Chip>
                <Chip tone="danger" onClick={() => { dismissAll.mutate(); playSound('tap') }} disabled={dismissAll.isPending}>
                  <Trash2 size={13} /> {t('shell.deleteAll')}
                </Chip>
              </>
            )}
          </div>
        )}

        {/* Liste */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {isLoading && <p style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: 'var(--texte-tertiaire)' }}>{t('shell.loading')}</p>}
          {!isLoading && items.length === 0 && (
            <div style={{ padding: '28px 20px' }}>
              <EmptyState icon={<Bell size={20} />} title={t('shell.emptyTitle')} description={t('shell.emptyDescription')} variant="subtle" />
            </div>
          )}
          {items.map(n => {
            const cfg = NIVEAU[n.niveau] ?? NIVEAU.INFO
            const Icon = cfg.icon
            const isSel = selected.has(n.id)
            const hovered = hoveredId === n.id
            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => handleClick(n)}
                onMouseEnter={() => setHoveredId(n.id)}
                onMouseLeave={() => setHoveredId(h => (h === n.id ? null : h))}
                style={{
                  position: 'relative', width: '100%', textAlign: 'left', display: 'flex', gap: 11, alignItems: 'flex-start',
                  padding: '12px 16px', cursor: selecting ? 'pointer' : n.lien ? 'pointer' : 'default',
                  borderBottom: '1px solid var(--bordure-legere)',
                  background: isSel ? 'var(--ap-100)' : n.lu ? (hovered ? 'var(--fond-surface-2)' : 'transparent') : (hovered ? 'var(--ap-100)' : 'var(--ap-50)'),
                  borderLeft: `3px solid ${n.lu ? 'transparent' : 'var(--ap-400)'}`,
                  transition: 'background 0.12s',
                }}
              >
                {selecting && (
                  <span style={{ width: 18, height: 18, marginTop: 7, flexShrink: 0, borderRadius: 5, border: `1.5px solid ${isSel ? 'var(--ap-400)' : 'var(--bordure-normale)'}`, background: isSel ? 'var(--ap-400)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                    {isSel && <Check size={12} />}
                  </span>
                )}
                <div style={{ width: 30, height: 30, borderRadius: 'var(--radius-md)', flexShrink: 0, background: cfg.bg, color: cfg.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                  <Icon size={15} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: n.lu ? 600 : 700, color: 'var(--texte-primaire)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.titre}</span>
                    <span style={{ fontSize: 10, color: 'var(--texte-tertiaire)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{tempsRelatif(n.createdAt)}</span>
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--texte-secondaire)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as 'vertical' }}>{n.message}</p>
                </div>
                {/* Corbeille au survol (suppression rapide pour moi) */}
                {!selecting && hovered && (
                  <button onClick={(e) => deleteOne(n.id, e)} title={t('shell.deleteForMe')} aria-label={t('shell.deleteNotificationAria')}
                    style={{ position: 'absolute', top: 8, right: 10, width: 26, height: 26, borderRadius: 7, border: '1px solid var(--bordure-legere)', background: 'var(--fond-surface)', color: 'var(--erreur-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Trash2 size={13} />
                  </button>
                )}
                {!selecting && !hovered && n.lien && <ChevronRight size={15} style={{ color: 'var(--texte-tertiaire)', flexShrink: 0, alignSelf: 'center' }} />}
              </div>
            )
          })}
        </div>
      </aside>
    </>
  )
}

/** Composer une annonce diffusée (admin système). */
function AnnonceModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const create = useCreateAnnonce()
  const [titre, setTitre]     = useState('')
  const [message, setMessage] = useState('')
  const [niveau, setNiveau]   = useState<NiveauNotif>('INFO')
  const [portee, setPortee]   = useState<'SITE' | 'TOUS'>('SITE')
  const valid = titre.trim().length > 0 && message.trim().length > 0

  function submit() {
    if (!valid || create.isPending) return
    create.mutate(
      { titre: titre.trim(), message: message.trim(), niveau, portee },
      {
        onSuccess: () => { toast.success(t('shell.annonceSent')); playSound('success'); onClose() },
        onError:   () => toast.error(t('shell.annonceError')),
      },
    )
  }

  return (
    <Modal
      icon={<Megaphone size={18} />}
      title={t('shell.annonceTitle')}
      subtitle={t('shell.annonceSubtitle')}
      width={480}
      onClose={onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>{t('shell.cancel')}</Button>
          <Button onClick={submit} disabled={!valid || create.isPending} leftIcon={<Megaphone size={14} />}>
            {create.isPending ? t('shell.annonceSending') : t('shell.annonceSend')}
          </Button>
        </>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label={t('shell.annonceFieldTitle')}>
          {id => <TextInput id={id} value={titre} onChange={e => setTitre(e.target.value)} maxLength={120} placeholder={t('shell.annoncePlaceholderTitle')} />}
        </Field>
        <Field label={t('shell.annonceFieldMessage')}>
          {id => <Textarea id={id} value={message} onChange={e => setMessage(e.target.value)} maxLength={1000} rows={4} placeholder={t('shell.annoncePlaceholderMessage')} />}
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label={t('shell.annonceFieldLevel')}>
            {id => (
              <SelectBox id={id} size="md" value={niveau} onChange={v => setNiveau(v as NiveauNotif)}
                options={[
                  { value: 'INFO',          label: t('shell.annonceLevelInfo') },
                  { value: 'SUCCES',        label: t('shell.annonceLevelSucces') },
                  { value: 'AVERTISSEMENT', label: t('shell.annonceLevelAvert') },
                  { value: 'CRITIQUE',      label: t('shell.annonceLevelCritique') },
                ]} />
            )}
          </Field>
          <Field label={t('shell.annonceFieldScope')}>
            {id => (
              <SelectBox id={id} size="md" value={portee} onChange={v => setPortee(v as 'SITE' | 'TOUS')}
                options={[
                  { value: 'SITE', label: t('shell.annonceScopeSite') },
                  { value: 'TOUS', label: t('shell.annonceScopeAll') },
                ]} />
            )}
          </Field>
        </div>
      </div>
    </Modal>
  )
}

function Chip({ children, onClick, disabled, tone }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; tone?: 'danger' }) {
  const danger = tone === 'danger'
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
        color: danger ? 'var(--erreur-accent)' : 'var(--ap-700)',
        background: danger ? 'var(--erreur-fond)' : 'var(--ap-50)',
        border: `1px solid ${danger ? 'var(--erreur-accent)' : 'var(--ap-200)'}`,
        borderRadius: 'var(--radius-md)', padding: '5px 9px', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}>
      {children}
    </button>
  )
}
