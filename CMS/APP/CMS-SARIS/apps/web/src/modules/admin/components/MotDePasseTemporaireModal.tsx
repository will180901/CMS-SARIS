/**
 * MotDePasseTemporaireModal — le mot de passe TEMPORAIRE d'un compte, montré UNE SEULE FOIS.
 *
 * L'administrateur ne choisit jamais le mot de passe de quelqu'un : le serveur en fabrique un, le
 * rend dans la réponse de la création ou de la réinitialisation, et ne le montre plus jamais (il n'est
 * ni relisible ni écrit dans le journal). Cette fenêtre est donc le seul moment où on le lit ; fermée,
 * il est perdu — la seule issue est de réinitialiser de nouveau. La personne le remplacera par le sien
 * dès sa première connexion.
 */
import { useTranslation } from 'react-i18next'
import { Check, Copy, KeyRound, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Button, Modal } from '@/components/saris'
import { toast } from '@workspace/ui/components/sonner'

interface Props {
  login: string
  motDePasse: string
  /** Titre de la fenêtre (« Compte créé », « Mot de passe réinitialisé »…). */
  titre: string
  onClose: () => void
}

export function MotDePasseTemporaireModal({ login, motDePasse, titre, onClose }: Props) {
  const { t } = useTranslation()
  const [copie, setCopie] = useState(false)

  async function copier() {
    try {
      await navigator.clipboard.writeText(motDePasse)
      setCopie(true)
      toast.success(t('admin.tempPwdCopied'))
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, autorisation) : le mot de passe reste lisible
      // à l'écran, on ne bloque rien.
      toast.error(t('admin.tempPwdCopyFailed'))
    }
  }

  return (
    <Modal
      icon={<KeyRound size={16} />}
      tone="warning"
      title={titre}
      subtitle={login}
      width={480}
      onClose={onClose}
      footer={<Button variant="primary" onClick={onClose}>{t('admin.tempPwdDone')}</Button>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--texte-secondaire)', lineHeight: 1.6 }}>
          {t('admin.tempPwdIntro', { login })}
        </p>

        <div style={{ display: 'flex', alignItems: 'stretch', gap: 'var(--espace-2)' }}>
          <code
            aria-label={t('admin.tempPwdLabel')}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 'var(--espace-3) var(--espace-4)',
              background: 'var(--fond-surface-2)', border: '1px solid var(--bordure-normale)',
              borderRadius: 'var(--radius-md)', fontFamily: 'monospace', fontSize: 20,
              fontWeight: 700, letterSpacing: '0.04em', color: 'var(--texte-primaire)',
              userSelect: 'all', wordBreak: 'break-all', textAlign: 'center',
            }}
          >
            {motDePasse}
          </code>
          <Button variant="outline" leftIcon={copie ? <Check size={14} /> : <Copy size={14} />} onClick={() => void copier()}>
            {t('admin.tempPwdCopy')}
          </Button>
        </div>

        <p style={{
          margin: 0, display: 'flex', gap: 6, alignItems: 'flex-start',
          padding: 'var(--espace-2) var(--espace-3)', borderRadius: 'var(--radius-md)',
          background: 'var(--avert-fond)', border: '1px solid var(--avert-bordure)',
          fontSize: 'var(--font-size-caption)', lineHeight: 1.5, color: 'var(--avert-texte)',
        }}>
          <TriangleAlert size={13} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{t('admin.tempPwdOnce')}</span>
        </p>
        <p style={{ margin: 0, fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', lineHeight: 1.5 }}>
          {t('admin.tempPwdChange')}
        </p>
      </div>
    </Modal>
  )
}
