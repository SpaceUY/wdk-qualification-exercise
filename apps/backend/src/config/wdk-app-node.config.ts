import { registerAs } from '@nestjs/config';

export const wdkAppNodeConfig = registerAs('wdkAppNode', () => ({
  // Must match infra/wdk-stack/.env's JWT_SECRET exactly — that's the secret wdk-app-node
  // verifies incoming Bearer tokens against (HS256, payload { userId }).
  jwtSecret: process.env['WDK_APP_NODE_JWT_SECRET'],
  tokenTtlSeconds: Number(process.env['WDK_APP_NODE_TOKEN_TTL_SECONDS'] ?? 3600),
  // Where this backend reaches app-node server-side (for the token-transfers proxy) —
  // distinct from EXPO_PUBLIC_APP_NODE_URL, which is the RN app's own direct connection
  // for every other app-node call (wallet connect/create/update).
  baseUrl: process.env['WDK_APP_NODE_BASE_URL'] ?? 'http://localhost:3000',
  tokenTransfersCacheTtlSeconds: Number(
    process.env['WDK_APP_NODE_TOKEN_TRANSFERS_CACHE_TTL_SECONDS'] ?? 86400,
  ),
}));
