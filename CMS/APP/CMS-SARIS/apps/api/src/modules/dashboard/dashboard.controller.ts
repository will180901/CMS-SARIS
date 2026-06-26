import {
  Controller, Get, Query, Req, UseGuards, UnauthorizedException,
} from '@nestjs/common'
import { DashboardService }     from './dashboard.service'
import { JwtAuthGuard }         from '../security/guards/jwt-auth.guard'
import { PermissionsGuard }     from '../security/guards/permissions.guard'
import { RequirePermissions }   from '../../common/decorators/require-permissions.decorator'

interface AuthedRequest { user?: { id?: string; siteId?: string } }

function requireSite(req: AuthedRequest): string {
  const siteId = req.user?.siteId
  if (!siteId) throw new UnauthorizedException('Session invalide')
  return siteId
}

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  @Get('overview')
  @RequirePermissions('dashboard.read')
  overview(@Req() req: AuthedRequest) {
    return this.svc.getOverview(requireSite(req))
  }

  @Get('motifs-jour')
  @RequirePermissions('dashboard.read')
  motifsDuJour(@Req() req: AuthedRequest) {
    return this.svc.getMotifsDuJour(requireSite(req))
  }

  @Get('urgences')
  @RequirePermissions('dashboard.read')
  urgences(@Req() req: AuthedRequest) {
    return this.svc.getUrgences(requireSite(req))
  }

  /** Série temporelle des visites (14 jours par défaut). */
  @Get('tendance')
  @RequirePermissions('dashboard.read')
  tendance(@Req() req: AuthedRequest) {
    return this.svc.getActivityTrend(requireSite(req))
  }

  /** Affluence du jour par tranche horaire. */
  @Get('affluence')
  @RequirePermissions('dashboard.read')
  affluence(@Req() req: AuthedRequest) {
    return this.svc.getHourlyAffluence(requireSite(req))
  }

  /** Statistiques gouvernance système — réservé aux administrateurs de comptes. */
  @Get('admin-systeme')
  @RequirePermissions('utilisateur.read')
  adminSysteme(@Req() req: AuthedRequest) {
    return this.svc.getAdminSystemStats(requireSite(req))
  }

  /** Statistiques d'activité (type × pathologie × catégorie + repos) — la finalité
   *  du système (remplace le comptage Excel « Jeannette »). Période optionnelle
   *  via ?from=YYYY-MM-DD&to=YYYY-MM-DD (défaut : 30 derniers jours). */
  @Get('statistiques')
  @RequirePermissions('consultation.read')
  statistiques(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.getStatistiques(requireSite(req), from, to)
  }
}
