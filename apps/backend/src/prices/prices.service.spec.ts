import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import { PricesService } from './prices.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const COINGECKO_PAYLOAD = {
  ethereum: { usd: 3500 },
  bitcoin: { usd: 98000 },
  tether: { usd: 1.0 },
};

describe('PricesService', () => {
  let service: PricesService;
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'prices.coingeckoBaseUrl') return 'https://coingecko.test/api/v3';
        if (key === 'prices.coingeckoApiKey') return '';
        if (key === 'prices.cacheTtlMs') return 60_000;
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PricesService, { provide: ConfigService, useValue: configService }],
    }).compile();

    service = module.get(PricesService);
  });

  it('maps CoinGecko ids back to wallet symbols, pricing sBTC as BTC and UTL as null', async () => {
    mockedAxios.get.mockResolvedValue({ data: COINGECKO_PAYLOAD });

    const result = await service.getPrices();

    expect(result.prices).toEqual({ ETH: 3500, BTC: 98000, sBTC: 98000, USDT: 1.0, UTL: null });
    expect(result.fetchedAt).toEqual(expect.any(String));
  });

  it('requests each CoinGecko id only once even when symbols share one (BTC and sBTC)', async () => {
    mockedAxios.get.mockResolvedValue({ data: COINGECKO_PAYLOAD });

    await service.getPrices();

    const params = mockedAxios.get.mock.calls[0]?.[1]?.params as { ids: string };
    const ids = params.ids.split(',');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('serves the cached snapshot within the TTL without calling upstream again', async () => {
    mockedAxios.get.mockResolvedValue({ data: COINGECKO_PAYLOAD });

    const first = await service.getPrices();
    const second = await service.getPrices();

    expect(second).toBe(first);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('degrades a symbol to null when its id is missing from the upstream response', async () => {
    mockedAxios.get.mockResolvedValue({ data: { bitcoin: { usd: 98000 }, tether: { usd: 1.0 } } });

    const result = await service.getPrices();

    expect(result.prices['ETH']).toBeNull();
    expect(result.prices['BTC']).toBe(98000);
  });

  it('serves the stale cache when the upstream fails after a successful fetch', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    mockedAxios.get.mockResolvedValueOnce({ data: COINGECKO_PAYLOAD });
    const first = await service.getPrices();

    // Jump past the TTL so the next call misses the cache and hits the failing upstream.
    (Date.now as jest.Mock).mockReturnValue(1_000_000 + 61_000);
    mockedAxios.get.mockRejectedValueOnce(new Error('upstream down'));

    const result = await service.getPrices();

    expect(result).toBe(first);
  });

  it('throws ServiceUnavailable without leaking upstream details when there is no cache', async () => {
    mockedAxios.get.mockRejectedValue(new Error('secret internal detail'));

    await expect(service.getPrices()).rejects.toThrow(ServiceUnavailableException);
    await expect(service.getPrices()).rejects.not.toThrow('secret internal detail');
  });

  it('coalesces concurrent cache misses onto a single upstream call', async () => {
    let resolveUpstream: (value: { data: typeof COINGECKO_PAYLOAD }) => void;
    mockedAxios.get.mockReturnValue(
      new Promise((resolve) => {
        resolveUpstream = resolve;
      }) as ReturnType<typeof axios.get>,
    );

    const [a, b] = [service.getPrices(), service.getPrices()];
    resolveUpstream!({ data: COINGECKO_PAYLOAD });

    expect(await a).toBe(await b);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });
});
