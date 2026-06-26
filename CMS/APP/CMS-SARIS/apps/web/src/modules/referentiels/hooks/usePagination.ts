/**
 * Re-export du hook usePagination global (anciennement local au module référentiels).
 * Conservé pour rétrocompatibilité des imports existants.
 */

export { usePagination } from '@/hooks/usePagination'
export type { PaginationState, PaginationControls } from '@/hooks/usePagination'
