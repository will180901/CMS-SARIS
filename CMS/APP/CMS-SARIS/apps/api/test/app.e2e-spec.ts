import request from 'supertest'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { demarrerApp } from './support/app-test'

describe('AppController (e2e)', () => {
  let app: NestExpressApplication

  beforeAll(async () => {
    app = await demarrerApp()
  })

  it('/health (GET) — sonde de liveness, valide le wiring complet des modules', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        const corps = res.body as { status?: string } | undefined
        if (corps?.status !== 'ok') {
          throw new Error(
            `statut attendu "ok", reçu ${JSON.stringify(res.body)}`,
          )
        }
      })
  })

  it('/notifications/unread-count (GET) — route protégée → 401 sans token', () => {
    return request(app.getHttpServer())
      .get('/notifications/unread-count')
      .expect(401)
  })

  afterAll(async () => {
    await app.close()
  })
})
