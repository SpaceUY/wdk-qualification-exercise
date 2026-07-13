import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { UsersService } from '../users/users.service';
import { CouponsService } from '../coupons/coupons.service';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import type { User } from '../users/entities/user.entity';
import type { EncryptedBackup } from './entities/encrypted-backup.entity';
import { BackupWalletDto } from './dto/backup-wallet.dto';

describe('WalletsController', () => {
  let controller: WalletsController;
  let walletsService: jest.Mocked<WalletsService>;
  let usersService: jest.Mocked<UsersService>;
  let couponsService: jest.Mocked<CouponsService>;

  const authUser: AuthenticatedUser = { sub: 'cognito-sub', email: 'test@example.com' };
  const mockUser: Partial<User> = { id: 'user-id', walletAddress: null };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletsController],
      providers: [
        {
          provide: WalletsService,
          useValue: { upsertBackup: jest.fn(), hasBackupForUser: jest.fn() },
        },
        {
          provide: UsersService,
          useValue: {
            findOrCreate: jest.fn(),
            findByCognitoSub: jest.fn(),
            updateWalletAddress: jest.fn(),
          },
        },
        {
          provide: CouponsService,
          useValue: { linkOrphanedCoupons: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(WalletsController);
    walletsService = module.get(WalletsService);
    usersService = module.get(UsersService);
    couponsService = module.get(CouponsService);
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

  describe('backupExists', () => {
    it('returns exists: false without querying backups when the user does not exist yet', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(null);

      const result = await controller.backupExists(authUser);

      expect(usersService.findByCognitoSub).toHaveBeenCalledWith('cognito-sub');
      expect(walletsService.hasBackupForUser).not.toHaveBeenCalled();
      expect(result).toEqual({ exists: false });
    });

    it('returns exists: true when the user has a backup', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as User);
      (walletsService.hasBackupForUser as jest.Mock).mockResolvedValue(true);

      const result = await controller.backupExists(authUser);

      expect(walletsService.hasBackupForUser).toHaveBeenCalledWith('user-id');
      expect(result).toEqual({ exists: true });
    });

    it('returns exists: false when the user has no backup', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as User);
      (walletsService.hasBackupForUser as jest.Mock).mockResolvedValue(false);

      const result = await controller.backupExists(authUser);

      expect(result).toEqual({ exists: false });
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

    it('links any coupons orphaned under this address after registering it', async () => {
      (usersService.findOrCreate as jest.Mock).mockResolvedValue(mockUser as User);
      const updated: Partial<User> = { walletAddress: '0xabc' };
      (usersService.updateWalletAddress as jest.Mock).mockResolvedValue(updated as User);

      await controller.updateAddress(authUser, { walletAddress: '0xabc' });

      expect(couponsService.linkOrphanedCoupons).toHaveBeenCalledWith('user-id', '0xabc');
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

  function validWdkCiphertext(byteLength = 61): string {
    const blob = Buffer.alloc(byteLength, 0);
    blob[0] = 0x01;
    return blob.toString('base64');
  }

  it('accepts a well-formed ciphertext blob', async () => {
    await expect(validate({ ciphertext: validWdkCiphertext() })).resolves.toBeDefined();
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

  it('accepts a well-formed ciphertext blob at exactly 65532 base64 characters (valid length)', async () => {
    // 49149 bytes -> exactly 65532 base64 chars (49149 / 3 * 4, no padding needed)
    await expect(validate({ ciphertext: validWdkCiphertext(49149) })).resolves.toBeDefined();
  });

  it('rejects a missing ciphertext field', async () => {
    await expect(validate({})).rejects.toThrow(BadRequestException);
  });
});
