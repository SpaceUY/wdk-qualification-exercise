import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CACHE_REDIS_CLIENT } from './redis-cache.tokens';

// This project's own Redis (REDIS_HOST/PORT), not infra/wdk-stack's event-bus Redis
// (WDK_EVENT_BUS_REDIS_HOST/PORT) — caching resilience data inside the same stack
// we're building resilience against would be self-defeating.
@Module({
  providers: [
    {
      provide: CACHE_REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis({
          host: config.getOrThrow('redis.host'),
          port: config.getOrThrow('redis.port'),
        }),
    },
  ],
  exports: [CACHE_REDIS_CLIENT],
})
export class RedisCacheModule implements OnModuleDestroy {
  constructor(@Inject(CACHE_REDIS_CLIENT) private readonly client: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
