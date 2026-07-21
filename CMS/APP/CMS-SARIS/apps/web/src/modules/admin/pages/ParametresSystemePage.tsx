/**
 * ParametresSystemePage — paramètres appliqués à TOUT le centre (sécurité, politique de
 * mot de passe, notifications). Réservée à `parametre.read` ; l'écriture exige en plus
 * `parametre.update` (sinon bandeau lecture seule géré par GenerauxTab lui-même).
 *
 * Distincte de ParametresPage (`/admin/parametres`), qui ne porte plus que les réglages
 * PERSONNELS du compte connecté, en self-service pour tout le monde.
 */

import { useState } from 'react'
import { SlidersHorizontal, ShieldCheck, Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/saris'
import { usePermissions } from '@/hooks/usePermissions'
import { useIsCompact } from '@/hooks/useMediaQuery'
import { GenerauxTab } from '../components/parametres/GenerauxTab'
import { SettingsSubNav, type SettingsSectionItem } from '../components/parametres/SettingsSubNav'

/** Groupes système combinés sous UNE entrée de sous-nav « Sécurité & mot de passe »
 *  (au lieu de 2 entrées séparées) — cf. GenerauxTab, qui rend un groupe par carte. */
const SECURITY_GROUPS = ['Sécurité & authentification', 'Politique de mot de passe']

export function ParametresSystemePage() {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const isCompact = useIsCompact()
  const canWrite = has('parametre.update')

  // La clé d'une section = le nom du groupe de paramètres côté serveur (filtrage direct),
  // sauf « securite-mdp » qui en regroupe deux.
  const sections: SettingsSectionItem[] = [
    { key: 'securite-mdp', label: t('settings.genSecurityPassword'), icon: <ShieldCheck size={15} />, hint: t('settings.genSecurityPasswordHint') },
    { key: 'Notifications', label: t('settings.genNotifications'), icon: <Bell size={15} />, hint: t('settings.genNotificationsHint') },
  ]

  const [sub, setSub] = useState<string>(sections[0]!.key)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <PageHeader
        icon={<SlidersHorizontal size={18} />}
        title={t('settings.sysTitle')}
        subtitle={t('settings.sysSubtitle')}
      />

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: isCompact ? 'column' : 'row', gap: 'var(--espace-5)', padding: 'var(--espace-4) var(--espace-6) var(--espace-6)' }}>
        <SettingsSubNav items={sections} value={sub} onChange={setSub} compact={isCompact} />
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto' }}>
          <GenerauxTab canWrite={canWrite} section={sub === 'securite-mdp' ? SECURITY_GROUPS : sub} />
        </div>
      </div>
    </div>
  )
}
