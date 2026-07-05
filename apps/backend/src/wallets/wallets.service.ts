import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EncryptedBackup, EncryptedBackupDocument } from './entities/encrypted-backup.entity';

@Injectable()
export class WalletsService {
  constructor(
    @InjectModel(EncryptedBackup.name)
    private readonly backupModel: Model<EncryptedBackupDocument>,
  ) {}

  async upsertBackup(userId: string, ciphertext: string): Promise<EncryptedBackupDocument> {
    return this.backupModel.findOneAndUpdate(
      { userId },
      { ciphertext },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
}
