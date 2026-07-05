import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ethers } from 'ethers';
import { Coupon, CouponDocument } from './entities/coupon.entity';
import { UsersService } from '../users/users.service';
import type { CouponListItemDto, ClaimedCouponListItemDto } from './dto/list-coupons.dto';

const ERC20_TRANSFER_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
] as const;

@Injectable()
export class CouponsService implements OnModuleInit {
  private readonly logger = new Logger(CouponsService.name);
  private provider!: ethers.JsonRpcProvider;
  private treasuryWallet!: ethers.Wallet;
  private utlContract!: ethers.Contract;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Coupon.name)
    private readonly couponModel: Model<CouponDocument>,
    private readonly usersService: UsersService,
  ) {}

  onModuleInit(): void {
    const rpcUrl = this.configService.getOrThrow<string>('blockchain.rpcUrl');
    const privateKey = this.configService.getOrThrow<string>('blockchain.treasuryPrivateKey');
    const utlAddress = this.configService.getOrThrow<string>('blockchain.utlAddress');

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.treasuryWallet = new ethers.Wallet(privateKey, this.provider);
    this.utlContract = new ethers.Contract(utlAddress, ERC20_TRANSFER_ABI, this.treasuryWallet);
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

    // Build and sign the transfer ourselves (instead of the one-shot contract.transfer()
    // convenience call) so we know the transaction's hash BEFORE it's broadcast. That
    // hash is what lets us later ask the chain "did this exact transaction land?"
    // instead of guessing from an ambiguous broadcast failure — see the catch block below.
    let signedTx: string;
    let txHash: string;
    try {
      const utlAddress = await this.utlContract.getAddress();
      const data = this.utlContract.interface.encodeFunctionData('transfer', [
        user.walletAddress,
        BigInt(coupon.utlAmountRaw),
      ]);
      const populated = await this.treasuryWallet.populateTransaction({ to: utlAddress, data });
      signedTx = await this.treasuryWallet.signTransaction(populated);
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

    let tx: ethers.TransactionResponse;
    try {
      tx = await this.provider.broadcastTransaction(signedTx);
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

    try {
      const receipt = await tx.wait(1);
      if (!receipt) throw new Error('Transaction receipt is null');

      this.logger.log(
        `UTL transferred: ${receipt.hash} — ${coupon.utlAmountRaw} raw UTL to ${user.walletAddress}`,
      );

      return { redemptionTxHash: receipt.hash };
    } catch (err) {
      this.logger.error(
        `UTL transfer broadcast (tx ${tx.hash}) but confirmation failed for coupon ${couponCode} — verify on-chain before retrying`,
        err,
      );
      throw new BadRequestException(
        'UTL transfer submitted but confirmation failed — check transaction status before retrying',
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
        const found = await this.provider.getTransaction(txHash);
        lastCallSucceeded = true;
        if (found) return true;
      } catch {
        lastCallSucceeded = false;
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

  // Called after a wallet address is (re-)registered so coupons issued while
  // the wallet was unrecognized get attached to the now-known user
  async linkOrphanedCoupons(userId: string, walletAddress: string): Promise<void> {
    await this.couponModel.updateMany(
      { payerAddress: walletAddress.toLowerCase(), userId: null },
      { $set: { userId } },
    );
  }

  async findUnredeemedByUser(cognitoSub: string): Promise<CouponListItemDto[]> {
    const user = await this.usersService.findByCognitoSub(cognitoSub);
    if (!user) return [];
    if (user.walletAddress) {
      await this.linkOrphanedCoupons(user.id, user.walletAddress);
    }
    const docs = await this.couponModel
      .find({ userId: user.id, redeemed: false })
      .sort({ createdAt: -1 })
      .select(['code', 'usdtAmountRaw', 'utlAmountRaw', 'createdAt'])
      .lean();
    return docs.map((d) => ({
      id: d._id.toString(),
      code: d.code,
      usdtAmountRaw: d.usdtAmountRaw,
      utlAmountRaw: d.utlAmountRaw,
      createdAt: d.createdAt as Date,
    }));
  }

  async findRedeemedByUser(cognitoSub: string): Promise<ClaimedCouponListItemDto[]> {
    const user = await this.usersService.findByCognitoSub(cognitoSub);
    if (!user) return [];
    if (user.walletAddress) {
      await this.linkOrphanedCoupons(user.id, user.walletAddress);
    }
    const docs = await this.couponModel
      .find({ userId: user.id, redeemed: true })
      .sort({ redeemedAt: -1 })
      .select(['usdtAmountRaw', 'utlAmountRaw', 'redeemedAt', 'redemptionTxHash', 'createdAt'])
      .lean();
    // redeemed: true guarantees redeemedAt and redemptionTxHash are non-null
    return docs.map((d) => ({
      id: d._id.toString(),
      usdtAmountRaw: d.usdtAmountRaw,
      utlAmountRaw: d.utlAmountRaw,
      redeemedAt: d.redeemedAt as Date,
      redemptionTxHash: d.redemptionTxHash as string,
      createdAt: d.createdAt as Date,
    }));
  }
}
