import { ConfigService } from '@nestjs/config';
import { Provider } from '@nestjs/common';
import { TransferStreamPort } from './ports/transfer-stream.port';
import { RedisStreamTransferAdapter } from './adapters/redis-stream-transfer.adapter';
import { WdkIndexerTransferAdapter } from './adapters/wdk-indexer-transfer.adapter';

export function selectTransferStream(
  transport: 'redis-stream' | 'hosted-api',
  redisAdapter: RedisStreamTransferAdapter,
  hostedAdapter: WdkIndexerTransferAdapter,
): TransferStreamPort {
  return transport === 'hosted-api' ? hostedAdapter : redisAdapter;
}

export const transferStreamProvider: Provider = {
  provide: TransferStreamPort,
  inject: [ConfigService, RedisStreamTransferAdapter, WdkIndexerTransferAdapter],
  useFactory: (
    config: ConfigService,
    redisAdapter: RedisStreamTransferAdapter,
    hostedAdapter: WdkIndexerTransferAdapter,
  ) => selectTransferStream(config.get('indexer.transport') ?? 'redis-stream', redisAdapter, hostedAdapter),
};
