/**
 * AccesPage — « Accès & habilitations » : UN SEUL corps unifié pour gérer les
 * UTILISATEURS et les RÔLES & PERMISSIONS. En-tête unique + onglets intégrés
 * (SegmentedTabs) ; chaque page est rendue en mode `embedded` (son gros en-tête
 * redondant est masqué — l'en-tête + les onglets ci-dessous le remplacent).
 * Remplace les 2 entrées de menu séparées /admin/utilisateurs + /admin/roles.
 */
import { ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SegmentedTabs } from '@/components/saris'
import { usePermissions } from '@/hooks/usePermissions'
import { useIsCompact } from '@/hooks/useMediaQuery'
import { usePersistedState } from '@/hooks/usePersistedState'
import { UtilisateursPage } from './UtilisateursPage'
import { RolesPage } from './RolesPage'
import { DelegationsTab } from '@/modules/acteurs/tabs/DelegationsTab'
import { PersonnelSoignantTab } from '@/modules/acteurs/tabs/PersonnelSoignantTab'

export function AccesPage() {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const isCompact = useIsCompact()
  const canUsers = has('utilisateur.read')
  const canRoles = has('role.read')
  const canPersonnel = has('personnel.read')
  const canDeleg = has('delegation.read')   // le médecin-chef gère ici ses délégations

  const tabs = [
    ...(canUsers ? [{ key: 'users', label: 'Utilisateurs' }] : []),
    ...(canRoles ? [{ key: 'roles', label: 'Rôles & permissions' }] : []),
    ...(canPersonnel ? [{ key: 'personnel', label: t('personnelSoignant.tab', { defaultValue: 'Personnel soignant' }) }] : []),
    ...(canDeleg ? [{ key: 'delegations', label: 'Délégations' }] : []),
  ]
  const [tab, setTab] = usePersistedState<string>('acces', 'tab', tabs[0]?.key ?? 'users')
  const active = tabs.some(t => t.key === tab) ? tab : (tabs[0]?.key ?? 'users')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* En-tête unifié + onglets intégrés (un seul corps) */}
      <div style={{ flexShrink: 0, padding: 'var(--espace-5) var(--espace-6) 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-3)', marginBottom: 'var(--espace-4)' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 'var(--radius-lg)', flexShrink: 0,
            background: 'var(--ap-50)', color: 'var(--ap-600)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldCheck size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 'var(--font-size-h2)', fontWeight: 700, color: 'var(--texte-primaire)', lineHeight: 1.15 }}>
              Accès &amp; habilitations
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-tertiaire)' }}>
              Comptes, rôles et permissions — gérés au même endroit
            </p>
          </div>
        </div>
        <SegmentedTabs value={active} onChange={setTab} tabs={tabs} />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: isCompact ? 'auto' : 'hidden' }}>
        {active === 'users' && canUsers && <UtilisateursPage embedded />}
        {active === 'roles' && canRoles && <RolesPage embedded />}
        {active === 'personnel' && canPersonnel && (
          <div style={{ height: isCompact ? 'auto' : '100%', padding: '0 var(--espace-6)' }}>
            <PersonnelSoignantTab
              canCreate={has('personnel.create')}
              canUpdate={has('personnel.update')}
              canDelete={has('personnel.delete')}
            />
          </div>
        )}
        {active === 'delegations' && canDeleg && (
          <div style={{ height: isCompact ? 'auto' : '100%', padding: '0 var(--espace-6)' }}>
            <DelegationsTab
              canCreate={has('delegation.create')}
              canUpdate={has('delegation.update')}
              canRevoke={has('delegation.revoke')}
              canDelete={has('delegation.delete')}
            />
          </div>
        )}
      </div>
    </div>
  )
}
