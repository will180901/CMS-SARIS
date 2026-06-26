import { create } from 'zustand'

interface NetworkState {
  isOnline: boolean
  setOnline: (online: boolean) => void
}

export const useNetworkStore = create<NetworkState>()((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  setOnline: (isOnline) => set({ isOnline }),
}))

// L'état réel (joignabilité du serveur API) est piloté par `useServerHealth`,
// qui combine `navigator.onLine` et un ping périodique sur /health.
