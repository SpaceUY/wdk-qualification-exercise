import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import { PricesService } from './prices.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const COINGECKO_PAYLOAD = {
  ethereum: { usd: 3500, usd_24h_change: 2.34 },
  bitcoin: { usd: 98000, usd_24h_change: -1.12 },
  tether: { usd: 1.0, usd_24h_change: 0.01 },
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
    expect(result.changePct24h).toEqual({ ETH: 2.34, BTC: -1.12, sBTC: -1.12, USDT: 0.01, UTL: null });
    expect(result.fetchedAt).toEqual(expect.any(String));
  });

  it('requests the 24h change from the upstream alongside the spot price', async () => {
    mockedAxios.get.mockResolvedValue({ data: COINGECKO_PAYLOAD });

    await service.getPrices();

    const params = mockedAxios.get.mock.calls[0]?.[1]?.params as Record<string, string>;
    expect(params.include_24hr_change).toBe('true');
  });

  it('degrades the 24h change to null when the upstream omits it, without touching the price', async () => {
    mockedAxios.get.mockResolvedValue({ data: { bitcoin: { usd: 98000 } } });

    const result = await service.getPrices();

    expect(result.prices['BTC']).toBe(98000);
    expect(result.changePct24h['BTC']).toBeNull();
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

  describe('getPriceHistory', () => {
    const MARKET_CHART = {
      prices: [
        [1_000, 100],
        [2_000, 110],
        [3_000, 105],
      ],
    };

    it('maps the range to CoinGecko days without sending the Enterprise-only interval param', async () => {
      mockedAxios.get.mockResolvedValue({ data: MARKET_CHART });

      await service.getPriceHistory('BTC', '1w');

      const [url, config] = mockedAxios.get.mock.calls[0] as [string, { params: Record<string, unknown> }];
      expect(url).toBe('https://coingecko.test/api/v3/coins/bitcoin/market_chart');
      expect(config.params).toEqual({ vs_currency: 'usd', days: 7 });
      expect(config.params).not.toHaveProperty('interval');
    });

    it('transforms upstream [timestamp, price] tuples into point objects', async () => {
      mockedAxios.get.mockResolvedValue({ data: MARKET_CHART });

      const result = await service.getPriceHistory('BTC', '1d');

      expect(result.symbol).toBe('BTC');
      expect(result.range).toBe('1d');
      expect(result.points).toEqual([
        { timestamp: 1_000, price: 100 },
        { timestamp: 2_000, price: 110 },
        { timestamp: 3_000, price: 105 },
      ]);
      expect(result.fetchedAt).toEqual(expect.any(String));
    });

    it('downsamples long series to 300 points, keeping the first and last', async () => {
      const raw = Array.from({ length: 1_000 }, (_, i) => [i, i * 2]);
      mockedAxios.get.mockResolvedValue({ data: { prices: raw } });

      const result = await service.getPriceHistory('BTC', '1y');

      expect(result.points).toHaveLength(300);
      expect(result.points[0]).toEqual({ timestamp: 0, price: 0 });
      expect(result.points[299]).toEqual({ timestamp: 999, price: 1_998 });
    });

    it('shares one cache entry between BTC and sBTC (same coingecko id)', async () => {
      mockedAxios.get.mockResolvedValue({ data: MARKET_CHART });

      const btc = await service.getPriceHistory('BTC', '1d');
      const sbtc = await service.getPriceHistory('sBTC', '1d');

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(sbtc.symbol).toBe('sBTC');
      expect(sbtc.points).toEqual(btc.points);
    });

    it('caches per range: a different range misses, a repeated range hits', async () => {
      mockedAxios.get.mockResolvedValue({ data: MARKET_CHART });

      await service.getPriceHistory('BTC', '1d');
      await service.getPriceHistory('BTC', '1w');
      await service.getPriceHistory('BTC', '1d');

      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('returns an empty series for UTL without calling the upstream', async () => {
      const result = await service.getPriceHistory('UTL', '1d');

      expect(result).toEqual({ symbol: 'UTL', range: '1d', points: [], fetchedAt: expect.any(String) });
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('throws NotFound for an unknown symbol without calling the upstream', async () => {
      await expect(service.getPriceHistory('XXX', '1d')).rejects.toThrow(NotFoundException);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('serves the stale series when the upstream fails after a successful fetch', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
      mockedAxios.get.mockResolvedValueOnce({ data: MARKET_CHART });
      const first = await service.getPriceHistory('BTC', '1d');

      // Jump past the 1d TTL so the next call misses the cache and hits the failing upstream.
      (Date.now as jest.Mock).mockReturnValue(1_000_000 + 61_000);
      mockedAxios.get.mockRejectedValueOnce(new Error('upstream down'));

      const result = await service.getPriceHistory('BTC', '1d');

      expect(result.points).toEqual(first.points);
    });

    it('throws ServiceUnavailable without leaking upstream details when there is no cache', async () => {
      mockedAxios.get.mockRejectedValue(new Error('secret internal detail'));

      await expect(service.getPriceHistory('BTC', '1d')).rejects.toThrow(ServiceUnavailableException);
      await expect(service.getPriceHistory('BTC', '1d')).rejects.not.toThrow('secret internal detail');
    });

    it('coalesces concurrent same-key cache misses onto a single upstream call', async () => {
      let resolveUpstream: (value: { data: typeof MARKET_CHART }) => void;
      mockedAxios.get.mockReturnValue(
        new Promise((resolve) => {
          resolveUpstream = resolve;
        }) as ReturnType<typeof axios.get>,
      );

      const [a, b] = [service.getPriceHistory('BTC', '1d'), service.getPriceHistory('sBTC', '1d')];
      resolveUpstream!({ data: MARKET_CHART });

      expect((await a).points).toEqual((await b).points);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });
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
