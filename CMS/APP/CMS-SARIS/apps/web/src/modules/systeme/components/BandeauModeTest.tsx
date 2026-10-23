/**
 * BandeauModeTest — le bandeau orange « MODE TEST », au sommet de l'application, pour TOUS.
 *
 * Même système, même base qu'en production : rien d'autre que ce bandeau ne distingue un centre en
 * mode test d'un centre en service. Il doit donc être impossible à manquer — c'est pourquoi il
 * sort volontairement de la palette sobre de l'application (jetons `--mode-test-*`) — et il se
 * montre à tout utilisateur connecté, pas seulement à l'administrateur qui l'a déclenché : le
 * médecin qui ouvre un dossier doit savoir que ce qu'il voit peut être fictif.
 *
 * L'administrateur y trouve aussi le moyen de revenir en production. Sur un poste de bureau, le
 * bandeau s'affiche (le poste reçoit le mode du serveur central) mais ne propose rien : un poste
 * ne change pas de mode.
 */

import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { FlaskConical } from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'
import { useParleAuCentral } from '@/stores/connectivity.store'
import { useModeModalStore } from '@/stores/modeModal.store'
import { useModeSysteme } from '../hooks/useModeSysteme'

export function BandeauModeTest() {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const { data } = useModeSysteme()
  const ouvrir = useModeModalStore((s) => s.ouvrir)
  const parleAuCentral = useParleAuCentral()

  if (data?.mode !== 'TEST') return null
  const peutRevenir = parleAuCentral && data.modifiable && has('systeme.mode')
  // Le serveur central seul fabrique des données de test (les postes les reçoivent par la synchronisation).
  const peutGererDonnees = parleAuCentral && has('systeme.donnees_test')

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap',
        padding: '5px 14px',
        background: 'var(--mode-test-fond)', color: 'var(--mode-test-texte)',
        borderBottom: '1px solid var(--mode-test-bordure)',
        fontSize: 'var(--font-size-caption)', lineHeight: 1.4, textAlign: 'center',
      }}
    >
      <FlaskConical size={14} style={{ flexShrink: 0 }} />
      <strong style={{ letterSpacing: '0.08em' }}>{t('modeSysteme.banniereTitre')}</strong>
      <span>{t('modeSysteme.banniereTexte')}</span>
      {data.parNom && (
        <span style={{ opacity: 0.8 }}>· {t('modeSysteme.activePar', { nom: data.parNom })}</span>
      )}
      {peutGererDonnees && (
        <Link
          to="/admin/donnees-test"
          style={{
            color: 'inherit', textDecoration: 'none',
            border: '1px solid currentColor', borderRadius: 9999,
            padding: '1px 10px', fontSize: 11, fontWeight: 700,
          }}
        >
          {t('donneesTest.titre')}
        </Link>
      )}
      {peutRevenir && (
        <button
          type="button"
          onClick={ouvrir}
          style={{
            background: 'transparent', color: 'inherit', cursor: 'pointer',
            border: '1px solid currentColor', borderRadius: 9999,
            padding: '1px 10px', fontSize: 11, fontWeight: 700,
          }}
        >
          {t('modeSysteme.revenir')}
        </button>
      )}
    </div>
  )
}
