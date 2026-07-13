import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { WalletsService } from './wallets.service';
import { EncryptedBackup } from './entities/encrypted-backup.entity';

type MockModel = {
  findOneAndUpdate: jest.Mock;
  exists: jest.Mock;
};

function createMockModel(): MockModel {
  return { findOneAndUpdate: jest.fn(), exists: jest.fn() };
}

describe('WalletsService', () => {
  let service: WalletsService;
  let backupModel: MockModel;

  beforeEach(async () => {
    backupModel = createMockModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        { provide: getModelToken(EncryptedBackup.name), useValue: backupModel },
      ],
    }).compile();

    service = module.get(WalletsService);
  });

  describe('upsertBackup', () => {
    it('creates a new backup when none exists', async () => {
      const backup: Partial<EncryptedBackup> = { id: 'bk-1', userId: 'user-1', ciphertext: 'cipher' };
      backupModel.findOneAndUpdate.mockResolvedValue(backup);

      const result = await service.upsertBackup('user-1', 'cipher');

      expect(backupModel.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'user-1' },
        { ciphertext: 'cipher' },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      expect(result).toBe(backup);
    });

    it('updates ciphertext when backup already exists', async () => {
      const refreshed: Partial<EncryptedBackup> = { id: 'bk-1', userId: 'user-1', ciphertext: 'new-cipher' };
      backupModel.findOneAndUpdate.mockResolvedValue(refreshed);

      const result = await service.upsertBackup('user-1', 'new-cipher');

      expect(backupModel.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'user-1' },
        { ciphertext: 'new-cipher' },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      expect(result).toBe(refreshed);
    });
  });

  describe('hasBackupForUser', () => {
    it('returns true when a backup exists for the user', async () => {
      backupModel.exists.mockResolvedValue({ _id: 'bk-1' });

      await expect(service.hasBackupForUser('user-1')).resolves.toBe(true);

      expect(backupModel.exists).toHaveBeenCalledWith({ userId: 'user-1' });
    });

    it('returns false when no backup exists for the user', async () => {
      backupModel.exists.mockResolvedValue(null);

      await expect(service.hasBackupForUser('user-1')).resolves.toBe(false);
    });
  });
});
