import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET) — sonde de liveness, valide le wiring complet des modules', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect(res => {
        if (res.body?.status !== 'ok') {
          throw new Error(`statut attendu "ok", reçu ${JSON.stringify(res.body)}`);
        }
      });
  });

  it('/notifications/unread-count (GET) — route protégée → 401 sans token', () => {
    return request(app.getHttpServer())
      .get('/notifications/unread-count')
      .expect(401);
  });

  afterEach(async () => {
    await app.close();
  });
});
