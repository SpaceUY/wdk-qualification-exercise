import Redis from 'ioredis';
import { RedisStreamTransferAdapter } from '../src/modules/indexer/adapters/redis-stream-transfer.adapter';

const CONFIG: Record<string, unknown> = {
  'wdkEventBus.streamKey': '@wdk/grouped-transactions:ethereum:usdt',
  'wdkEventBus.consumerGroup': 'cashback-backend',
  'blockchain.merchantAddresses': ['0x13e37ef17525bf110511f1fcb4654655a239ca00'],
  'indexer.transport': 'redis-stream',
};

const fakeConfigService = {
  get: (key: string) => CONFIG[key],
  getOrThrow: (key: string) => {
    const value = CONFIG[key];
    if (value === undefined) throw new Error(`Missing config: ${key}`);
    return value;
  },
} as never;

async function main(): Promise<void> {
  const redis = new Redis({ host: '127.0.0.1', port: 6380, maxRetriesPerRequest: null });
  const adapter = new RedisStreamTransferAdapter(redis, fakeConfigService);
  await adapter.onModuleInit();

  console.log('Listening on the real stream via the actual RedisStreamTransferAdapter code path...');
  for (let i = 0; i < 20; i++) {
    console.log(`read() call #${i + 1} (blocks up to 5s)...`);
    const events = await adapter.read();
    if (events.length > 0) {
      console.log('EVENTS RECEIVED:', JSON.stringify(events, null, 2));
      await redis.quit();
      return;
    }
  }
  console.log('No events received after 20 blocking read() cycles.');
  await redis.quit();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
