import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { ObjectLiteral, Repository } from 'typeorm';
import { WalletsService } from './wallets.service';
import { EncryptedBackup } from './entities/encrypted-backup.entity';

type MockRepo<T extends ObjectLiteral> = Partial<Record<keyof Repository<T>, jest.Mock>>;

function createMockRepo<T extends ObjectLiteral>(): MockRepo<T> {
  return {
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
}

describe('WalletsService', () => {
  let service: WalletsService;
  let repo: MockRepo<EncryptedBackup>;

  beforeEach(async () => {
    repo = createMockRepo<EncryptedBackup>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        { provide: getRepositoryToken(EncryptedBackup), useValue: repo },
      ],
    }).compile();

    service = module.get(WalletsService);
  });

  describe('upsertBackup', () => {
    it('creates a new backup when none exists', async () => {
      const backup: Partial<EncryptedBackup> = {
        id: 'bk-1',
        userId: 'user-1',
        ciphertext: 'cipher',
      };
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      (repo.create as jest.Mock).mockReturnValue(backup);
      (repo.save as jest.Mock).mockResolvedValue(backup);

      const result = await service.upsertBackup('user-1', 'cipher');

      expect(repo.create).toHaveBeenCalledWith({ userId: 'user-1', ciphertext: 'cipher' });
      expect(repo.save).toHaveBeenCalledWith(backup);
      expect(result).toBe(backup);
    });

    it('updates ciphertext when backup already exists', async () => {
      const existing: Partial<EncryptedBackup> = { id: 'bk-1', userId: 'user-1', ciphertext: 'old' };
      const refreshed: Partial<EncryptedBackup> = { ...existing, ciphertext: 'new-cipher' };
      (repo.findOne as jest.Mock).mockResolvedValue(existing);
      (repo.update as jest.Mock).mockResolvedValue(undefined);
      (repo.findOneOrFail as jest.Mock).mockResolvedValue(refreshed);

      const result = await service.upsertBackup('user-1', 'new-cipher');

      expect(repo.update).toHaveBeenCalledWith('bk-1', { ciphertext: 'new-cipher' });
      expect(repo.create).not.toHaveBeenCalled();
      expect(result).toBe(refreshed);
    });
  });
});
