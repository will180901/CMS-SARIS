import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common'

/**
 * HealthController — sonde de disponibilité publique (liveness).
 *
 * Endpoint léger, SANS authentification, conçu pour être interrogé fréquemment
 * par le frontend afin d'afficher l'état réel « En ligne / Hors ligne » du
 * serveur (et non le simple état réseau du navigateur).
 */
@Controller('health')
export class HealthController {
  @Get()
  @HttpCode(HttpStatus.OK)
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() }
  }
}
