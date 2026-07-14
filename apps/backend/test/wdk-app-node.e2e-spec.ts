import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { decode } from 'jsonwebtoken';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { AuthModule } from '../src/auth/auth.module';
import { WdkAppNodeModule } from '../src/wdk-app-node/wdk-app-node.module';
import { CACHE_REDIS_CLIENT } from '../src/redis/redis-cache.tokens';
import { cognitoConfig } from '../src/config/cognito.config';
import { wdkAppNodeConfig } from '../src/config/wdk-app-node.config';
import { TEST_USER, createMockJwtAuthGuard } from './support/auth';

describe('WdkAppNode (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env['WDK_APP_NODE_JWT_SECRET'] = 'e2e-test-secret';

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [cognitoConfig, wdkAppNodeConfig] }),
        AuthModule,
        WdkAppNodeModule,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(createMockJwtAuthGuard(TEST_USER))
      // WdkAppNodeModule pulls in RedisCacheModule; stub the client so the e2e
      // run needs no Redis instance (quit is called by app.close()).
      .overrideProvider(CACHE_REDIS_CLIENT)
      .useValue({
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        quit: jest.fn().mockResolvedValue('OK'),
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    // Optional chaining: if beforeAll failed, don't mask its error with a TypeError here.
    await app?.close();
  });

  it('GET /wdk-app-node/token mints a token scoped to the authenticated user', async () => {
    const response = await request(app.getHttpServer()).get('/wdk-app-node/token').expect(200);

    expect(typeof response.body.token).toBe('string');

    const decoded = decode(response.body.token) as { userId: string } | null;
    expect(decoded?.userId).toBe(TEST_USER.email);
  });
});
