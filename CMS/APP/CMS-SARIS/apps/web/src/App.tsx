import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useSessionStore } from '@/stores/session.store'
import { AppShell }   from '@/components/layout/AppShell'
import { LoginPage }  from '@/modules/auth/pages/LoginPage'
import { SessionBootstrap } from '@/modules/auth/components/SessionBootstrap'
import { ConfirmationSiteModal } from '@/modules/auth/components/ConfirmationSiteModal'
import { PreferencesSync } from '@/components/PreferencesSync'
import { LoadingScreen } from '@/components/LoadingScreen'
import { desktopBridge } from '@/lib/desktop'

export function App() {
  const isAuthenticated = useSessionStore(s => s.isAuthenticated)
  const hasHydrated     = useSessionStore(s => s._hasHydrated)

  // Desktop (Electron) uniquement : la fenêtre suit l'état d'authentification — petite
  // sur /login (même gabarit que les écrans de config), pleine une fois connecté. Couvre
  // aussi le retour à /login après déconnexion/expiration (isAuthenticated repasse à false).
  useEffect(() => {
    if (!hasHydrated) return
    desktopBridge()?.setWindowMode(isAuthenticated ? 'app' : 'login')
  }, [isAuthenticated, hasHydrated])

  // Tant que la session n'est pas hydratée (lecture du stockage), on ne sait pas encore si
  // l'utilisateur est connecté → écran neutre, PAS l'écran de connexion (sinon flash au démarrage).
  if (!hasHydrated) return <LoadingScreen />

  return (
    <BrowserRouter>
      {isAuthenticated ? (
        // ── Shell principal (modules) ──────────────────────────────────────
        <>
          {/* Re-synchronise les permissions au démarrage de l'app */}
          <SessionBootstrap />
          {/* Applique les préférences (thème, densité, langue) de l'utilisateur */}
          <PreferencesSync />
          {/* Confirmation du site de travail — bloquante, une fois par session (web). */}
          <ConfirmationSiteModal />
          <AppShell />
        </>
      ) : (
        // ── Authentification ───────────────────────────────────────────────
        // Toute URL autre que /login est redirigée → l'URL reflète la réalité
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*"      element={<Navigate to="/login" replace />} />
        </Routes>
      )}
    </BrowserRouter>
  )
}
