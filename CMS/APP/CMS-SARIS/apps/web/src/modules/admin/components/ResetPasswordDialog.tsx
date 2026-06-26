/**
 * ResetPasswordDialog — dialogue admin pour réinitialiser le mot de passe.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyRound, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { Button, Field, TextInput, Modal } from '@/components/saris'
import { useResetPassword } from '../hooks/useAdmin'
import type { UtilisateurAdmin } from '../api/admin.api'

interface Props {
  utilisateur: UtilisateurAdmin
  onClose:     () => void
}

// Règle alignée avec le backend (cf utilisateur.dto.ts : PASSWORD_RULES).
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/

export function ResetPasswordDialog({ utilisateur, onClose }: Props) {
  const { t } = useTranslation()
  const reset = useResetPassword(utilisateur.id)
  const [mdp,     setMdp]     = useState('')
  const [show,    setShow]    = useState(false)
  const [forcer,  setForcer]  = useState(true)

  const valid = PASSWORD_REGEX.test(mdp)
  const mdpError = mdp.length > 0 && !valid
    ? t('admin.passwordRule')
    : undefined

  async function handleConfirm() {
    if (!valid) return
    try {
      await reset.mutateAsync({ nouveauMotDePasse: mdp, forcerChangement: forcer })
      onClose()
    } catch {
      // Erreur déjà notifiée par toast. On laisse le dialog ouvert pour correction.
    }
  }

  return (
    <Modal
      icon={<KeyRound size={16} />}
      title={t('admin.resetPasswordTitle')}
      subtitle={`${utilisateur.login} · ${utilisateur.email}`}
      width={460}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('admin.cancel')}</Button>
          <Button
            variant="primary"
            leftIcon={<KeyRound size={14} />}
            loading={reset.isPending}
            disabled={!valid}
            onClick={handleConfirm}
          >
            {t('admin.reset')}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
          <Field
            label={t('admin.newPassword')}
            required
            hint={t('admin.passwordRule')}
            error={mdpError}
          >
            {(id) => (
              <div style={{ position: 'relative' }}>
                <TextInput
                  id={id}
                  type={show ? 'text' : 'password'}
                  value={mdp}
                  onChange={e => setMdp(e.target.value)}
                  placeholder={t('admin.newPassword')}
                  autoFocus
                  style={{ paddingRight: 38 }}
                />
                <button
                  type="button"
                  aria-label={show ? t('admin.hide') : t('admin.show')}
                  onClick={() => setShow(v => !v)}
                  style={{
                    position: 'absolute', right: 8, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--texte-tertiaire)', padding: 4,
                  }}
                >
                  {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            )}
          </Field>

          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-2)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={forcer}
              onChange={e => setForcer(e.target.checked)}
              style={{ width: 14, height: 14, accentColor: 'var(--ap-500)' }}
            />
            <span style={{ fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)' }}>
              {t('admin.forcePasswordChange')}
            </span>
          </label>

          <p style={{
            margin: 0, display: 'flex', alignItems: 'center', gap: 6,
            padding: 'var(--espace-2) var(--espace-3)',
            background: 'var(--avert-fond)',
            border: '1px solid var(--avert-bordure)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-caption)',
            color: 'var(--avert-texte)',
          }}>
            <AlertTriangle size={13} style={{ flexShrink: 0 }} /> {t('admin.resetSessionsWarning')}
          </p>
      </div>
    </Modal>
  )
}
