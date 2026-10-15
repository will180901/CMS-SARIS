/**
 * ChoixMotDePasse — écran PLEIN ÉCRAN qui impose de choisir son mot de passe.
 *
 * Affiché à la place de toute l'application tant que le compte porte un mot de passe TEMPORAIRE (posé
 * par l'administrateur à la création du compte ou à une réinitialisation) : ce mot de passe n'a servi
 * qu'à entrer ici, la personne en choisit un que PERSONNE d'autre ne connaît. Le serveur applique la
 * même règle de son côté (il refuse tout autre appel, 403 `MOT_DE_PASSE_TEMPORAIRE`) : cet écran n'est
 * que la façon de la remplir.
 *
 * Une fois le mot de passe changé, les autres connexions de la personne sont fermées (pas celle-ci).
 */
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, KeyRound, LogOut, ShieldCheck } from 'lucide-react'
import { Button, Field, TextInput } from '@/components/saris'
import { PASSWORD_REGEX } from '@/lib/validation'
import { useSessionStore } from '@/stores/session.store'
import { useChangePassword } from '../hooks/useChangePassword'
import { useLogout } from '../hooks/useLogout'

export function ChoixMotDePasse() {
  const { t } = useTranslation()
  const user = useSessionStore((s) => s.user)
  const setUser = useSessionStore((s) => s.setUser)
  const change = useChangePassword()
  const logout = useLogout()
  const [actuel, setActuel] = useState('')
  const [nouveau, setNouveau] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [afficher, setAfficher] = useState(false)

  const regleOk = PASSWORD_REGEX.test(nouveau)
  const erreurNouveau =
    nouveau.length > 0 && !regleOk
      ? t('auth.mdpRegle')
      : nouveau.length > 0 && nouveau === actuel
        ? t('auth.mdpIdentique')
        : undefined
  const erreurConfirmation =
    confirmation.length > 0 && confirmation !== nouveau ? t('auth.mdpDifferents') : undefined
  const pret =
    actuel.length > 0 && regleOk && nouveau !== actuel && confirmation === nouveau

  function valider(e?: FormEvent) {
    e?.preventDefault()
    if (!pret || change.isPending || !user) return
    change.mutate(
      { motDePasseActuel: actuel, nouveauMotDePasse: nouveau },
      {
        // Le compte est libre : l'application s'ouvre (App relit `motDePasseTemp`).
        onSuccess: () => setUser({ ...user, motDePasseTemp: false }),
        onError: () => {
          setActuel('')
        },
      },
    )
  }

  const type = afficher ? 'text' : 'password'

  return (
    <div
      style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--espace-4)', background: 'var(--fond-page)',
      }}
    >
      <form
        onSubmit={valider}
        style={{
          width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column',
          gap: 'var(--espace-4)', padding: 'var(--espace-6)',
          background: 'var(--fond-surface)', border: '1px solid var(--bordure-normale)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-3)' }}>
          <span
            style={{
              width: 38, height: 38, borderRadius: 'var(--radius-lg)', background: 'var(--ap-50)',
              color: 'var(--ap-600)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <KeyRound size={18} />
          </span>
          <div>
            <h1 style={{ margin: 0, fontSize: 'var(--font-size-title)', fontWeight: 700, color: 'var(--texte-primaire)' }}>
              {t('auth.mdpObligatoireTitre')}
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
              {user?.login}
            </p>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: 13, color: 'var(--texte-secondaire)', lineHeight: 1.6 }}>
          {t('auth.mdpObligatoireTexte')}
        </p>

        <Field label={t('auth.mdpTemporaire')} required>
          {(id) => (
            <TextInput
              id={id} type={type} value={actuel} autoFocus autoComplete="current-password"
              onChange={(e) => setActuel(e.target.value)}
            />
          )}
        </Field>
        <Field label={t('auth.mdpNouveau')} required hint={t('auth.mdpRegle')} error={erreurNouveau}>
          {(id) => (
            <TextInput
              id={id} type={type} value={nouveau} autoComplete="new-password" invalid={!!erreurNouveau}
              onChange={(e) => setNouveau(e.target.value)}
            />
          )}
        </Field>
        <Field label={t('auth.mdpConfirmation')} required error={erreurConfirmation}>
          {(id) => (
            <TextInput
              id={id} type={type} value={confirmation} autoComplete="new-password" invalid={!!erreurConfirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          )}
        </Field>

        <button
          type="button"
          onClick={() => setAfficher((v) => !v)}
          style={{
            alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
            fontSize: 'var(--font-size-caption)', color: 'var(--texte-secondaire)',
          }}
        >
          {afficher ? <EyeOff size={13} /> : <Eye size={13} />}
          {afficher ? t('auth.mdpMasquer') : t('auth.mdpAfficher')}
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--espace-2)', flexWrap: 'wrap' }}>
          <Button
            type="button" variant="ghost" leftIcon={<LogOut size={14} />}
            onClick={() => logout.mutate()} disabled={change.isPending}
          >
            {t('auth.mdpSeDeconnecter')}
          </Button>
          <Button type="submit" variant="primary" leftIcon={<ShieldCheck size={14} />} loading={change.isPending} disabled={!pret}>
            {t('auth.mdpEnregistrer')}
          </Button>
        </div>
      </form>
    </div>
  )
}
