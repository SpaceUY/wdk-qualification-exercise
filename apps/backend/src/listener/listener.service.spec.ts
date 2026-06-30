import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import type { ObjectLiteral, Repository } from 'typeorm';
import { ListenerService } from './listener.service';
import { ListenerState } from './entities/listener-state.entity';
import { Coupon } from '../coupons/entities/coupon.entity';
import { UsersService } from '../users/users.service';
import type { User } from '../users/entities/user.entity';

type MockRepo<T extends ObjectLiteral> = Partial<Record<keyof Repository<T>, jest.Mock>>;

function createMockRepo<T extends ObjectLiteral>(): MockRepo<T> {
  return {
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
}

// Provider mock is set in beforeEach via mockReturnValue so each test gets a fresh one
const mockProviderFactory = {
  getBlockNumber: jest.fn().mockResolvedValue(1000),
  getLogs: jest.fn().mockResolvedValue([]),
};

const mockInterfaceFactory = {
  parseLog: jest.fn(),
};

// Services use `import { ethers }` named namespace — mock must export the `ethers` property
jest.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: jest.fn().mockImplementation(() => mockProviderFactory),
    WebSocketProvider: jest.fn(),
    Interface: jest.fn().mockImplementation(() => mockInterfaceFactory),
    Contract: jest.fn().mockReturnValue({ on: jest.fn() }),
    id: jest.fn().mockReturnValue('0xtopichash'),
  },
}));

const mockConfigValues: Record<string, unknown> = {
  'blockchain.rpcUrl': 'https://rpc.example.com',
  'blockchain.wssUrl': '',
  'blockchain.usdtAddress': '0xusdtaddress',
  'blockchain.merchantAddresses': ['0xmerchant'],
  'blockchain.confirmations': 2,
  'blockchain.cashbackBps': 500,
};

const mockConfig = {
  getOrThrow: jest.fn((key: string) => mockConfigValues[key] ?? ''),
  get: jest.fn((key: string) => mockConfigValues[key]),
};

describe('ListenerService', () => {
  let service: ListenerService;
  let stateRepo: MockRepo<ListenerState>;
  let couponRepo: MockRepo<Coupon>;
  let usersService: jest.Mocked<UsersService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset provider mock state
    mockProviderFactory.getBlockNumber.mockResolvedValue(1000);
    mockProviderFactory.getLogs.mockResolvedValue([]);

    stateRepo = createMockRepo<ListenerState>();
    couponRepo = createMockRepo<Coupon>();

    (stateRepo.findOne as jest.Mock).mockResolvedValue(null);
    (stateRepo.create as jest.Mock).mockReturnValue({
      chainKey: 'ethereum-sepolia',
      lastProcessedBlock: 999,
    });
    (stateRepo.save as jest.Mock).mockResolvedValue(undefined);
    (couponRepo.create as jest.Mock).mockImplementation(
      (data: Partial<Coupon>) => ({ ...data }) as Coupon,
    );
    (couponRepo.save as jest.Mock).mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListenerService,
        { provide: getRepositoryToken(ListenerState), useValue: stateRepo },
        { provide: getRepositoryToken(Coupon), useValue: couponRepo },
        {
          provide: UsersService,
          useValue: { findByWalletAddress: jest.fn().mockResolvedValue(null) },
        },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(ListenerService);
    usersService = module.get(UsersService);

    await service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  describe('computeUtlCashback', () => {
    it('correctly computes 5% cashback with decimal adjustment', () => {
      // 1 USDT = 1_000_000 raw (6 decimals)
      // 5% cashback = 0.05 UTL = 50_000_000_000_000_000 raw (18 decimals)
      expect(service.computeUtlCashback(1_000_000n)).toBe(50_000_000_000_000_000n);
    });

    it('correctly computes cashback for 100 USDT', () => {
      // 100 USDT raw = 100_000_000
      // 5% = 5 UTL = 5_000_000_000_000_000_000 raw
      expect(service.computeUtlCashback(100_000_000n)).toBe(5_000_000_000_000_000_000n);
    });

    it('returns zero for zero input', () => {
      expect(service.computeUtlCashback(0n)).toBe(0n);
    });
  });

  describe('pollForMissedEvents', () => {
    it('creates a coupon when a Transfer to a merchant address is detected', async () => {
      (stateRepo.findOne as jest.Mock).mockResolvedValue({
        chainKey: 'ethereum-sepolia',
        lastProcessedBlock: 990,
      });

      mockProviderFactory.getBlockNumber.mockResolvedValue(1000);
      mockProviderFactory.getLogs.mockResolvedValue([
        { transactionHash: '0xtx123', blockNumber: 995 },
      ]);
      mockInterfaceFactory.parseLog.mockReturnValue({
        args: ['0xsender', '0xmerchant', 1_000_000n],
      });

      await service.pollForMissedEvents();

      expect(couponRepo.save).toHaveBeenCalled();
      const savedCoupon = (couponRepo.create as jest.Mock).mock.calls[0]?.[0] as Partial<Coupon>;
      expect(savedCoupon?.txHash).toBe('0xtx123');
      expect(savedCoupon?.usdtAmountRaw).toBe('1000000');
      expect(savedCoupon?.utlAmountRaw).toBe('50000000000000000');
      expect(savedCoupon?.merchantAddress).toBe('0xmerchant');
    });

    it('links coupon to user when sender wallet is registered', async () => {
      const mockUser: Partial<User> = { id: 'user-id' };
      (usersService.findByWalletAddress as jest.Mock).mockResolvedValue(mockUser as User);
      (stateRepo.findOne as jest.Mock).mockResolvedValue({
        chainKey: 'ethereum-sepolia',
        lastProcessedBlock: 990,
      });
      mockProviderFactory.getBlockNumber.mockResolvedValue(1000);
      mockProviderFactory.getLogs.mockResolvedValue([
        { transactionHash: '0xtx456', blockNumber: 995 },
      ]);
      mockInterfaceFactory.parseLog.mockReturnValue({
        args: ['0xsender', '0xmerchant', 500_000n],
      });

      await service.pollForMissedEvents();

      const savedCoupon = (couponRepo.create as jest.Mock).mock.calls[0]?.[0] as Partial<Coupon>;
      expect(savedCoupon?.userId).toBe('user-id');
    });

    it('silently ignores duplicate tx hash (Postgres unique violation code 23505)', async () => {
      (stateRepo.findOne as jest.Mock).mockResolvedValue({
        chainKey: 'ethereum-sepolia',
        lastProcessedBlock: 990,
      });
      mockProviderFactory.getBlockNumber.mockResolvedValue(1000);
      mockProviderFactory.getLogs.mockResolvedValue([
        { transactionHash: '0xduptx', blockNumber: 995 },
      ]);
      mockInterfaceFactory.parseLog.mockReturnValue({
        args: ['0xsender', '0xmerchant', 1_000_000n],
      });
      (couponRepo.save as jest.Mock).mockRejectedValue({ code: '23505' });

      await expect(service.pollForMissedEvents()).resolves.not.toThrow();
    });

    it('skips transfers to non-merchant addresses', async () => {
      (stateRepo.findOne as jest.Mock).mockResolvedValue({
        chainKey: 'ethereum-sepolia',
        lastProcessedBlock: 990,
      });
      mockProviderFactory.getBlockNumber.mockResolvedValue(1000);
      mockProviderFactory.getLogs.mockResolvedValue([
        { transactionHash: '0xskipped', blockNumber: 995 },
      ]);
      mockInterfaceFactory.parseLog.mockReturnValue({
        args: ['0xsender', '0xnotamerchant', 1_000_000n],
      });

      await service.pollForMissedEvents();

      expect(couponRepo.save).not.toHaveBeenCalled();
    });

    it('does not process events when lastProcessedBlock is current', async () => {
      (stateRepo.findOne as jest.Mock).mockResolvedValue({
        chainKey: 'ethereum-sepolia',
        lastProcessedBlock: 998,
      });
      mockProviderFactory.getBlockNumber.mockResolvedValue(1000);

      await service.pollForMissedEvents();

      // getLogs should not be called when toBlock <= lastProcessedBlock
      expect(couponRepo.save).not.toHaveBeenCalled();
    });
  });
});
