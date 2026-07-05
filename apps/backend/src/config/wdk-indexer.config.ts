import { registerAs } from '@nestjs/config';

export const wdkIndexerConfig = registerAs('wdkIndexer', () => ({
  baseUrl: process.env['WDK_INDEXER_BASE_URL'] ?? 'https://wdk-api.tether.io',
  apiKey: process.env['WDK_INDEXER_API_KEY'] ?? '',
}));
