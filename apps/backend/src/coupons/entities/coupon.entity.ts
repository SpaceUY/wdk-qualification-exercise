import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from '../../users/entities/user.entity';

@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ length: 64 })
  code!: string;

  // Prevents issuing more than one coupon per blockchain transaction
  @Index({ unique: true })
  @Column({ length: 66 })
  txHash!: string;

  // Raw USDT transfer amount (6 decimals) — stored as string to preserve BigInt precision
  @Column({ type: 'numeric', precision: 36, scale: 0 })
  usdtAmountRaw!: string;

  // Cashback amount in UTL (18 decimals) = 5% of usdtAmountRaw × 10^12 decimal adjustment
  @Column({ type: 'numeric', precision: 36, scale: 0 })
  utlAmountRaw!: string;

  @Column({ length: 42 })
  merchantAddress!: string;

  @Column({ type: 'int' })
  blockNumber!: number;

  @ManyToOne('User', (u: User) => u.coupons, { onDelete: 'SET NULL', nullable: true })
  user!: User | null;

  @RelationId((coupon: Coupon) => coupon.user)
  userId!: string | null;

  @Column({ default: false })
  redeemed!: boolean;

  @Column({ type: 'varchar', nullable: true, length: 66 })
  redemptionTxHash!: string | null;

  @Column({ nullable: true, type: 'timestamptz' })
  redeemedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
