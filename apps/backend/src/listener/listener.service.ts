import * as crypto from 'crypto';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { ethers } from 'ethers';
import { ListenerState } from './entities/listener-state.entity';
import { Coupon } from '../coupons/entities/coupon.entity';
import { UsersService } from '../users/users.service';

const USDT_TRANSFER_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
] as const;

const CHAIN_KEY = 'ethereum-sepolia';

// Decimal adjustment: UTL has 18 decimals, USDT has 6 → multiply by 10^12
const DECIMAL_ADJUSTMENT = 10n ** 12n;
const BASIS_POINTS_DENOMINATOR = 10000n;

@Injectable()
export class ListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ListenerService.name);
  private wsProvider: ethers.WebSocketProvider | null = null;
  private httpProvider!: ethers.JsonRpcProvider;
  private usdtInterface!: ethers.Interface;
  private merchantAddresses!: Set<string>;
  private usdtAddress!: string;
  private confirmations!: number;
  private cashbackBps!: bigint;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(ListenerState)
    private readonly stateRepo: Repository<ListenerState>,
    @InjectRepository(Coupon)
    private readonly couponRepo: Repository<Coupon>,
    private readonly usersService: UsersService,
  ) {}

  async onModuleInit(): Promise<void> {
    const rpcUrl = this.configService.getOrThrow<string>('blockchain.rpcUrl');
    this.usdtAddress = this.configService.getOrThrow<string>('blockchain.usdtAddress');
    this.confirmations = this.configService.get<number>('blockchain.confirmations') ?? 2;
    this.cashbackBps = BigInt(
      this.configService.get<number>('blockchain.cashbackBps') ?? 500,
    );
    const merchantList: string[] =
      this.configService.get<string[]>('blockchain.merchantAddresses') ?? [];
    this.merchantAddresses = new Set(merchantList.map((a: string) => a.toLowerCase()));

    this.httpProvider = new ethers.JsonRpcProvider(rpcUrl);
    this.usdtInterface = new ethers.Interface(USDT_TRANSFER_ABI);

    await this.ensureState();
    this.setupWebSocket();
  }

  onModuleDestroy(): void {
    this.wsProvider?.destroy();
  }

  private async ensureState(): Promise<void> {
    const existing = await this.stateRepo.findOne({ where: { chainKey: CHAIN_KEY } });
    if (!existing) {
      const currentBlock = await this.httpProvider.getBlockNumber();
      await this.stateRepo.save(
        this.stateRepo.create({
          chainKey: CHAIN_KEY,
          lastProcessedBlock: currentBlock - 1,
        }),
      );
      this.logger.log(`Listener initialized at block ${currentBlock - 1}`);
    }
  }

  private setupWebSocket(): void {
    const wssUrl = this.configService.get<string>('blockchain.wssUrl');
    if (!wssUrl) {
      this.logger.warn('No ETHEREUM_WSS_URL configured — running in polling-only mode');
      return;
    }

    try {
      this.wsProvider = new ethers.WebSocketProvider(wssUrl);
      const contract = new ethers.Contract(
        this.usdtAddress,
        USDT_TRANSFER_ABI,
        this.wsProvider,
      );

      contract.on(
        'Transfer',
        async (from: string, to: string, value: bigint, event: ethers.EventLog) => {
          if (!this.merchantAddresses.has(to.toLowerCase())) return;
          await this.handleTransfer(from, to, value, event.transactionHash, event.blockNumber);
        },
      );

      // Cast required: ethers WebSocketLike interface omits onclose in some versions
      (this.wsProvider.websocket as unknown as { onclose: () => void }).onclose = () => {
        this.logger.warn('WebSocket connection closed — reconnecting in 5s');
        setTimeout(() => this.setupWebSocket(), 5000);
      };

      this.logger.log('WebSocket listener active');
    } catch (err) {
      this.logger.error('Failed to set up WebSocket listener', err);
    }
  }

  // Polling fallback runs every 30 seconds to catch any events missed during WS gaps
  @Cron('*/30 * * * * *')
  async pollForMissedEvents(): Promise<void> {
    const state = await this.stateRepo.findOne({ where: { chainKey: CHAIN_KEY } });
    if (!state) return;

    const currentBlock = await this.httpProvider.getBlockNumber();
    const toBlock = currentBlock - this.confirmations;

    if (toBlock <= state.lastProcessedBlock) return;

    const transferTopic = ethers.id('Transfer(address,address,uint256)');

    const logs = await this.httpProvider.getLogs({
      address: this.usdtAddress,
      topics: [transferTopic],
      fromBlock: state.lastProcessedBlock + 1,
      toBlock,
    });

    for (const log of logs) {
      const parsed = this.usdtInterface.parseLog(log);
      if (!parsed) continue;
      const from = parsed.args[0] as string;
      const to = parsed.args[1] as string;
      const value = parsed.args[2] as bigint;
      if (!this.merchantAddresses.has(to.toLowerCase())) continue;
      await this.handleTransfer(from, to, value, log.transactionHash, log.blockNumber);
    }

    await this.stateRepo.update({ chainKey: CHAIN_KEY }, { lastProcessedBlock: toBlock });
  }

  private async handleTransfer(
    from: string,
    to: string,
    value: bigint,
    txHash: string,
    blockNumber: number,
  ): Promise<void> {
    try {
      const user = await this.usersService.findByWalletAddress(from);
      const utlAmountRaw = this.computeUtlCashback(value);
      const code = crypto.randomBytes(16).toString('hex');

      const coupon = this.couponRepo.create({
        code,
        txHash: txHash.toLowerCase(),
        usdtAmountRaw: value.toString(),
        utlAmountRaw: utlAmountRaw.toString(),
        merchantAddress: to.toLowerCase(),
        blockNumber,
        user: user ?? null,
        redeemed: false,
      });

      await this.couponRepo.save(coupon);
      this.logger.log(`Coupon ${code} created for tx ${txHash} (${value} USDT raw → ${utlAmountRaw} UTL raw)`);
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        // Already processed — idempotency via tx_hash unique constraint
        this.logger.debug(`Duplicate tx ${txHash} — skipped`);
        return;
      }
      this.logger.error(`Failed to create coupon for tx ${txHash}`, err);
    }
  }

  computeUtlCashback(usdtRaw: bigint): bigint {
    // cashback UTL raw = usdtRaw × cashbackBps / 10000 × 10^(18−6)
    return (usdtRaw * this.cashbackBps * DECIMAL_ADJUSTMENT) / BASIS_POINTS_DENOMINATOR;
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as Record<string, unknown>)['code'] === '23505'
  );
}
