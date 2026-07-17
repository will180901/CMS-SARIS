/**
 * useLeaveGroupFlow — quitter un groupe, avec succession d'administrateur
 * PRINCIPAL obligatoire : si le créateur (admin principal) quitte un groupe qui
 * compte encore d'autres membres, il doit d'abord désigner un administrateur
 * SECONDAIRE existant qui hérite du rôle (jamais un simple membre, jamais
 * automatique) — sinon le groupe se retrouverait sans admin principal.
 *
 * Point d'entrée UNIQUE partagé par les 3 façons de quitter un groupe (liste des
 * conversations, panneau « Infos du groupe », menu ⋮ du fil) : même vérification,
 * même modale, comportement cohérent partout.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LogOut, Users, X } from 'lucide-react'
import { toast } from '@workspace/ui/components/sonner'
import { UserAvatar } from '@/components/saris'
import { isDesktop } from '@/lib/desktop'
import { DESKTOP_TITLEBAR_H } from '@/components/layout/DesktopTitleBar'
import { messagerieApi, type GroupMember } from '../api/messagerie.api'
import { useLeaveConversation } from './useMessagerie'

interface LeaveTarget { id: string; titre: string }

const overlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, right: 0, bottom: 0, left: 0,
  background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 2000, padding: 16,
}

const iconBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: 8, background: 'transparent', border: 'none',
  cursor: 'pointer', color: 'var(--texte-secondaire)', flexShrink: 0,
}

export function useLeaveGroupFlow(onLeft?: (conversationId: string) => void) {
  const { t } = useTranslation()
  const leaveMut = useLeaveConversation()
  const [confirmTarget, setConfirmTarget] = useState<LeaveTarget | null>(null)
  const [picker, setPicker] = useState<{ target: LeaveTarget; candidats: GroupMember[] } | null>(null)

  /** Point d'entrée : vérifie (infos fraîches) si une succession est requise avant de proposer la confirmation. */
  async function requestLeave(target: LeaveTarget) {
    let info
    try { info = await messagerieApi.groupInfo(target.id) }
    catch { toast.error(t('messagerie.groupUpdateError')); return }

    if (!info.monRole.estCreateur || info.membres.length <= 1) {
      setConfirmTarget(target)
      return
    }
    const candidats = info.membres.filter(m => m.estAdmin && !m.estCreateur)
    if (!candidats.length) {
      toast.error(t('messagerie.noSecondaryAdminToInherit'))
      return
    }
    setPicker({ target, candidats })
  }

  async function confirmPlainLeave() {
    if (!confirmTarget) return
    const { id } = confirmTarget
    setConfirmTarget(null)
    try {
      await leaveMut.mutateAsync({ conversationId: id })
      toast.success(t('messagerie.groupLeft'))
      onLeft?.(id)
    } catch { toast.error(t('messagerie.leaveError')) }
  }

  async function confirmSuccessor(newPrincipalId: string) {
    if (!picker) return
    const { id } = picker.target
    try {
      await leaveMut.mutateAsync({ conversationId: id, newPrincipalId })
      setPicker(null)
      toast.success(t('messagerie.groupLeft'))
      onLeft?.(id)
    } catch { toast.error(t('messagerie.leaveError')) }
  }

  const modal = (
    <>
      {confirmTarget && (
        <div onClick={() => setConfirmTarget(null)} style={{ ...overlayStyle, top: isDesktop ? DESKTOP_TITLEBAR_H : 0 }}>
          <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
            style={{ width: 380, maxWidth: '100%', background: 'var(--fond-surface)', borderRadius: 14, border: '1px solid var(--bordure-legere)', boxShadow: '0 24px 60px rgba(15,23,42,0.28)', padding: '20px 22px' }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--texte-primaire)' }}>{t('messagerie.leaveGroupTitle')}</p>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--texte-secondaire)', lineHeight: 1.5 }}>
              {t('messagerie.confirmLeaveGroup', { titre: confirmTarget.titre })}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button onClick={() => setConfirmTarget(null)}
                style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 9999, background: 'var(--fond-surface-2)', color: 'var(--texte-secondaire)', border: '1px solid var(--bordure-normale)', cursor: 'pointer' }}>
                {t('messagerie.cancel')}
              </button>
              <button onClick={confirmPlainLeave} disabled={leaveMut.isPending}
                style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 9999, background: 'var(--erreur-accent)', color: '#fff', border: 'none', cursor: leaveMut.isPending ? 'wait' : 'pointer' }}>
                {t('messagerie.leaveGroup')}
              </button>
            </div>
          </div>
        </div>
      )}

      {picker && (
        <div onClick={() => setPicker(null)} style={{ ...overlayStyle, top: isDesktop ? DESKTOP_TITLEBAR_H : 0 }}>
          <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
            style={{ width: 400, maxWidth: '94vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: 'var(--fond-surface)', borderRadius: 14, border: '1px solid var(--bordure-legere)', boxShadow: '0 24px 60px rgba(15,23,42,0.28)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, padding: '16px 18px 0' }}>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--texte-primaire)' }}>{t('messagerie.pickSuccessorTitle')}</p>
                <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--texte-secondaire)', lineHeight: 1.5 }}>
                  {t('messagerie.pickSuccessorBody', { titre: picker.target.titre })}
                </p>
              </div>
              <button onClick={() => setPicker(null)} title={t('messagerie.close')} style={iconBtn}><X size={16} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 14px' }}>
              {picker.candidats.map(c => (
                <button key={c.id} onClick={() => confirmSuccessor(c.id)} disabled={leaveMut.isPending}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px', borderRadius: 9, background: 'transparent', border: 'none', cursor: leaveMut.isPending ? 'wait' : 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--fond-surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <UserAvatar userId={c.id} nom={c.nom} size={34} clickable={false} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--texte-primaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nom}</p>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--ap-600)', fontWeight: 600 }}>{t('messagerie.roleAdmin')}</p>
                  </div>
                  <LogOut size={15} style={{ color: 'var(--texte-tertiaire)', flexShrink: 0 }} />
                </button>
              ))}
              {picker.candidats.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center' }}>
                  <Users size={24} style={{ color: 'var(--texte-tertiaire)', opacity: 0.4, margin: '0 auto 8px', display: 'block' }} />
                  <p style={{ fontSize: 12, color: 'var(--texte-tertiaire)', margin: 0 }}>{t('messagerie.noSecondaryAdminToInherit')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )

  return { requestLeave, modal }
}
