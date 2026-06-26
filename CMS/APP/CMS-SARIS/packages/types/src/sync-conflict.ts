/**
 * Logique PURE de résolution de conflit pour la synchronisation offline-first.
 *
 * Zéro I/O, zéro dépendance, déterministe → testable unitairement et réutilisable des
 * deux côtés : serveur central (PostgreSQL) et backend local embarqué (SQLite).
 *
 * Modèle : **« dernière écriture gagne » (Last-Write-Wins)** par `updatedAt`, conscient
 * des **tombstones** (une suppression est une mutation horodatée comme une autre).
 * Si l'enregistrement côté serveur a évolué DEPUIS la version qu'avait le client
 * (`baseUpdatedAt`), on **signale un vrai conflit** (à journaliser pour revue) tout en
 * tranchant par LWW — on ne **bloque jamais** (aucun verrou distribué : impossible et
 * non souhaitable entre des machines hors-ligne).
 */

export interface Versioned {
  /** Horodatage ISO 8601 de dernière modification. */
  updatedAt: string
  /** Horodatage ISO 8601 de suppression logique (tombstone) ; null/absent = vivant. */
  deletedAt?: string | null
}

export interface IncomingVersioned extends Versioned {
  /**
   * Version (`updatedAt`) sur laquelle le client a commencé son édition — typiquement
   * le `updatedAt` connu lors du dernier pull. Permet de détecter qu'un AUTRE poste a
   * modifié l'enregistrement entre-temps. Optionnel : absent → LWW pur, sans détection
   * fine de conflit.
   */
  baseUpdatedAt?: string | null
}

export type ConflictDecision =
  | { kind: 'apply' }                                       // écrire l'entrant (pas de conflit)
  | { kind: 'skip' }                                        // garder l'existant (entrant périmé ou renvoi idempotent)
  | { kind: 'conflict'; winner: 'incoming' | 'existing' }   // vrai conflit concurrent, tranché par LWW

function toMs(iso: string | null | undefined): number {
  if (!iso) return 0
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

/**
 * Décide comment appliquer un enregistrement entrant face à l'existant.
 * - `existing` null → `apply` (création).
 * - LWW par `updatedAt` ; égalité stricte → `skip` (idempotent / même milliseconde).
 * - Si `baseUpdatedAt` fourni et l'existant a bougé depuis cette base → `conflict`
 *   (le `winner` est désigné par LWW ; l'appelant journalise puis applique le gagnant).
 */
export function resolveConflict(incoming: IncomingVersioned, existing: Versioned | null): ConflictDecision {
  if (!existing) return { kind: 'apply' }

  const inMs = toMs(incoming.updatedAt)
  const exMs = toMs(existing.updatedAt)
  const baseMs = incoming.baseUpdatedAt != null ? toMs(incoming.baseUpdatedAt) : exMs
  const serverMovedSinceBase = exMs > baseMs

  if (inMs > exMs) {
    return serverMovedSinceBase ? { kind: 'conflict', winner: 'incoming' } : { kind: 'apply' }
  }
  if (inMs < exMs) {
    return serverMovedSinceBase ? { kind: 'conflict', winner: 'existing' } : { kind: 'skip' }
  }
  return { kind: 'skip' }
}

/**
 * Champs réellement divergents entre deux versions (comparaison superficielle).
 * Sert à classer un conflit (un seul champ vs champs disjoints) pour le journal.
 * Les horodatages techniques sont ignorés par défaut.
 */
export function diffFields(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  ignore: readonly string[] = ['updatedAt', 'createdAt', 'deletedAt'],
): string[] {
  const ignoreSet = new Set(ignore)
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  const out: string[] = []
  for (const k of keys) {
    if (ignoreSet.has(k)) continue
    if (!Object.is(a[k], b[k])) out.push(k)
  }
  return out.sort()
}

/**
 * Résolution spécifique aux suppressions : une suppression plus récente l'emporte sur
 * une édition concurrente (et inversement). Délègue au LWW de `resolveConflict`
 * (les tombstones portent leur propre `updatedAt`).
 */
export function mergeTombstone(incoming: IncomingVersioned, existing: Versioned | null): ConflictDecision {
  return resolveConflict(incoming, existing)
}

/** Vrai si l'enregistrement est un tombstone (supprimé logiquement). */
export function isTombstone(row: Versioned): boolean {
  return row.deletedAt != null
}
