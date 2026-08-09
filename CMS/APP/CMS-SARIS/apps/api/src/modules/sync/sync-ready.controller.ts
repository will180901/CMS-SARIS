import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
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
@SkipThrottle() // endpoint loopback-only, aucune donnée sensible — pas de surface à protéger
export class SyncReadyController {
  constructor(private readonly client: SyncClientService) {}

  /**
   * MIROIR IMMEDIAT — declenche un cycle de synchronisation sans attendre.
   *
   * Appele par l'application apres CHAQUE ecriture reussie sur le serveur central, tant
   * qu'elle travaille en ligne. Sans cela, la base locale n'apprenait le changement qu'au
   * prochain rendez-vous periodique — jusqu'a CINQ MINUTES plus tard. Le reseau tombant
   * entre-temps, le poste basculait sur une base qui ignorait le travail des dernieres
   * minutes, y compris celui de la personne devant l'ecran.
   *
   * On ne rejoue PAS l'ecriture localement : le central genererait un identifiant, le
   * local un autre, et la synchro ramenerait les deux — un doublon pour une seule saisie.
   * On demande au backend d'aller CHERCHER ce qui vient de changer : il recoit
   * l'enregistrement authentique, avec son vrai identifiant.
   *
   * Sans garde : endpoint loopback (127.0.0.1), aucune donnee, aucun parametre. Sans
   * effet si un cycle est deja en cours (cf. triggerSync).
   */
  @Post('now')
  @HttpCode(HttpStatus.ACCEPTED)
  now(): { ok: true } {
    void this.client.triggerSync('écriture en ligne')
    return { ok: true }
  }

  @Get('ready')
  async ready(): Promise<{
    ready: boolean
    enabled: boolean
    pendingPush: boolean
    recus: number
    enCours: boolean
  }> {
    return {
      ready: this.client.ready,
      enabled: this.client.enabled,
      // Compteur du 1er chargement : l'écran d'attente l'affiche pour montrer que les
      // données arrivent. Un texte figé fait croire à un blocage — on ferme, et le poste
      // repart de zéro au lancement suivant.
      recus: this.client.recusPremierChargement,
      // Cycle en cours → l'application affiche sa bulle de synchronisation.
      enCours: this.client.enCours,
      // `pendingPush` : ce poste a-t-il encore des écritures hors-ligne à remonter ?
      // Le processus Electron s'en sert pour ne rendre la main au serveur central
      // qu'une fois le travail de l'utilisateur réellement arrivé là-bas.
      pendingPush: await this.client.hasPendingPush(),
    }
  }
}
