/**
 * ChangePasswordDialog — Dialog centré pour la modification du mot de passe.
 * Accessible depuis le menu utilisateur de la sidebar.
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription,
} from '@workspace/ui/components/dialog'
import { Button } from '@workspace/ui/components/button'
import { Input }  from '@workspace/ui/components/input'
import { Label }  from '@workspace/ui/components/label'
import { useChangePassword } from '../hooks/useChangePassword'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n/config'
import { motDePasse, msgValidation } from '@/lib/validation'

// ── Schéma ────────────────────────────────────────────────────────────────────

const schema = z.object({
  motDePasseActuel:    z.string().refine(v => v.length >= 1, msgValidation('validation.mdpActuelRequis')),
  nouveauMotDePasse:   motDePasse,
  confirmation:        z.string().refine(v => v.length >= 1, msgValidation('validation.confirmationRequise')),
}).refine(d => d.nouveauMotDePasse === d.confirmation, () => ({
  message: i18n.t('validation.mdpDifferents'),
  path:    ['confirmation'],
})).refine(d => d.nouveauMotDePasse !== d.motDePasseActuel, () => ({
  message: i18n.t('validation.mdpIdentique'),
  path:    ['nouveauMotDePasse'],
}))

type FormValues = z.infer<typeof schema>

// ── Composant ─────────────────────────────────────────────────────────────────

interface ChangePasswordDialogProps {
  open:    boolean
  onClose: () => void
}

export function ChangePasswordDialog({ open, onClose }: ChangePasswordDialogProps) {
  const { t } = useTranslation()
  const mutation = useChangePassword()

  const [showActuel,    setShowActuel]    = useState(false)
  const [showNouveau,   setShowNouveau]   = useState(false)
  const [showConfirm,   setShowConfirm]   = useState(false)

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  function handleClose() {
    if (mutation.isPending) return
    reset()
    onClose()
  }

  async function onSubmit(data: FormValues) {
    await mutation.mutateAsync({
      motDePasseActuel:  data.motDePasseActuel,
      nouveauMotDePasse: data.nouveauMotDePasse,
    })
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent
        style={{
          maxWidth:     '420px',
          borderRadius: '12px',
          border:       '1px solid var(--bordure-normale)',
          background:   'var(--fond-surface)',
          boxShadow:    '0 8px 32px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.06)',
          padding:      0,
          overflow:     'hidden',
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <DialogHeader style={{ padding: '24px 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'var(--ap-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <KeyRound size={15} style={{ color: 'var(--ap-600)' }} />
            </div>
            <DialogTitle style={{ fontSize: '15px', fontWeight: '600', color: 'var(--texte-primaire)', margin: 0 }}>
              {t('settings.passwordChange')}
            </DialogTitle>
          </div>
          <DialogDescription style={{ fontSize: '13px', color: 'var(--texte-tertiaire)', marginTop: '2px' }}>
            {t('settings.passwordDialogDescription')}
          </DialogDescription>
        </DialogHeader>

        {/* ── Formulaire ──────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Mot de passe actuel */}
            <div>
              <Label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', marginBottom: '6px', display: 'block' }}>
                {t('settings.passwordCurrent')} <span style={{ color: 'var(--erreur-texte)' }}>*</span>
              </Label>
              <div style={{ position: 'relative' }}>
                <Input
                  {...register('motDePasseActuel')}
                  type={showActuel ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="[&::-ms-reveal]:hidden [&::-ms-clear]:hidden [&::-webkit-contacts-auto-fill-button]:hidden [&::-webkit-credentials-auto-fill-button]:hidden"
                  style={{
                    fontSize: '13px', height: '36px',
                    paddingRight: '40px',
                    borderColor: errors.motDePasseActuel ? 'var(--erreur-texte)' : undefined,
                  }}
                />
                <button type="button" onClick={() => setShowActuel(v => !v)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texte-tertiaire)', display: 'flex', padding: '2px' }}>
                  {showActuel ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {errors.motDePasseActuel && (
                <p style={{ fontSize: '12px', color: 'var(--erreur-texte)', marginTop: '4px' }}>{errors.motDePasseActuel.message}</p>
              )}
            </div>

            {/* Séparateur visuel */}
            <div style={{ height: '1px', background: 'var(--bordure-legere)', margin: '0 -4px' }} />

            {/* Nouveau mot de passe */}
            <div>
              <Label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', marginBottom: '6px', display: 'block' }}>
                {t('settings.passwordNew')} <span style={{ color: 'var(--erreur-texte)' }}>*</span>
              </Label>
              <div style={{ position: 'relative' }}>
                <Input
                  {...register('nouveauMotDePasse')}
                  type={showNouveau ? 'text' : 'password'}
                  placeholder={t('settings.passwordNewPlaceholder')}
                  autoComplete="new-password"
                  className="[&::-ms-reveal]:hidden [&::-ms-clear]:hidden [&::-webkit-contacts-auto-fill-button]:hidden [&::-webkit-credentials-auto-fill-button]:hidden"
                  style={{
                    fontSize: '13px', height: '36px',
                    paddingRight: '40px',
                    borderColor: errors.nouveauMotDePasse ? 'var(--erreur-texte)' : undefined,
                  }}
                />
                <button type="button" onClick={() => setShowNouveau(v => !v)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texte-tertiaire)', display: 'flex', padding: '2px' }}>
                  {showNouveau ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {errors.nouveauMotDePasse && (
                <p style={{ fontSize: '12px', color: 'var(--erreur-texte)', marginTop: '4px' }}>{errors.nouveauMotDePasse.message}</p>
              )}
            </div>

            {/* Confirmation */}
            <div>
              <Label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)', marginBottom: '6px', display: 'block' }}>
                {t('settings.passwordConfirm')} <span style={{ color: 'var(--erreur-texte)' }}>*</span>
              </Label>
              <div style={{ position: 'relative' }}>
                <Input
                  {...register('confirmation')}
                  type={showConfirm ? 'text' : 'password'}
                  placeholder={t('settings.passwordConfirmPlaceholder')}
                  autoComplete="new-password"
                  className="[&::-ms-reveal]:hidden [&::-ms-clear]:hidden [&::-webkit-contacts-auto-fill-button]:hidden [&::-webkit-credentials-auto-fill-button]:hidden"
                  style={{
                    fontSize: '13px', height: '36px',
                    paddingRight: '40px',
                    borderColor: errors.confirmation ? 'var(--erreur-texte)' : undefined,
                  }}
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texte-tertiaire)', display: 'flex', padding: '2px' }}>
                  {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {errors.confirmation && (
                <p style={{ fontSize: '12px', color: 'var(--erreur-texte)', marginTop: '4px' }}>{errors.confirmation.message}</p>
              )}
            </div>
          </div>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <div style={{
            padding:        '16px 24px',
            borderTop:      '1px solid var(--bordure-legere)',
            display:        'flex',
            justifyContent: 'flex-end',
            gap:            '8px',
            background:     'var(--fond-surface-2)',
          }}>
            <Button type="button" variant="outline" size="sm" onClick={handleClose}
              disabled={mutation.isPending}
              style={{ fontSize: '13px', height: '34px' }}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" size="sm"
              disabled={!isDirty || mutation.isPending}
              style={{ fontSize: '13px', height: '34px', background: 'var(--ap-500)', color: '#fff', gap: '6px' }}>
              <ShieldCheck size={13} />
              {mutation.isPending ? t('settings.passwordSaving') : t('settings.passwordChange')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
