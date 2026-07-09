import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { type AxiosInstance } from 'axios';

export type UsdtChain = 'sepolia';

export interface WdkTokenBalance {
  blockchain: string;
  token: string;
  amount: string;
}

@Injectable()
export class WdkService {
  private readonly logger = new Logger(WdkService.name);
  private readonly client: AxiosInstance;

  constructor(configService: ConfigService) {
    const baseURL = configService.getOrThrow<string>('wdkIndexer.baseUrl');
    const apiKey = configService.getOrThrow<string>('wdkIndexer.apiKey');
    this.client = axios.create({ baseURL, headers: { 'x-api-key': apiKey } });
  }

  async getUsdtBalance(chain: UsdtChain, address: string): Promise<string> {
    const response = await this.client.get<{ tokenBalance: WdkTokenBalance }>(
      `/api/v1/${chain}/usdt/${encodeURIComponent(address)}/token-balances`,
    );
    return response.data.tokenBalance.amount;
  }

  // Return type is intentionally `unknown[]`, not a fixed interface: the per-item field
  // names on this endpoint aren't documented by the provider — see the field-mapping
  // fallback in WdkIndexerTransferAdapter.toTransferEvent, which is why this stays loose.
  async getUsdtTransfers(
    chain: UsdtChain,
    address: string,
    limit = 20,
  ): Promise<unknown[]> {
    try {
      const response = await this.client.get<{ transfers: unknown[] }>(
        `/api/v1/${chain}/usdt/${encodeURIComponent(address)}/token-transfers?limit=${limit}`,
      );
      return response.data.transfers;
    } catch (err) {
      this.logger.error(`Failed to fetch transfers for ${address} on ${chain}`, err);
      throw err;
    }
  }
}
