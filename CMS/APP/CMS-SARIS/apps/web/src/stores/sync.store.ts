import { create } from 'zustand'

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

interface SyncState {
  status:       SyncStatus
  pendingCount: number
  lastSyncAt:   Date | null
  errorMessage: string | null

  setStatus:       (status: SyncStatus) => void
  setPendingCount: (count: number) => void
  setSyncSuccess:  (syncedAt: Date) => void
  setSyncError:    (message: string) => void
  reset:           () => void
}

export const useSyncStore = create<SyncState>()((set) => ({
  status:       'idle',
  pendingCount: 0,
  lastSyncAt:   null,
  errorMessage: null,

  setStatus:       (status)       => set({ status }),
  setPendingCount: (pendingCount) => set({ pendingCount }),

  setSyncSuccess: (lastSyncAt) =>
    set({ status: 'success', lastSyncAt, errorMessage: null }),

  setSyncError: (errorMessage) =>
    set({ status: 'error', errorMessage }),

  reset: () =>
    set({ status: 'idle', pendingCount: 0, errorMessage: null }),
}))
