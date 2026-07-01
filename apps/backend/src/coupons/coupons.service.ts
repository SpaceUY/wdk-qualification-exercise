import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';
import { Coupon } from './entities/coupon.entity';
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
    @InjectRepository(Coupon)
    private readonly couponRepo: Repository<Coupon>,
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

    const coupon = await this.couponRepo.findOne({ where: { code: couponCode } });
    if (!coupon) throw new BadRequestException('Invalid coupon code');
    if (coupon.redeemed) throw new BadRequestException('Coupon already redeemed');
    if (coupon.userId !== user.id) throw new ForbiddenException('Coupon does not belong to this user');

    // Optimistic lock: mark redeemed before sending to prevent concurrent double-redemption
    await this.couponRepo.update(coupon.id, {
      redeemed: true,
      redeemedAt: new Date(),
    });

    try {
      const tx = await (this.utlContract['transfer'] as (
        to: string,
        amount: bigint,
      ) => Promise<ethers.TransactionResponse>)(user.walletAddress, BigInt(coupon.utlAmountRaw));

      const receipt = await tx.wait(1);
      if (!receipt) throw new Error('Transaction receipt is null');

      await this.couponRepo.update(coupon.id, { redemptionTxHash: receipt.hash });

      this.logger.log(
        `UTL transferred: ${receipt.hash} — ${coupon.utlAmountRaw} raw UTL to ${user.walletAddress}`,
      );

      return { redemptionTxHash: receipt.hash };
    } catch (err) {
      // Roll back so the user can retry after fixing the underlying issue
      await this.couponRepo.update(coupon.id, { redeemed: false, redeemedAt: null });
      this.logger.error(`UTL transfer failed for coupon ${couponCode}`, err);
      throw new BadRequestException('UTL transfer failed — please retry');
    }
  }

  async findUnredeemedByUser(cognitoSub: string): Promise<CouponListItemDto[]> {
    const user = await this.usersService.findByCognitoSub(cognitoSub);
    if (!user) return [];
    return this.couponRepo.find({
      where: { user: { id: user.id }, redeemed: false },
      order: { createdAt: 'DESC' },
      select: ['id', 'code', 'usdtAmountRaw', 'utlAmountRaw', 'createdAt'],
    });
  }

  async findRedeemedByUser(cognitoSub: string): Promise<ClaimedCouponListItemDto[]> {
    const user = await this.usersService.findByCognitoSub(cognitoSub);
    if (!user) return [];
    const rows = await this.couponRepo.find({
      where: { user: { id: user.id }, redeemed: true },
      order: { redeemedAt: 'DESC' },
      select: ['id', 'usdtAmountRaw', 'utlAmountRaw', 'redeemedAt', 'redemptionTxHash', 'createdAt'],
    });
    // redeemed: true guarantees redeemedAt and redemptionTxHash are non-null
    return rows as unknown as ClaimedCouponListItemDto[];
  }
}
