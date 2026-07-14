import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type Redis from 'ioredis';
import { CACHE_REDIS_CLIENT } from '../redis/redis-cache.tokens';
import { WdkAppNodeService } from './wdk-app-node.service';

export type TokenTransfer = {
  transactionHash: string;
  blockchain: string;
  token: string;
  from: string;
  to: string;
  amount: string;
  ts: number;
  type: string;
};

const UPSTREAM_TIMEOUT_MS = 5_000;
// app-node's ork/DHT shard lookup can fail for minutes at a stretch (see
// useAppNodeWalletSync.ts's RETRY_DELAYS_MS comment) — retrying longer here just adds
// latency on top of an outage retrying won't outlast, so this fails fast to the Redis
// fallback below instead of matching the client's own retry budget.
const SERVER_RETRY_DELAYS_MS = [300, 800];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class TokenTransfersService {
  private readonly logger = new Logger(TokenTransfersService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly wdkAppNodeService: WdkAppNodeService,
    @Inject(CACHE_REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getTokenTransfers(
    userId: string,
    opts: { limit?: number; skip?: number },
  ): Promise<TokenTransfer[]> {
    const limit = opts.limit ?? 25;
    const skip = opts.skip ?? 0;
    const cacheKey = `wdk-app-node:token-transfers:${userId}:${limit}:${skip}:desc`;

    try {
      const transfers = await this.fetchWithRetries(userId, limit, skip);
      const ttlSeconds = this.config.get<number>('wdkAppNode.tokenTransfersCacheTtlSeconds') ?? 86400;
      await this.redis.set(cacheKey, JSON.stringify(transfers), 'EX', ttlSeconds);
      return transfers;
    } catch (error) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        this.logger.warn(
          `Token transfers fetch failed for ${userId}, serving stale cache: ${String(error)}`,
        );
        return JSON.parse(cached) as TokenTransfer[];
      }
      this.logger.error(
        `Token transfers fetch failed for ${userId} with no cache to fall back on: ${String(error)}`,
      );
      throw new ServiceUnavailableException('Token transfers unavailable');
    }
  }

  private async fetchWithRetries(userId: string, limit: number, skip: number): Promise<TokenTransfer[]> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.fetchLive(userId, limit, skip);
      } catch (err) {
        if (attempt >= SERVER_RETRY_DELAYS_MS.length) throw err;
        await sleep(SERVER_RETRY_DELAYS_MS[attempt]);
      }
    }
  }

  private async fetchLive(userId: string, limit: number, skip: number): Promise<TokenTransfer[]> {
    const baseUrl = this.config.get<string>('wdkAppNode.baseUrl');
    const token = this.wdkAppNodeService.mintToken(userId);

    const { data } = await axios.get<{ transfers: TokenTransfer[] }>(
      `${baseUrl}/api/v1/users/${encodeURIComponent(userId)}/token-transfers`,
      {
        params: { limit, skip, sort: 'desc' },
        headers: { Authorization: `Bearer ${token}` },
        timeout: UPSTREAM_TIMEOUT_MS,
      },
    );
    return data.transfers;
  }
}
