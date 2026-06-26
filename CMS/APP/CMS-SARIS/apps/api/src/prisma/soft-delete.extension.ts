/**
 * Extension Prisma de soft-delete (suppression logique) pour la synchronisation
 * offline-first. Pour les modèles de l'allow-list (qui portent `deletedAt`) :
 *  - `delete` / `deleteMany`  →  `update` / `updateMany { deletedAt: now }`
 *  - `findMany` / `findFirst` / `findFirstOrThrow` / `count` / `aggregate` / `groupBy`
 *    →  filtre `deletedAt: null` ajouté par défaut (sauf filtre `deletedAt` explicite —
 *    la synchro lit les tombstones via le client BRUT `prisma.raw`)
 *  - `findUnique`  →  POST-filtré : un enregistrement soft-supprimé devient `null`
 *    (`findUniqueOrThrow` → jette P2025). ⚠️ un `select` qui OMET `deletedAt` défait ce
 *    post-filtre (sélectionner `deletedAt` si on s'appuie dessus).
 *
 * NON couverts (par conception) : `upsert`, le `_count` relationnel et les `include`
 * imbriqués → ils VOIENT les tombstones. Pour un contrôle d'unicité-avant-create ou pour
 * ressusciter un tombstone (`update { deletedAt: null }`), lire via le client BRUT
 * `this.prisma.raw`.
 *
 * La logique décisionnelle est testée à part (`soft-delete-core.ts`).
 */
import { Prisma } from '@prisma/client'
import {
  type SoftDeleteAllow,
  isSoftDeletable,
  toSoftDeleteUpdate,
  addNotDeletedFilter,
  delegateName,
} from './soft-delete-core'

type AnyArgs = Record<string, unknown>

export function buildSoftDeleteExtension(allow: SoftDeleteAllow) {
  // ── Écritures : delete / deleteMany → suppression LOGIQUE ────────────────────
  // On surcharge ces opérations modèle PAR modèle (allow-list) plutôt que via
  // `$allModels`, pour deux raisons :
  //  1. les modèles HORS allow-list conservent une suppression PHYSIQUE inchangée ;
  //  2. dans une extension `model`, `getExtensionContext(this)` est le **délégué** du
  //     modèle (il porte `.update`/`.updateMany`) et reste **lié à la transaction**
  //     courante — ce qui n'est pas le cas dans une extension `query`.
  const model: Record<string, unknown> = {}
  for (const name of allow) {
    model[delegateName(name)] = {
      // ⚠️ NON-`async` : doit renvoyer un PrismaPromise (et non Promise<PrismaPromise>)
      // pour rester compatible avec `$transaction([...])` (forme batch), qui exige des
      // PrismaPromise. Un override `async` casse silencieusement les suppressions en
      // transaction-batch (ex. patient.deletePatient).
      delete(this: unknown, args: AnyArgs) {
        const ctx = Prisma.getExtensionContext(this) as unknown as { update: (a: unknown) => unknown }
        return ctx.update(toSoftDeleteUpdate(args ?? {}, new Date()))
      },
      deleteMany(this: unknown, args: AnyArgs | undefined) {
        const ctx = Prisma.getExtensionContext(this) as unknown as { updateMany: (a: unknown) => unknown }
        return ctx.updateMany(toSoftDeleteUpdate(args ?? {}, new Date()))
      },
    }
  }

  return Prisma.defineExtension({
    name: 'soft-delete',
    // Construit dynamiquement depuis l'allow-list (noms de modèles connus au runtime) :
    // non typable statiquement. Cast en `{}` (et non `never`) pour NE PAS dégrader les
    // types des délégués du client étendu ; les surcharges réelles s'appliquent au runtime.
    // Les appelants voient de toute façon les types PrismaClient de base (PrismaService).
    model: model as Record<string, unknown> as {},
    query: {
      // ── Lectures : exclure les tombstones par défaut ──────────────────────────
      $allModels: {
        async findMany({ model: m, args, query }) {
          return query(isSoftDeletable(m, allow) ? addNotDeletedFilter(args) : args)
        },
        async findFirst({ model: m, args, query }) {
          return query(isSoftDeletable(m, allow) ? addNotDeletedFilter(args) : args)
        },
        async findFirstOrThrow({ model: m, args, query }) {
          return query(isSoftDeletable(m, allow) ? addNotDeletedFilter(args) : args)
        },
        async count({ model: m, args, query }) {
          return query(isSoftDeletable(m, allow) ? addNotDeletedFilter(args) : args)
        },
        // aggregate / groupBy : Prisma ne les intercepte pas via les autres surcharges ;
        // sans ça les stats (dashboards) compteraient les tombstones. On injecte
        // `deletedAt: null` dans le `where` (les deux acceptent un `where`).
        async aggregate({ model: m, args, query }) {
          return query(isSoftDeletable(m, allow) ? addNotDeletedFilter(args) : args)
        },
        async groupBy({ model: m, args, query }) {
          return query(isSoftDeletable(m, allow) ? addNotDeletedFilter(args) : args)
        },
        // findUnique : le `where` n'accepte QUE des champs uniques → impossible d'y
        // injecter `deletedAt: null`. On POST-filtre le résultat : un enregistrement
        // soft-supprimé devient introuvable (null) → les endpoints "get by id"
        // (findUnique + check null → NotFoundException) renvoient bien 404.
        async findUnique({ model: m, args, query }) {
          const res = await query(args)
          if (isSoftDeletable(m, allow) && res && (res as { deletedAt?: unknown }).deletedAt) return null
          return res
        },
        async findUniqueOrThrow({ model: m, args, query }) {
          const res = await query(args)
          if (isSoftDeletable(m, allow) && res && (res as { deletedAt?: unknown }).deletedAt) {
            throw new Prisma.PrismaClientKnownRequestError('No record was found for a query (soft-deleted).', {
              code: 'P2025',
              clientVersion: Prisma.prismaVersion.client,
            })
          }
          return res
        },
      },
    },
  })
}

/**
 * Modèles soumis au soft-delete (racines métier portant `deletedAt`). Aligné sur la
 * Phase 0 du schéma. Les enfants en cascade restent en hard-delete tant que le parent
 * est présent (décision blueprint §1.2).
 */
export const SOFT_DELETE_MODELS: ReadonlySet<string> = new Set<string>([
  'Utilisateur', 'Patient', 'Visite', 'Conversation', 'Site', 'CategoriePatient',
  'MotifConsultation', 'PathologieReference', 'MedicamentReference', 'TypeExamen',
  'TypeConsultation', 'TypeCertificat',
  'EtablissementReference', 'SocieteSousTraitante', 'EmployeSaris', 'PersonnelMedical', 'IdentitePatient',
  'DonneesEmploi', 'ModeViePatient',
  'ContactUrgence', 'AllergiePatient', 'AntecedentPatient', 'AlerteMedicale',
  'PreSaisieMedicale', 'SuiviGrossesse', 'ConsultationPrenatale', 'ConstanteVitale',
  'Consultation', 'Ordonnance', 'LigneOrdonnance', 'BonExamen', 'ResultatExamen',
  'BonPharmacie', 'LigneBonPharmacie',
  'SuiviChronique', 'CertificatMedical', 'Evacuation', 'AccidentTravail', 'MessageReaction', 'MessagePieceJointe',
  'PlanningPermutation', 'PresenceJournaliere', 'AbsencePersonnel', 'DelegationPrescription',
  'RattachementAyantDroitCdi', 'RattachementSousTraitant', 'Message',
])
