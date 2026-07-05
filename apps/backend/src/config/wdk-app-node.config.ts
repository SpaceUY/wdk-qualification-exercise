import { registerAs } from '@nestjs/config';

export const wdkAppNodeConfig = registerAs('wdkAppNode', () => ({
  // Must match infra/wdk-stack/.env's JWT_SECRET exactly — that's the secret wdk-app-node
  // verifies incoming Bearer tokens against (HS256, payload { userId }).
  jwtSecret: process.env['WDK_APP_NODE_JWT_SECRET'],
  tokenTtlSeconds: Number(process.env['WDK_APP_NODE_TOKEN_TTL_SECONDS'] ?? 3600),
}));
