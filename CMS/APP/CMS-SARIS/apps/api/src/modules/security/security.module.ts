import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { SecurityController } from './security.controller'
import { SecurityService } from './security.service'
import { MeController } from './me.controller'
import { MeService } from './me.service'
import { JwtStrategy } from './strategies/jwt.strategy'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { PermissionsGuard } from './guards/permissions.guard'
import { PermissionsResolverService } from './permissions-resolver.service'
import { ParametresModule } from '../parametres/parametres.module'

/**
 * SecurityModule — Module 1 : Authentification & Autorisation
 *
 * Exporte :
 *   - JwtAuthGuard       : authentification JWT
 *   - PermissionsGuard   : autorisation granulaire (seul mécanisme d'autorisation)
 *   - JwtModule
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
    ParametresModule,
  ],
  controllers: [SecurityController, MeController],
  providers: [
    SecurityService,
    MeService,
    JwtStrategy,
    JwtAuthGuard,
    PermissionsGuard,
    PermissionsResolverService,
  ],
  // PermissionsResolverService est exporté : les modules d'administration doivent
  // pouvoir INVALIDER le cache dès qu'ils modifient des droits (rôles, dérogations,
  // affectations) — sans quoi le changement attendrait l'expiration du TTL.
  exports: [
    JwtAuthGuard,
    PermissionsGuard,
    JwtModule,
    PermissionsResolverService,
  ],
})
export class SecurityModule {}
