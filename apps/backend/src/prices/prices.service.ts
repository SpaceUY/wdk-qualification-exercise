import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

// Symbols the mobile app displays, mapped to CoinGecko ids. sBTC is BTC held on the
// Spark network, so it tracks the BTC price. UTL has no market — null tells clients
// "no fiat equivalent" (it must not be rendered as $0).
const SYMBOL_TO_COINGECKO_ID: Record<string, string | null> = {
  ETH: 'ethereum',
  BTC: 'bitcoin',
  sBTC: 'bitcoin',
  USDT: 'tether',
  UTL: null,
};

const UPSTREAM_TIMEOUT_MS = 5_000;

export const PRICE_HISTORY_RANGES = ['1d', '1w', '1m', '1y'] as const;
export type PriceHistoryRange = (typeof PRICE_HISTORY_RANGES)[number];

// `interval` is intentionally never sent to market_chart — it is Enterprise-only on
// the demo tier; CoinGecko's automatic granularity covers all four ranges.
const RANGE_TO_DAYS: Record<PriceHistoryRange, number> = { '1d': 1, '1w': 7, '1m': 30, '1y': 365 };

// Longer ranges change slowly, so they can be cached longer. 1d reuses the
// configured spot-price TTL to stay in step with /prices.
const RANGE_TTL_MS: Record<Exclude<PriceHistoryRange, '1d'>, number> = {
  '1w': 5 * 60_000,
  '1m': 15 * 60_000,
  '1y': 60 * 60_000,
};

// Chart payloads stay small no matter the range (1y at hourly granularity is ~8760 raw points).
const MAX_HISTORY_POINTS = 300;

export type PricesResponse = {
  prices: Record<string, number | null>;
  // 24h change as a percentage (2.34 = +2.34%). null mirrors the prices contract:
  // no market or upstream omitted it — clients must not render it as 0%.
  changePct24h: Record<string, number | null>;
  fetchedAt: string;
};

export type PriceHistoryPoint = { timestamp: number; price: number };

export type PriceHistoryResponse = {
  symbol: string;
  range: PriceHistoryRange;
  points: PriceHistoryPoint[];
  fetchedAt: string;
};

type CoinGeckoSimplePrice = Record<string, { usd?: number; usd_24h_change?: number }>;

type CoinGeckoMarketChart = { prices?: [number, number][] };

// Cached per coingecko id (BTC and sBTC share one entry), so the request's symbol
// is stitched back in at response time.
type HistorySnapshot = { points: PriceHistoryPoint[]; fetchedAt: string };

const downsample = (points: PriceHistoryPoint[], max: number): PriceHistoryPoint[] => {
  if (points.length <= max) return points;
  // Uniform stride that always keeps the first and last points.
  const stride = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * stride)] as PriceHistoryPoint);
};

@Injectable()
export class PricesService {
  private readonly logger = new Logger(PricesService.name);
  private cache: PricesResponse | null = null;
  private cacheExpiresAt = 0;
  // Coalesces concurrent cache misses onto a single upstream call.
  private inFlight: Promise<PricesResponse> | null = null;

  // History caches are keyed by `${coingeckoId}:${range}` so BTC and sBTC share entries.
  private readonly historyCache = new Map<string, { snapshot: HistorySnapshot; expiresAt: number }>();
  private readonly historyInFlight = new Map<string, Promise<HistorySnapshot>>();

  constructor(private readonly configService: ConfigService) {}

  async getPrices(): Promise<PricesResponse> {
    if (this.cache && Date.now() < this.cacheExpiresAt) return this.cache;

    this.inFlight ??= this.fetchFresh().finally(() => {
      this.inFlight = null;
    });

    try {
      return await this.inFlight;
    } catch (error) {
      // A stale price beats no price for a balance display — serve the last
      // known snapshot past its TTL rather than failing the request.
      if (this.cache) {
        this.logger.warn(`Price fetch failed, serving stale cache: ${String(error)}`);
        return this.cache;
      }
      this.logger.error(`Price fetch failed with no cache to fall back on: ${String(error)}`);
      throw new ServiceUnavailableException('Price provider unavailable');
    }
  }

  async getPriceHistory(symbol: string, range: PriceHistoryRange): Promise<PriceHistoryResponse> {
    if (!(symbol in SYMBOL_TO_COINGECKO_ID)) {
      throw new NotFoundException(`Unknown asset symbol: ${symbol}`);
    }

    const coingeckoId = SYMBOL_TO_COINGECKO_ID[symbol];
    if (coingeckoId === null || coingeckoId === undefined) {
      // No market (e.g. UTL) — same contract as /prices: report "no data", never fabricate a series.
      return { symbol, range, points: [], fetchedAt: new Date().toISOString() };
    }

    const key = `${coingeckoId}:${range}`;
    const cached = this.historyCache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return { symbol, range, ...cached.snapshot };
    }

    let inFlight = this.historyInFlight.get(key);
    if (!inFlight) {
      inFlight = this.fetchHistorySnapshot(key, coingeckoId, range).finally(() => {
        this.historyInFlight.delete(key);
      });
      this.historyInFlight.set(key, inFlight);
    }

    try {
      const snapshot = await inFlight;
      return { symbol, range, ...snapshot };
    } catch (error) {
      // Same stale-on-error posture as getPrices(): an outdated chart beats no chart.
      if (cached) {
        this.logger.warn(`Price history fetch failed for ${key}, serving stale cache: ${String(error)}`);
        return { symbol, range, ...cached.snapshot };
      }
      this.logger.error(`Price history fetch failed for ${key} with no cache to fall back on: ${String(error)}`);
      throw new ServiceUnavailableException('Price provider unavailable');
    }
  }

  private async fetchHistorySnapshot(
    key: string,
    coingeckoId: string,
    range: PriceHistoryRange,
  ): Promise<HistorySnapshot> {
    const baseUrl = this.configService.get<string>('prices.coingeckoBaseUrl');
    const apiKey = this.configService.get<string>('prices.coingeckoApiKey');

    const { data } = await axios.get<CoinGeckoMarketChart>(`${baseUrl}/coins/${coingeckoId}/market_chart`, {
      params: { vs_currency: 'usd', days: RANGE_TO_DAYS[range] },
      headers: apiKey ? { 'x-cg-demo-api-key': apiKey } : undefined,
      timeout: UPSTREAM_TIMEOUT_MS,
    });

    const points = downsample(
      (data.prices ?? []).map(([timestamp, price]) => ({ timestamp, price })),
      MAX_HISTORY_POINTS,
    );

    const snapshot: HistorySnapshot = { points, fetchedAt: new Date().toISOString() };
    const ttlMs =
      range === '1d' ? (this.configService.get<number>('prices.cacheTtlMs') ?? 60_000) : RANGE_TTL_MS[range];
    this.historyCache.set(key, { snapshot, expiresAt: Date.now() + ttlMs });
    return snapshot;
  }

  private async fetchFresh(): Promise<PricesResponse> {
    const baseUrl = this.configService.get<string>('prices.coingeckoBaseUrl');
    const apiKey = this.configService.get<string>('prices.coingeckoApiKey');
    const ttlMs = this.configService.get<number>('prices.cacheTtlMs') ?? 60_000;

    const ids = [...new Set(Object.values(SYMBOL_TO_COINGECKO_ID).filter((id): id is string => id !== null))];
    const { data } = await axios.get<CoinGeckoSimplePrice>(`${baseUrl}/simple/price`, {
      params: { ids: ids.join(','), vs_currencies: 'usd', include_24hr_change: 'true' },
      headers: apiKey ? { 'x-cg-demo-api-key': apiKey } : undefined,
      timeout: UPSTREAM_TIMEOUT_MS,
    });

    const prices: Record<string, number | null> = {};
    const changePct24h: Record<string, number | null> = {};
    for (const [symbol, id] of Object.entries(SYMBOL_TO_COINGECKO_ID)) {
      // An id missing from the upstream response degrades to null for that symbol
      // instead of failing the whole payload.
      prices[symbol] = id !== null ? (data[id]?.usd ?? null) : null;
      changePct24h[symbol] = id !== null ? (data[id]?.usd_24h_change ?? null) : null;
    }

    const result: PricesResponse = { prices, changePct24h, fetchedAt: new Date().toISOString() };
    this.cache = result;
    this.cacheExpiresAt = Date.now() + ttlMs;
    return result;
  }
}
