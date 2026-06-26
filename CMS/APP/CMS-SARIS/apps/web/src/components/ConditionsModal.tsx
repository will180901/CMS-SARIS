/**
 * Modale légale réutilisable et BILINGUE (FR/EN) : Conditions d'utilisation (CGU) ou
 * Politique de confidentialité. Contenu issu de l'i18n (`legal.*`).
 *
 * - `kind='cgu'` (défaut) : charte d'usage ; mode ACCEPTATION bloquant si `onAccept` fourni.
 * - `kind='privacy'` : politique de confidentialité (lecture seule).
 *
 * Note : document d'usage interne — ne se substitue pas à un conseil juridique.
 */
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ShieldCheck, Lock, Loader2, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const SECTION_COUNT = { cgu: 6, privacy: 7 } as const

export function ConditionsModal({
  open,
  onClose,
  onAccept,
  accepting,
  kind = 'cgu',
}: {
  open: boolean
  onClose: () => void
  /** Mode ACCEPTATION (bloquant, CGU uniquement) : l'utilisateur DOIT accepter pour continuer. */
  onAccept?: () => void
  accepting?: boolean
  kind?: 'cgu' | 'privacy'
}) {
  const { t } = useTranslation()
  const blocking = !!onAccept && kind === 'cgu'

  useEffect(() => {
    if (!open || blocking) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose, blocking])

  if (!open) return null

  const ns = kind === 'cgu' ? 'legal.cgu' : 'legal.privacy'
  const title = t(kind === 'cgu' ? 'legal.cguTitle' : 'legal.privacyTitle')
  const intro = t(kind === 'cgu' ? 'legal.cguIntro' : 'legal.privacyIntro')
  const subtitle = blocking
    ? t('legal.acceptHint')
    : t(kind === 'cgu' ? 'legal.cguSubtitle' : 'legal.privacySubtitle')
  const sections = Array.from({ length: SECTION_COUNT[kind] }, (_, i) => ({
    title: t(`${ns}.s${i + 1}Title`),
    body: t(`${ns}.s${i + 1}`),
  }))

  return createPortal(
    <div onClick={blocking ? undefined : onClose} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}
        style={{ width: 620, maxWidth: '100%', maxHeight: '88vh', background: 'var(--fond-surface)', borderRadius: 16, border: '1px solid var(--bordure-legere)', boxShadow: '0 24px 60px rgba(15,23,42,0.28)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 11, padding: '16px 18px', borderBottom: '1px solid var(--bordure-legere)' }}>
          <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-lg)', background: 'var(--ap-50)', color: 'var(--ap-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {kind === 'cgu' ? <ShieldCheck size={17} /> : <Lock size={17} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--texte-primaire)' }}>{title}</p>
            <p style={{ margin: '1px 0 0', fontSize: 11.5, color: 'var(--texte-tertiaire)' }}>{subtitle}</p>
          </div>
          {!blocking && (
            <button onClick={onClose} title={t('common.close')} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--texte-secondaire)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={17} />
            </button>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <p style={{ margin: '0 0 14px', fontSize: 12.5, lineHeight: 1.55, color: 'var(--texte-secondaire)' }}>{intro}</p>
          {sections.map((s) => (
            <div key={s.title} style={{ marginBottom: 14 }}>
              <p style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 700, color: 'var(--texte-primaire)' }}>{s.title}</p>
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: 'var(--texte-secondaire)' }}>{s.body}</p>
            </div>
          ))}
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--texte-tertiaire)', fontStyle: 'italic' }}>{t('legal.disclaimer')}</p>
        </div>
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', padding: '12px 18px', borderTop: '1px solid var(--bordure-legere)' }}>
          {blocking ? (
            <button onClick={onAccept} disabled={accepting}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, padding: '9px 18px', borderRadius: 9999, background: 'var(--ap-400)', color: '#fff', border: 'none', cursor: accepting ? 'wait' : 'pointer', opacity: accepting ? 0.7 : 1 }}>
              {accepting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {t('common.acceptContinue')}
            </button>
          ) : (
            <button onClick={onClose} style={{ fontSize: 13, fontWeight: 600, padding: '8px 18px', borderRadius: 9999, background: 'var(--ap-400)', color: '#fff', border: 'none', cursor: 'pointer' }}>{t('common.understood')}</button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
