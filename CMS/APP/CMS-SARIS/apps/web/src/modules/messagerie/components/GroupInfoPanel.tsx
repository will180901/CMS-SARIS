/**
 * GroupInfoPanel — infos + gestion d'un groupe, façon WhatsApp.
 *
 * Photo/nom/description éditables par les ADMINS uniquement (le créateur est
 * toujours admin implicite) ; liste des membres avec badge Créateur/Admin ;
 * ajout/retrait de membres et promotion/rétrogradation admin ; quitter le groupe.
 */
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  X, Camera, Pencil, Check, Shield, ShieldOff, UserPlus, UserMinus, LogOut, Users,
} from 'lucide-react'
import { toast } from '@workspace/ui/components/sonner'
import { UserAvatar, PhotoCropModal, CheckBox } from '@/components/saris'
import { isDesktop } from '@/lib/desktop'
import { DESKTOP_TITLEBAR_H } from '@/components/layout/DesktopTitleBar'
import {
  useGroupInfo, useUpdateGroup, useUploadGroupPhoto, useRemoveGroupPhoto,
  useAddParticipants, useRemoveParticipant, useSetAdmin, useContacts,
} from '../hooks/useMessagerie'

const PHOTO_MAX_BYTES = 5 * 1024 * 1024
const PHOTO_MIME_RE = /^image\/(jpeg|png|webp|gif)$/

const iconBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: 8, background: 'transparent', border: 'none',
  cursor: 'pointer', color: 'var(--texte-secondaire)', flexShrink: 0,
}

export function GroupInfoPanel({ conversationId, onClose, onRequestLeave }: { conversationId: string; onClose: () => void; onRequestLeave: () => void }) {
  const { t } = useTranslation()
  const { data: info, isLoading } = useGroupInfo(conversationId)
  const updateGroup    = useUpdateGroup(conversationId)
  const uploadPhoto     = useUploadGroupPhoto(conversationId)
  const removePhoto     = useRemoveGroupPhoto(conversationId)
  const removeParticipant = useRemoveParticipant(conversationId)
  const setAdminMut     = useSetAdmin(conversationId)

  const [editingTitre, setEditingTitre] = useState(false)
  const [titreDraft, setTitreDraft]     = useState('')
  const [editingDesc, setEditingDesc]   = useState(false)
  const [descDraft, setDescDraft]       = useState('')
  const [cropSrc, setCropSrc]           = useState<string | null>(null)
  const [addOpen, setAddOpen]           = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const isAdmin = !!info?.monRole.estAdmin

  function startEditTitre() { setTitreDraft(info?.titre ?? ''); setEditingTitre(true) }
  async function saveTitre() {
    const v = titreDraft.trim()
    if (!v) return
    try { await updateGroup.mutateAsync({ titre: v }); setEditingTitre(false) }
    catch { toast.error(t('messagerie.groupUpdateError')) }
  }
  function startEditDesc() { setDescDraft(info?.description ?? ''); setEditingDesc(true) }
  async function saveDesc() {
    try { await updateGroup.mutateAsync({ description: descDraft.trim() }); setEditingDesc(false) }
    catch { toast.error(t('messagerie.groupUpdateError')) }
  }

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!PHOTO_MIME_RE.test(file.type)) { toast.error(t('messagerie.photoInvalidFormat')); return }
    if (file.size > PHOTO_MAX_BYTES) { toast.error(t('messagerie.photoTooLarge')); return }
    setCropSrc(URL.createObjectURL(file))
  }
  function closeCrop() { if (cropSrc) URL.revokeObjectURL(cropSrc); setCropSrc(null) }
  function onCropConfirm(blob: Blob) {
    uploadPhoto.mutate(new File([blob], 'photo.jpg', { type: 'image/jpeg' }), { onSuccess: closeCrop })
  }

  async function toggleAdmin(userId: string, next: boolean) {
    try { await setAdminMut.mutateAsync({ userId, estAdmin: next }) } catch { toast.error(t('messagerie.groupUpdateError')) }
  }
  async function kick(userId: string) {
    if (!window.confirm(t('messagerie.confirmRemoveMember'))) return
    try { await removeParticipant.mutateAsync(userId) } catch { toast.error(t('messagerie.groupUpdateError')) }
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', top: isDesktop ? DESKTOP_TITLEBAR_H : 0, right: 0, bottom: 0, left: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 420, maxWidth: '94vw', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--fond-surface)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.32)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--bordure-legere)', flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--texte-primaire)' }}>{t('messagerie.groupInfo')}</span>
          <button onClick={onClose} title={t('messagerie.close')} style={iconBtn}><X size={17} /></button>
        </div>

        {isLoading || !info ? (
          <p style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--texte-tertiaire)' }}>{t('messagerie.loading')}</p>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Photo + nom + description */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ position: 'relative' }}>
                {info.photoUrl
                  ? <img src={info.photoUrl} alt={info.titre ?? ''} style={{ width: 96, height: 96, borderRadius: 'var(--radius-xl)', objectFit: 'cover', display: 'block' }} />
                  : <div style={{ width: 96, height: 96, borderRadius: 'var(--radius-xl)', background: 'var(--ap-100)', color: 'var(--ap-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={40} /></div>}
                {isAdmin && (
                  <button onClick={() => fileRef.current?.click()} disabled={uploadPhoto.isPending}
                    title={t('messagerie.changeGroupPhoto')}
                    style={{ position: 'absolute', right: -4, bottom: -4, width: 30, height: 30, borderRadius: '50%', background: 'var(--ap-400)', color: '#fff', border: '2px solid var(--fond-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: uploadPhoto.isPending ? 'wait' : 'pointer' }}>
                    <Camera size={14} />
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={onPickPhoto} />
              </div>
              {isAdmin && info.photoUrl && (
                <button onClick={() => removePhoto.mutate()} disabled={removePhoto.isPending}
                  style={{ fontSize: 11, color: 'var(--erreur-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  {t('messagerie.removeGroupPhoto')}
                </button>
              )}

              {editingTitre ? (
                <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                  <input value={titreDraft} onChange={e => setTitreDraft(e.target.value)} maxLength={120} autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') saveTitre(); if (e.key === 'Escape') setEditingTitre(false) }}
                    style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--bordure-normale)', fontSize: 14, fontWeight: 600, color: 'var(--texte-primaire)', background: 'var(--fond-surface)' }} />
                  <button onClick={saveTitre} title={t('messagerie.save')} style={{ ...iconBtn, color: 'var(--succes-accent)' }}><Check size={16} /></button>
                </div>
              ) : (
                <div onClick={isAdmin ? startEditTitre : undefined} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: isAdmin ? 'pointer' : 'default', maxWidth: '100%' }}>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--texte-primaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.titre}</p>
                  {isAdmin && <Pencil size={12} style={{ color: 'var(--texte-tertiaire)', flexShrink: 0 }} />}
                </div>
              )}

              {editingDesc ? (
                <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                  <textarea value={descDraft} onChange={e => setDescDraft(e.target.value)} maxLength={500} rows={2} autoFocus
                    style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--bordure-normale)', fontSize: 12.5, fontFamily: 'inherit', resize: 'vertical', color: 'var(--texte-primaire)', background: 'var(--fond-surface)' }} />
                  <button onClick={saveDesc} title={t('messagerie.save')} style={{ ...iconBtn, color: 'var(--succes-accent)' }}><Check size={16} /></button>
                </div>
              ) : (
                <div onClick={isAdmin ? startEditDesc : undefined} style={{ textAlign: 'center', cursor: isAdmin ? 'pointer' : 'default', maxWidth: '100%' }}>
                  <p style={{ margin: 0, fontSize: 12.5, color: info.description ? 'var(--texte-secondaire)' : 'var(--texte-tertiaire)', fontStyle: info.description ? 'normal' : 'italic' }}>
                    {info.description || (isAdmin ? t('messagerie.addDescription') : '')}
                  </p>
                </div>
              )}
            </div>

            {/* Membres */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--texte-tertiaire)' }}>
                  {t('messagerie.membersCount', { count: info.membres.length })}
                </p>
                {isAdmin && (
                  <button onClick={() => setAddOpen(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--ap-600)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <UserPlus size={13} /> {t('messagerie.addMembers')}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {info.membres.map(mb => (
                  <div key={mb.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
                    <UserAvatar userId={mb.id} nom={mb.nom} size={34} clickable={false} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--texte-primaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mb.nom}</p>
                      <p style={{ margin: 0, fontSize: 11, color: mb.estCreateur || mb.estAdmin ? 'var(--ap-600)' : 'var(--texte-tertiaire)', fontWeight: mb.estCreateur || mb.estAdmin ? 600 : 400 }}>
                        {mb.estCreateur ? t('messagerie.roleCreator') : mb.estAdmin ? t('messagerie.roleAdmin') : (mb.role ?? '')}
                      </p>
                    </div>
                    {isAdmin && !mb.estCreateur && (
                      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                        <button onClick={() => toggleAdmin(mb.id, !mb.estAdmin)} title={mb.estAdmin ? t('messagerie.demoteAdmin') : t('messagerie.promoteAdmin')} style={iconBtn}>
                          {mb.estAdmin ? <ShieldOff size={15} /> : <Shield size={15} />}
                        </button>
                        <button onClick={() => kick(mb.id)} title={t('messagerie.removeMember')} style={{ ...iconBtn, color: 'var(--erreur-accent)' }}>
                          <UserMinus size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button onClick={onRequestLeave}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0 0', color: 'var(--erreur-accent)', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', borderTop: '1px solid var(--bordure-legere)', cursor: 'pointer' }}>
              <LogOut size={15} /> {t('messagerie.leaveGroup')}
            </button>
          </div>
        )}

        {addOpen && <AddMembersModal conversationId={conversationId} existing={info?.membres.map(m => m.id) ?? []} onClose={() => setAddOpen(false)} />}
        {cropSrc && <PhotoCropModal imageSrc={cropSrc} busy={uploadPhoto.isPending} onConfirm={onCropConfirm} onCancel={closeCrop} />}
      </div>
    </div>
  )
}

// ── Ajout de membres ──────────────────────────────────────────────────────────

function AddMembersModal({ conversationId, existing, onClose }: { conversationId: string; existing: string[]; onClose: () => void }) {
  const { t } = useTranslation()
  const { data: contacts = [] } = useContacts(true)
  const addMut = useAddParticipants(conversationId)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const existingSet = new Set(existing)
  const candidates = contacts.filter(c => !existingSet.has(c.id) && (!search.trim() || c.nom.toLowerCase().includes(search.trim().toLowerCase())))

  function toggle(id: string) { setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n }) }
  async function submit() {
    if (!selected.size) return
    try { await addMut.mutateAsync([...selected]); onClose() }
    catch { toast.error(t('messagerie.groupUpdateError')) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', top: isDesktop ? DESKTOP_TITLEBAR_H : 0, right: 0, bottom: 0, left: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 360, maxWidth: '92vw', maxHeight: '76vh', display: 'flex', flexDirection: 'column', background: 'var(--fond-surface)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.32)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--bordure-legere)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--texte-primaire)' }}>{t('messagerie.addMembers')}</span>
          <button onClick={onClose} title={t('messagerie.close')} style={iconBtn}><X size={16} /></button>
        </div>
        <div style={{ padding: '10px 14px', flexShrink: 0 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('messagerie.searchContact')}
            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--bordure-normale)', fontSize: 13, color: 'var(--texte-primaire)', background: 'var(--fond-surface)' }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          {candidates.map(c => (
            <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px', borderRadius: 8, cursor: 'pointer' }}>
              <CheckBox checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
              <UserAvatar userId={c.id} nom={c.nom} size={30} clickable={false} />
              <span style={{ fontSize: 13, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--texte-primaire)' }}>{c.nom}</span>
            </label>
          ))}
          {candidates.length === 0 && <p style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--texte-tertiaire)' }}>{t('messagerie.noContact')}</p>}
        </div>
        <div style={{ padding: 12, borderTop: '1px solid var(--bordure-legere)', flexShrink: 0 }}>
          <button onClick={submit} disabled={!selected.size || addMut.isPending}
            style={{ width: '100%', padding: '9px', borderRadius: 9999, background: 'var(--ap-400)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: selected.size ? 'pointer' : 'not-allowed', opacity: selected.size ? 1 : 0.6 }}>
            {t('messagerie.addSelected', { count: selected.size })}
          </button>
        </div>
      </div>
    </div>
  )
}
