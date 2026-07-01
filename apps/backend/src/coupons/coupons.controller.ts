import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { CouponsService } from './coupons.service';
import { ClaimCouponDto } from './dto/claim-coupon.dto';
import type { CouponListItemDto, ClaimedCouponListItemDto } from './dto/list-coupons.dto';

@Controller('coupons')
@UseGuards(JwtAuthGuard)
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  async list(
    @CurrentUser() authUser: AuthenticatedUser,
  ): Promise<CouponListItemDto[]> {
    return this.couponsService.findUnredeemedByUser(authUser.sub);
  }

  @Get('claimed')
  async listClaimed(
    @CurrentUser() authUser: AuthenticatedUser,
  ): Promise<ClaimedCouponListItemDto[]> {
    return this.couponsService.findRedeemedByUser(authUser.sub);
  }

  @Post('claim')
  async claim(
    @CurrentUser() authUser: AuthenticatedUser,
    @Body() dto: ClaimCouponDto,
  ): Promise<{ redemptionTxHash: string }> {
    return this.couponsService.claimCoupon(dto.code, authUser.sub);
  }
}
