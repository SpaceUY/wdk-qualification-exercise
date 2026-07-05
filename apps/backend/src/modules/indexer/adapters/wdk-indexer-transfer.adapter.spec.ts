import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { validateSync } from 'class-validator';
import { WdkIndexerTransferAdapter } from './wdk-indexer-transfer.adapter';
import { WdkService } from '../../../wdk/wdk.service';
import { IndexerState } from '../entities/indexer-state.entity';

jest.mock('class-validator', () => ({
  ...jest.requireActual('class-validator'),
  validateSync: jest.fn((...args: unknown[]) =>
    (jest.requireActual('class-validator') as typeof import('class-validator')).validateSync(
      ...(args as Parameters<typeof import('class-validator').validateSync>),
    ),
  ),
}));

type MockModel = {
  findOne: jest.Mock;
  findOneAndUpdate: jest.Mock;
};

function createMockModel(): MockModel {
  return { findOne: jest.fn(), findOneAndUpdate: jest.fn() };
}

describe('WdkIndexerTransferAdapter', () => {
  let adapter: WdkIndexerTransferAdapter;
  let wdkService: jest.Mocked<WdkService>;
  let stateModel: MockModel;

  beforeEach(async () => {
    wdkService = { getUsdtTransfers: jest.fn() } as unknown as jest.Mocked<WdkService>;
    stateModel = createMockModel();
    stateModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    stateModel.findOneAndUpdate.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WdkIndexerTransferAdapter,
        { provide: WdkService, useValue: wdkService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(['0xmerchant']) },
        },
        { provide: getModelToken(IndexerState.name), useValue: stateModel },
      ],
    }).compile();

    adapter = module.get(WdkIndexerTransferAdapter);
  });

  it('maps valid transfer items into TransferEventDto[]', async () => {
    wdkService.getUsdtTransfers.mockResolvedValue([
      { from: '0xsender', to: '0xmerchant', amount: '1000000', txHash: '0xtx1' },
    ]);

    const events = await adapter.read();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      from: '0xsender',
      to: '0xmerchant',
      amount: '1000000',
      txHash: '0xtx1',
      chain: 'sepolia',
    });
  });

  it('skips transfers already recorded as seen for that merchant', async () => {
    stateModel.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: '0xmerchant', seenTxHashes: ['0xtx1'] }),
    });
    wdkService.getUsdtTransfers.mockResolvedValue([
      { from: '0xsender', to: '0xmerchant', amount: '1000000', txHash: '0xtx1' },
      { from: '0xsender', to: '0xmerchant', amount: '2000000', txHash: '0xtx2' },
    ]);

    const events = await adapter.read();

    expect(events).toHaveLength(1);
    expect(events[0]?.txHash).toBe('0xtx2');
  });

  it('skips malformed items missing required fields and keeps processing the rest', async () => {
    wdkService.getUsdtTransfers.mockResolvedValue([
      { to: '0xmerchant', amount: '1000000' }, // missing from/txHash
      { from: '0xsender', to: '0xmerchant', amount: '1000000', txHash: '0xtx2' },
    ]);

    const events = await adapter.read();

    expect(events).toHaveLength(1);
    expect(events[0]?.txHash).toBe('0xtx2');
  });

  it('returns no events and does not throw when the indexer API call fails', async () => {
    wdkService.getUsdtTransfers.mockRejectedValue(new Error('indexer down'));

    await expect(adapter.read()).resolves.toEqual([]);
  });

  it('reports a non-zero pollIntervalMs — REST polling has no internal blocking wait', () => {
    expect(adapter.pollIntervalMs()).toBeGreaterThan(0);
  });

  it('skips a transfer that fails TransferEventDto validation', async () => {
    wdkService.getUsdtTransfers.mockResolvedValue([
      { from: '0xsender', to: '0xmerchant', amount: '1000000', txHash: '0xtx1' },
    ]);
    (validateSync as jest.Mock).mockReturnValueOnce([{ property: 'chain', constraints: {} }]);

    const events = await adapter.read();

    expect(events).toHaveLength(0);
  });

  it('persists newly-seen tx hashes after a successful read', async () => {
    wdkService.getUsdtTransfers.mockResolvedValue([
      { from: '0xsender', to: '0xmerchant', amount: '1000000', txHash: '0xtx1' },
    ]);

    await adapter.read();

    expect(stateModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: '0xmerchant' },
      { seenTxHashes: ['0xtx1'] },
      { upsert: true },
    );
  });
});
