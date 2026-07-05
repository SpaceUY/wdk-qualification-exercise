import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { validateSync } from 'class-validator';
import { RedisStreamTransferAdapter } from './redis-stream-transfer.adapter';
import { WDK_EVENT_BUS_CLIENT } from '../wdk-event-bus/wdk-event-bus.tokens';
import { TransferEventDto } from '../dto/transfer-event.dto';

jest.mock('class-validator', () => ({
  ...jest.requireActual('class-validator'),
  validateSync: jest.fn((...args: unknown[]) =>
    (jest.requireActual('class-validator') as typeof import('class-validator')).validateSync(
      ...(args as Parameters<typeof import('class-validator').validateSync>),
    ),
  ),
}));

const STREAM_KEY = '@wdk/grouped-transactions:ethereum:usdt';
const CONSUMER_GROUP = 'cashback-backend';

function createMockRedis() {
  return {
    xreadgroup: jest.fn(),
    xack: jest.fn().mockResolvedValue(1),
    xgroup: jest.fn().mockResolvedValue('OK'),
  };
}

function createMockConfig(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    'wdkEventBus.streamKey': STREAM_KEY,
    'wdkEventBus.consumerGroup': CONSUMER_GROUP,
    'blockchain.merchantAddresses': ['0xmerchant'],
    'indexer.transport': 'redis-stream',
    ...overrides,
  };
  return {
    get: jest.fn((key: string) => values[key]),
    getOrThrow: jest.fn((key: string) => {
      const value = values[key];
      if (value === undefined) throw new Error(`Missing config: ${key}`);
      return value;
    }),
  };
}

// Mirrors @tetherto/wdk-indexer-wrk-base's WrkIndexerProc._publishTransfers wire format:
// txHash,transferIndex,blockNumber,from,to,amount,timestamp,blockchain,token,transactionIndex,logIndex,label
function rawLine(overrides: Partial<Record<string, string>> = {}): string {
  const fields = {
    txHash: '0xtx1',
    transferIndex: '0',
    blockNumber: '100',
    from: '0xsender',
    to: '0xmerchant',
    amount: '1.0',
    timestamp: '1700000000000',
    blockchain: 'ethereum',
    token: 'usdt',
    transactionIndex: '0',
    logIndex: '0',
    label: '',
    ...overrides,
  };
  return [
    fields.txHash,
    fields.transferIndex,
    fields.blockNumber,
    fields.from,
    fields.to,
    fields.amount,
    fields.timestamp,
    fields.blockchain,
    fields.token,
    fields.transactionIndex,
    fields.logIndex,
    fields.label,
  ].join(',');
}

function groupedMessage(...lines: string[]): string[] {
  return ['type', 'grouped_transaction', 'raw', lines.join('\n')];
}

describe('RedisStreamTransferAdapter', () => {
  let redis: ReturnType<typeof createMockRedis>;

  async function build(configOverrides?: Record<string, unknown>): Promise<RedisStreamTransferAdapter> {
    redis = createMockRedis();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisStreamTransferAdapter,
        { provide: WDK_EVENT_BUS_CLIENT, useValue: redis },
        { provide: ConfigService, useValue: createMockConfig(configOverrides) },
      ],
    }).compile();
    return module.get(RedisStreamTransferAdapter);
  }

  it('maps valid stream messages into TransferEventDto[]', async () => {
    const adapter = await build();
    redis.xreadgroup.mockResolvedValue([
      [STREAM_KEY, [['1-0', groupedMessage(rawLine({ txHash: '0xtx1', amount: '1.0' }))]]],
    ]);

    const events = await adapter.read();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      from: '0xsender',
      to: '0xmerchant',
      amount: '1000000', // 1.0 USDT converted to 6-decimal raw units
      txHash: '0xtx1',
      chain: 'ethereum',
    });
  });

  it('maps every transfer in a multi-transfer grouped message', async () => {
    const adapter = await build({ 'blockchain.merchantAddresses': ['0xmerchant1', '0xmerchant2'] });
    redis.xreadgroup.mockResolvedValue([
      [
        STREAM_KEY,
        [
          [
            '1-0',
            groupedMessage(
              rawLine({ txHash: '0xtx1', transferIndex: '0', to: '0xmerchant1', amount: '1.0' }),
              rawLine({ txHash: '0xtx1', transferIndex: '1', to: '0xmerchant2', amount: '2.5' }),
            ),
          ],
        ],
      ],
    ]);

    const events = await adapter.read();

    expect(events).toHaveLength(2);
    expect(events.map((event: TransferEventDto) => event.amount)).toEqual(['1000000', '2500000']);
  });

  it('filters out transfers to non-merchant addresses', async () => {
    const adapter = await build();
    redis.xreadgroup.mockResolvedValue([
      [STREAM_KEY, [['1-0', groupedMessage(rawLine({ to: '0xsomeoneelse' }))]]],
    ]);

    const events = await adapter.read();
    expect(events).toHaveLength(0);
  });

  it('filters out non-USDT token transfers', async () => {
    const adapter = await build();
    redis.xreadgroup.mockResolvedValue([[STREAM_KEY, [['1-0', groupedMessage(rawLine({ token: 'eth' }))]]]]);

    const events = await adapter.read();
    expect(events).toHaveLength(0);
  });

  it('skips messages that are not the grouped_transaction type', async () => {
    const adapter = await build();
    redis.xreadgroup.mockResolvedValue([
      [STREAM_KEY, [['1-0', ['type', 'something_else', 'raw', rawLine()]]]],
    ]);

    const events = await adapter.read();
    expect(events).toHaveLength(0);
  });

  it('skips malformed transfer lines missing required fields and keeps processing the rest', async () => {
    const adapter = await build();
    redis.xreadgroup.mockResolvedValue([
      [
        STREAM_KEY,
        [
          ['1-0', groupedMessage('not,enough,fields')],
          ['2-0', groupedMessage(rawLine({ txHash: '0xtx2' }))],
        ],
      ],
    ]);

    const events = await adapter.read();
    expect(events).toHaveLength(1);
    expect(events[0]?.txHash).toBe('0xtx2');
  });

  it('acks every consumed message id regardless of whether it produced an event', async () => {
    const adapter = await build();
    redis.xreadgroup.mockResolvedValue([
      [
        STREAM_KEY,
        [
          ['1-0', groupedMessage(rawLine({ to: '0xnotmerchant', txHash: '0xtx1' }))],
          ['2-0', groupedMessage(rawLine({ to: '0xmerchant', txHash: '0xtx2' }))],
        ],
      ],
    ]);

    await adapter.read();

    expect(redis.xack).toHaveBeenCalledWith(STREAM_KEY, CONSUMER_GROUP, '1-0', '2-0');
  });

  it('returns no events and does not throw when xreadgroup rejects', async () => {
    const adapter = await build();
    redis.xreadgroup.mockRejectedValue(new Error('connection lost'));

    await expect(adapter.read()).resolves.toEqual([]);
  });

  it('blocks on XREADGROUP so the consumer loop can race indexer-processor for each message', async () => {
    const adapter = await build();
    redis.xreadgroup.mockResolvedValue(null);

    await adapter.read();

    expect(redis.xreadgroup).toHaveBeenCalledWith(
      'GROUP', CONSUMER_GROUP, expect.any(String), 'COUNT', '200',
      'BLOCK', expect.any(Number),
      'STREAMS', STREAM_KEY, '>',
    );
  });

  it('reports pollIntervalMs of 0 — the blocking XREADGROUP call already paces the loop', async () => {
    const adapter = await build();
    expect(adapter.pollIntervalMs()).toBe(0);
  });

  it('returns no events when xreadgroup resolves null (no new messages)', async () => {
    const adapter = await build();
    redis.xreadgroup.mockResolvedValue(null);

    await expect(adapter.read()).resolves.toEqual([]);
  });

  it('creates the consumer group on module init when transport is redis-stream', async () => {
    const adapter = await build();
    await adapter.onModuleInit();
    expect(redis.xgroup).toHaveBeenCalledWith('CREATE', STREAM_KEY, CONSUMER_GROUP, '$', 'MKSTREAM');
  });

  it('tolerates BUSYGROUP error when the consumer group already exists', async () => {
    const adapter = await build();
    redis.xgroup.mockRejectedValue(new Error('BUSYGROUP Consumer Group name already exists'));

    await expect(adapter.onModuleInit()).resolves.toBeUndefined();
  });

  it('does not create a consumer group when transport is hosted-api', async () => {
    const adapter = await build({ 'indexer.transport': 'hosted-api' });
    await adapter.onModuleInit();
    expect(redis.xgroup).not.toHaveBeenCalled();
  });

  it('logs (but does not throw) an unexpected consumer-group creation error', async () => {
    const adapter = await build();
    redis.xgroup.mockRejectedValue(new Error('NOPERM this user has no permissions'));

    await expect(adapter.onModuleInit()).resolves.toBeUndefined();
  });

  it('does not fail the read when XACK rejects', async () => {
    const adapter = await build();
    redis.xreadgroup.mockResolvedValue([
      [STREAM_KEY, [['1-0', groupedMessage(rawLine())]]],
    ]);
    redis.xack.mockRejectedValue(new Error('connection lost'));

    await expect(adapter.read()).resolves.toHaveLength(1);
  });

  it('skips a transfer with an empty required field despite having all 12 raw columns', async () => {
    const adapter = await build();
    redis.xreadgroup.mockResolvedValue([
      [STREAM_KEY, [['1-0', groupedMessage(rawLine({ from: '' }))]]],
    ]);

    const events = await adapter.read();
    expect(events).toHaveLength(0);
  });

  it('skips a transfer whose amount cannot be parsed as a decimal', async () => {
    const adapter = await build();
    redis.xreadgroup.mockResolvedValue([
      [STREAM_KEY, [['1-0', groupedMessage(rawLine({ amount: 'not-a-number' }))]]],
    ]);

    const events = await adapter.read();
    expect(events).toHaveLength(0);
  });

  it('skips a transfer that fails TransferEventDto validation', async () => {
    const adapter = await build();
    redis.xreadgroup.mockResolvedValue([
      [STREAM_KEY, [['1-0', groupedMessage(rawLine())]]],
    ]);
    (validateSync as jest.Mock).mockReturnValueOnce([{ property: 'chain', constraints: {} }]);

    const events = await adapter.read();
    expect(events).toHaveLength(0);
  });
});
