import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "@workspace/ui/globals.css"
import "./i18n/config"
import { App } from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { QueryProvider } from "@/providers/query-provider.tsx"
import { Toaster } from "@workspace/ui/components/sonner"
import { ErrorBoundary } from "@/components/ErrorBoundary"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryProvider>
        <TooltipProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
          {/* Toasts — centré en haut, durée 4s */}
          <Toaster
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
