import { NestFactory } from '@nestjs/core'
import { ValidationPipe, Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import helmet from 'helmet'
import { AppModule } from './app.module'
import { GlobalExceptionFilter } from './common/filters/http-exception.filter'

export async function bootstrap(opts: { port?: number; host?: string } = {}): Promise<NestExpressApplication> {
  const logger = new Logger('Bootstrap')

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
    bodyParser: false, // on configure les parseurs nous-mêmes (limite de taille relevée)
  })

  // ── Corps de requête JSON : les lots de synchronisation peuvent être volumineux (50 Mo).
  app.useBodyParser('json', { limit: '50mb' })
  app.useBodyParser('urlencoded', { extended: true, limit: '50mb' })

  // ── Confiance proxy : indispensable derrière un reverse-proxy (nginx, traefik,
  // load-balancer cloud…) pour lire la VRAIE IP client via X-Forwarded-For.
  // En local sans proxy, req.ip = IP de la socket (::1) — comportement inchangé.
  // TRUST_PROXY : nombre de hops (ex. "1"), "true", ou une plage (ex. "loopback").
  const trustProxyEnv = process.env['TRUST_PROXY']
  const trustProxy: boolean | number | string = trustProxyEnv
    ? (/^\d+$/.test(trustProxyEnv) ? Number(trustProxyEnv)
      : trustProxyEnv === 'true' ? true
      : trustProxyEnv === 'false' ? false
      : trustProxyEnv)
    : 1 // défaut : on fait confiance au 1er proxy en amont
  app.set('trust proxy', trustProxy)

  // ── Sécurité : headers HTTP protégés ──────────────────────────────────────
  app.use(helmet())

  // ── CORS : frontend web + client de bureau (Electron) ─────────────────────
  // Origines autorisées : FRONTEND_URL ou liste CORS_ORIGINS (séparée par des
  // virgules) + l'origine du client de bureau (schéma applicatif `app://cms-saris`).
  // Indispensable au flux SSE des notifications (EventSource est soumis au CORS).
  const corsOrigins = (
    process.env['CORS_ORIGINS'] ??
    process.env['FRONTEND_URL'] ??
    'http://localhost:5173'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  const DESKTOP_ORIGIN = 'app://cms-saris'
  if (!corsOrigins.includes(DESKTOP_ORIGIN)) corsOrigins.push(DESKTOP_ORIGIN)
  // Mode « backend embarqué » (Electron) : le frontend (origine app://cms-saris) appelle
  // l'API locale sur 127.0.0.1:<port dynamique> → on autorise aussi localhost/127.0.0.1.
  const localOriginRe = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || corsOrigins.includes(origin) || localOriginRe.test(origin)) callback(null, true)
      else callback(null, false)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  })

  // ── Validation globale des DTOs ───────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // Supprime les champs non déclarés dans le DTO
      forbidNonWhitelisted: true, // Rejette les requêtes avec champs inconnus
      transform: true,            // Transforme automatiquement les types primitifs
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  // ── Filtre global d'exceptions ────────────────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter())

  const port = opts.port ?? parseInt(process.env['PORT'] ?? '3000', 10)
  const host = opts.host ?? process.env['HOST'] ?? '0.0.0.0'
  await app.listen(port, host)
  logger.log(`🚀 CMS SARIS API démarrée sur : http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`)
  return app
}

// Lancement direct (process serveur) — PAS lors d'un import (backend embarqué Electron).
if (require.main === module) {
  void bootstrap()
}
