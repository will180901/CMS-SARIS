import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { ApiError } from '@/lib/api'

/**
 * QueryClient configuré pour CMS SARIS offline-first.
 *
 * Choix :
 *   - staleTime 5 min    : les données serveur restent "fraîches" 5 min
 *   - gcTime 30 min      : les données restent en cache même sans composant actif
 *   - retry 1            : 1 re-tentative sur erreur réseau (pas sur 4xx)
 *   - refetchOnWindowFocus false : on ne re-fetch pas au focus (offline-first)
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:           5 * 60 * 1000,  // 5 minutes
      gcTime:             30 * 60 * 1000,  // 30 minutes
      retry: (failureCount, error) => {
        // Pas de retry sur les erreurs 4xx (auth, validation, not found)
        if (error instanceof ApiError && error.status < 500) return false
        return failureCount < 1
      },
      refetchOnWindowFocus:      false,
      refetchOnReconnect:        true,  // Re-fetch quand la connexion revient
    },
    mutations: {
      retry: 0,
    },
  },
})

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
