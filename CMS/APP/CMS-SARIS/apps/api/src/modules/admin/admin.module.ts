/**
 * AdminModule — Administration système (utilisateurs, rôles, audit).
 *
 * Réservé aux ADMIN_SYSTEME (via permissions granulaires) :
 *   - utilisateur.* : gestion des comptes
 *   - role.* : matrice rôles ↔ permissions
 *   - audit.read : consultation des journaux
 */

import { Module } from '@nestjs/common'
import { SecurityModule }          from '../security/security.module'
import { PrismaModule }            from '../../prisma/prisma.module'
import { ParametresModule }        from '../parametres/parametres.module'
import { NotificationModule }      from '../notification/notification.module'
import { UtilisateursController }  from './utilisateurs.controller'
import { UtilisateursService }     from './utilisateurs.service'
import { RolesController }         from './roles.controller'
import { RolesService }            from './roles.service'
import { AuditController }         from './audit.controller'
import { AuditService }            from './audit.service'
import { ParametresController }    from './parametres.controller'
import { SynchronisationController } from './synchronisation.controller'
import { SynchronisationService }    from './synchronisation.service'

@Module({
  imports:     [SecurityModule, PrismaModule, ParametresModule, NotificationModule],
  controllers: [
    UtilisateursController, RolesController, AuditController,
    ParametresController, SynchronisationController,
  ],
  providers:   [
    UtilisateursService, RolesService, AuditService,
    SynchronisationService,
  ],
  exports:     [
    UtilisateursService, RolesService, AuditService,
    SynchronisationService,
  ],
})
export class AdminModule {}
