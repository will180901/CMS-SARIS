import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common'

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
export class HealthController {
  @Get()
  @HttpCode(HttpStatus.OK)
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() }
  }

  /** Sonde DÉDIÉE au frontend — jamais interrogée par Render (cf. note ci-dessus). */
  @Get('ping')
  @HttpCode(HttpStatus.OK)
  ping() {
    return { status: 'ok', timestamp: new Date().toISOString() }
  }
}
