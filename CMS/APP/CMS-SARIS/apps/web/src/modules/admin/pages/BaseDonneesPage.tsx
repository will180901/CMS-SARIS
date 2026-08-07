/**
 * BaseDonneesPage — sauvegardes et volumétrie des données.
 *
 * Ces deux sujets vivaient dans « Synchronisation », derrière deux onglets. Ils n'y
 * avaient pas leur place : restaurer une sauvegarde ou lire des compteurs de stockage
 * n'a rien à voir avec surveiller un parc de postes. Les mêler obligeait à traverser un
 * tableau de bord d'exploitation pour un geste d'administration courant — et, dans
 * l'autre sens, noyait l'état du parc sous des informations sans rapport.
 *
 * Les deux blocs sont réutilisés tels quels depuis SynchronisationPage : ils étaient
 * déjà autonomes, seul leur emplacement changeait.
 */
import { useTranslation } from 'react-i18next'
import { Database } from 'lucide-react'
import { PageHeader } from '@/components/saris'
import { usePermissions } from '@/hooks/usePermissions'
import { useSyncStatus, useSauvegardes } from '../hooks/useAdmin'
import { SauvegardesZone, VolumetrieZone } from './SynchronisationPage'

export function BaseDonneesPage() {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canRestore = has('synchronisation.restore')

  const { data: status, isLoading: ls } = useSyncStatus()
  const { data: sauvegardes = [], isLoading: lh } = useSauvegardes()

  const totalEnregistrements = status?.modules.reduce((a, m) => a + m.count, 0) ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <PageHeader
        icon={<Database size={18} />}
        title={t('admin.bddPageTitle', { defaultValue: 'Base de données' })}
        subtitle={t('admin.bddPageSubtitle', {
          defaultValue: 'Sauvegardes de configuration et volumétrie des données',
        })}
        tone="neutral"
      />

      <div style={{
        padding: 'var(--espace-4) var(--espace-6) var(--espace-6)',
        display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)',
      }}>
        {/* Les sauvegardes d'abord : c'est ce qu'on vient chercher ici, la volumétrie
            n'étant qu'une lecture d'état. */}
        <SauvegardesZone
          sauvegardes={sauvegardes}
          loading={lh}
          canRestore={canRestore}
          planification={status?.planification}
        />
        <VolumetrieZone status={status} loading={ls} total={totalEnregistrements} />
      </div>
    </div>
  )
}
