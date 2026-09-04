import * as crypto from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ethers } from 'ethers';
import { WalletAccountEvm, type EvmTransaction } from '@tetherto/wdk-wallet-evm';
import { NoSuchElementError } from '@tetherto/wdk-wallet';
import type Redis from 'ioredis';
import { Coupon, CouponDocument } from './entities/coupon.entity';
import { UsersService } from '../users/users.service';
import { CACHE_REDIS_CLIENT } from '../redis/redis-cache.tokens';
import type { CouponListItemDto, ClaimedCouponListItemDto } from './dto/list-coupons.dto';

const ERC20_TRANSFER_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
] as const;

// Raised only while nothing has been signed or broadcast, so the caller can
// safely roll back the coupon's redeemed flag and ask the user to retry.
class TreasuryLockUnavailableError extends Error {}

@Injectable()
export class CouponsService implements OnModuleInit {
  private readonly logger = new Logger(CouponsService.name);
  // Plain read-only ethers provider for populating a transaction (nonce, fee data,
  // chainId, gas estimate) before signing. No key material touches this — it only
  // ever does unauthenticated chain reads against the same RPC endpoint WDK itself
  // is configured with. Signing and broadcasting go through `treasuryAccount`'s
  // public API below, not through this provider.
  private provider!: ethers.JsonRpcProvider;
  private treasuryAccount!: WalletAccountEvm;
  private treasuryAddress!: string;
  private utlContract!: ethers.Contract;
  // First layer of treasury-send serialization: an in-process queue, so claims in
  // this process line up cheaply instead of all polling Redis. The second layer,
  // a Redis lock (see withTreasuryLock), extends the exclusion across instances —
  // two concurrent claims must never both populate/sign before either broadcasts,
  // or they'd fetch the same pending nonce and one would invalidate the other.
  private localTreasuryQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Coupon.name)
    private readonly couponModel: Model<CouponDocument>,
    private readonly usersService: UsersService,
    @Inject(CACHE_REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async onModuleInit(): Promise<void> {
    const rpcUrl = this.configService.getOrThrow<string>('blockchain.rpcUrl');
    const seedPhrase = this.configService.getOrThrow<string>('blockchain.treasurySeedPhrase');
    const derivationPath = this.configService.getOrThrow<string>('blockchain.treasuryDerivationPath');
    const utlAddress = this.configService.getOrThrow<string>('blockchain.utlAddress');

    // Treasury key is derived via WDK's EVM wallet module from a BIP-39 seed phrase,
    // instead of holding a raw private key. Everything that touches the key
    // (signing, broadcasting) goes through this account's public API only —
    // see buildSignAndBroadcast below for why we don't use its one-shot transfer().
    this.treasuryAccount = new WalletAccountEvm(seedPhrase, derivationPath, { provider: rpcUrl });
    this.treasuryAddress = await this.treasuryAccount.getAddress();
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.utlContract = new ethers.Contract(utlAddress, ERC20_TRANSFER_ABI, this.provider);
  }

  async claimCoupon(
    couponCode: string,
    cognitoSub: string,
  ): Promise<{ redemptionTxHash: string }> {
    const user = await this.usersService.findByCognitoSub(cognitoSub);
    if (!user) throw new BadRequestException('User not found');
    if (!user.walletAddress) {
      throw new BadRequestException('Wallet address not registered — call PUT /wallets/address first');
    }
    const recipientAddress = user.walletAddress;

    const coupon = await this.couponModel.findOne({ code: couponCode });
    if (!coupon) throw new BadRequestException('Invalid coupon code');
    if (coupon.redeemed) throw new BadRequestException('Coupon already redeemed');
    if (coupon.userId !== user.id) throw new ForbiddenException('Coupon does not belong to this user');

    // Atomic compare-and-swap: only succeeds if no concurrent request has already
    // claimed this coupon. The `redeemed: false` filter is what makes this a real
    // lock — a plain `updateOne({ _id })` matches regardless of current state and
    // lets two concurrent requests both "win", causing a double-payout.
    const locked = await this.couponModel.findOneAndUpdate(
      { _id: coupon._id, redeemed: false },
      { redeemed: true, redeemedAt: new Date() },
    );
    if (!locked) throw new BadRequestException('Coupon already redeemed');

    // Build, sign, and broadcast under the treasury lock: the nonce we read while
    // populating the transaction only stays valid until the next one is broadcast,
    // so a second claim must not start building its own until this one is sent
    // (see `localTreasuryQueue` above).
    let txHash: string;
    try {
      txHash = await this.withTreasuryLock(() =>
        this.buildSignAndBroadcast(coupon, recipientAddress, couponCode),
      );
    } catch (err) {
      if (err instanceof TreasuryLockUnavailableError) {
        // Nothing was signed or sent — safe to roll back the claim lock.
        await this.couponModel.updateOne(
          { _id: coupon._id },
          { redeemed: false, redeemedAt: null },
        );
        this.logger.error(`Treasury lock unavailable for coupon ${couponCode}`, err);
        throw new BadRequestException('UTL transfer is busy — please retry');
      }
      throw err;
    }

    try {
      const receipt = await this.treasuryAccount.waitForTransaction(txHash);
      if (!receipt.success) throw new Error(`Transaction reverted on-chain (tx ${receipt.hash})`);

      this.logger.log(
        `UTL transferred: ${receipt.hash} — ${coupon.utlAmountRaw} raw UTL to ${recipientAddress}`,
      );

      return { redemptionTxHash: receipt.hash };
    } catch (err) {
      this.logger.error(
        `UTL transfer broadcast (tx ${txHash}) but confirmation failed for coupon ${couponCode} — verify on-chain before retrying`,
        err,
      );
      throw new BadRequestException(
        'UTL transfer submitted but confirmation failed — check transaction status before retrying',
      );
    }
  }

  private async buildSignAndBroadcast(
    coupon: CouponDocument,
    recipientAddress: string,
    couponCode: string,
  ): Promise<string> {
    // Build the transfer ourselves and sign it via WDK's treasuryAccount.signTransaction()
    // (instead of the one-shot transfer()/sendTransaction() convenience calls, which sign
    // AND broadcast in one step) so we know the transaction's hash BEFORE it's broadcast.
    // That hash is what lets us later ask the chain "did this exact transaction land?"
    // instead of guessing from an ambiguous broadcast failure — see the catch block below.
    //
    // Populating (nonce/fee/gas/chainId) is done via a plain ethers provider — WDK's
    // signTransaction() signs exactly what it's given, it doesn't populate defaults, and
    // this step never touches key material, just unauthenticated chain reads.
    let signedTx: string;
    let txHash: string;
    try {
      const utlAddress = await this.utlContract.getAddress();
      const data = this.utlContract.interface.encodeFunctionData('transfer', [
        recipientAddress,
        BigInt(coupon.utlAmountRaw),
      ]);

      const [nonce, feeData, network, gasLimit] = await Promise.all([
        this.provider.getTransactionCount(this.treasuryAddress, 'pending'),
        this.provider.getFeeData(),
        this.provider.getNetwork(),
        this.provider.estimateGas({ to: utlAddress, data, from: this.treasuryAddress }),
      ]);

      const tx: EvmTransaction = {
        to: utlAddress,
        data,
        value: 0n,
        nonce,
        gasLimit,
        maxFeePerGas: feeData.maxFeePerGas ?? undefined,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? undefined,
        chainId: network.chainId,
      };

      signedTx = await this.treasuryAccount.signTransaction(tx);
      const parsed = ethers.Transaction.from(signedTx).hash;
      if (!parsed) throw new Error('Signed transaction has no hash');
      txHash = parsed;
    } catch (err) {
      // Nothing was ever sent to the network at this point — safe to roll back.
      await this.couponModel.updateOne(
        { _id: coupon._id },
        { redeemed: false, redeemedAt: null },
      );
      this.logger.error(`Failed to build/sign UTL transfer for coupon ${couponCode}`, err);
      throw new BadRequestException('UTL transfer failed — please retry');
    }

    // Record the intended hash BEFORE broadcasting — this is the durable idempotency
    // record. If the broadcast call below throws, we can still ask the chain "did
    // *this* transaction land?" using this hash instead of assuming it didn't.
    await this.couponModel.updateOne({ _id: coupon._id }, { redemptionTxHash: txHash });

    try {
      const result = await this.treasuryAccount.sendTransaction(signedTx);
      return result.hash;
    } catch (broadcastErr) {
      const wasBroadcast = await this.wasTransactionBroadcast(txHash);

      if (wasBroadcast === true) {
        this.logger.error(
          `UTL transfer for coupon ${couponCode} (tx ${txHash}) found on-chain despite a failed broadcast response — treating as sent, not rolling back`,
          broadcastErr,
        );
        throw new BadRequestException(
          'UTL transfer submitted but confirmation failed — check transaction status before retrying',
        );
      }

      if (wasBroadcast === false) {
        await this.couponModel.updateOne(
          { _id: coupon._id },
          { redeemed: false, redeemedAt: null, redemptionTxHash: null },
        );
        this.logger.error(`UTL transfer failed to broadcast for coupon ${couponCode}`, broadcastErr);
        throw new BadRequestException('UTL transfer failed — please retry');
      }

      // wasBroadcast === null: the chain could not be reached to verify either way.
      // Fund-safety default: never roll back a lock we can't prove is safe to retry.
      this.logger.error(
        `UTL transfer broadcast status for coupon ${couponCode} (tx ${txHash}) could not be verified — manual check required`,
        broadcastErr,
      );
      throw new BadRequestException(
        'UTL transfer status could not be confirmed — please contact support before retrying',
      );
    }
  }

  private static readonly BROADCAST_VERIFY_ATTEMPTS = 3;
  private static readonly BROADCAST_VERIFY_DELAY_MS = 2000;

  // Retries getTransaction a few times since an ambiguous broadcast failure is
  // inherently about network visibility — one failed check proves nothing.
  private async wasTransactionBroadcast(txHash: string): Promise<boolean | null> {
    let lastCallSucceeded = false;

    for (let attempt = 1; attempt <= CouponsService.BROADCAST_VERIFY_ATTEMPTS; attempt++) {
      try {
        // WDK's getTransaction throws NoSuchElementError instead of returning null —
        // reaching this line at all (no throw) means the chain has a record of it.
        await this.treasuryAccount.getTransaction(txHash);
        lastCallSucceeded = true;
        return true;
      } catch (err) {
        if (err instanceof NoSuchElementError) {
          lastCallSucceeded = true;
        } else {
          lastCallSucceeded = false;
        }
      }
      if (attempt < CouponsService.BROADCAST_VERIFY_ATTEMPTS) {
        await this.delay(CouponsService.BROADCAST_VERIFY_DELAY_MS);
      }
    }

    // If the last attempt got a real response (just an empty one), the chain is
    // reachable and genuinely has no record of it — safe to treat as not sent.
    // If it kept throwing, we truly don't know either way.
    return lastCallSucceeded ? false : null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Generous ceiling: the locked section can legitimately take tens of seconds on the
  // broadcast-failure verification path. If a process dies mid-send, other instances
  // are blocked at most this long. Expiry while still working would re-open the nonce
  // race, hence the margin over the observed worst case.
  private static readonly TREASURY_LOCK_KEY = 'coupons:treasury-send-lock';
  private static readonly TREASURY_LOCK_TTL_MS = 120_000;
  private static readonly TREASURY_LOCK_ACQUIRE_ATTEMPTS = 120;
  private static readonly TREASURY_LOCK_ACQUIRE_POLL_MS = 250;
  // Compare-and-delete: only the token holder may release, so a lock that expired
  // and was re-acquired by another process is never deleted out from under it.
  private static readonly TREASURY_LOCK_RELEASE_SCRIPT =
    'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';

  // Runs fn while holding both serialization layers: the in-process queue (cheap
  // ordering between local claims) and the Redis lock (mutual exclusion across
  // instances). Encapsulating acquire+release here makes leaking the lock from a
  // future call site impossible by construction.
  private async withTreasuryLock<T>(fn: () => Promise<T>): Promise<T> {
    const previous = this.localTreasuryQueue;
    let releaseLocal!: () => void;
    this.localTreasuryQueue = new Promise<void>((resolve) => {
      releaseLocal = resolve;
    });
    await previous;
    try {
      const token = await this.acquireDistributedTreasuryLock();
      try {
        return await fn();
      } finally {
        await this.releaseDistributedTreasuryLock(token);
      }
    } finally {
      releaseLocal();
    }
  }

  private async acquireDistributedTreasuryLock(): Promise<string> {
    const token = crypto.randomUUID();
    for (let attempt = 1; attempt <= CouponsService.TREASURY_LOCK_ACQUIRE_ATTEMPTS; attempt++) {
      try {
        const acquired = await this.redis.set(
          CouponsService.TREASURY_LOCK_KEY,
          token,
          'PX',
          CouponsService.TREASURY_LOCK_TTL_MS,
          'NX',
        );
        if (acquired === 'OK') return token;
      } catch (err) {
        // Fund-safety: without Redis we cannot prove exclusion across instances,
        // so fail the claim (nothing signed yet) rather than proceed unlocked.
        throw new TreasuryLockUnavailableError(
          `Redis unreachable while acquiring treasury lock: ${String(err)}`,
        );
      }
      if (attempt < CouponsService.TREASURY_LOCK_ACQUIRE_ATTEMPTS) {
        await this.delay(CouponsService.TREASURY_LOCK_ACQUIRE_POLL_MS);
      }
    }
    throw new TreasuryLockUnavailableError(
      'Timed out waiting for the treasury lock held by another instance',
    );
  }

  private async releaseDistributedTreasuryLock(token: string): Promise<void> {
    try {
      await this.redis.eval(
        CouponsService.TREASURY_LOCK_RELEASE_SCRIPT,
        1,
        CouponsService.TREASURY_LOCK_KEY,
        token,
      );
    } catch (err) {
      // Never let a release failure mask the transfer outcome — the TTL will
      // reclaim the lock; other instances just wait a little longer.
      this.logger.error('Failed to release treasury lock — relying on TTL expiry', err);
    }
  }

  // Called after a wallet address is (re-)registered so coupons issued while
  // the wallet was unrecognized get attached to the now-known user
  async linkOrphanedCoupons(userId: string, walletAddress: string): Promise<void> {
    await this.couponModel.updateMany(
      { payerAddress: walletAddress.toLowerCase(), userId: null },
      { $set: { userId } },
    );
  }

  async findUnredeemedByUser(cognitoSub: string): Promise<CouponListItemDto[]> {
    const docs = await this.findCouponDocsByUser(cognitoSub, false);
    return docs.map((d) => ({
      id: d._id.toString(),
      code: d.code,
      usdtAmountRaw: d.usdtAmountRaw,
      utlAmountRaw: d.utlAmountRaw,
      merchantAddress: d.merchantAddress ?? null,
      createdAt: d.createdAt as Date,
    }));
  }

  async findRedeemedByUser(cognitoSub: string): Promise<ClaimedCouponListItemDto[]> {
    const docs = await this.findCouponDocsByUser(cognitoSub, true);
    // redeemed: true guarantees redeemedAt and redemptionTxHash are non-null
    return docs.map((d) => ({
      id: d._id.toString(),
      usdtAmountRaw: d.usdtAmountRaw,
      utlAmountRaw: d.utlAmountRaw,
      merchantAddress: d.merchantAddress ?? null,
      redeemedAt: d.redeemedAt as Date,
      redemptionTxHash: d.redemptionTxHash as string,
      createdAt: d.createdAt as Date,
    }));
  }

  // Pure read — coupon→user linking happens exclusively at write time: when a coupon is
  // issued (transfer.processor looks up the user by payer address) and when a wallet
  // address is registered (PUT /wallets/address calls linkOrphanedCoupons). Listing
  // endpoints must never mutate state, so GETs stay cacheable and safely retriable.
  private async findCouponDocsByUser(cognitoSub: string, redeemed: boolean) {
    const user = await this.usersService.findByCognitoSub(cognitoSub);
    if (!user) return [];
    return this.couponModel
      .find({ userId: user.id, redeemed })
      .sort(redeemed ? { redeemedAt: -1 } : { createdAt: -1 })
      .select([
        'code',
        'usdtAmountRaw',
        'utlAmountRaw',
        'merchantAddress',
        'redeemedAt',
        'redemptionTxHash',
        'createdAt',
      ])
      .lean();
  }
}
