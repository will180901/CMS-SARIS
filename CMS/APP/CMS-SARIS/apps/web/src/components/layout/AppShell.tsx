import { Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar, SIDEBAR_RAIL } from './Sidebar'
import { TopHeader }        from './TopHeader'
import { DesktopTitleBar }  from './DesktopTitleBar'
import { isDesktop }        from '@/lib/desktop'
import { CguGate }          from '@/components/CguGate'
import { PermissionGate }   from '@/components/auth/PermissionGate'
import { useMyPreferences } from '@/modules/admin/hooks/useAdmin'
import { usePermissions }   from '@/hooks/usePermissions'
import { useIsMobile }      from '@/hooks/useMediaQuery'
import { useNavStackTracker } from '@/hooks/useNavStack'
import type { PermissionCode } from '@cms-saris/types'

// Pages d'accueil possibles → permission requise. Toute valeur hors de cette
// table est ignorée (évite une redirection vers une route inexistante qui
// bouclerait indéfiniment via le wildcard `*`).
const HOME_PERM: Record<string, PermissionCode> = {
  dashboard:            'dashboard.read',
  patients:             'patient.read',
  triage:               'visite.read',
  consultations:        'consultation.read',
  referentiels:         'referentiel.read',
  'admin/acces':        'utilisateur.read',
}
const HOME_ORDER = ['dashboard', 'patients', 'triage', 'consultations', 'referentiels', 'admin/acces']

/** Redirige vers la page d'accueil préférée — uniquement si connue ET autorisée,
 *  sinon vers la première page accessible (jamais une route inexistante). */
function RootRedirect() {
  const { has } = usePermissions()
  const { data: pref, isLoading } = useMyPreferences()
  if (isLoading) return null

  const firstAllowed = HOME_ORDER.find(p => has(HOME_PERM[p])) ?? 'dashboard'
  const cible = pref?.pageAccueil ?? ''
  const perm  = HOME_PERM[cible]
  const target = perm && has(perm) ? cible : firstAllowed

  return <Navigate to={`/${target}`} replace />
}

// ── Pages réelles ─────────────────────────────────────────────────────────────
import { ReferentielsPage } from '@/modules/referentiels/pages/ReferentielsPage'
import { PatientsPage }     from '@/modules/patients/pages/PatientsPage'
import { DossierPage }      from '@/modules/patients/pages/DossierPage'
import { TriagePage }       from '@/modules/triage/pages/TriagePage'
import { ConsultationPage } from '@/modules/consultation/pages/ConsultationPage'
import { AccesPage }        from '@/modules/admin/pages/AccesPage'
import { AuditPage }        from '@/modules/admin/pages/AuditPage'
import { DashboardPage }    from '@/modules/dashboard/pages/DashboardPage'
import { ParametresPage }   from '@/modules/admin/pages/ParametresPage'
import { SynchronisationPage } from '@/modules/admin/pages/SynchronisationPage'
import { SortiesCritiquesPage } from '@/modules/sorties-critiques/pages/SortiesCritiquesPage'
import { MessageriePage }    from '@/modules/messagerie/pages/MessageriePage'

// ── Shell principal ───────────────────────────────────────────────────────────

export function AppShell() {
  const isMobile = useIsMobile()
  useNavStackTracker()   // alimente la pile avant/arrière du header
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {isDesktop && <DesktopTitleBar />}
      <div className="flex flex-1 min-h-0 overflow-hidden">
      <CguGate />
      <Sidebar />

      <main
        className="flex-1 overflow-hidden flex flex-col saris-grain-strong"
        style={{ backgroundColor: 'var(--fond-page)', marginLeft: isMobile ? 0 : SIDEBAR_RAIL }}
      >
        <TopHeader />
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: isMobile ? '0 var(--espace-2) var(--espace-2)' : '0 var(--espace-4) var(--espace-4)' }}>
        <Routes>
          {/* Redirection racine → page d'accueil préférée */}
          <Route path="/" element={<RootRedirect />} />

          {/* ── Clinique ─────────────────────────────────────────────────── */}
          <Route
            path="/dashboard"
            element={
              <PermissionGate any={['dashboard.read']}>
                <DashboardPage />
              </PermissionGate>
            }
          />

          <Route
            path="/patients"
            element={
              <PermissionGate any={['patient.read']}>
                <PatientsPage />
              </PermissionGate>
            }
          />

          <Route
            path="/patients/:id"
            element={
              <PermissionGate any={['patient.read']}>
                <DossierPage />
              </PermissionGate>
            }
          />

          <Route
            path="/triage"
            element={
              <PermissionGate any={['visite.read']}>
                <TriagePage />
              </PermissionGate>
            }
          />

          <Route
            path="/consultations"
            element={
              <PermissionGate any={['consultation.read']}>
                <ConsultationPage />
              </PermissionGate>
            }
          />

          <Route
            path="/sorties-critiques"
            element={
              <PermissionGate any={['evacuation.read']}>
                <SortiesCritiquesPage />
              </PermissionGate>
            }
          />

          <Route
            path="/messagerie"
            element={
              <PermissionGate any={['messagerie.read']}>
                <MessageriePage />
              </PermissionGate>
            }
          />

          {/* ── Administration médicale ──────────────────────────────────── */}
          <Route
            path="/referentiels"
            element={
              <PermissionGate any={['referentiel.read']}>
                <ReferentielsPage />
              </PermissionGate>
            }
          />

          {/* ── Administration système ───────────────────────────────────── */}
          <Route
            path="/admin/acces"
            element={
              <PermissionGate any={['utilisateur.read', 'role.read', 'delegation.read']}>
                <AccesPage />
              </PermissionGate>
            }
          />
          {/* Anciennes routes → module unifié « Accès & habilitations » */}
          <Route path="/admin/utilisateurs" element={<Navigate to="/admin/acces" replace />} />
          <Route path="/admin/roles"        element={<Navigate to="/admin/acces" replace />} />

          <Route
            path="/admin/audit"
            element={
              <PermissionGate any={['audit.read']}>
                <AuditPage />
              </PermissionGate>
            }
          />

          {/* Accessible à tout utilisateur connecté : la section Personnel
              (préférences, mot de passe, 2FA, sessions) est en self-service.
              L'onglet Généraux (système) se restreint lui-même à parametre.read. */}
          <Route
            path="/admin/parametres"
            element={<ParametresPage />}
          />

          {/* ── Système ──────────────────────────────────────────────────── */}
          <Route
            path="/synchronisation"
            element={
              <PermissionGate any={['synchronisation.read']}>
                <SynchronisationPage />
              </PermissionGate>
            }
          />

          {/* Fallback → page d'accueil préférée */}
          <Route path="*" element={<RootRedirect />} />
        </Routes>
        </div>
      </main>
      </div>
    </div>
  )
}
