import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { CouponsService } from './coupons.service';
import { ClaimCouponDto } from './dto/claim-coupon.dto';
import { CouponListItemDto, ClaimedCouponListItemDto } from './dto/list-coupons.dto';

@ApiTags('coupons')
@ApiBearerAuth('access-token')
@Controller('coupons')
@UseGuards(JwtAuthGuard)
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  @ApiOperation({ summary: 'List the authenticated user\'s unredeemed cashback coupons' })
  @ApiOkResponse({ type: [CouponListItemDto] })
  async list(
    @CurrentUser() authUser: AuthenticatedUser,
  ): Promise<CouponListItemDto[]> {
    return this.couponsService.findUnredeemedByUser(authUser.sub);
  }

  @Get('claimed')
  @ApiOperation({ summary: 'List the authenticated user\'s already-claimed cashback coupons' })
  @ApiOkResponse({ type: [ClaimedCouponListItemDto] })
  async listClaimed(
    @CurrentUser() authUser: AuthenticatedUser,
  ): Promise<ClaimedCouponListItemDto[]> {
    return this.couponsService.findRedeemedByUser(authUser.sub);
  }

  @Post('claim')
  @ApiOperation({ summary: 'Claim a coupon — sends the UTL cashback to the user\'s wallet' })
  @ApiOkResponse({ description: 'UTL transferred', type: Object })
  async claim(
    @CurrentUser() authUser: AuthenticatedUser,
    @Body() dto: ClaimCouponDto,
  ): Promise<{ redemptionTxHash: string }> {
    return this.couponsService.claimCoupon(dto.code, authUser.sub);
  }
}
