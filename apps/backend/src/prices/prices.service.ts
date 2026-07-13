import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
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

export type PricesResponse = {
  prices: Record<string, number | null>;
  fetchedAt: string;
};

type CoinGeckoSimplePrice = Record<string, { usd?: number }>;

@Injectable()
export class PricesService {
  private readonly logger = new Logger(PricesService.name);
  private cache: PricesResponse | null = null;
  private cacheExpiresAt = 0;
  // Coalesces concurrent cache misses onto a single upstream call.
  private inFlight: Promise<PricesResponse> | null = null;

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

  private async fetchFresh(): Promise<PricesResponse> {
    const baseUrl = this.configService.get<string>('prices.coingeckoBaseUrl');
    const apiKey = this.configService.get<string>('prices.coingeckoApiKey');
    const ttlMs = this.configService.get<number>('prices.cacheTtlMs') ?? 60_000;

    const ids = [...new Set(Object.values(SYMBOL_TO_COINGECKO_ID).filter((id): id is string => id !== null))];
    const { data } = await axios.get<CoinGeckoSimplePrice>(`${baseUrl}/simple/price`, {
      params: { ids: ids.join(','), vs_currencies: 'usd' },
      headers: apiKey ? { 'x-cg-demo-api-key': apiKey } : undefined,
      timeout: UPSTREAM_TIMEOUT_MS,
    });

    const prices: Record<string, number | null> = {};
    for (const [symbol, id] of Object.entries(SYMBOL_TO_COINGECKO_ID)) {
      // An id missing from the upstream response degrades to null for that symbol
      // instead of failing the whole payload.
      prices[symbol] = id !== null ? (data[id]?.usd ?? null) : null;
    }

    const result: PricesResponse = { prices, fetchedAt: new Date().toISOString() };
    this.cache = result;
    this.cacheExpiresAt = Date.now() + ttlMs;
    return result;
  }
}
