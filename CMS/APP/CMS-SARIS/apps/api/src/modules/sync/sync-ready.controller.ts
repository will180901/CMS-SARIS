import { Controller, Get } from '@nestjs/common'
import { SyncClientService } from './sync-client.service'

/**
 * Endpoint PUBLIC (loopback) du backend EMBARQUÉ : indique si la 1ère synchronisation est
 * faite. Le process Electron interroge ce point APRÈS le démarrage du backend et AVANT
 * d'ouvrir l'application, pour n'ouvrir qu'une fois les données du site présentes
 * (ouverture fluide — évite l'écran de connexion « à vide » le temps du 1er pull).
 *
 * Sans garde : aucune donnée sensible ({ ready, enabled }) et le backend embarqué n'écoute
 * que sur 127.0.0.1 (loopback). Sur le serveur central, `enabled` est faux → `ready` = true.
 */
@Controller('sync')
export class SyncReadyController {
  constructor(private readonly client: SyncClientService) {}

  @Get('ready')
  ready(): { ready: boolean; enabled: boolean } {
    return { ready: this.client.ready, enabled: this.client.enabled }
  }
}
