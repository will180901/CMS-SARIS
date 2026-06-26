/**
 * Hooks notifications : feed + compteur non-lus + actions + flux temps réel (SSE).
 *
 * useNotificationStream() ouvre un EventSource sur /notifications/stream?token=…
 * (EventSource ne supportant pas l'en-tête Authorization). À chaque notification
 * poussée, on invalide les queries → la cloche et le drawer se mettent à jour
 * instantanément. Reconnexion automatique (EventSource) + sur rotation du token.
 */
import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@workspace/ui/components/sonner'
import { BASE_URL } from '@/lib/api'
import { useSessionStore } from '@/stores/session.store'
import { useConnectivityStore } from '@/stores/connectivity.store'
import { playSound } from '@/lib/sounds'
import { useTypingStore } from '@/stores/typing.store'
import { notificationsApi, type NotificationItem } from '../api/notifications.api'

export const NOTIF_KEY = ['notifications'] as const

/** Décode le `sid` (identifiant de session) du payload du JWT d'accès courant. */
function sidFromToken(token: string | null): string | null {
  if (!token) return null
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return (JSON.parse(atob(b64)) as { sid?: string }).sid ?? null
  } catch {
    return null
  }
}

/**
 * Carte « réseau de neurones » : chaque type d'événement SSE poussé par le backend
 * invalide les caches concernés → toute création/édition/suppression (par soi OU
 * par un autre utilisateur) se propage INSTANTANÉMENT, sans bouton actualiser.
 */
const SSE_INVALIDATIONS: Record<string, readonly (readonly string[])[]> = {
  // (notifications persistées → feed + cloche + son ci-dessous)
  PATIENT_CREE:             [['patients'], ['dashboard']],
  VISITE_CREE:              [['visites'], ['dashboard']],
  CONSULTATION_OUVERTE:     [['consultations'], ['visites'], ['dashboard']],
  CONSULTATION_CLOTUREE:    [['consultations'], ['visites'], ['dashboard']],
  ORDONNANCE_VALIDEE:       [['consultations'], ['bons-examen']],
  SUIVI_CHRONIQUE_OUVERT:   [['suivis-chroniques'], ['dashboard']],
  EVACUATION_INITIEE:       [['evacuations'], ['dashboard']],
  ACCIDENT_TRAVAIL_DECLARE: [['accidents-travail'], ['dashboard']],
  UTILISATEUR_CREE:         [['admin', 'utilisateurs'], ['acteurs']],
  UTILISATEUR_DESACTIVE:    [['admin', 'utilisateurs'], ['acteurs']],
  UTILISATEUR_REACTIVE:     [['admin', 'utilisateurs'], ['acteurs']],
  UTILISATEUR_SUPPRIME:     [['admin', 'utilisateurs'], ['acteurs']],
  ROLE_MODIFIE:             [['admin', 'roles'], ['admin', 'utilisateurs']],
}

/**
 * Événements LIVE SILENCIEUX (non persistés) : rafraîchissent les listes SANS
 * cloche, son ni toast (référentiels, acteurs, bons d'examen, synchronisation).
 */
const LIVE_INVALIDATIONS: Record<string, readonly (readonly string[])[]> = {
  LIVE_REFERENTIELS: [['referentiels']],
  LIVE_ACTEURS:      [['acteurs']],
  LIVE_BONS_EXAMEN:  [['bons-examen']],
  LIVE_TRIAGE:       [['visites']],
  // Une consultation impacte aussi la file de triage (la visite envoyée en consultation
  // quitte la file active) → rafraîchir ['visites'] sur tous les postes.
  LIVE_CONSULTATION: [['consultations'], ['visites']],
  LIVE_SYNC:         [['admin', 'sync']],
  SYNC_ACTIVITY:     [['admin', 'sync']],
}

export function useNotificationsFeed(enabled = true) {
  return useQuery({
    queryKey: [...NOTIF_KEY, 'feed'],
    queryFn:  () => notificationsApi.list(40),
    enabled,
    staleTime: 15_000,
    refetchInterval: 90_000, // filet de sécurité ; le SSE assure l'instantané
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: [...NOTIF_KEY, 'unread'],
    queryFn:  () => notificationsApi.unreadCount(),
    staleTime: 15_000,
    refetchInterval: 90_000,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: NOTIF_KEY }) },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: NOTIF_KEY }) },
  })
}

/** Émettre une annonce diffusée (admin système — notification.create). */
export function useCreateAnnonce() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: import('../api/notifications.api').CreateAnnoncePayload) => notificationsApi.annonce(p),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: NOTIF_KEY }) },
  })
}

/** Supprimer « pour moi » : une, plusieurs, ou toutes les notifications. */
export function useDismissNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationsApi.dismiss(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: NOTIF_KEY }) },
  })
}

export function useDismissManyNotifications() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => notificationsApi.dismissMany(ids),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: NOTIF_KEY }) },
  })
}

export function useDismissAllNotifications() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => notificationsApi.dismissAll(),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: NOTIF_KEY }) },
  })
}

/** Ouvre le flux SSE et rafraîchit la cloche en temps réel. À appeler une seule fois (header). */
export function useNotificationStream() {
  const qc       = useQueryClient()
  const token    = useSessionStore(s => s.token)
  // version ++ à chaque bascule online↔offline (client de bureau) → on RECONNECTE le SSE
  // sur le backend actif (central en ligne = temps réel instantané ; local hors-ligne).
  const endpoint = useConnectivityStore(s => s.version)
  const esRef    = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!token) return
    const url = `${BASE_URL}/notifications/stream?token=${encodeURIComponent(token)}`
    const es  = new EventSource(url)
    esRef.current = es

    es.onmessage = (ev) => {
      try {
        const n = JSON.parse(ev.data) as NotificationItem
        // SESSION UNIQUE : MA session a-t-elle été révoquée (compte ouvert sur un autre poste) ?
        // `entiteId` = sids révoqués (CSV). Si MON sid y est → déconnexion IMMÉDIATE.
        if (n.type === 'SESSION_REVOKED') {
          const mySid = sidFromToken(useSessionStore.getState().token)
          if (mySid && (n.entiteId ?? '').split(',').includes(mySid)) {
            toast.error('Session fermée', { description: 'Votre compte a été ouvert sur un autre poste.' })
            useSessionStore.getState().clearSession()
          }
          return
        }
        // Mise à jour temps réel des accusés (✓✓ gris/bleu) : on rafraîchit juste
        // le fil ouvert, sans toucher au feed/cloche.
        if (n.type === 'MESSAGE_STATUS') { qc.invalidateQueries({ queryKey: ['messagerie', 'thread'] }); return }
        // « En train d'écrire » : événement éphémère → réarme la bulle animée (aucune cloche/son).
        if (n.type === 'TYPING') { if (n.entiteId) useTypingStore.getState().ping(n.entiteId, 'text'); return }
        if (n.type === 'TYPING_AUDIO') { if (n.entiteId) useTypingStore.getState().ping(n.entiteId, 'audio'); return }
        // Message reçu dans la conversation ACTIVE (déjà ouverte) : on met à jour le fil
        // et les listes, mais SANS cloche ni son — le message est déjà sous les yeux.
        if (n.type === 'MESSAGE_NEW') { qc.invalidateQueries({ queryKey: ['messagerie'] }); return }
        // Événements LIVE silencieux : rafraîchir les listes, sans cloche/son/toast.
        const live = LIVE_INVALIDATIONS[n.type]
        if (live) { for (const key of live) qc.invalidateQueries({ queryKey: key }); return }
        // Rafraîchit cloche + feed immédiatement.
        qc.invalidateQueries({ queryKey: NOTIF_KEY })
        // Un message reçu rafraîchit aussi la messagerie (liste + fil + compteur).
        if (n.type === 'MESSAGE') { qc.invalidateQueries({ queryKey: ['messagerie'] }); playSound('received') }
        else playSound('notification')
        // Propagation temps réel vers les modules concernés (réseau de neurones).
        const targets = SSE_INVALIDATIONS[n.type]
        if (targets) for (const key of targets) qc.invalidateQueries({ queryKey: key })
        // Toast discret pour les niveaux importants.
        if (n.niveau === 'CRITIQUE')        toast.error(n.titre, { description: n.message })
        else if (n.niveau === 'AVERTISSEMENT') toast.warning(n.titre, { description: n.message })
        else if (n.niveau === 'SUCCES')     toast.success(n.titre, { description: n.message })
      } catch { /* ignore payloads malformés */ }
    }

    // EventSource gère sa propre reconnexion ; on log silencieusement.
    es.onerror = () => { /* reconnexion auto par le navigateur */ }

    return () => { es.close(); esRef.current = null }
  }, [token, qc, endpoint])
}
