import {
  Controller, Get, Query, UseGuards,
} from '@nestjs/common'
import { DashboardService }     from './dashboard.service'
import { JwtAuthGuard }         from '../security/guards/jwt-auth.guard'
import { PermissionsGuard }     from '../security/guards/permissions.guard'
import { RequirePermissions }   from '../../common/decorators/require-permissions.decorator'

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  @Get('overview')
  @RequirePermissions('dashboard.read')
  overview() {
    return this.svc.getOverview()
  }

  @Get('motifs-jour')
  @RequirePermissions('dashboard.read')
  motifsDuJour() {
    return this.svc.getMotifsDuJour()
  }

  @Get('urgences')
  @RequirePermissions('dashboard.read')
  urgences() {
    return this.svc.getUrgences()
  }

  /** Série temporelle des visites (14 jours par défaut). */
  @Get('tendance')
  @RequirePermissions('dashboard.read')
  tendance() {
    return this.svc.getActivityTrend()
  }

  /** Affluence du jour par tranche horaire. */
  @Get('affluence')
  @RequirePermissions('dashboard.read')
  affluence() {
    return this.svc.getHourlyAffluence()
  }

  /** Statistiques gouvernance système — réservé aux administrateurs de comptes. */
  @Get('admin-systeme')
  @RequirePermissions('utilisateur.read')
  adminSysteme() {
    return this.svc.getAdminSystemStats()
  }

  /** Statistiques d'activité (type × pathologie × catégorie + repos) — la finalité
   *  du système (remplace le comptage Excel « Jeannette »). Période optionnelle
   *  via ?from=YYYY-MM-DD&to=YYYY-MM-DD (défaut : 30 derniers jours). */
  @Get('statistiques')
  @RequirePermissions('consultation.read')
  statistiques(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.getStatistiques(from, to)
  }

  /** Croisement pathologie × catégorie × département sur la période (recueil §6.2). */
  @Get('croisement')
  @RequirePermissions('consultation.read')
  croisement(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.getCroisementPathologieCategorieDirection(from, to)
  }

  /** Évolution mensuelle sur une année complète (recueil §6.2) — ?annee=YYYY (défaut : année en cours). */
  @Get('evolution-annuelle')
  @RequirePermissions('consultation.read')
  evolutionAnnuelle(
    @Query('annee') annee?: string,
  ) {
    const anneeNum = annee ? parseInt(annee, 10) : new Date().getFullYear()
    return this.svc.getEvolutionAnnuelle(anneeNum)
  }
}
