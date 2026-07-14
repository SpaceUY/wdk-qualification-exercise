import * as crypto from 'crypto';
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Job } from 'bull';
import { Model } from 'mongoose';
import { Coupon, CouponDocument } from '../../../coupons/entities/coupon.entity';
import { UsersService } from '../../../users/users.service';
import { TransferEventDto } from '../dto/transfer-event.dto';

const DECIMAL_ADJUSTMENT = 10n ** 12n; // UTL has 18 decimals, USDT has 6
const BASIS_POINTS_DENOMINATOR = 10000n;

@Processor('transfers')
export class TransferProcessor {
  private readonly logger = new Logger(TransferProcessor.name);
  private merchantAddresses?: Set<string>;
  private cashbackBps?: bigint;
  private minPayoutUsdtRaw?: bigint;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Coupon.name)
    private readonly couponModel: Model<CouponDocument>,
    private readonly usersService: UsersService,
  ) {}

  @Process('process-transfer')
  async handle(job: Job<TransferEventDto>): Promise<void> {
    const { merchantAddresses, cashbackBps, minPayoutUsdtRaw } = this.loadConfig();
    const { from, to, amount, txHash, chain } = job.data;

    if (!merchantAddresses.has(to.toLowerCase())) return;

    const usdtAmountRaw = BigInt(amount);
    if (usdtAmountRaw < minPayoutUsdtRaw) {
      this.logger.debug(
        `Transfer ${txHash} below minimum payout floor (${usdtAmountRaw} < ${minPayoutUsdtRaw} raw USDT) — no coupon issued`,
      );
      return;
    }
    const utlAmountRaw = this.computeUtlCashback(usdtAmountRaw, cashbackBps);
    const code = crypto.randomBytes(16).toString('hex');

    try {
      const user = await this.usersService.findByWalletAddress(from.toLowerCase());

      await this.couponModel.create({
        code,
        txHash: txHash.toLowerCase(),
        usdtAmountRaw: usdtAmountRaw.toString(),
        utlAmountRaw: utlAmountRaw.toString(),
        merchantAddress: to.toLowerCase(),
        payerAddress: from.toLowerCase(),
        // Not available from the REST indexer transport (only eth_getLogs supplied it before)
        blockNumber: 0,
        userId: user?.id ?? null,
        redeemed: false,
      });

      this.logger.log(
        `Coupon ${code} created for tx ${txHash} on ${chain} (${usdtAmountRaw} USDT raw → ${utlAmountRaw} UTL raw)`,
      );
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        // Already processed — idempotency via tx_hash unique constraint
        this.logger.debug(`Duplicate tx ${txHash} — skipped`);
        return;
      }
      this.logger.error(`Failed to create coupon for tx ${txHash}`, err);
      throw err; // let Bull retry on unexpected (non-duplicate) failures
    }
  }

  private loadConfig(): {
    merchantAddresses: Set<string>;
    cashbackBps: bigint;
    minPayoutUsdtRaw: bigint;
  } {
    if (
      !this.merchantAddresses ||
      this.cashbackBps === undefined ||
      this.minPayoutUsdtRaw === undefined
    ) {
      const merchantList =
        this.configService.get<string[]>('blockchain.merchantAddresses') ?? [];
      this.merchantAddresses = new Set(merchantList.map((a) => a.toLowerCase()));
      this.cashbackBps = this.configService.getOrThrow<bigint>('blockchain.cashbackBps');
      this.minPayoutUsdtRaw = BigInt(
        this.configService.get<number>('blockchain.minPayoutUsdtRaw') ?? 10_000,
      );
    }
    return {
      merchantAddresses: this.merchantAddresses,
      cashbackBps: this.cashbackBps,
      minPayoutUsdtRaw: this.minPayoutUsdtRaw,
    };
  }

  private computeUtlCashback(usdtRaw: bigint, cashbackBps: bigint): bigint {
    return (usdtRaw * cashbackBps * DECIMAL_ADJUSTMENT) / BASIS_POINTS_DENOMINATOR;
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as Record<string, unknown>)['code'] === 11000
  );
}
