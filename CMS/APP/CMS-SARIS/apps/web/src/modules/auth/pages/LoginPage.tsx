import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Eye, EyeOff, ArrowRight, Shield, ChevronLeft,
  AlertCircle, Loader2,
} from 'lucide-react'
import { Button }       from '@workspace/ui/components/button'
import { Input }        from '@workspace/ui/components/input'
import { Label }        from '@workspace/ui/components/label'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@workspace/ui/components/input-otp'
import { TotpCountdown }    from '@/components/saris'
import { ConditionsModal }  from '@/components/ConditionsModal'
import { useLoginMutation, useTotpVerifyMutation } from '../hooks/useLogin'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

// ── Schémas Zod ───────────────────────────────────────────────────────────────

const loginSchema = z.object({
  login:    z.string().min(1, "L'identifiant est requis").max(100),
  password: z.string().min(1, 'Le mot de passe est requis').max(200),
})

const totpSchema = z.object({
  code: z
    .string()
    .trim()
    .refine(
      v => /^\d{6}$/.test(v) || /^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/.test(v),
      'Entrez un code à 6 chiffres ou un code de secours (XXXX-XXXX)',
    ),
})

type LoginForm = z.infer<typeof loginSchema>
type TotpForm  = z.infer<typeof totpSchema>

// ── Composant principal ───────────────────────────────────────────────────────

export function LoginPage() {
  const { t } = useTranslation()
  const [step, setStep]           = useState<'login' | 'totp'>('login')
  const [totpMode, setTotpMode]   = useState<'app' | 'backup'>('app')
  const [tempToken, setTempToken] = useState<string | null>(null)
  const [showCgu, setShowCgu]     = useState(false)
  const [showPass, setShowPass]   = useState(false)

  const loginMutation = useLoginMutation()
  const totpMutation  = useTotpVerifyMutation()

  // ── Formulaire étape 1 ──────────────────────────────────────────────────

  const loginForm = useForm<LoginForm>({
    resolver:      zodResolver(loginSchema),
    defaultValues: { login: '', password: '' },
  })

  // ── Formulaire étape 2 ──────────────────────────────────────────────────

  const totpForm = useForm<TotpForm>({
    resolver:      zodResolver(totpSchema),
    defaultValues: { code: '' },
  })

  // ── Handlers ────────────────────────────────────────────────────────────

  async function onLoginSubmit(data: LoginForm) {
    try {
      const result = await loginMutation.mutateAsync(data)
      if (result.requireTotp) {
        setTempToken(result.tempToken)
        setStep('totp')
      }
      // Si !requireTotp → useLoginMutation.onSuccess appelle setSession → App rerend
    } catch {
      // L'erreur est dans loginMutation.error
    }
  }

  async function onTotpSubmit(data: TotpForm) {
    if (!tempToken) return
    try {
      await totpMutation.mutateAsync({ code: data.code, tempToken })
      // onSuccess → setSession → App rerend
    } catch {
      // L'erreur est dans totpMutation.error
    }
  }

  function goBack() {
    setStep('login')
    setTotpMode('app')
    setTempToken(null)
    totpForm.reset()
    loginMutation.reset()
    totpMutation.reset()
  }

  function switchTotpMode(mode: 'app' | 'backup') {
    setTotpMode(mode)
    totpForm.setValue('code', '')
    totpMutation.reset()
  }

  // ── Messages d'erreur ───────────────────────────────────────────────────

  const loginError = loginMutation.error?.serverMessage
  const totpError  = totpMutation.error?.serverMessage

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundColor:  'var(--fond-page)',
        backgroundImage:  'radial-gradient(circle, rgba(78,139,164,0.12) 1px, transparent 1px)',
        backgroundSize:   '28px 28px',
      }}
    >
      <div className="w-full max-w-[400px]">

        {/* ── Card ──────────────────────────────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background:   'var(--fond-surface)',
            border:       '1px solid var(--bordure-legere)',
            backdropFilter: 'blur(24px)',
            boxShadow:    'var(--ombre-3)',
          }}
        >
          <div className="px-8 pt-8 pb-6">

            {/* ── Logo + Titre ─────────────────────────────────────────── */}
            <div className="flex flex-col items-center mb-8">
              <img
                src="/logo_cms_saris.png" alt="CMS SARIS"
                style={{ height: 46, width: 'auto', maxWidth: '100%', marginBottom: 10 }}
              />
              <p
                className="text-[11px] tracking-wide"
                style={{ color: 'var(--texte-tertiaire)' }}
              >
                {t('common.tagline')}
              </p>
              <div className="mt-3"><LanguageSwitcher compact /></div>
            </div>

            {/* ── Retour (step TOTP) ───────────────────────────────────── */}
            {step === 'totp' && (
              <button
                onClick={goBack}
                className="flex items-center gap-1 text-xs mb-5 -mt-2 transition-colors"
                style={{ color: 'var(--texte-tertiaire)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--texte-secondaire)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--texte-tertiaire)')}
              >
                <ChevronLeft size={13} strokeWidth={2.5} />
                {t('auth.backToLogin')}
              </button>
            )}

            {/* ══════════════════════════════════════════════════════════
                ÉTAPE 1 — Login / Mot de passe
            ══════════════════════════════════════════════════════════ */}
            {step === 'login' && (
              <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-200">

                {/* Sous-titre */}
                <div className="mb-5">
                  <h2
                    className="text-sm font-medium"
                    style={{ color: 'var(--texte-primaire)' }}
                  >
                    {t('auth.title')}
                  </h2>
                  <p
                    className="text-[11px] mt-0.5"
                    style={{ color: 'var(--texte-tertiaire)' }}
                  >
                    {t('auth.subtitle')}
                  </p>
                </div>

                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} noValidate>
                  <div className="space-y-3.5">

                    {/* Identifiant */}
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="login"
                        className="text-[11px] font-medium"
                        style={{ color: 'var(--texte-secondaire)' }}
                      >
                        {t('auth.username')}
                      </Label>
                      <Input
                        id="login"
                        type="text"
                        autoComplete="username"
                        // eslint-disable-next-line jsx-a11y/no-autofocus
                        autoFocus
                        placeholder={t('auth.usernamePlaceholder')}
                        className="h-9 text-sm"
                        {...loginForm.register('login')}
                      />
                      {loginForm.formState.errors.login && (
                        <FieldError message={loginForm.formState.errors.login.message} />
                      )}
                    </div>

                    {/* Mot de passe */}
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="password"
                        className="text-[11px] font-medium"
                        style={{ color: 'var(--texte-secondaire)' }}
                      >
                        {t('auth.password')}
                      </Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPass ? 'text' : 'password'}
                          autoComplete="current-password"
                          placeholder="••••••••"
                          className="h-9 text-sm pr-9 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden [&::-webkit-contacts-auto-fill-button]:hidden [&::-webkit-credentials-auto-fill-button]:hidden"
                          {...loginForm.register('password')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(v => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors"
                          style={{ color: 'var(--texte-tertiaire)' }}
                          tabIndex={-1}
                          aria-label={showPass ? t('auth.hidePassword') : t('auth.showPassword')}
                        >
                          {showPass
                            ? <EyeOff size={15} strokeWidth={1.75} />
                            : <Eye    size={15} strokeWidth={1.75} />
                          }
                        </button>
                      </div>
                      {loginForm.formState.errors.password && (
                        <FieldError message={loginForm.formState.errors.password.message} />
                      )}
                    </div>

                    {/* Erreur serveur */}
                    {loginError && <ServerError message={loginError} />}

                    {/* Bouton soumettre */}
                    <Button
                      type="submit"
                      className="w-full h-9 text-sm gap-2 mt-1"
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending
                        ? <Loader2 size={15} className="animate-spin" />
                        : (
                          <>
                            {t('auth.login')}
                            <ArrowRight size={15} strokeWidth={2.5} />
                          </>
                        )
                      }
                    </Button>

                  </div>
                </form>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                ÉTAPE 2 — Code TOTP
            ══════════════════════════════════════════════════════════ */}
            {step === 'totp' && (
              <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-200">

                {/* En-tête TOTP */}
                <div className="flex flex-col items-center mb-6">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                    style={{ background: 'var(--couleur-accent-fond)' }}
                  >
                    <Shield size={20} strokeWidth={1.75} style={{ color: 'var(--ap-600)' }} />
                  </div>
                  <h2
                    className="text-sm font-medium"
                    style={{ color: 'var(--texte-primaire)' }}
                  >
                    {t('auth.twoStepTitle')}
                  </h2>
                  <p
                    className="text-[11px] mt-1 text-center leading-relaxed"
                    style={{ color: 'var(--texte-tertiaire)' }}
                  >
                    {totpMode === 'app' ? t('auth.twoStepApp') : t('auth.twoStepBackup')}
                  </p>
                </div>

                <form onSubmit={totpForm.handleSubmit(onTotpSubmit)} noValidate>
                  <div className="space-y-4">

                    {totpMode === 'app' ? (
                      /* ── Code de l'application d'authentification ── */
                      <div className="flex flex-col items-center gap-1.5">
                        <InputOTP
                          maxLength={6}
                          value={totpForm.watch('code')}
                          onChange={(val) =>
                            totpForm.setValue('code', val, { shouldValidate: totpForm.formState.isSubmitted })
                          }
                          // eslint-disable-next-line jsx-a11y/no-autofocus
                          autoFocus
                        >
                          <InputOTPGroup>
                            <InputOTPSlot index={0} className="size-10 text-base" />
                            <InputOTPSlot index={1} className="size-10 text-base" />
                            <InputOTPSlot index={2} className="size-10 text-base" />
                            <InputOTPSlot index={3} className="size-10 text-base" />
                            <InputOTPSlot index={4} className="size-10 text-base" />
                            <InputOTPSlot index={5} className="size-10 text-base" />
                          </InputOTPGroup>
                        </InputOTP>

                        {totpForm.formState.errors.code && (
                          <FieldError message={totpForm.formState.errors.code.message} />
                        )}
                        <div className="mt-1">
                          <TotpCountdown align="center" />
                        </div>
                      </div>
                    ) : (
                      /* ── Code de secours ── */
                      <div className="flex flex-col items-center gap-1.5">
                        <Input
                          // eslint-disable-next-line jsx-a11y/no-autofocus
                          autoFocus
                          autoComplete="one-time-code"
                          placeholder="XXXX-XXXX"
                          aria-label={t('auth.backupCode')}
                          className="h-10 w-44 text-center text-base font-mono tracking-[0.25em] uppercase"
                          maxLength={9}
                          value={totpForm.watch('code')}
                          onChange={(e) =>
                            totpForm.setValue('code', e.target.value, { shouldValidate: totpForm.formState.isSubmitted })
                          }
                        />
                        {totpForm.formState.errors.code && (
                          <FieldError message={totpForm.formState.errors.code.message} />
                        )}
                      </div>
                    )}

                    {/* Erreur serveur TOTP */}
                    {totpError && <ServerError message={totpError} />}

                    {/* Bouton vérifier */}
                    <Button
                      type="submit"
                      className="w-full h-9 text-sm gap-2"
                      disabled={
                        totpMutation.isPending ||
                        (totpMode === 'app'
                          ? totpForm.watch('code').length < 6
                          : totpForm.watch('code').trim().length < 8)
                      }
                    >
                      {totpMutation.isPending
                        ? <Loader2 size={15} className="animate-spin" />
                        : (
                          <>
                            {t('auth.verifyCode')}
                            <ArrowRight size={15} strokeWidth={2.5} />
                          </>
                        )
                      }
                    </Button>

                    {/* Bascule application ↔ code de secours */}
                    <button
                      type="button"
                      onClick={() => switchTotpMode(totpMode === 'app' ? 'backup' : 'app')}
                      className="w-full text-center text-[11px] transition-colors"
                      style={{ color: 'var(--texte-tertiaire)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--texte-secondaire)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--texte-tertiaire)')}
                    >
                      {totpMode === 'app'
                        ? t('auth.useBackupCode')
                        : t('auth.backToApp')}
                    </button>

                  </div>
                </form>
              </div>
            )}

          </div>
        </div>

        {/* Conditions d'utilisation */}
        <p
          className="text-center text-[10px] mt-4 tracking-wide"
          style={{ color: 'var(--texte-tertiaire)' }}
        >
          <button
            type="button"
            onClick={() => setShowCgu(true)}
            className="underline underline-offset-2"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texte-tertiaire)', fontSize: '10px', padding: 0 }}
          >
            {t('auth.terms')}
          </button>
        </p>

      </div>

      <ConditionsModal open={showCgu} onClose={() => setShowCgu(false)} />
    </div>
  )
}

// ── Sous-composants utilitaires ───────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p
      className="flex items-center gap-1 text-[11px]"
      style={{ color: 'var(--erreur-accent)' }}
    >
      <AlertCircle size={11} strokeWidth={2} />
      {message}
    </p>
  )
}

function ServerError({ message }: { message: string }) {
  return (
    <div
      className="flex items-start gap-2 rounded-lg px-3 py-2.5"
      style={{
        background:  'var(--erreur-fond)',
        border:      '1px solid var(--erreur-bordure)',
      }}
    >
      <AlertCircle
        size={13}
        strokeWidth={2}
        className="shrink-0 mt-px"
        style={{ color: 'var(--erreur-accent)' }}
      />
      <p
        className="text-[11px] leading-relaxed"
        style={{ color: 'var(--erreur-texte)' }}
      >
        {message}
      </p>
    </div>
  )
}
