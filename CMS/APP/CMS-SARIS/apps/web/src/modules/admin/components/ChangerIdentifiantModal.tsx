/**
 * ChangerIdentifiantModal — changer l'IDENTIFIANT de connexion d'un compte.
 *
 * Deux usages, une seule fenêtre :
 *  - « moi » : la personne change le sien, son MOT DE PASSE est redemandé (changer ce qui sert à se
 *    connecter n'est pas un geste qu'on laisse à une session restée ouverte) ;
 *  - « admin » : un administrateur corrige celui d'un compte (faute de frappe, changement de nom),
 *    sans mot de passe — il ne le connaît jamais ; la personne est prévenue.
 *
 * Ce que dit le serveur est montré ICI, sous le champ (déjà pris, mis de côté 90 jours, forme
 * invalide, mot de passe faux) : la fenêtre reste ouverte pour corriger. L'identifiant se tape en
 * minuscules (le serveur les normalise de toute façon) ; l'ancien reste mis de côté 90 jours pour que
 * quelqu'un d'autre ne le prenne pas tout de suite.
 */
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AtSign } from 'lucide-react'
import { Button, Field, Modal, TextInput } from '@/components/saris'
import { toast } from '@workspace/ui/components/sonner'
import { ApiError } from '@/lib/api'

interface Props {
  /** L'identifiant actuel, montré dans le sous-titre. */
  actuel: string
  /** `moi` : mot de passe redemandé ; `admin` : correction par un administrateur. */
  mode: 'moi' | 'admin'
  /** Appelé avec le nouvel identifiant (et le mot de passe en mode `moi`) ; rejette si le serveur refuse. */
  onValider: (login: string, motDePasse: string) => Promise<unknown>
  onClose: () => void
}

/** Même forme que le serveur : 3 à 32 caractères, lettres/chiffres/. _ -, une lettre en tête. */
const FORME = /^[a-z][a-z0-9._-]{2,31}$/

function codeDe(e: unknown): string | null {
  if (e instanceof ApiError && typeof e.body === 'object' && e.body !== null && 'code' in e.body) {
    const c = (e.body as { code: unknown }).code
    return typeof c === 'string' ? c : null
  }
  return null
}

export function ChangerIdentifiantModal({ actuel, mode, onValider, onClose }: Props) {
  const { t } = useTranslation()
  const [login, setLogin] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreurLogin, setErreurLogin] = useState<string | null>(null)
  const [erreurMdp, setErreurMdp] = useState<string | null>(null)

  const formeOk = FORME.test(login)
  const formeErreur = login.length > 0 && !formeOk ? t('admin.idChangeForme') : undefined
  const pret = formeOk && login !== actuel && (mode === 'admin' || motDePasse.length > 0)

  async function valider(e?: FormEvent) {
    e?.preventDefault()
    if (!pret || enCours) return
    setErreurLogin(null)
    setErreurMdp(null)
    setEnCours(true)
    try {
      await onValider(login, motDePasse)
      onClose()
    } catch (err) {
      const code = codeDe(err)
      if (code === 'MOT_DE_PASSE_INCORRECT') {
        setErreurMdp(t('admin.idChangeMdpFaux'))
        setMotDePasse('')
      } else if (code === 'MODE_CENTRAL') {
        toast.error(t('admin.idChangeCentral'))
        onClose()
      } else if (err instanceof ApiError && code?.startsWith('IDENTIFIANT_')) {
        setErreurLogin(err.serverMessage)
      } else {
        toast.error(err instanceof ApiError ? err.serverMessage : (err as Error).message)
      }
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Modal
      icon={<AtSign size={16} />}
      tone="accent"
      title={t('admin.idChangeTitre')}
      subtitle={actuel}
      width={480}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={enCours} disabled={!pret} onClick={() => void valider()}>
            {t('admin.idChangeBouton')}
          </Button>
        </>
      }
    >
      <form onSubmit={(e) => void valider(e)} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--texte-secondaire)', lineHeight: 1.6 }}>
          {mode === 'moi' ? t('admin.idChangeCorpsMoi') : t('admin.idChangeCorpsAdmin')}
        </p>

        <Field label={t('admin.idChangeNouveau')} required hint={t('admin.idChangeAide')} error={erreurLogin ?? formeErreur}>
          {(id) => (
            <TextInput
              id={id} value={login} data-autofocus autoComplete="off" spellCheck={false}
              invalid={!!(erreurLogin ?? formeErreur)} placeholder={actuel}
              onChange={(e) => { setLogin(e.target.value.toLowerCase().trim()); setErreurLogin(null) }}
            />
          )}
        </Field>

        {mode === 'moi' && (
          <Field label={t('admin.idChangeMotDePasse')} required hint={t('admin.idChangeMotDePasseAide')} error={erreurMdp}>
            {(id) => (
              <TextInput
                id={id} type="password" autoComplete="current-password"
                value={motDePasse} invalid={!!erreurMdp}
                onChange={(e) => setMotDePasse(e.target.value)}
              />
            )}
          </Field>
        )}
      </form>
    </Modal>
  )
}
