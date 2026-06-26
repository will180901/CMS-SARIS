/**
 * Logique PURE du soft-delete (suppression logique) pour la synchronisation.
 * Zéro dépendance Prisma → testable unitairement (tsx). La glue Prisma
 * (`Prisma.defineExtension`) vit dans `soft-delete.extension.ts` et réutilise ces
 * fonctions.
 *
 * Principe : pour les modèles « tombstone-able » (qui portent `deletedAt`), une
 * suppression devient un `update { deletedAt: now }`, et les lectures excluent par
 * défaut les enregistrements supprimés (sauf filtre `deletedAt` explicite — utile à
 * la synchro qui DOIT voir les tombstones).
 */

export type SoftDeleteAllow = ReadonlySet<string>

/** Le modèle participe-t-il au soft-delete ? */
export function isSoftDeletable(model: string | undefined, allow: SoftDeleteAllow): boolean {
  return !!model && allow.has(model)
}

/** Transforme les args d'un `delete`/`deleteMany` en `update`/`updateMany { deletedAt }`. */
export function toSoftDeleteUpdate<T extends object>(args: T, now: Date): T & { data: { deletedAt: Date } } {
  return { ...args, data: { deletedAt: now } }
}

/**
 * Ajoute le filtre `deletedAt: null` au `where` d'une lecture (exclut les supprimés).
 * Respecte un filtre `deletedAt` déjà présent (la synchro le pose pour récupérer les
 * tombstones).
 */
export function addNotDeletedFilter<T extends { where?: Record<string, unknown> }>(args: T | undefined): T {
  const base = (args ?? {}) as T
  const where = (base.where ?? {}) as Record<string, unknown>
  if ('deletedAt' in where) return base
  return { ...base, where: { ...where, deletedAt: null } }
}

/** Nom de la propriété délégué Prisma (camelCase) pour un nom de modèle. */
export function delegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1)
}
