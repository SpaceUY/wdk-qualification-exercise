import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ObjectLiteral, Repository } from 'typeorm';
import { CouponsService } from './coupons.service';
import { Coupon } from './entities/coupon.entity';
import { UsersService } from '../users/users.service';
import type { User } from '../users/entities/user.entity';

type MockRepo<T extends ObjectLiteral> = Partial<Record<keyof Repository<T>, jest.Mock>>;

function createMockRepo<T extends ObjectLiteral>(): MockRepo<T> {
  return {
    findOne: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
  };
}

// Services use `import { ethers } from 'ethers'` (named namespace), not default import
// The mock must export the `ethers` named property with the same shape
const mockTransferFn = jest.fn();
const mockWaitFn = jest.fn().mockResolvedValue({ hash: '0xreceipt' });
const mockTxFn = { wait: mockWaitFn };

jest.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: jest.fn(),
    Wallet: jest.fn(),
    Contract: jest.fn().mockImplementation(() => ({ transfer: mockTransferFn })),
  },
}));

describe('CouponsService', () => {
  let service: CouponsService;
  let couponRepo: MockRepo<Coupon>;
  let usersService: jest.Mocked<UsersService>;

  const mockUser: Partial<User> = {
    id: 'user-id',
    cognitoSub: 'cognito-sub',
    walletAddress: '0xuseraddress',
  };

  const mockCoupon: Partial<Coupon> = {
    id: 'coupon-id',
    code: 'abcdef1234567890abcdef1234567890',
    txHash: '0xtxhash',
    usdtAmountRaw: '1000000',
    utlAmountRaw: '50000000000000000',
    userId: 'user-id',
    redeemed: false,
  };

  beforeEach(async () => {
    couponRepo = createMockRepo<Coupon>();
    mockTransferFn.mockReset();
    mockWaitFn.mockReset();
    mockWaitFn.mockResolvedValue({ hash: '0xreceipt' });
    mockTransferFn.mockResolvedValue(mockTxFn);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponsService,
        { provide: getRepositoryToken(Coupon), useValue: couponRepo },
        {
          provide: UsersService,
          useValue: {
            findByCognitoSub: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('mock-value') },
        },
      ],
    }).compile();

    service = module.get(CouponsService);
    usersService = module.get(UsersService);

    service.onModuleInit();
  });

  describe('claimCoupon', () => {
    it('throws BadRequestException when user not found', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(null);

      await expect(service.claimCoupon('code', 'sub')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when user has no wallet address', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue({
        ...mockUser,
        walletAddress: null,
      } as User);

      await expect(service.claimCoupon('code', 'sub')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when coupon not found', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as User);
      (couponRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.claimCoupon('invalid-code', 'sub')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when coupon already redeemed', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as User);
      (couponRepo.findOne as jest.Mock).mockResolvedValue({ ...mockCoupon, redeemed: true });

      await expect(
        service.claimCoupon(mockCoupon.code as string, 'sub'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when coupon belongs to a different user', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as User);
      (couponRepo.findOne as jest.Mock).mockResolvedValue({
        ...mockCoupon,
        userId: 'other-user-id',
      });

      await expect(
        service.claimCoupon(mockCoupon.code as string, 'sub'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('marks coupon redeemed and returns redemptionTxHash on success', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as User);
      (couponRepo.findOne as jest.Mock).mockResolvedValue(mockCoupon as Coupon);
      (couponRepo.update as jest.Mock).mockResolvedValue(undefined);

      const result = await service.claimCoupon(mockCoupon.code as string, 'cognito-sub');

      expect(couponRepo.update).toHaveBeenCalledWith(
        'coupon-id',
        expect.objectContaining({ redeemed: true }),
      );
      expect(result).toEqual({ redemptionTxHash: '0xreceipt' });
    });

    it('rolls back redeemed flag when UTL transfer fails', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as User);
      (couponRepo.findOne as jest.Mock).mockResolvedValue(mockCoupon as Coupon);
      (couponRepo.update as jest.Mock).mockResolvedValue(undefined);
      mockTransferFn.mockRejectedValueOnce(new Error('RPC error'));

      await expect(
        service.claimCoupon(mockCoupon.code as string, 'cognito-sub'),
      ).rejects.toThrow(BadRequestException);

      const calls = (couponRepo.update as jest.Mock).mock.calls as [string, Partial<Coupon>][];
      const lastCall = calls[calls.length - 1];
      expect(lastCall?.[1]).toEqual(expect.objectContaining({ redeemed: false }));
    });
  });

  describe('findRedeemedByUser', () => {
    it('returns redeemed coupon DTOs for the user', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as User);
      const rows: Partial<Coupon>[] = [
        {
          id: 'c2',
          usdtAmountRaw: '2000000',
          utlAmountRaw: '100000000000000000',
          redeemedAt: new Date('2024-01-02T00:00:00.000Z'),
          redemptionTxHash: '0xdeadbeef',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
        },
      ];
      (couponRepo.find as jest.Mock).mockResolvedValue(rows);

      const result = await service.findRedeemedByUser('cognito-sub');

      expect(usersService.findByCognitoSub).toHaveBeenCalledWith('cognito-sub');
      expect(couponRepo.find).toHaveBeenCalledWith({
        where: { user: { id: 'user-id' }, redeemed: true },
        order: { redeemedAt: 'DESC' },
        select: ['id', 'usdtAmountRaw', 'utlAmountRaw', 'redeemedAt', 'redemptionTxHash', 'createdAt'],
      });
      expect(result).toEqual(rows);
    });

    it('returns empty array when user not found', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(null);

      const result = await service.findRedeemedByUser('unknown-sub');

      expect(result).toEqual([]);
      expect(couponRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('findUnredeemedByUser', () => {
    it('returns unredeemed coupon DTOs for the user', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as User);
      const rows: Partial<Coupon>[] = [
        {
          id: 'c1',
          code: 'aabbcc1234567890aabbcc1234567890',
          usdtAmountRaw: '1000000',
          utlAmountRaw: '50000000000000000',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
        },
      ];
      (couponRepo.find as jest.Mock).mockResolvedValue(rows);

      const result = await service.findUnredeemedByUser('cognito-sub');

      expect(usersService.findByCognitoSub).toHaveBeenCalledWith('cognito-sub');
      expect(couponRepo.find).toHaveBeenCalledWith({
        where: { user: { id: 'user-id' }, redeemed: false },
        order: { createdAt: 'DESC' },
        select: ['id', 'code', 'usdtAmountRaw', 'utlAmountRaw', 'createdAt'],
      });
      expect(result).toEqual(rows);
    });

    it('returns empty array when user not found', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(null);

      const result = await service.findUnredeemedByUser('unknown-sub');

      expect(result).toEqual([]);
      expect(couponRepo.find).not.toHaveBeenCalled();
    });
  });
});
