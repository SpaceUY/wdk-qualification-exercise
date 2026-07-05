import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CouponsService } from './coupons.service';
import { Coupon } from './entities/coupon.entity';
import { UsersService } from '../users/users.service';
import type { UserDocument } from '../users/entities/user.entity';

type MockModel = {
  findOne: jest.Mock;
  findOneAndUpdate: jest.Mock;
  updateOne: jest.Mock;
  updateMany: jest.Mock;
  find: jest.Mock;
};

function createMockModel(): MockModel {
  return {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
    updateMany: jest.fn(),
    find: jest.fn(),
  };
}

function createChainableFind<T>(result: T) {
  return {
    sort: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
  };
}

const mockTransferFn = jest.fn();
const mockWaitFn = jest.fn().mockResolvedValue({ hash: '0xreceipt' });
const mockTxFn = { hash: '0xbroadcast', wait: mockWaitFn };
const mockEncodeFunctionDataFn = jest.fn().mockReturnValue('0xencodeddata');
const mockGetAddressFn = jest.fn().mockResolvedValue('0xutladdress');
const mockPopulateTransactionFn = jest.fn();
const mockSignTransactionFn = jest.fn();
const mockBroadcastTransactionFn = jest.fn();
const mockGetTransactionFn = jest.fn();
const mockTransactionFromFn = jest.fn();

// Services use `import { ethers } from 'ethers'` (named namespace), not default import
// The mock must export the `ethers` named property with the same shape
jest.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      broadcastTransaction: mockBroadcastTransactionFn,
      getTransaction: mockGetTransactionFn,
    })),
    Wallet: jest.fn().mockImplementation(() => ({
      populateTransaction: mockPopulateTransactionFn,
      signTransaction: mockSignTransactionFn,
    })),
    Contract: jest.fn().mockImplementation(() => ({
      transfer: mockTransferFn,
      getAddress: mockGetAddressFn,
      interface: { encodeFunctionData: mockEncodeFunctionDataFn },
    })),
    Transaction: {
      // Wrapped (rather than referenced directly) because jest hoists this
      // `jest.mock` factory above the `const mockTransactionFromFn` declaration
      // below — a direct reference would throw "Cannot access before
      // initialization" the first time this module is required.
      from: (...args: unknown[]) => mockTransactionFromFn(...(args as [string])),
    },
  },
}));

describe('CouponsService', () => {
  let service: CouponsService;
  let couponModel: MockModel;
  let usersService: jest.Mocked<UsersService>;

  const mockUser: Partial<UserDocument> = {
    id: 'user-id',
    cognitoSub: 'cognito-sub',
    walletAddress: '0xuseraddress',
  };

  const mockCoupon: Partial<Coupon> & { _id: string } = {
    _id: 'coupon-id',
    id: 'coupon-id',
    code: 'abcdef1234567890abcdef1234567890',
    txHash: '0xtxhash',
    usdtAmountRaw: '1000000',
    utlAmountRaw: '50000000000000000',
    userId: 'user-id',
    redeemed: false,
  };

  beforeEach(async () => {
    couponModel = createMockModel();
    mockTransferFn.mockReset();
    mockWaitFn.mockReset();
    mockWaitFn.mockResolvedValue({ hash: '0xreceipt' });
    mockEncodeFunctionDataFn.mockReset().mockReturnValue('0xencodeddata');
    mockGetAddressFn.mockReset().mockResolvedValue('0xutladdress');
    mockPopulateTransactionFn.mockReset().mockResolvedValue({ to: '0xutladdress', data: '0xencodeddata' });
    mockSignTransactionFn.mockReset().mockResolvedValue('0xsignedtx');
    mockTransactionFromFn.mockReset().mockReturnValue({ hash: '0xbroadcast' });
    mockBroadcastTransactionFn.mockReset().mockResolvedValue(mockTxFn);
    mockGetTransactionFn.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponsService,
        { provide: getModelToken(Coupon.name), useValue: couponModel },
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
    jest.spyOn(service as unknown as { delay: (ms: number) => Promise<void> }, 'delay').mockResolvedValue(undefined);
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
      } as UserDocument);

      await expect(service.claimCoupon('code', 'sub')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when coupon not found', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as UserDocument);
      couponModel.findOne.mockResolvedValue(null);

      await expect(service.claimCoupon('invalid-code', 'sub')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when coupon already redeemed', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as UserDocument);
      couponModel.findOne.mockResolvedValue({ ...mockCoupon, redeemed: true });

      await expect(
        service.claimCoupon(mockCoupon.code as string, 'sub'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when coupon belongs to a different user', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as UserDocument);
      couponModel.findOne.mockResolvedValue({
        ...mockCoupon,
        userId: 'other-user-id',
      });

      await expect(
        service.claimCoupon(mockCoupon.code as string, 'sub'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when a concurrent request already claimed the coupon (lost the atomic race)', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as UserDocument);
      couponModel.findOne.mockResolvedValue(mockCoupon);
      // Simulates another request winning the compare-and-swap first: the atomic
      // findOneAndUpdate matches nothing because `redeemed` is no longer `false`.
      couponModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        service.claimCoupon(mockCoupon.code as string, 'cognito-sub'),
      ).rejects.toThrow(BadRequestException);

      expect(couponModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'coupon-id', redeemed: false },
        expect.objectContaining({ redeemed: true }),
      );
      // Critical: must never attempt the on-chain transfer if the lock wasn't won.
      expect(mockPopulateTransactionFn).not.toHaveBeenCalled();
    });

    it('marks coupon redeemed and returns redemptionTxHash on success', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as UserDocument);
      couponModel.findOne.mockResolvedValue(mockCoupon);
      couponModel.findOneAndUpdate.mockResolvedValue({ ...mockCoupon, redeemed: true });
      couponModel.updateOne.mockResolvedValue(undefined);

      const result = await service.claimCoupon(mockCoupon.code as string, 'cognito-sub');

      expect(mockEncodeFunctionDataFn).toHaveBeenCalledWith('transfer', [
        mockUser.walletAddress,
        BigInt(mockCoupon.utlAmountRaw as string),
      ]);
      expect(mockPopulateTransactionFn).toHaveBeenCalledWith({
        to: '0xutladdress',
        data: '0xencodeddata',
      });
      expect(mockSignTransactionFn).toHaveBeenCalledWith({ to: '0xutladdress', data: '0xencodeddata' });
      // The hash must be recorded immediately after signing — BEFORE broadcasting —
      // so it's a durable idempotency record even if the broadcast call itself fails.
      expect(couponModel.updateOne).toHaveBeenCalledWith(
        { _id: 'coupon-id' },
        { redemptionTxHash: '0xbroadcast' },
      );
      expect(mockBroadcastTransactionFn).toHaveBeenCalledWith('0xsignedtx');
      expect(result).toEqual({ redemptionTxHash: '0xreceipt' });
    });

    it('rolls back the lock when building or signing the transfer fails (nothing was ever sent)', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as UserDocument);
      couponModel.findOne.mockResolvedValue(mockCoupon);
      couponModel.findOneAndUpdate.mockResolvedValue({ ...mockCoupon, redeemed: true });
      couponModel.updateOne.mockResolvedValue(undefined);
      mockPopulateTransactionFn.mockRejectedValueOnce(new Error('RPC unreachable'));

      await expect(
        service.claimCoupon(mockCoupon.code as string, 'cognito-sub'),
      ).rejects.toThrow(BadRequestException);

      expect(couponModel.updateOne).toHaveBeenCalledWith(
        { _id: 'coupon-id' },
        { redeemed: false, redeemedAt: null },
      );
      // Must never reach the broadcast step, and must never record a hash for a
      // transaction that was never even signed.
      expect(mockBroadcastTransactionFn).not.toHaveBeenCalled();
      expect(couponModel.updateOne).not.toHaveBeenCalledWith(
        { _id: 'coupon-id' },
        expect.objectContaining({ redemptionTxHash: expect.anything() }),
      );
    });

    it('rolls back the lock when broadcast fails and the chain confirms the transaction was never sent', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as UserDocument);
      couponModel.findOne.mockResolvedValue(mockCoupon);
      couponModel.findOneAndUpdate.mockResolvedValue({ ...mockCoupon, redeemed: true });
      couponModel.updateOne.mockResolvedValue(undefined);
      mockBroadcastTransactionFn.mockRejectedValueOnce(new Error('connection reset'));
      mockGetTransactionFn.mockResolvedValue(null);

      await expect(
        service.claimCoupon(mockCoupon.code as string, 'cognito-sub'),
      ).rejects.toThrow('UTL transfer failed — please retry');

      expect(mockGetTransactionFn).toHaveBeenCalledWith('0xbroadcast');
      expect(couponModel.updateOne).toHaveBeenCalledWith(
        { _id: 'coupon-id' },
        { redeemed: false, redeemedAt: null, redemptionTxHash: null },
      );
    });

    it('does NOT roll back when broadcast fails but the chain shows the transaction landed anyway', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as UserDocument);
      couponModel.findOne.mockResolvedValue(mockCoupon);
      couponModel.findOneAndUpdate.mockResolvedValue({ ...mockCoupon, redeemed: true });
      couponModel.updateOne.mockResolvedValue(undefined);
      mockBroadcastTransactionFn.mockRejectedValueOnce(new Error('response timed out'));
      mockGetTransactionFn.mockResolvedValueOnce({ hash: '0xbroadcast' });

      await expect(
        service.claimCoupon(mockCoupon.code as string, 'cognito-sub'),
      ).rejects.toThrow('UTL transfer submitted but confirmation failed — check transaction status before retrying');

      const rollbackCalls = couponModel.updateOne.mock.calls.filter(
        (call) => (call[1] as Record<string, unknown>)['redeemed'] === false,
      );
      expect(rollbackCalls).toHaveLength(0);
    });

    it('does NOT roll back when broadcast fails and the chain cannot be reached to verify either way', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as UserDocument);
      couponModel.findOne.mockResolvedValue(mockCoupon);
      couponModel.findOneAndUpdate.mockResolvedValue({ ...mockCoupon, redeemed: true });
      couponModel.updateOne.mockResolvedValue(undefined);
      mockBroadcastTransactionFn.mockRejectedValueOnce(new Error('connection reset'));
      mockGetTransactionFn.mockRejectedValue(new Error('RPC still unreachable'));

      await expect(
        service.claimCoupon(mockCoupon.code as string, 'cognito-sub'),
      ).rejects.toThrow('UTL transfer status could not be confirmed — please contact support before retrying');

      expect(mockGetTransactionFn).toHaveBeenCalledTimes(3);
      const rollbackCalls = couponModel.updateOne.mock.calls.filter(
        (call) => (call[1] as Record<string, unknown>)['redeemed'] === false,
      );
      expect(rollbackCalls).toHaveLength(0);
    });

    it('does NOT roll back when confirmation fails after broadcast — funds may have already moved', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as UserDocument);
      couponModel.findOne.mockResolvedValue(mockCoupon);
      couponModel.findOneAndUpdate.mockResolvedValue({ ...mockCoupon, redeemed: true });
      couponModel.updateOne.mockResolvedValue(undefined);
      mockWaitFn.mockResolvedValueOnce(null);

      await expect(
        service.claimCoupon(mockCoupon.code as string, 'cognito-sub'),
      ).rejects.toThrow('UTL transfer submitted but confirmation failed — check transaction status before retrying');

      // The hash-recording write must have happened...
      expect(couponModel.updateOne).toHaveBeenCalledWith(
        { _id: 'coupon-id' },
        { redemptionTxHash: '0xbroadcast' },
      );
      // ...but `redeemed` must never be reset to false anywhere in this scenario.
      const rollbackCalls = couponModel.updateOne.mock.calls.filter(
        (call) => (call[1] as Record<string, unknown>)['redeemed'] === false,
      );
      expect(rollbackCalls).toHaveLength(0);
    });
  });

  describe('linkOrphanedCoupons', () => {
    it('links coupons matching the payer address that have no user yet', async () => {
      couponModel.updateMany.mockResolvedValue(undefined);

      await service.linkOrphanedCoupons('user-id', '0xABC');

      expect(couponModel.updateMany).toHaveBeenCalledWith(
        { payerAddress: '0xabc', userId: null },
        { $set: { userId: 'user-id' } },
      );
    });
  });

  describe('findRedeemedByUser', () => {
    it('returns redeemed coupon DTOs for the user', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as UserDocument);
      const rows = [
        {
          _id: 'c2',
          usdtAmountRaw: '2000000',
          utlAmountRaw: '100000000000000000',
          redeemedAt: new Date('2024-01-02T00:00:00.000Z'),
          redemptionTxHash: '0xdeadbeef',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
        },
      ];
      couponModel.updateMany.mockResolvedValue(undefined);
      const query = createChainableFind(rows);
      couponModel.find.mockReturnValue(query);

      const result = await service.findRedeemedByUser('cognito-sub');

      expect(usersService.findByCognitoSub).toHaveBeenCalledWith('cognito-sub');
      expect(couponModel.find).toHaveBeenCalledWith({ userId: 'user-id', redeemed: true });
      expect(query.sort).toHaveBeenCalledWith({ redeemedAt: -1 });
      expect(query.select).toHaveBeenCalledWith([
        'usdtAmountRaw',
        'utlAmountRaw',
        'redeemedAt',
        'redemptionTxHash',
        'createdAt',
      ]);
      expect(result).toEqual([
        {
          id: 'c2',
          usdtAmountRaw: '2000000',
          utlAmountRaw: '100000000000000000',
          redeemedAt: rows[0]?.redeemedAt,
          redemptionTxHash: '0xdeadbeef',
          createdAt: rows[0]?.createdAt,
        },
      ]);
    });

    it('returns empty array when user not found', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(null);

      const result = await service.findRedeemedByUser('unknown-sub');

      expect(result).toEqual([]);
      expect(couponModel.find).not.toHaveBeenCalled();
    });

    it('links any orphaned coupons for this wallet before listing, when the user has a wallet address', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as UserDocument);
      couponModel.updateMany.mockResolvedValue(undefined);
      const query = createChainableFind([]);
      couponModel.find.mockReturnValue(query);

      await service.findRedeemedByUser('cognito-sub');

      expect(couponModel.updateMany).toHaveBeenCalledWith(
        { payerAddress: (mockUser.walletAddress as string).toLowerCase(), userId: null },
        { $set: { userId: mockUser.id } },
      );
    });

    it('skips the orphan-linking sweep when the user has no wallet address yet', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue({
        ...mockUser,
        walletAddress: null,
      } as UserDocument);
      const query = createChainableFind([]);
      couponModel.find.mockReturnValue(query);

      await service.findRedeemedByUser('cognito-sub');

      expect(couponModel.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('findUnredeemedByUser', () => {
    it('returns unredeemed coupon DTOs for the user', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as UserDocument);
      const rows = [
        {
          _id: 'c1',
          code: 'aabbcc1234567890aabbcc1234567890',
          usdtAmountRaw: '1000000',
          utlAmountRaw: '50000000000000000',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
        },
      ];
      couponModel.updateMany.mockResolvedValue(undefined);
      const query = createChainableFind(rows);
      couponModel.find.mockReturnValue(query);

      const result = await service.findUnredeemedByUser('cognito-sub');

      expect(usersService.findByCognitoSub).toHaveBeenCalledWith('cognito-sub');
      expect(couponModel.find).toHaveBeenCalledWith({ userId: 'user-id', redeemed: false });
      expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(query.select).toHaveBeenCalledWith([
        'code',
        'usdtAmountRaw',
        'utlAmountRaw',
        'createdAt',
      ]);
      expect(result).toEqual([
        {
          id: 'c1',
          code: 'aabbcc1234567890aabbcc1234567890',
          usdtAmountRaw: '1000000',
          utlAmountRaw: '50000000000000000',
          createdAt: rows[0]?.createdAt,
        },
      ]);
    });

    it('returns empty array when user not found', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(null);

      const result = await service.findUnredeemedByUser('unknown-sub');

      expect(result).toEqual([]);
      expect(couponModel.find).not.toHaveBeenCalled();
    });

    it('links any orphaned coupons for this wallet before listing, when the user has a wallet address', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as UserDocument);
      couponModel.updateMany.mockResolvedValue(undefined);
      const query = createChainableFind([]);
      couponModel.find.mockReturnValue(query);

      await service.findUnredeemedByUser('cognito-sub');

      expect(couponModel.updateMany).toHaveBeenCalledWith(
        { payerAddress: (mockUser.walletAddress as string).toLowerCase(), userId: null },
        { $set: { userId: mockUser.id } },
      );
    });

    it('skips the orphan-linking sweep when the user has no wallet address yet', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue({
        ...mockUser,
        walletAddress: null,
      } as UserDocument);
      const query = createChainableFind([]);
      couponModel.find.mockReturnValue(query);

      await service.findUnredeemedByUser('cognito-sub');

      expect(couponModel.updateMany).not.toHaveBeenCalled();
    });
  });
});
