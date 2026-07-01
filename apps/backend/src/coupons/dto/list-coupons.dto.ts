export class CouponListItemDto {
  id!: string;
  code!: string;
  usdtAmountRaw!: string;
  utlAmountRaw!: string;
  createdAt!: Date;
}

export class ClaimedCouponListItemDto {
  id!: string;
  usdtAmountRaw!: string;
  utlAmountRaw!: string;
  redeemedAt!: Date;
  redemptionTxHash!: string;
  createdAt!: Date;
}
