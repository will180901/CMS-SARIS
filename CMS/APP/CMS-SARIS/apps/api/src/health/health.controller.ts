import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Version de l'API centrale — lue une fois depuis package.json (dist/health/../../package.json).
// Purement INFORMATIF : les schémas de version desktop (ex. 1.6.0) et API (ex. 0.0.1) sont
// indépendants, il n'existe pas de règle de compatibilité "même version" à faire respecter ici —
// exposée pour permettre à un client (desktop, supervision) d'AFFICHER ce qui tourne côté
// central, sans qu'aucune logique n'en déduise un verdict compatible/incompatible.
const API_VERSION = (() => {
  try {
    return (
      JSON.parse(
        readFileSync(join(__dirname, '../../package.json'), 'utf-8'),
      ) as { version: string }
    ).version
  } catch {
    return 'inconnue'
  }
})()

/**
 * HealthController — sonde de disponibilité publique (liveness).
 *
 * Endpoint léger, SANS authentification, conçu pour être interrogé fréquemment
 * par le frontend afin d'afficher l'état réel « En ligne / Hors ligne » du
 * serveur (et non le simple état réseau du navigateur).
 *
 * ⚠️ `/health` (racine) est le `healthCheckPath` DÉCLARÉ à Render (render.yaml,
 * git racine) : Render l'interroge en interne pour ses propres décisions de
 * routage/redémarrage et peut y répondre 503 pendant une transition d'instance,
 * INDÉPENDAMMENT de la disponibilité réelle de l'API pour les vrais clients.
 * Le frontend (`useServerHealth`) ne doit PAS sonder ce chemin réservé — il
 * utilise `/health/ping`, un chemin distinct, dédié, jamais touché par Render.
 */
@Controller('health')
@SkipThrottle() // sonde de liveness interrogée en continu (desktop : /health/ping toutes les 5s) — pas de surface à protéger
export class HealthController {
  @Get()
  @HttpCode(HttpStatus.OK)
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: API_VERSION,
    }
  }

  /**
   * Sonde DÉDIÉE au frontend — jamais interrogée par Render (cf. note ci-dessus).
   *
   * DEUX adresses pour la MÊME sonde, et ce n'est pas une négligence :
   *
   *  - `/health/etat` est la bonne. Le mot « ping » figure dans les listes de filtres des
   *    bloqueurs de publicité, qui y voient du traçage : la requête était annulée par le
   *    navigateur (`ERR_BLOCKED_BY_CLIENT`), l'application se croyait HORS LIGNE et mettait
   *    les actions en file d'attente au lieu de les exécuter. Un bloqueur ne doit pas
   *    pouvoir faire croire à une panne réseau.
   *
   *  - `/health/ping` reste servie : les postes de bureau déjà installés l'interrogent
   *    toutes les cinq secondes. La retirer les basculerait tous en « hors ligne » du jour
   *    au lendemain, sans qu'ils aient rien demandé.
   */
  @Get('etat')
  @HttpCode(HttpStatus.OK)
  etat() {
    return this.ping()
  }

  @Get('ping')
  @HttpCode(HttpStatus.OK)
  ping() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: API_VERSION,
    }
  }
}
