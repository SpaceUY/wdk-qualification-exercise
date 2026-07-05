import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WdkService } from './wdk.service';

// axios uses a default export — mock must set __esModule + default
jest.mock('axios', () => {
  const mockInstance = { get: jest.fn() };
  return {
    __esModule: true,
    default: { create: jest.fn().mockReturnValue(mockInstance) },
  };
});

describe('WdkService', () => {
  let service: WdkService;
  let mockAxiosInstance: { get: jest.Mock };
  let mockAxiosCreate: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WdkService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) =>
              key === 'wdkIndexer.baseUrl' ? 'https://wdk-api.tether.io' : 'test-api-key',
            ),
          },
        },
      ],
    }).compile();

    service = module.get(WdkService);

    const axios = (jest.requireMock('axios') as { default: { create: jest.Mock } }).default;
    mockAxiosCreate = axios.create;
    mockAxiosInstance = axios.create.mock.results[0]?.value as { get: jest.Mock };
  });

  it('creates the axios client with the x-api-key header', () => {
    expect(mockAxiosCreate).toHaveBeenCalledWith({
      baseURL: 'https://wdk-api.tether.io',
      headers: { 'x-api-key': 'test-api-key' },
    });
  });

  describe('getUsdtBalance', () => {
    it('returns the balance amount from GET /api/v1/:chain/usdt/:address/token-balances', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { tokenBalance: { blockchain: 'sepolia', token: 'usdt', amount: '12.5' } },
      });

      const result = await service.getUsdtBalance('sepolia', '0xabc');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/v1/sepolia/usdt/0xabc/token-balances',
      );
      expect(result).toBe('12.5');
    });
  });

  describe('getUsdtTransfers', () => {
    it('returns transfers from GET /api/v1/:chain/usdt/:address/token-transfers', async () => {
      const transfers = [{ txHash: '0xabc' }];
      mockAxiosInstance.get.mockResolvedValue({ data: { transfers } });

      const result = await service.getUsdtTransfers('sepolia', '0xabc', 5);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/v1/sepolia/usdt/0xabc/token-transfers?limit=5',
      );
      expect(result).toEqual(transfers);
    });

    it('propagates errors from the indexer API', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('indexer down'));

      await expect(service.getUsdtTransfers('sepolia', '0xabc')).rejects.toThrow('indexer down');
    });
  });
});
