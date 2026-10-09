/**
 * L'API complète, démarrée dans le processus de test (pas de port réseau ouvert),
 * avec la MÊME configuration HTTP qu'en production (configurerApp, src/main.ts).
 *
 * Seule différence : le limiteur de requêtes est neutralisé. Toutes les requêtes des
 * tests viennent de la même adresse ; le plafond anti brute-force de la connexion
 * (10/min) bloquerait la suite au bout de quelques comptes. La configuration de
 * production n'est pas modifiée : on remplace ses options dans le module de test.
 */
import { Test } from '@nestjs/testing'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { getOptionsToken } from '@nestjs/throttler'
import { AppModule } from '../../src/app.module'
import { configurerApp } from '../../src/main'
import { PrismaService } from '../../src/prisma/prisma.service'

export async function demarrerApp(): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(getOptionsToken())
    .useValue({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
      skipIf: () => true,
    })
    .compile()
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bodyParser: false,
    logger: ['error', 'warn'],
  })
  configurerApp(app)
  await app.init()
  return app
}

/** Accès direct à la base de test (vérifications, préparation de cas précis). */
export function baseDe(app: NestExpressApplication): PrismaService {
  return app.get(PrismaService)
}
