/**
 * notifications.api.ts — feed de notifications (REST). Le flux temps réel (SSE)
 * est géré séparément dans le hook useNotificationStream.
 */
import { api } from '@/lib/api'

export type NiveauNotif = 'INFO' | 'SUCCES' | 'AVERTISSEMENT' | 'CRITIQUE'

export interface NotificationItem {
  id:                 string
  createdAt:          string
  destinataireId:     string | null
  siteId:             string | null
  requiredPermission: string | null
  type:               string
  niveau:             NiveauNotif
  titre:              string
  message:            string
  entiteType:         string | null
  entiteId:           string | null
  lien:               string | null
  createdById:        string | null
  lu:                 boolean
}

export interface CreateAnnoncePayload {
  titre:   string
  message: string
  niveau?: NiveauNotif
  portee?: 'SITE' | 'TOUS'
}

export const notificationsApi = {
  list:        (limit = 40) => api.get<NotificationItem[]>('/notifications', { limit }),
  annonce:     (p: CreateAnnoncePayload) => api.post<{ ok: boolean; id: string | null }>('/notifications/annonce', p),
  unreadCount: ()           => api.get<{ count: number }>('/notifications/unread-count'),
  markRead:    (id: string) => api.patch<{ ok: boolean }>(`/notifications/${id}/read`),
  markAllRead: ()           => api.post<{ marked: number }>('/notifications/read-all', {}),
  // Suppression « pour moi » (au survol / multi-sélection / tout supprimer).
  dismiss:     (id: string)    => api.post<{ ok: boolean }>(`/notifications/${id}/dismiss`, {}),
  dismissMany: (ids: string[]) => api.post<{ dismissed: number }>('/notifications/dismiss-many', { ids }),
  dismissAll:  ()              => api.post<{ dismissed: number }>('/notifications/dismiss-all', {}),
}
