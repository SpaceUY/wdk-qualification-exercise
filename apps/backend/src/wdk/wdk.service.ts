import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { type AxiosInstance } from 'axios';

export interface WdkBalance {
  asset: string;
  amount: string;
  decimals: number;
}

export interface WdkTransaction {
  txHash: string;
  asset: string;
  amount: string;
  direction: 'in' | 'out';
  timestamp: number;
}

@Injectable()
export class WdkService {
  private readonly logger = new Logger(WdkService.name);
  private readonly client: AxiosInstance;

  constructor(configService: ConfigService) {
    const baseURL = configService.getOrThrow<string>('WDK_BASE_URL');
    this.client = axios.create({ baseURL });
  }

  async connectShard(walletId: string): Promise<void> {
    await this.client.post('/connect-shard', { walletId });
    this.logger.log(`Shard connected for wallet ${walletId}`);
  }

  async getBalances(walletId: string): Promise<WdkBalance[]> {
    const response = await this.client.get<WdkBalance[]>(
      `/balances/${encodeURIComponent(walletId)}`,
    );
    return response.data;
  }

  async getTransactionHistory(walletId: string): Promise<WdkTransaction[]> {
    const response = await this.client.get<WdkTransaction[]>(
      `/transactions/${encodeURIComponent(walletId)}`,
    );
    return response.data;
  }
}
