import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WdkService } from './wdk.service';

// axios uses a default export — mock must set __esModule + default
jest.mock('axios', () => {
  const mockInstance = { post: jest.fn(), get: jest.fn() };
  return {
    __esModule: true,
    default: { create: jest.fn().mockReturnValue(mockInstance) },
  };
});

describe('WdkService', () => {
  let service: WdkService;
  let mockAxiosInstance: { post: jest.Mock; get: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WdkService,
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('http://wdk.example.com') },
        },
      ],
    }).compile();

    service = module.get(WdkService);

    const axios = (jest.requireMock('axios') as { default: { create: jest.Mock } }).default;
    mockAxiosInstance = axios.create.mock.results[0]?.value as { post: jest.Mock; get: jest.Mock };
  });

  describe('connectShard', () => {
    it('posts to /connect-shard with walletId', async () => {
      mockAxiosInstance.post.mockResolvedValue({});

      await service.connectShard('user@example.com');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/connect-shard', {
        walletId: 'user@example.com',
      });
    });
  });

  describe('getBalances', () => {
    it('returns balance data from GET /balances/:walletId', async () => {
      const balances = [{ asset: 'ETH', amount: '1000000000000000000', decimals: 18 }];
      mockAxiosInstance.get.mockResolvedValue({ data: balances });

      const result = await service.getBalances('user@example.com');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/balances/user%40example.com');
      expect(result).toEqual(balances);
    });
  });

  describe('getTransactionHistory', () => {
    it('returns transactions from GET /transactions/:walletId', async () => {
      const txs = [
        { txHash: '0xabc', asset: 'ETH', amount: '100', direction: 'out', timestamp: 1000 },
      ];
      mockAxiosInstance.get.mockResolvedValue({ data: txs });

      const result = await service.getTransactionHistory('user@example.com');

      expect(result).toEqual(txs);
    });
  });
});
