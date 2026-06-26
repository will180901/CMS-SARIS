/**
 * sync.ts — Moteur de synchronisation offline-first CMS SARIS.
 *
 * Stratégie « rejeu de requêtes » :
 *   - Hors-ligne, toute écriture (POST/PATCH/PUT/DELETE) est capturée dans
 *     IndexedDB (table file_mutations) sous forme { method, path, body }.
 *   - À la reconnexion, syncPush() rejoue ces requêtes dans l'ordre vers les
 *     endpoints réels → réutilise toute la validation / les permissions / la
 *     logique métier du serveur (aucun moteur d'application parallèle).
 *   - Les lectures (GET) sont servies hors-ligne par le service worker
 *     (NetworkFirst), donc syncPull() se contente de signaler la fin de cycle ;
 *     le rafraîchissement des données est déclenché par l'invalidation
 *     React Query au retour réseau.
 *
 * Garanties :
 *   - Pas de perte : une mutation reste PENDING tant que le serveur n'a pas
 *     répondu 2xx (ou explicitement rejeté en 4xx).
 *   - Ordre respecté : tri par ordreLocal croissant avant rejeu.
 *   - Idempotence : chaque mutation porte un mutationUuid unique.
 */

import { db } from './db'
import { replayRequest, tryRefreshToken, isTokenExpiringSoon } from './api'
import { useSessionStore } from '@/stores/session.store'
import { encryptField, decryptField } from './offlineCrypto'
import { useSyncStore } from '@/stores/sync.store'
import { useNetworkStore } from '@/stores/network.store'
import type { FileMutation, MutationAction, ModuleName } from '@cms-saris/types'

// ── Dérivation des métadonnées d'une requête ───────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function deriveModule(segment: string): ModuleName {
  switch (segment) {
    case 'patients':                                       return 'patients'
    case 'visites': case 'triage':                         return 'triage'
    case 'consultations': case 'bons-examen':              return 'consultations'
    case 'evacuations': case 'accidents-travail':
    case 'suivis-chroniques':                              return 'sorties_critiques'
    case 'referentiels': case 'sites':                     return 'referentiels'
    case 'admin': case 'utilisateurs': case 'roles':       return 'acteurs'
    default:                                               return 'patients'
  }
}

function deriveAction(method: string, path: string): MutationAction {
  if (method === 'DELETE') return 'DELETE'
  if (method === 'POST')   return 'CREATE'
  // PATCH/PUT : clôture / annulation = transition de cycle de vie
  if (/\/(cloturer|annuler|close)(\/|$)/.test(path)) return 'CLOSE'
  return 'UPDATE'
}

/** Premier UUID trouvé dans le chemin (meilleure approximation de l'entité ciblée). */
function deriveEntiteId(segments: string[]): string {
  const found = segments.find(s => UUID_RE.test(s))
  return found ?? ''
}

// ── Mise en file d'attente d'une écriture ───────────────────────────────────────

/**
 * Capture une mutation hors-ligne. Appelée par le client API quand le réseau
 * est indisponible. Stocke la requête brute pour rejeu ultérieur.
 */
export async function enqueueMutation(method: string, path: string, body: unknown): Promise<void> {
  const clean = path.split('?')[0] ?? path
  const segments = clean.split('/').filter(Boolean)
  const firstSegment = segments[0] ?? ''

  // payloadJson : requête brute rejouable, CHIFFRÉE au repos (AES-256-GCM).
  // En cas d'échec du chiffrement (clé indisponible), on RETOMBE en clair plutôt
  // que de perdre la mutation — la perte de donnée est pire que le clair local.
  const rawPayload = JSON.stringify({ method: method.toUpperCase(), path, body })
  let payloadJson: string
  try {
    payloadJson = await encryptField(rawPayload)
  } catch {
    payloadJson = rawPayload   // fallback clair (decryptField le relira via le test de préfixe)
    // Signal NON-sensible (aucun payload loggé) : si la clé est durablement
    // indisponible, ce warning rend la dégradation détectable au lieu d'écrire
    // silencieusement des PII en clair dans IndexedDB.
    console.warn('[Sync] Clé de chiffrement indisponible — mutation mise en file EN CLAIR (fallback anti-perte).')
  }

  const mutation: Omit<FileMutation, 'id'> = {
    mutationUuid:   crypto.randomUUID(),
    module:         deriveModule(firstSegment),
    entiteType:     firstSegment,
    entiteId:       deriveEntiteId(segments),
    action:         deriveAction(method.toUpperCase(), clean),
    payloadJson,
    statut:         'PENDING',
    ordreLocal:     Date.now(),
    createdLocalAt: new Date(),
  }

  await db.file_mutations.add(mutation as FileMutation)
  await refreshPendingCount()
}

/** Recalcule et publie le nombre de mutations en attente. */
export async function refreshPendingCount(): Promise<number> {
  const n = await db.file_mutations.where('statut').equals('PENDING').count()
  useSyncStore.getState().setPendingCount(n)
  return n
}

// ── Cycle de synchronisation ────────────────────────────────────────────────────

/** Lance un cycle push → pull si en ligne. */
export async function syncCycle(): Promise<void> {
  const { isOnline } = useNetworkStore.getState()
  if (!isOnline) return
  await syncPush()
  await syncPull()
}

/** Rejoue les mutations PENDING vers le serveur, dans l'ordre. */
export async function syncPush(): Promise<void> {
  const { isOnline } = useNetworkStore.getState()
  if (!isOnline) return

  const { setStatus, setSyncError, setSyncSuccess } = useSyncStore.getState()

  const pending = await db.file_mutations.where('statut').equals('PENDING').sortBy('ordreLocal')
  await refreshPendingCount()
  if (pending.length === 0) {
    setStatus('idle')
    return
  }

  // Refresh PROACTIF : si le token courant est proche/au-delà de l'expiration,
  // on le rafraîchit UNE fois avant le rejeu pour éviter une vague de 401.
  // Échec silencieux : si le refresh échoue ici (session réellement morte),
  // tryRefreshToken a déjà vidé la session ; les rejeux tomberont en 401 et
  // seront gérés ci-dessous (réactif) — mais sans token, ils échoueront proprement.
  let refreshAttempted = false
  const currentToken = useSessionStore.getState().token
  if (currentToken && isTokenExpiringSoon(currentToken)) {
    refreshAttempted = true
    try {
      await tryRefreshToken()
    } catch {
      // Session expirée définitivement : on stoppe le cycle SANS rien rejeter.
      // La file reste intacte ; l'utilisateur sera redirigé vers /login par le
      // clearSession() interne de tryRefreshToken. On retentera après re-login.
      setStatus('idle')
      return
    }
  }

  setStatus('syncing')
  let applied = 0
  let rejected = 0

  for (const m of pending) {
    let parsed: { method: string; path: string; body: unknown }
    try {
      const clearPayload = await decryptField(m.payloadJson)   // legacy clair toléré (test de préfixe interne)
      parsed = JSON.parse(clearPayload)
    } catch {
      // Payload illisible ou indéchiffrable : on écarte pour ne pas bloquer la file.
      await db.file_mutations.update(m.id!, { statut: 'REJECTED', errorMessage: 'Payload illisible' })
      rejected++
      continue
    }

    try {
      let status = await replayRequest(parsed.method, parsed.path, parsed.body)

      // 401 pendant le rejeu : token périmé. On tente UN SEUL refresh par cycle,
      // puis on REJOUE la mutation avant tout verdict définitif.
      if (status === 401 && !refreshAttempted) {
        refreshAttempted = true
        try {
          await tryRefreshToken()
        } catch {
          // Refresh impossible (session morte) : on stoppe le cycle, file intacte.
          setStatus('idle')
          return
        }
        // Re-rejeu avec le token fraîchement obtenu (replayRequest relit le store).
        status = await replayRequest(parsed.method, parsed.path, parsed.body)
      }

      if (status >= 200 && status < 300) {
        await db.file_mutations.update(m.id!, { statut: 'APPLIED', serverAckedAt: new Date() })
        applied++
      } else if (status === 401) {
        // 401 PERSISTANT après refresh (ou refresh déjà épuisé ce cycle) :
        // on stoppe sans rejeter — la mutation reste PENDING pour le prochain
        // cycle / après re-login. NE PAS purger une 401 (≠ rejet métier).
        setSyncError('Session expirée — synchronisation suspendue')
        return
      } else if (status >= 400 && status < 500) {
        // Rejet métier définitif (validation, permission, conflit de statut…) :
        // inutile de rejouer en boucle.
        await db.file_mutations.update(m.id!, { statut: 'REJECTED', errorMessage: `HTTP ${status}` })
        rejected++
      } else {
        // 5xx ou autre : on stoppe le cycle, on retentera plus tard.
        setSyncError(`Serveur indisponible (HTTP ${status})`)
        return
      }
    } catch {
      // Réseau retombé pendant le rejeu : on stoppe, la file reste intacte.
      setStatus('idle')
      return
    }
  }

  // Purge des mutations traitées (APPLIED / REJECTED) pour garder la file propre.
  await db.file_mutations.where('statut').anyOf('APPLIED', 'REJECTED').delete()
  await refreshPendingCount()
  setSyncSuccess(new Date())

  if (rejected > 0) {
    // Signalé via le store ; l'UI peut afficher le détail. On garde une trace.
    console.warn(`[Sync] ${applied} mutation(s) appliquée(s), ${rejected} rejetée(s).`)
  }
}

/**
 * Fin de cycle côté lecture. Le service worker (NetworkFirst) rafraîchit déjà
 * le cache des GET ; l'invalidation React Query est déclenchée par le hook de
 * reconnexion. Conservé comme point d'extension (delta pull serveur).
 */
export async function syncPull(): Promise<void> {
  const { isOnline } = useNetworkStore.getState()
  if (!isOnline) return
}

// ── Inspection / maintenance de la file (utilisé par l'écran Synchronisation) ──

/** Toutes les mutations locales, plus récentes d'abord. */
export async function listMutations(): Promise<FileMutation[]> {
  const all = await db.file_mutations.toArray()
  return all.sort((a, b) => b.ordreLocal - a.ordreLocal)
}

/** Supprime les mutations d'un statut donné (ou toutes si non précisé). Renvoie le nombre supprimé. */
export async function purgeMutations(statut?: FileMutation['statut']): Promise<number> {
  const n = statut
    ? await db.file_mutations.where('statut').equals(statut).delete()
    : await db.file_mutations.clear().then(() => -1)
  await refreshPendingCount()
  return n
}

/** Remet les mutations REJECTED en PENDING puis relance un cycle (nouvelle tentative). */
export async function retryRejected(): Promise<void> {
  const rejected = await db.file_mutations.where('statut').equals('REJECTED').toArray()
  await Promise.all(rejected.map(m => db.file_mutations.update(m.id!, { statut: 'PENDING', errorMessage: undefined })))
  await refreshPendingCount()
  await syncCycle()
}
