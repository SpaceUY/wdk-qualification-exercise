import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { EncryptedBackup } from '../../wallets/entities/encrypted-backup.entity';
import type { Coupon } from '../../coupons/entities/coupon.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  cognitoSub!: string;

  // email doubles as the WDK walletId — matches the RN app's useAuthStore.userId
  @Column({ unique: true })
  email!: string;

  @Column({ type: 'varchar', nullable: true, unique: true })
  walletAddress!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date | null;

  @OneToOne('EncryptedBackup', (b: EncryptedBackup) => b.user)
  encryptedBackup!: EncryptedBackup | null;

  @OneToMany('Coupon', (c: Coupon) => c.user)
  coupons!: Coupon[];
}
