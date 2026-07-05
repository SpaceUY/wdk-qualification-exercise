import { registerAs } from '@nestjs/config';

export const wdkEventBusConfig = registerAs('wdkEventBus', () => ({
  host: process.env['WDK_EVENT_BUS_REDIS_HOST'] ?? 'localhost',
  port: Number(process.env['WDK_EVENT_BUS_REDIS_PORT'] ?? 6380),
  password: process.env['WDK_EVENT_BUS_REDIS_PASSWORD'] || undefined,
  tls: process.env['WDK_EVENT_BUS_REDIS_TLS'] === 'true' ? {} : undefined,
  streamKey: process.env['WDK_EVENT_BUS_STREAM_KEY'] ?? '@wdk/grouped-transactions:ethereum:usdt',
  consumerGroup: process.env['WDK_EVENT_BUS_CONSUMER_GROUP'] ?? 'cashback-backend',
}));
