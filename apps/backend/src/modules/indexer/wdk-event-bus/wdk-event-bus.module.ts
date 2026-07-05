import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { WDK_EVENT_BUS_CLIENT } from './wdk-event-bus.tokens';

@Module({
  providers: [
    {
      provide: WDK_EVENT_BUS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis({
          host: config.getOrThrow('wdkEventBus.host'),
          port: config.getOrThrow('wdkEventBus.port'),
          password: config.get('wdkEventBus.password'),
          tls: config.get('wdkEventBus.tls'),
          maxRetriesPerRequest: null, // ioredis convention for stream/blocking commands
        }),
    },
  ],
  exports: [WDK_EVENT_BUS_CLIENT],
})
export class WdkEventBusModule implements OnModuleDestroy {
  constructor(@Inject(WDK_EVENT_BUS_CLIENT) private readonly client: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
