import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EncryptedBackup, EncryptedBackupDocument } from './entities/encrypted-backup.entity';
import { UsersService, FindOrCreateParams } from '../users/users.service';
import type { UserDocument } from '../users/entities/user.entity';
import { CouponsService } from '../coupons/coupons.service';

@Injectable()
export class WalletsService {
  constructor(
    @InjectModel(EncryptedBackup.name)
    private readonly backupModel: Model<EncryptedBackupDocument>,
    private readonly usersService: UsersService,
    private readonly couponsService: CouponsService,
  ) {}

  async upsertBackup(userId: string, ciphertext: string): Promise<EncryptedBackupDocument> {
    return this.backupModel.findOneAndUpdate(
      { userId },
      { ciphertext },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  async hasBackupForUser(userId: string): Promise<boolean> {
    return this.backupModel.exists({ userId }).then(Boolean);
  }

  // If linkOrphanedCoupons throws, the address has already been updated — retrying
  // this call is safe (updateWalletAddress is idempotent, and linking only matches
  // coupons still unlinked), so no rollback is attempted here.
  async registerAddress(
    userParams: FindOrCreateParams,
    walletAddress: string,
  ): Promise<UserDocument> {
    const user = await this.usersService.findOrCreate(userParams);
    const updated = await this.usersService.updateWalletAddress(user.id, walletAddress);
    await this.couponsService.linkOrphanedCoupons(user.id, walletAddress);
    return updated;
  }
}
