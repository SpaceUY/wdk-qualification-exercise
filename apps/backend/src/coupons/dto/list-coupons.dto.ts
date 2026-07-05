import { ApiProperty } from '@nestjs/swagger';

export class CouponListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty({ description: 'Raw USDT amount (6 decimals)' }) usdtAmountRaw!: string;
  @ApiProperty({ description: 'Raw UTL cashback amount (18 decimals)' }) utlAmountRaw!: string;
  @ApiProperty() createdAt!: Date;
}

export class ClaimedCouponListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty({ description: 'Raw USDT amount (6 decimals)' }) usdtAmountRaw!: string;
  @ApiProperty({ description: 'Raw UTL cashback amount (18 decimals)' }) utlAmountRaw!: string;
  @ApiProperty() redeemedAt!: Date;
  @ApiProperty() redemptionTxHash!: string;
  @ApiProperty() createdAt!: Date;
}
