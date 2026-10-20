/**
 * ChangerModeModal — passer en mode Test, ou revenir en production, MOT DE PASSE REDEMANDÉ.
 *
 * Le mot de passe est redemandé à chaque bascule, dans un sens comme dans l'autre : changer ce que
 * TOUT LE MONDE voit à l'écran est un geste qu'on ne laisse pas à une session restée ouverte sur
 * un poste partagé.
 *
 * Un mot de passe faux ne ferme pas la fenêtre : il est signalé sous le champ, qui est vidé et
 * reprend le focus (le serveur répond 403 — pas 401 : la session, elle, est valide).
 */

import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FlaskConical } from 'lucide-react'
import { Modal, Button, Field, TextInput } from '@/components/saris'
import { toast } from '@workspace/ui/components/sonner'
import { ApiError } from '@/lib/api'
import { useModeModalStore } from '@/stores/modeModal.store'
import { useChangerMode, useModeSysteme } from '../hooks/useModeSysteme'
import type { EtatModeSysteme, ModeSysteme } from '../api/systeme.api'

export function ChangerModeModal() {
  const ouverte = useModeModalStore((s) => s.ouverte)
  const fermer = useModeModalStore((s) => s.fermer)
  const { data: etat } = useModeSysteme()
  // Le contenu est monté à chaque ouverture : le mot de passe saisi ne survit jamais à la fenêtre.
  if (!ouverte || !etat) return null
  return <Contenu etat={etat} onClose={fermer} />
}

function codeDe(e: unknown): string | null {
  if (e instanceof ApiError && typeof e.body === 'object' && e.body !== null && 'code' in e.body) {
    const c = (e.body as { code: unknown }).code
    return typeof c === 'string' ? c : null
  }
  return null
}

function Contenu({ etat, onClose }: { etat: EtatModeSysteme; onClose: () => void }) {
  const { t } = useTranslation()
  const changer = useChangerMode()
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const cible: ModeSysteme = etat.mode === 'TEST' ? 'PRODUCTION' : 'TEST'
  const versTest = cible === 'TEST'

  function valider(e?: FormEvent) {
    e?.preventDefault()
    if (!motDePasse || changer.isPending) return
    setErreur(null)
    changer.mutate({ mode: cible, motDePasse }, {
      onSuccess: () => {
        onClose()
        toast.success(versTest ? t('modeSysteme.activeTest') : t('modeSysteme.retourProd'))
      },
      onError: (err) => {
        const code = codeDe(err)
        setErreur(
          code === 'MOT_DE_PASSE_INCORRECT' ? t('modeSysteme.motDePasseFaux')
            : code === 'MODE_TEST_VERROUILLE' ? t('modeSysteme.verrouErreur')
              : t('modeSysteme.erreur'),
        )
        setMotDePasse('')
      },
    })
  }

  return (
    <Modal
      icon={<FlaskConical size={18} />}
      tone={versTest ? 'warning' : 'accent'}
      title={versTest ? t('modeSysteme.entrerTitre') : t('modeSysteme.sortirTitre')}
      width={480}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant="primary" loading={changer.isPending} disabled={!motDePasse}
            onClick={() => valider()}
          >
            {versTest ? t('modeSysteme.confirmerEntrer') : t('modeSysteme.confirmerSortir')}
          </Button>
        </>
      }
    >
      <form onSubmit={valider} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--texte-secondaire)', lineHeight: 1.6 }}>
          {versTest ? t('modeSysteme.entrerCorps') : t('modeSysteme.sortirCorps')}
        </p>
        <Field label={t('modeSysteme.motDePasse')} hint={t('modeSysteme.motDePasseAide')} error={erreur}>
          {(id) => (
            <TextInput
              id={id} type="password" autoComplete="current-password" data-autofocus
              value={motDePasse} invalid={!!erreur}
              onChange={(e) => setMotDePasse(e.target.value)}
            />
          )}
        </Field>
      </form>
    </Modal>
  )
}
