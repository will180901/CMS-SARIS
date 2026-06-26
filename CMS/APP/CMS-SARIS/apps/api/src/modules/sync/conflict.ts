/**
 * Copie LOCALE (côté API) de la logique pure de résolution de conflit.
 *
 * Source de vérité + tests : `@cms-saris/types/sync-conflict` (17 tests). On DUPLIQUE
 * ici volontairement car la value-import de `@cms-saris/types` côté API casse le watcher
 * Nest (ESM) — cf. MEMORY `project_crud_complet`. Garder les deux en phase si modif.
 */
export interface Versioned {
  updatedAt: string
  deletedAt?: string | null
}
export interface IncomingVersioned extends Versioned {
  baseUpdatedAt?: string | null
}
export type ConflictDecision =
  | { kind: 'apply' }
  | { kind: 'skip' }
  | { kind: 'conflict'; winner: 'incoming' | 'existing' }

function toMs(iso: string | null | undefined): number {
  if (!iso) return 0
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

export function resolveConflict(incoming: IncomingVersioned, existing: Versioned | null): ConflictDecision {
  if (!existing) return { kind: 'apply' }
  const inMs = toMs(incoming.updatedAt)
  const exMs = toMs(existing.updatedAt)
  const baseMs = incoming.baseUpdatedAt != null ? toMs(incoming.baseUpdatedAt) : exMs
  const serverMovedSinceBase = exMs > baseMs
  if (inMs > exMs) return serverMovedSinceBase ? { kind: 'conflict', winner: 'incoming' } : { kind: 'apply' }
  if (inMs < exMs) return serverMovedSinceBase ? { kind: 'conflict', winner: 'existing' } : { kind: 'skip' }
  return { kind: 'skip' }
}

export function diffFields(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  ignore: readonly string[] = ['updatedAt', 'createdAt', 'deletedAt'],
): string[] {
  const ig = new Set(ignore)
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  const out: string[] = []
  for (const k of keys) {
    if (ig.has(k)) continue
    if (!Object.is(a[k], b[k])) out.push(k)
  }
  return out.sort()
}
