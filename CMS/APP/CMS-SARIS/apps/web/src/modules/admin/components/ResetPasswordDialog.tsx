/**
 * ResetPasswordDialog — dialogue admin pour réinitialiser le mot de passe d'un compte.
 *
 * L'administrateur ne choisit RIEN : un clic fait fabriquer un mot de passe temporaire par le
 * serveur, toutes les connexions de la personne sont fermées, et le mot de passe ne lui est montré
 * qu'une fois (cf. MotDePasseTemporaireModal). La personne devra le remplacer à sa prochaine connexion.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyRound, AlertTriangle } from 'lucide-react'
import { Button, Modal } from '@/components/saris'
import { useResetPassword } from '../hooks/useAdmin'
import type { UtilisateurAdmin } from '../api/admin.api'
import { MotDePasseTemporaireModal } from './MotDePasseTemporaireModal'

interface Props {
  utilisateur: UtilisateurAdmin
  onClose:     () => void
}

export function ResetPasswordDialog({ utilisateur, onClose }: Props) {
  const { t } = useTranslation()
  const reset = useResetPassword(utilisateur.id)
  const [motDePasse, setMotDePasse] = useState<string | null>(null)

  async function handleConfirm() {
    try {
      const r = await reset.mutateAsync()
      setMotDePasse(r.motDePasseTemporaire)
    } catch {
      // Erreur déjà notifiée par toast. On laisse le dialog ouvert pour réessayer.
    }
  }

  // Le mot de passe est là : c'est la seule fois qu'il se lit. Fermée, la fenêtre l'oublie.
  if (motDePasse)
    return (
      <MotDePasseTemporaireModal
        login={utilisateur.login}
        motDePasse={motDePasse}
        titre={t('admin.resetDoneTitle')}
        onClose={onClose}
      />
    )

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
            onClick={() => void handleConfirm()}
          >
            {t('admin.resetGenerate')}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--texte-secondaire)', lineHeight: 1.6 }}>
          {t('admin.resetGenerateBody', { login: utilisateur.login })}
        </p>
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
