/**
 * ViderActiviteModal — vider l'historique des échanges de synchronisation.
 *
 * Même geste que « Vider les journaux » du journal d'audit : irréversible, annoncé avec les
 * nombres réels, tracé au journal d'audit. Une différence, voulue : la QUARANTAINE.
 *
 * Un changement refusé par le serveur n'est ni perdu ni rejoué — le poste fait avancer son
 * curseur, et la copie gardée au serveur est la seule qui lui reste. Elle est donc CONSERVÉE
 * par défaut ; l'effacer est un choix explicite, signalé comme définitif.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, ShieldAlert } from 'lucide-react'
import { Modal, Button, CheckBox } from '@/components/saris'
import { toast } from '@workspace/ui/components/sonner'
import { formatNumber } from '@/lib/intl'
import { usePurgerActivite } from '../hooks/useSync'

interface Props {
  /** Ce que contient l'historique : annoncé tel quel, pas un « êtes-vous sûr ? » vague. */
  totaux: { echanges: number; quarantaine: number; conflitsAuto: number; echangesAvecRefus: number }
  onClose: () => void
}

export function ViderActiviteModal({ totaux, onClose }: Props) {
  const { t } = useTranslation()
  const purger = usePurgerActivite()
  const [aussiQuarantaine, setAussiQuarantaine] = useState(false)

  // Ce qui partira VRAIMENT : par défaut, les échanges qui portent un refus restent avec lui.
  const echangesAEffacer = totaux.echanges - (aussiQuarantaine ? 0 : totaux.echangesAvecRefus)
  const conflitsAEffacer = totaux.conflitsAuto + (aussiQuarantaine ? totaux.quarantaine : 0)

  function vider() {
    purger.mutate(aussiQuarantaine ? 'tout' : 'echanges', {
      onSuccess: (res) => {
        onClose()
        toast.success(
          t('admin.supPurgeDone', { echanges: formatNumber(res.echanges), conflits: formatNumber(res.conflits) })
          + (res.quarantaineConservee > 0
            ? ` ${t('admin.supPurgeDoneGarde', { count: res.quarantaineConservee })}`
            : ''),
        )
      },
      onError: () => toast.error(t('admin.supPurgeError')),
    })
  }

  return (
    <Modal
      icon={<Trash2 size={18} />}
      tone="error"
      title={t('admin.supPurgeTitle')}
      subtitle={t('admin.supPurgeSubtitle', {
        echanges: formatNumber(echangesAEffacer), conflits: formatNumber(conflitsAEffacer),
      })}
      width={500}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="danger" loading={purger.isPending} onClick={vider}>
            {t('admin.supPurgeConfirm')}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--texte-secondaire)', lineHeight: 1.6 }}>
          {t('admin.supPurgeBody')}
        </p>

        {totaux.quarantaine > 0 && (
          <>
            <div style={{
              display: 'flex', gap: 'var(--espace-2)', padding: 'var(--espace-3)',
              borderRadius: 'var(--radius-md)', background: 'var(--info-fond)', color: 'var(--info-texte)',
              fontSize: 'var(--font-size-caption)', lineHeight: 1.5,
            }}>
              <ShieldAlert size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{t('admin.supPurgeQuarantaine', { count: totaux.quarantaine })}</span>
            </div>

            <label style={{
              display: 'flex', alignItems: 'center', gap: 'var(--espace-2)', cursor: 'pointer',
              fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-primaire)',
            }}>
              <CheckBox
                checked={aussiQuarantaine} onChange={setAussiQuarantaine}
                aria-label={t('admin.supPurgeToutLabel', { count: totaux.quarantaine })}
              />
              {t('admin.supPurgeToutLabel', { count: formatNumber(totaux.quarantaine) })}
            </label>

            {aussiQuarantaine && (
              <p style={{
                margin: 0, padding: 'var(--espace-2) var(--espace-3)', borderRadius: 'var(--radius-md)',
                background: 'var(--erreur-fond)', color: 'var(--erreur-texte)',
                fontSize: 'var(--font-size-caption)', lineHeight: 1.5,
              }}>
                {t('admin.supPurgeToutAvert')}
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
