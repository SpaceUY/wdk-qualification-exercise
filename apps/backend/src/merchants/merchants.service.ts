import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MERCHANT_NAMES } from '../config/merchants.config';

export type MerchantsResponse = {
  addresses: string[];
  names: Record<string, string>;
  cashbackRate: number;
};

const BASIS_POINTS_DENOMINATOR = 10000;
const DEFAULT_CASHBACK_BPS = 500n;

@Injectable()
export class MerchantsService {
  constructor(private readonly configService: ConfigService) {}

  getMerchants(): MerchantsResponse {
    const addresses = this.configService.get<string[]>('blockchain.merchantAddresses') ?? [];
    const cashbackBps = this.configService.get<bigint>('blockchain.cashbackBps') ?? DEFAULT_CASHBACK_BPS;

    const names: Record<string, string> = {};
    for (const address of addresses) {
      const name = MERCHANT_NAMES[address];
      if (name !== undefined) names[address] = name;
    }

    return {
      addresses,
      names,
      cashbackRate: Number(cashbackBps) / BASIS_POINTS_DENOMINATOR,
    };
  }
}
