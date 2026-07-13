import { registerAs } from '@nestjs/config';

export const pricesConfig = registerAs('prices', () => ({
  coingeckoBaseUrl: process.env['COINGECKO_BASE_URL'] ?? 'https://api.coingecko.com/api/v3',
  // Optional demo/pro key raises CoinGecko's rate limit; empty means anonymous access.
  coingeckoApiKey: process.env['COINGECKO_API_KEY'] ?? '',
  // One upstream call per minute at most — clients poll us, not CoinGecko.
  cacheTtlMs: 60_000,
}));
