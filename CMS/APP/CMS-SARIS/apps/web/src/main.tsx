import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "@workspace/ui/globals.css"
import "./i18n/config"
import { App } from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { QueryProvider } from "@/providers/query-provider.tsx"
import { ThemedToaster } from "@/components/ThemedToaster"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { installerFiletChunkObsolete, reinitialiserTentative } from "@/lib/stale-chunk"

// Après un déploiement, un onglet ouvert peut réclamer un fichier de page qui
// n'existe plus. On intercepte AVANT React pour recharger au lieu de casser.
installerFiletChunkObsolete()
// L'application démarre : une éventuelle tentative précédente a abouti.
reinitialiserTentative()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryProvider>
        <TooltipProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
          {/* Toasts — centré en haut, durée 4s */}
          <ThemedToaster
            position="top-center"
            duration={4000}
            richColors
            closeButton
          />
        </TooltipProvider>
      </QueryProvider>
    </ThemeProvider>
  </StrictMode>
)
