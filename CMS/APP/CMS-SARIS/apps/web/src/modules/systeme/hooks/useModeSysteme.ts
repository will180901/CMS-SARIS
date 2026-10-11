/**
 * Hooks du mode du système (production / test).
 *
 * Le mode est le même pour tout le monde : une seule clé de cache, partagée. Il se met à jour de
 * trois façons — l'événement temps réel `SYSTEME_MODE` (instantané, cf. LIVE_INVALIDATIONS), un
 * relevé toutes les minutes (filet de sécurité), et la réponse même du changement.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '@/stores/session.store'
import { systemeApi, type ModeSysteme } from '../api/systeme.api'

export const MODE_KEY = ['systeme', 'mode'] as const

export function useModeSysteme() {
  // Rien à demander tant que personne n'est connecté (page de connexion).
  const connecte = useSessionStore((s) => !!s.token)
  return useQuery({
    queryKey: MODE_KEY,
    queryFn: () => systemeApi.mode(),
    enabled: connecte,
    staleTime: 15_000,
    refetchInterval: 60_000,
  })
}

export function useChangerMode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ mode, motDePasse }: { mode: ModeSysteme; motDePasse: string }) =>
      systemeApi.changerMode(mode, motDePasse),
    // Le serveur renvoie le nouvel état : on l'affiche tout de suite, sans second aller-retour.
    onSuccess: (etat) => { qc.setQueryData(MODE_KEY, etat) },
  })
}
