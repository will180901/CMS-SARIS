import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { createRequire } from 'node:module'
import { buildSoftDeleteExtension, SOFT_DELETE_MODELS } from './soft-delete.extension'

/**
 * PrismaService — wrapper NestJS autour de PrismaClient, **bi-cible** et
 * **soft-delete par défaut** :
 *
 *  - Mode serveur (défaut) : PostgreSQL — le client de base EST `this` (extends PrismaClient).
 *  - Mode desktop embarqué (`DATABASE_PROVIDER=sqlite`) : charge dynamiquement le client
 *    Prisma SQLite généré (chemin `SQLITE_CLIENT_PATH`).
 *
 * Dans les DEUX modes, les délégués de modèles (`prisma.patient`, `prisma.message`…),
 * les transactions et les requêtes brutes sont servis par le **client étendu soft-delete** :
 * une suppression d'un modèle « tombstone-able » devient un `update { deletedAt }` et les
 * lectures excluent par défaut les enregistrements supprimés. La synchronisation, elle,
 * a besoin de VOIR les tombstones : elle passe par `this.raw` (client brut, non étendu).
 *
 * Le comportement PostgreSQL côté schéma/connexion est inchangé ; seule la sémantique de
 * suppression/lecture des modèles syncables change (suppression logique propagée par la synchro).
 */

// Membres propres au service + cycle de vie (NON routés vers le client étendu).
const SERVICE_OWN = new Set<string>([
  'logger', 'baseClient', 'extendedClient', 'buildExtended',
  'onModuleInit', 'onModuleDestroy', 'raw', 'softDelete', 'then',
])

// Méthodes `$` qui n'existent QUE sur le client de base (perdues par `$extends`) :
// elles doivent toujours cibler le client brut (connexion, hooks, middleware).
const BASE_ONLY = new Set<string>(['$connect', '$disconnect', '$on', '$use'])

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)
  /** Client BRUT (non étendu) : `this` en PostgreSQL, l'instance SQLite chargée en embarqué. */
  private readonly baseClient: PrismaClient
  /** Client étendu soft-delete : cible par défaut des délégués métier. */
  private readonly extendedClient: ReturnType<PrismaService['buildExtended']>

  constructor() {
    super({
      log: process.env['NODE_ENV'] === 'development' ? ['query', 'error', 'warn'] : ['error'],
    })

    if (process.env['DATABASE_PROVIDER'] === 'sqlite') {
      const clientPath = process.env['SQLITE_CLIENT_PATH']
      if (!clientPath) {
        throw new Error('DATABASE_PROVIDER=sqlite mais SQLITE_CLIENT_PATH est absent (chemin du client Prisma SQLite généré).')
      }
      const req = createRequire(__filename)
      const mod = req(clientPath) as { PrismaClient: typeof PrismaClient }
      this.baseClient = new mod.PrismaClient({ log: ['error'] })
    } else {
      // Mode PostgreSQL : le service EST le client de base.
      this.baseClient = this
    }

    this.extendedClient = this.buildExtended()

    // Routage : délégués de modèles + transactions + SQL brut → client étendu (soft-delete) ;
    // connexion/hooks → client de base ; membres du service → le service lui-même.
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (typeof prop !== 'string') return Reflect.get(target, prop, receiver)
        if (SERVICE_OWN.has(prop)) return Reflect.get(target, prop, receiver)
        const source = BASE_ONLY.has(prop) ? target.baseClient : target.extendedClient
        const value = (source as unknown as Record<string, unknown>)[prop]
        return typeof value === 'function'
          ? (value as (...a: unknown[]) => unknown).bind(source)
          : value
      },
    })
  }

  private buildExtended() {
    return this.baseClient.$extends(buildSoftDeleteExtension(SOFT_DELETE_MODELS))
  }

  async onModuleInit(): Promise<void> {
    await this.baseClient.$connect()
    const sqlite = process.env['DATABASE_PROVIDER'] === 'sqlite'
    if (sqlite) {
      // Réplique locale : l'intégrité référentielle est garantie par le serveur central.
      // On désactive l'enforcement des clés étrangères pour que la synchro n'ait pas à
      // appliquer les enregistrements dans l'ordre parent → enfant.
      await this.baseClient.$executeRawUnsafe('PRAGMA foreign_keys = OFF')
    }
    this.logger.log(`Base de données ${sqlite ? 'SQLite locale' : 'PostgreSQL'} connectée (soft-delete actif)`)
  }

  async onModuleDestroy(): Promise<void> {
    await this.baseClient.$disconnect()
  }

  /**
   * Client BRUT non étendu. **Réservé à la synchronisation** : il VOIT les tombstones
   * (`deletedAt` non null) et n'applique aucun filtre soft-delete, ce qui est indispensable
   * pour propager les suppressions et restaurer l'`updatedAt` source.
   */
  get raw(): PrismaClient {
    return this.baseClient
  }

  /**
   * Alias explicite du client étendu soft-delete (déjà la cible par défaut des délégués).
   * Conservé pour la lisibilité des appels qui veulent rendre l'intention manifeste.
   */
  get softDelete(): ReturnType<PrismaService['buildExtended']> {
    return this.extendedClient
  }
}
