/**
 * ModeSystemeSwitch — l'interrupteur Production / Test de l'en-tête.
 *
 * Réservé à l'administrateur système (droit `systeme.mode`) et à un écran qui parle au serveur CENTRAL :
 * la version web, ou le poste de bureau tant qu'il est connecté. Hors ligne, l'écran parle au service local, qui
 * reçoit le mode du central et ne le change pas. Un clic n'inverse rien tout de
 * suite : il ouvre la fenêtre qui redemande le mot de passe (cf. ChangerModeModal).
 *
 * Absent si le serveur interdit le mode Test (verrou de mise en service) : une fois le centre en
 * service réel, il n'y a plus rien à basculer, et un interrupteur condamné ne ferait que tenter.
 */

import { useTranslation } from 'react-i18next'
import { FlaskConical } from 'lucide-react'
import { Tooltip } from '@/components/saris'
import { usePermissions } from '@/hooks/usePermissions'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useParleAuCentral } from '@/stores/connectivity.store'
import { useModeModalStore } from '@/stores/modeModal.store'
import { useModeSysteme } from '../hooks/useModeSysteme'

export function ModeSystemeSwitch() {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const { data } = useModeSysteme()
  const isMobile = useIsMobile()
  const ouvrir = useModeModalStore((s) => s.ouvrir)
  const parleAuCentral = useParleAuCentral()

  if (!parleAuCentral || !has('systeme.mode') || !data || !data.modifiable || data.verrouille) return null
  const test = data.mode === 'TEST'

  return (
    <Tooltip label={test ? t('modeSysteme.infoTest') : t('modeSysteme.infoProduction')}>
      <button
        type="button"
        role="switch"
        aria-checked={test}
        aria-label={t('modeSysteme.interrupteurAria')}
        onClick={ouvrir}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          height: 30, padding: '0 9px', borderRadius: 9999, cursor: 'pointer',
          fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
          border: test ? '1px solid var(--mode-test-bordure)' : '1px solid transparent',
          background: test ? 'var(--mode-test-fond)' : 'transparent',
          color: test ? 'var(--mode-test-texte)' : 'var(--texte-tertiaire)',
          transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => { if (!test) e.currentTarget.style.background = 'var(--fond-surface-2)' }}
        onMouseLeave={(e) => { if (!test) e.currentTarget.style.background = 'transparent' }}
      >
        <FlaskConical size={14} />
        {!isMobile && <span>{test ? t('modeSysteme.test') : t('modeSysteme.production')}</span>}
        {/* Rail + bouton coulissant, comme l'interrupteur du rideau de confidentialité */}
        <span aria-hidden="true" style={{
          position: 'relative', width: 34, height: 19, borderRadius: 9999, flexShrink: 0,
          background: test ? 'var(--mode-test-texte)' : 'var(--bordure-normale)',
          transition: 'background 0.18s',
        }}>
          <span style={{
            position: 'absolute', top: 2, left: test ? 17 : 2,
            width: 15, height: 15, borderRadius: 9999,
            background: test ? 'var(--mode-test-fond)' : '#fff',
            boxShadow: '0 1px 2px rgba(15,23,42,0.28)',
            transition: 'left 0.18s',
          }} />
        </span>
      </button>
    </Tooltip>
  )
}
