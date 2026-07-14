import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bull';
import { TransferProcessor } from './transfer.processor';
import { Coupon } from '../../../coupons/entities/coupon.entity';
import { UsersService } from '../../../users/users.service';
import type { UserDocument } from '../../../users/entities/user.entity';
import { TransferEventDto } from '../dto/transfer-event.dto';

type MockModel = {
  create: jest.Mock;
};

function createMockModel(): MockModel {
  return { create: jest.fn() };
}

function makeJob(overrides: Partial<TransferEventDto> = {}): Job<TransferEventDto> {
  const data: TransferEventDto = {
    from: '0xsender',
    to: '0xmerchant',
    amount: '1000000',
    txHash: '0xtx1',
    chain: 'sepolia',
    ...overrides,
  };
  return { data } as Job<TransferEventDto>;
}

const mockConfigValues: Record<string, unknown> = {
  'blockchain.merchantAddresses': ['0xmerchant'],
  'blockchain.cashbackBps': 500n,
  'blockchain.minPayoutUsdtRaw': 10_000,
};

describe('TransferProcessor', () => {
  let processor: TransferProcessor;
  let couponModel: MockModel;
  let usersService: jest.Mocked<UsersService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    couponModel = createMockModel();
    couponModel.create.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferProcessor,
        { provide: getModelToken(Coupon.name), useValue: couponModel },
        {
          provide: UsersService,
          useValue: { findByWalletAddress: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => mockConfigValues[key]),
            getOrThrow: jest.fn((key: string) => {
              const value = mockConfigValues[key];
              if (value === undefined) throw new Error(`Missing config: ${key}`);
              return value;
            }),
          },
        },
      ],
    }).compile();

    processor = module.get(TransferProcessor);
    usersService = module.get(UsersService);
    configService = module.get(ConfigService);
  });

  it('reads merchant/cashback config once and reuses it across subsequent transfers', async () => {
    await processor.handle(makeJob({ txHash: '0xtx1' }));
    const callsAfterFirst = configService.get.mock.calls.length;

    await processor.handle(makeJob({ txHash: '0xtx2' }));

    expect(configService.get.mock.calls.length).toBe(callsAfterFirst);
  });

  it('creates a coupon for a transfer to a merchant address', async () => {
    await processor.handle(makeJob());

    expect(couponModel.create).toHaveBeenCalled();
    const saved = couponModel.create.mock.calls[0]?.[0] as Partial<Coupon>;
    expect(saved.txHash).toBe('0xtx1');
    expect(saved.usdtAmountRaw).toBe('1000000');
    expect(saved.utlAmountRaw).toBe('50000000000000000'); // 5% of 1_000_000 USDT raw, decimal-adjusted
    expect(saved.merchantAddress).toBe('0xmerchant');
    expect(saved.payerAddress).toBe('0xsender');
  });

  it('skips transfers to non-merchant addresses', async () => {
    await processor.handle(makeJob({ to: '0xnotamerchant' }));

    expect(couponModel.create).not.toHaveBeenCalled();
  });

  it('links the coupon to the user when the sender wallet is registered', async () => {
    const mockUser: Partial<UserDocument> = { id: 'user-id' };
    usersService.findByWalletAddress.mockResolvedValue(mockUser as UserDocument);

    await processor.handle(makeJob());

    const saved = couponModel.create.mock.calls[0]?.[0] as Partial<Coupon>;
    expect(saved.userId).toBe('user-id');
  });

  it('creates an orphaned coupon (userId: null) when the sender wallet is not registered', async () => {
    usersService.findByWalletAddress.mockResolvedValue(null);

    await processor.handle(makeJob());

    expect(couponModel.create).toHaveBeenCalled();
    const saved = couponModel.create.mock.calls[0]?.[0] as Partial<Coupon>;
    expect(saved.userId).toBeNull();
    expect(saved.txHash).toBe('0xtx1');
  });

  it('skips a dust-sized transfer below the minimum payout floor', async () => {
    await processor.handle(makeJob({ amount: '1' })); // 1 raw USDT unit, floor is 10_000

    expect(couponModel.create).not.toHaveBeenCalled();
  });

  it('still issues a coupon for a transfer exactly at the minimum payout floor', async () => {
    await processor.handle(makeJob({ amount: '10000' }));

    expect(couponModel.create).toHaveBeenCalled();
    const saved = couponModel.create.mock.calls[0]?.[0] as Partial<Coupon>;
    expect(saved.usdtAmountRaw).toBe('10000');
    // 10_000 raw USDT (6dp) * 500bps / 10000 * 10^12 (decimal adjustment to 18dp) = 500_000_000_000_000 raw UTL
    expect(saved.utlAmountRaw).toBe('500000000000000');
  });

  it('skips a transfer one unit below the minimum payout floor', async () => {
    await processor.handle(makeJob({ amount: '9999' }));

    expect(couponModel.create).not.toHaveBeenCalled();
  });

  it('silently swallows a duplicate tx hash (Mongo duplicate key 11000)', async () => {
    couponModel.create.mockRejectedValue({ code: 11000 });

    await expect(processor.handle(makeJob())).resolves.not.toThrow();
  });

  it('rethrows unexpected errors so Bull can retry the job', async () => {
    couponModel.create.mockRejectedValue(new Error('db down'));

    await expect(processor.handle(makeJob())).rejects.toThrow('db down');
  });
});
