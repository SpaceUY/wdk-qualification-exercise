import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { UsersService } from '../users/users.service';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import type { User } from '../users/entities/user.entity';
import type { EncryptedBackup } from './entities/encrypted-backup.entity';
import { BackupWalletDto } from './dto/backup-wallet.dto';

describe('WalletsController', () => {
  let controller: WalletsController;
  let walletsService: jest.Mocked<WalletsService>;
  let usersService: jest.Mocked<UsersService>;

  const authUser: AuthenticatedUser = { sub: 'cognito-sub', email: 'test@example.com' };
  const mockUser: Partial<User> = { id: 'user-id', walletAddress: null };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletsController],
      providers: [
        {
          provide: WalletsService,
          useValue: { upsertBackup: jest.fn() },
        },
        {
          provide: UsersService,
          useValue: { findOrCreate: jest.fn(), updateWalletAddress: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(WalletsController);
    walletsService = module.get(WalletsService);
    usersService = module.get(UsersService);
  });

  describe('backup', () => {
    it('finds or creates user then upserts backup', async () => {
      (usersService.findOrCreate as jest.Mock).mockResolvedValue(mockUser as User);
      const backup: Partial<EncryptedBackup> = { id: 'bk-1' };
      (walletsService.upsertBackup as jest.Mock).mockResolvedValue(backup as EncryptedBackup);

      const result = await controller.backup(authUser, { ciphertext: 'abc123' });

      expect(usersService.findOrCreate).toHaveBeenCalledWith({
        cognitoSub: 'cognito-sub',
        email: 'test@example.com',
      });
      expect(walletsService.upsertBackup).toHaveBeenCalledWith('user-id', 'abc123');
      expect(result).toEqual({ id: 'bk-1' });
    });
  });

  describe('updateAddress', () => {
    it('registers wallet address for the authenticated user', async () => {
      (usersService.findOrCreate as jest.Mock).mockResolvedValue(mockUser as User);
      const updated: Partial<User> = { walletAddress: '0xabc' };
      (usersService.updateWalletAddress as jest.Mock).mockResolvedValue(updated as User);

      const result = await controller.updateAddress(authUser, {
        walletAddress: '0xabc',
      });

      expect(usersService.updateWalletAddress).toHaveBeenCalledWith('user-id', '0xabc');
      expect(result).toEqual({ walletAddress: '0xabc' });
    });
  });
});

describe('BackupWalletDto validation', () => {
  let pipe: ValidationPipe;

  beforeEach(() => {
    pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true });
  });

  async function validate(body: Record<string, unknown>): Promise<BackupWalletDto> {
    return pipe.transform(body, {
      type: 'body',
      metatype: BackupWalletDto,
    }) as Promise<BackupWalletDto>;
  }

  it('accepts a valid base64 string', async () => {
    await expect(validate({ ciphertext: 'SGVsbG8gV29ybGQ=' })).resolves.toBeDefined();
  });

  it('rejects an empty string', async () => {
    await expect(validate({ ciphertext: '' })).rejects.toThrow(BadRequestException);
  });

  it('rejects a non-base64 string (contains spaces and !)', async () => {
    await expect(validate({ ciphertext: 'not valid base 64!' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a string exceeding 65535 characters', async () => {
    // 'AAAA' repeated 16384 times = 65536 chars — one over the limit
    await expect(validate({ ciphertext: 'AAAA'.repeat(16384) })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('accepts a base64 string at exactly 65532 characters (valid length)', async () => {
    // 'AAAA' repeated 16383 times = 65532 chars — under the limit, valid base64
    await expect(validate({ ciphertext: 'AAAA'.repeat(16383) })).resolves.toBeDefined();
  });

  it('rejects a missing ciphertext field', async () => {
    await expect(validate({})).rejects.toThrow(BadRequestException);
  });
});
