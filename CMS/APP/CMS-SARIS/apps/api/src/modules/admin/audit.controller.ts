import {
  Controller, Get, Delete, Query, Req, UseGuards, HttpCode, HttpStatus,
  BadRequestException,
} from '@nestjs/common'
import { AuditService, type PortailPurge } from './audit.service'
import { JwtAuthGuard } from '../security/guards/jwt-auth.guard'
import { PermissionsGuard } from '../security/guards/permissions.guard'
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator'

/** Pas de page au-delà : 100 000 pages de 500 lignes dépassent tout ce qu'un journal purgé peut contenir. */
const PAGE_MAX = 100_000

/** `page` : entier de 1 à PAGE_MAX, sinon 400 (une page illisible ne se corrige pas en silence). */
function pageDemandee(page?: string): number | undefined {
  if (page === undefined || page === '') return undefined
  const n = Number(page)
  if (!/^[0-9]+$/.test(page) || n < 1 || n > PAGE_MAX)
    throw new BadRequestException('Numéro de page invalide')
  return n
}

/** `jusqua` : un instant lisible (ISO), sinon 400 ; vide = absent. */
function instantDemande(jusqua?: string): string | undefined {
  if (jusqua === undefined || jusqua === '') return undefined
  if (Number.isNaN(Date.parse(jusqua)))
    throw new BadRequestException('Instant de lecture invalide')
  return new Date(jusqua).toISOString()
}

/**
 * `search` : borné, et vide = absent. 400 caractères : le client y ajoute, à chaque mot, les codes qui portent
 * le libellé tapé (« création|CREATE »), ce qui dépasse largement une saisie à la main.
 */
function rechercheDemandee(search?: string): string | undefined {
  const s = (search ?? '').trim().slice(0, 400)
  return s || undefined
}

@Controller('admin/audit')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly svc: AuditService) {}

  /** Les comptes qui figurent au journal (filtre « Utilisateur » de l'écran). */
  @Get('utilisateurs')
  @RequirePermissions('audit.read')
  utilisateurs() {
    return this.svc.utilisateursDuJournal()
  }

  @Get('actions')
  @RequirePermissions('audit.read')
  audit(
    @Query('module') module?: string,
    @Query('action') action?: string,
    @Query('utilisateurId') utilisateurId?: string,
    @Query('entiteType') entiteType?: string,
    @Query('entiteId') entiteId?: string,
    @Query('dateMin') dateMin?: string,
    @Query('dateMax') dateMax?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('search') search?: string,
    @Query('jusqua') jusqua?: string,
  ) {
    return this.svc.findAudit({
      module,
      action,
      utilisateurId,
      entiteType,
      entiteId,
      dateMin,
      dateMax,
      limit:
        limit && Number.isFinite(Number(limit)) ? Number(limit) : undefined,
      page: pageDemandee(page),
      search: rechercheDemandee(search),
      jusqua: instantDemande(jusqua),
    })
  }

  @Get('authentifications')
  @RequirePermissions('audit.read')
  auth(
    @Query('utilisateurId') utilisateurId?: string,
    @Query('resultat') resultat?: string,
    @Query('dateMin') dateMin?: string,
    @Query('dateMax') dateMax?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('search') search?: string,
    @Query('jusqua') jusqua?: string,
  ) {
    return this.svc.findAuth({
      utilisateurId,
      resultat,
      dateMin,
      dateMax,
      limit:
        limit && Number.isFinite(Number(limit)) ? Number(limit) : undefined,
      page: pageDemandee(page),
      search: rechercheDemandee(search),
      jusqua: instantDemande(jusqua),
    })
  }

  /**
   * Vide les journaux. Sous `audit.purge` et NON `audit.read` : consulter des traces
   * et les effacer ne sont pas le même pouvoir. La purge se journalise elle-même,
   * de sorte qu'il reste toujours trace de qui a effacé quoi, et quand.
   */
  @Delete()
  @RequirePermissions('audit.purge')
  @HttpCode(HttpStatus.OK)
  purger(@Req() req: any, @Query('portee') portee?: string) {
    const p = (portee ?? 'tout') as PortailPurge
    if (p !== 'actions' && p !== 'authentifications' && p !== 'tout') {
      throw new BadRequestException('Portée de purge inconnue')
    }
    return this.svc.purger(p, req.user?.id ?? null)
  }
}
