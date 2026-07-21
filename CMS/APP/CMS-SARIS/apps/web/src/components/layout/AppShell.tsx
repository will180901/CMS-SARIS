import { lazy, Suspense } from 'react'
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
// ⚠️ Doit rester aligné sur NAV_GROUPS (navigation.config.ts) ET sur la liste de choix
// « page d'accueil » des préférences (PersonnelTab.tsx) : une page proposée à l'utilisateur
// mais absente d'ici serait silencieusement ignorée au profit de la 1re page autorisée.
const HOME_PERM: Record<string, PermissionCode> = {
  dashboard:            'dashboard.read',
  rapports:             'consultation.read',
  patients:             'patient.read',
  triage:               'visite.read',
  consultations:        'consultation.read',
  messagerie:           'messagerie.read',
  referentiels:         'referentiel.read',
  'admin/acces':        'utilisateur.read',
}
const HOME_ORDER = ['dashboard', 'triage', 'patients', 'consultations', 'rapports', 'messagerie', 'referentiels', 'admin/acces']

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
// Chargées à la demande (une route = un chunk) : le bundle initial n'embarque plus
// tous les modules métier d'un coup (référentiels, messagerie, admin…), seulement
// la route effectivement visitée.
const ReferentielsPage    = lazy(() => import('@/modules/referentiels/pages/ReferentielsPage').then(m => ({ default: m.ReferentielsPage })))
const PatientsPage        = lazy(() => import('@/modules/patients/pages/PatientsPage').then(m => ({ default: m.PatientsPage })))
const DossierPage         = lazy(() => import('@/modules/patients/pages/DossierPage').then(m => ({ default: m.DossierPage })))
const TriagePage          = lazy(() => import('@/modules/triage/pages/TriagePage').then(m => ({ default: m.TriagePage })))
const ConsultationPage    = lazy(() => import('@/modules/consultation/pages/ConsultationPage').then(m => ({ default: m.ConsultationPage })))
const AccesPage           = lazy(() => import('@/modules/admin/pages/AccesPage').then(m => ({ default: m.AccesPage })))
const AuditPage           = lazy(() => import('@/modules/admin/pages/AuditPage').then(m => ({ default: m.AuditPage })))
const DashboardPage       = lazy(() => import('@/modules/dashboard/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const RapportsPage        = lazy(() => import('@/modules/rapports/pages/RapportsPage').then(m => ({ default: m.RapportsPage })))
const ParametresPage      = lazy(() => import('@/modules/admin/pages/ParametresPage').then(m => ({ default: m.ParametresPage })))
const ParametresSystemePage = lazy(() => import('@/modules/admin/pages/ParametresSystemePage').then(m => ({ default: m.ParametresSystemePage })))
const SynchronisationPage = lazy(() => import('@/modules/admin/pages/SynchronisationPage').then(m => ({ default: m.SynchronisationPage })))
const MessageriePage      = lazy(() => import('@/modules/messagerie/pages/MessageriePage').then(m => ({ default: m.MessageriePage })))

/** Fallback de route (Suspense) — même langage visuel que LoadingScreen, mais scopé à
 *  la zone de contenu (pas un overlay plein écran par-dessus sidebar/header déjà montés). */
function RouteLoader() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div
        className="h-9 w-9 animate-spin rounded-full border-[3px] border-muted border-t-primary"
        role="status"
        aria-label="Chargement"
      />
    </div>
  )
}

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
        <Suspense fallback={<RouteLoader />}>
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
            path="/rapports"
            element={
              <PermissionGate any={['consultation.read']}>
                <RapportsPage />
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
          {/* Les 4 permissions correspondent aux 4 onglets de la page (comptes, rôles,
              personnel soignant, délégations) — `personnel.read` manquait, ce qui
              bloquait l'accès à un profil n'ayant QUE cet onglet. */}
          <Route
            path="/admin/acces"
            element={
              <PermissionGate any={['utilisateur.read', 'role.read', 'personnel.read', 'delegation.read']}>
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

          {/* Accessible à tout utilisateur connecté : cette page ne porte QUE les réglages
              personnels (préférences, mot de passe, 2FA, sessions) — self-service. */}
          <Route
            path="/admin/parametres"
            element={<ParametresPage />}
          />

          {/* Paramètres SYSTÈME (appliqués à tout le centre) — page distincte et gardée. */}
          <Route
            path="/admin/parametres-systeme"
            element={
              <PermissionGate any={['parametre.read']}>
                <ParametresSystemePage />
              </PermissionGate>
            }
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
        </Suspense>
        </div>
      </main>
      </div>
    </div>
  )
}
