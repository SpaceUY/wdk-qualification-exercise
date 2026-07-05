import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'coupons', timestamps: true })
export class Coupon {
  // Not a @Prop — Mongoose's default `id` virtual (string form of `_id`), declared
  // here only so TypeScript recognizes it on hydrated documents.
  id!: string;

  @Prop({ type: String, required: true, unique: true, maxlength: 64 })
  code!: string;

  // Prevents issuing more than one coupon per blockchain transaction — this unique index
  // is the real idempotency backstop for coupon issuance (see transfer.processor.ts)
  @Prop({ type: String, required: true, unique: true, maxlength: 66 })
  txHash!: string;

  // Raw USDT transfer amount (6 decimals) — stored as string to preserve BigInt precision.
  // Never Number/Decimal128: these can need up to 36 significant digits.
  @Prop({ type: String, required: true })
  usdtAmountRaw!: string;

  // Cashback amount in UTL (18 decimals) = 5% of usdtAmountRaw × 10^12 decimal adjustment
  @Prop({ type: String, required: true })
  utlAmountRaw!: string;

  @Prop({ type: String, required: true, maxlength: 42 })
  merchantAddress!: string;

  // Sender's EVM address at payment time — lets a later `PUT /wallets/address`
  // retroactively link a coupon that was orphaned because the wallet wasn't
  // registered yet when the payment was indexed
  @Prop({ type: String, default: null, maxlength: 42 })
  payerAddress!: string | null;

  @Prop({ type: Number, required: true })
  blockNumber!: number;

  // Plain denormalized reference (no populate/ref) — mirrors the app's previous
  // @RelationId shadow-column behavior, since the relation was never eagerly loaded.
  @Prop({ type: String, default: null })
  userId!: string | null;

  @Prop({ type: Boolean, default: false })
  redeemed!: boolean;

  @Prop({ type: String, default: null, maxlength: 66 })
  redemptionTxHash!: string | null;

  @Prop({ type: Date, default: null })
  redeemedAt!: Date | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export type CouponDocument = HydratedDocument<Coupon>;
export const CouponSchema = SchemaFactory.createForClass(Coupon);

CouponSchema.index({ payerAddress: 1 });
// Matches the exact query shape used by findUnredeemedByUser/findRedeemedByUser
CouponSchema.index({ userId: 1, redeemed: 1 });
