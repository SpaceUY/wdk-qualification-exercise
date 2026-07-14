import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import { TokenTransfersService } from './token-transfers.service';
import { WdkAppNodeService } from './wdk-app-node.service';
import { CACHE_REDIS_CLIENT } from '../redis/redis-cache.tokens';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const TRANSFERS = [
  {
    transactionHash: '0xabc',
    blockchain: 'ethereum',
    token: 'usdt',
    from: 'a',
    to: 'b',
    amount: '1000000',
    ts: 1,
    type: 'received',
  },
];

describe('TokenTransfersService', () => {
  let service: TokenTransfersService;
  let configService: { get: jest.Mock };
  let wdkAppNodeService: { mintToken: jest.Mock };
  let redis: { get: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'wdkAppNode.baseUrl') return 'http://app-node.test';
        if (key === 'wdkAppNode.tokenTransfersCacheTtlSeconds') return 86400;
        return undefined;
      }),
    };
    wdkAppNodeService = { mintToken: jest.fn().mockReturnValue('signed.jwt.token') };
    redis = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue('OK') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenTransfersService,
        { provide: ConfigService, useValue: configService },
        { provide: WdkAppNodeService, useValue: wdkAppNodeService },
        { provide: CACHE_REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = module.get(TokenTransfersService);
  });

  it('fetches live transfers and caches them with the configured TTL', async () => {
    mockedAxios.get.mockResolvedValue({ data: { transfers: TRANSFERS } });

    const result = await service.getTokenTransfers('user@example.com', {});

    expect(result).toEqual(TRANSFERS);
    expect(redis.set).toHaveBeenCalledWith(
      'wdk-app-node:token-transfers:user@example.com:25:0:desc',
      JSON.stringify(TRANSFERS),
      'EX',
      86400,
    );
  });

  it('mints an app-node token for the requested user and forwards it as a Bearer header', async () => {
    mockedAxios.get.mockResolvedValue({ data: { transfers: TRANSFERS } });

    await service.getTokenTransfers('user@example.com', { limit: 10, skip: 5 });

    expect(wdkAppNodeService.mintToken).toHaveBeenCalledWith('user@example.com');
    const [url, config] = mockedAxios.get.mock.calls[0] as [
      string,
      { headers: Record<string, string>; params: Record<string, unknown> },
    ];
    expect(url).toBe('http://app-node.test/api/v1/users/user%40example.com/token-transfers');
    expect(config.headers.Authorization).toBe('Bearer signed.jwt.token');
    expect(config.params).toEqual({ limit: 10, skip: 5, sort: 'desc' });
  });

  it('retries the live fetch before falling back to the stale cache', async () => {
    mockedAxios.get.mockRejectedValue(new Error('ork/DHT lookup failed'));
    redis.get.mockResolvedValue(JSON.stringify(TRANSFERS));

    const result = await service.getTokenTransfers('user@example.com', {});

    expect(result).toEqual(TRANSFERS);
    expect(mockedAxios.get).toHaveBeenCalledTimes(3); // 1 initial attempt + 2 retries
  });

  it('throws ServiceUnavailable without leaking upstream details when there is no cache to fall back on', async () => {
    mockedAxios.get.mockRejectedValue(new Error('secret internal detail'));
    redis.get.mockResolvedValue(null);

    await expect(service.getTokenTransfers('user@example.com', {})).rejects.toThrow(
      ServiceUnavailableException,
    );
    await expect(service.getTokenTransfers('user@example.com', {})).rejects.not.toThrow(
      'secret internal detail',
    );
  });

  it('keys the cache per user/limit/skip so different pagination requests do not collide', async () => {
    mockedAxios.get.mockResolvedValue({ data: { transfers: TRANSFERS } });

    await service.getTokenTransfers('user@example.com', { limit: 10, skip: 20 });

    expect(redis.set).toHaveBeenCalledWith(
      'wdk-app-node:token-transfers:user@example.com:10:20:desc',
      expect.any(String),
      'EX',
      86400,
    );
  });
});
