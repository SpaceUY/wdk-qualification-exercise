import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EncryptedBackup } from './entities/encrypted-backup.entity';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(EncryptedBackup)
    private readonly backupRepo: Repository<EncryptedBackup>,
  ) {}

  async upsertBackup(userId: string, ciphertext: string): Promise<EncryptedBackup> {
    const existing = await this.backupRepo.findOne({ where: { userId } });
    if (existing) {
      await this.backupRepo.update(existing.id, { ciphertext });
      return this.backupRepo.findOneOrFail({ where: { id: existing.id } });
    }
    const backup = this.backupRepo.create({ userId, ciphertext });
    return this.backupRepo.save(backup);
  }
}
