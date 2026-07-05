import { registerAs } from '@nestjs/config';

export const indexerConfig = registerAs('indexer', () => ({
  transport: (process.env['INDEXER_TRANSPORT'] ?? 'redis-stream') as 'redis-stream' | 'hosted-api',
}));
