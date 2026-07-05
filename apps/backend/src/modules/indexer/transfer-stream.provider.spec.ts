import type { ConfigService } from '@nestjs/config';
import { selectTransferStream, transferStreamProvider } from './transfer-stream.provider';
import { RedisStreamTransferAdapter } from './adapters/redis-stream-transfer.adapter';
import { WdkIndexerTransferAdapter } from './adapters/wdk-indexer-transfer.adapter';

describe('selectTransferStream', () => {
  const redisAdapter = { read: jest.fn() } as unknown as RedisStreamTransferAdapter;
  const hostedAdapter = { read: jest.fn() } as unknown as WdkIndexerTransferAdapter;

  it('returns the Redis adapter for "redis-stream"', () => {
    expect(selectTransferStream('redis-stream', redisAdapter, hostedAdapter)).toBe(redisAdapter);
  });

  it('returns the legacy hosted-api adapter for "hosted-api"', () => {
    expect(selectTransferStream('hosted-api', redisAdapter, hostedAdapter)).toBe(hostedAdapter);
  });
});

describe('transferStreamProvider.useFactory', () => {
  const redisAdapter = { read: jest.fn() } as unknown as RedisStreamTransferAdapter;
  const hostedAdapter = { read: jest.fn() } as unknown as WdkIndexerTransferAdapter;

  function useFactory(config: ConfigService) {
    const factory = transferStreamProvider as unknown as {
      useFactory: (
        config: ConfigService,
        redisAdapter: RedisStreamTransferAdapter,
        hostedAdapter: WdkIndexerTransferAdapter,
      ) => unknown;
    };
    return factory.useFactory(config, redisAdapter, hostedAdapter);
  }

  it('defaults to the Redis adapter when indexer.transport is unset', () => {
    const config = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;

    expect(useFactory(config)).toBe(redisAdapter);
  });

  it('honors an explicit hosted-api transport setting', () => {
    const config = { get: jest.fn().mockReturnValue('hosted-api') } as unknown as ConfigService;

    expect(useFactory(config)).toBe(hostedAdapter);
  });
});
