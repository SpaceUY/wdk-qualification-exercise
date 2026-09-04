import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NoSuchElementError } from '@tetherto/wdk-wallet';
import { CouponsService } from './coupons.service';
import { Coupon } from './entities/coupon.entity';
import { UsersService } from '../users/users.service';
import { CACHE_REDIS_CLIENT } from '../redis/redis-cache.tokens';
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

const mockEncodeFunctionDataFn = jest.fn().mockReturnValue('0xencodeddata');
const mockUtlGetAddressFn = jest.fn().mockResolvedValue('0xutladdress');
const mockTransactionFromFn = jest.fn();

// Plain read-only chain calls used to populate a transaction (nonce/fee/gas/chainId)
// before it's handed to WDK's treasuryAccount.signTransaction() — never touches key
// material.
const mockGetTransactionCountFn = jest.fn();
const mockGetFeeDataFn = jest.fn();
const mockGetNetworkFn = jest.fn();
const mockEstimateGasFn = jest.fn();

// WDK's treasuryAccount public API — CouponsService calls only these, never reaches
// into any internal/protected field.
const mockTreasuryGetAddressFn = jest.fn();
const mockSignTransactionFn = jest.fn();
const mockSendTransactionFn = jest.fn();
const mockGetTransactionFn = jest.fn();
const mockWaitForTransactionFn = jest.fn();

// Services use `import { ethers } from 'ethers'` (named namespace), not default import
// The mock must export the `ethers` named property with the same shape
jest.mock('ethers', () => ({
  ethers: {
    Contract: jest.fn().mockImplementation(() => ({
      getAddress: (...args: unknown[]) => mockUtlGetAddressFn(...args),
      interface: { encodeFunctionData: (...args: unknown[]) => mockEncodeFunctionDataFn(...args) },
    })),
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      getTransactionCount: (...args: unknown[]) => mockGetTransactionCountFn(...args),
      getFeeData: (...args: unknown[]) => mockGetFeeDataFn(...args),
      getNetwork: (...args: unknown[]) => mockGetNetworkFn(...args),
      estimateGas: (...args: unknown[]) => mockEstimateGasFn(...args),
    })),
    Transaction: {
      // Wrapped (rather than referenced directly) because jest hoists this
      // `jest.mock` factory above the `const mockTransactionFromFn` declaration
      // above — a direct reference would throw "Cannot access before
      // initialization" the first time this module is required.
      from: (...args: unknown[]) => mockTransactionFromFn(...(args as [string])),
    },
  },
}));

// CouponsService derives the treasury signer via WDK's WalletAccountEvm and drives it
// entirely through its public API (getAddress/signTransaction/sendTransaction/
// getTransaction/waitForTransaction) — no internal/protected field is touched.
jest.mock('@tetherto/wdk-wallet-evm', () => ({
  WalletAccountEvm: jest.fn().mockImplementation(() => ({
    getAddress: (...args: unknown[]) => mockTreasuryGetAddressFn(...args),
    signTransaction: (...args: unknown[]) => mockSignTransactionFn(...args),
    sendTransaction: (...args: unknown[]) => mockSendTransactionFn(...args),
    getTransaction: (...args: unknown[]) => mockGetTransactionFn(...args),
    waitForTransaction: (...args: unknown[]) => mockWaitForTransactionFn(...args),
  })),
}));

// `@tetherto/wdk-wallet` ships ESM-only, which jest's default transform can't parse —
// mocked (like wdk-wallet-evm above) rather than fighting the transformIgnorePatterns
// config. Only `NoSuchElementError` is actually used, so a plain Error subclass with
// the same name/instanceof behavior is all this needs.
jest.mock('@tetherto/wdk-wallet', () => ({
  NoSuchElementError: class NoSuchElementError extends Error {},
}));

type MockRedis = {
  set: jest.Mock;
  eval: jest.Mock;
};

describe('CouponsService', () => {
  let service: CouponsService;
  let couponModel: MockModel;
  let usersService: jest.Mocked<UsersService>;
  let redis: MockRedis;

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

  const EXPECTED_TX = {
    to: '0xutladdress',
    data: '0xencodeddata',
    value: 0n,
    nonce: 5,
    gasLimit: 21000n,
    maxFeePerGas: 2n,
    maxPriorityFeePerGas: 1n,
    chainId: 1n,
  };

  beforeEach(async () => {
    couponModel = createMockModel();
    redis = {
      set: jest.fn().mockResolvedValue('OK'),
      eval: jest.fn().mockResolvedValue(1),
    };
    mockEncodeFunctionDataFn.mockReset().mockReturnValue('0xencodeddata');
    mockUtlGetAddressFn.mockReset().mockResolvedValue('0xutladdress');
    mockTransactionFromFn.mockReset().mockReturnValue({ hash: '0xbroadcast' });

    mockGetTransactionCountFn.mockReset().mockResolvedValue(5);
    mockGetFeeDataFn.mockReset().mockResolvedValue({ maxFeePerGas: 2n, maxPriorityFeePerGas: 1n });
    mockGetNetworkFn.mockReset().mockResolvedValue({ chainId: 1n });
    mockEstimateGasFn.mockReset().mockResolvedValue(21000n);

    mockTreasuryGetAddressFn.mockReset().mockResolvedValue('0xtreasuryaddress');
    mockSignTransactionFn.mockReset().mockResolvedValue('0xsignedtx');
    mockSendTransactionFn.mockReset().mockResolvedValue({ hash: '0xbroadcast', fee: 1n });
    mockGetTransactionFn.mockReset();
    mockWaitForTransactionFn.mockReset().mockResolvedValue({ hash: '0xreceipt', success: true });

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
        { provide: CACHE_REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = module.get(CouponsService);
    usersService = module.get(UsersService);

    await service.onModuleInit();
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
      expect(mockGetTransactionCountFn).not.toHaveBeenCalled();
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
      expect(mockSignTransactionFn).toHaveBeenCalledWith(EXPECTED_TX);
      // The hash must be recorded immediately after signing — BEFORE broadcasting —
      // so it's a durable idempotency record even if the broadcast call itself fails.
      expect(couponModel.updateOne).toHaveBeenCalledWith(
        { _id: 'coupon-id' },
        { redemptionTxHash: '0xbroadcast' },
      );
      expect(mockSendTransactionFn).toHaveBeenCalledWith('0xsignedtx');
      expect(result).toEqual({ redemptionTxHash: '0xreceipt' });
    });

    it('rolls back the lock when building or signing the transfer fails (nothing was ever sent)', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as UserDocument);
      couponModel.findOne.mockResolvedValue(mockCoupon);
      couponModel.findOneAndUpdate.mockResolvedValue({ ...mockCoupon, redeemed: true });
      couponModel.updateOne.mockResolvedValue(undefined);
      mockGetTransactionCountFn.mockRejectedValueOnce(new Error('RPC unreachable'));

      await expect(
        service.claimCoupon(mockCoupon.code as string, 'cognito-sub'),
      ).rejects.toThrow(BadRequestException);

      expect(couponModel.updateOne).toHaveBeenCalledWith(
        { _id: 'coupon-id' },
        { redeemed: false, redeemedAt: null },
      );
      // Must never reach the broadcast step, and must never record a hash for a
      // transaction that was never even signed.
      expect(mockSendTransactionFn).not.toHaveBeenCalled();
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
      mockSendTransactionFn.mockRejectedValueOnce(new Error('connection reset'));
      // WDK's getTransaction throws NoSuchElementError instead of resolving null.
      mockGetTransactionFn.mockRejectedValue(new NoSuchElementError('not found'));

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
      mockSendTransactionFn.mockRejectedValueOnce(new Error('response timed out'));
      mockGetTransactionFn.mockResolvedValueOnce({ hash: '0xbroadcast', success: true });

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
      mockSendTransactionFn.mockRejectedValueOnce(new Error('connection reset'));
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
      mockWaitForTransactionFn.mockResolvedValueOnce({ hash: '0xreceipt', success: false });

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

  describe('treasury nonce serialization', () => {
    it('never lets a second claim start building its transfer before the first one is broadcast', async () => {
      const couponA = { ...mockCoupon, _id: 'coupon-a', code: 'codeA' };
      const couponB = { ...mockCoupon, _id: 'coupon-b', code: 'codeB' };
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as UserDocument);
      couponModel.findOne.mockImplementation((query: { code: string }) =>
        Promise.resolve(query.code === 'codeA' ? couponA : couponB),
      );
      couponModel.findOneAndUpdate.mockImplementation((query: { _id: string }) =>
        Promise.resolve({ ...(query._id === 'coupon-a' ? couponA : couponB), redeemed: true }),
      );
      couponModel.updateOne.mockResolvedValue(undefined);

      const order: string[] = [];
      mockGetTransactionCountFn.mockImplementation(async () => {
        order.push('populate');
        return 5;
      });
      mockSendTransactionFn.mockImplementation(async () => {
        order.push('broadcast');
        return { hash: '0xbroadcast', fee: 1n };
      });

      await Promise.all([
        service.claimCoupon('codeA', 'cognito-sub'),
        service.claimCoupon('codeB', 'cognito-sub'),
      ]);

      // Each populate must be immediately followed by its own broadcast — the two
      // treasury sends never interleave, which is what keeps the nonce sequential.
      expect(order).toEqual(['populate', 'broadcast', 'populate', 'broadcast']);
    });
  });

  describe('distributed treasury lock', () => {
    beforeEach(() => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as UserDocument);
      couponModel.findOne.mockResolvedValue(mockCoupon);
      couponModel.findOneAndUpdate.mockResolvedValue({ ...mockCoupon, redeemed: true });
      couponModel.updateOne.mockResolvedValue(undefined);
    });

    it('acquires the Redis lock before sending and releases it with the same token after', async () => {
      await service.claimCoupon(mockCoupon.code as string, 'cognito-sub');

      expect(redis.set).toHaveBeenCalledWith(
        'coupons:treasury-send-lock',
        expect.any(String),
        'PX',
        expect.any(Number),
        'NX',
      );
      const token = redis.set.mock.calls[0]?.[1] as string;
      expect(redis.eval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call("del", KEYS[1])'),
        1,
        'coupons:treasury-send-lock',
        token,
      );
    });

    it('rolls back the coupon and asks for a retry when another instance holds the lock past the timeout', async () => {
      redis.set.mockResolvedValue(null);

      await expect(
        service.claimCoupon(mockCoupon.code as string, 'cognito-sub'),
      ).rejects.toThrow('UTL transfer is busy — please retry');

      expect(couponModel.updateOne).toHaveBeenCalledWith(
        { _id: 'coupon-id' },
        { redeemed: false, redeemedAt: null },
      );
      // Nothing may be signed or broadcast without the distributed lock.
      expect(mockGetTransactionCountFn).not.toHaveBeenCalled();
      expect(mockSendTransactionFn).not.toHaveBeenCalled();
    });

    it('fails closed (rollback + retriable error) when Redis is unreachable', async () => {
      redis.set.mockRejectedValue(new Error('connection refused'));

      await expect(
        service.claimCoupon(mockCoupon.code as string, 'cognito-sub'),
      ).rejects.toThrow('UTL transfer is busy — please retry');

      expect(couponModel.updateOne).toHaveBeenCalledWith(
        { _id: 'coupon-id' },
        { redeemed: false, redeemedAt: null },
      );
      expect(mockGetTransactionCountFn).not.toHaveBeenCalled();
    });

    it('does not fail a successful transfer when releasing the lock errors (TTL reclaims it)', async () => {
      redis.eval.mockRejectedValue(new Error('connection reset'));

      const result = await service.claimCoupon(mockCoupon.code as string, 'cognito-sub');

      expect(result).toEqual({ redemptionTxHash: '0xreceipt' });
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
          merchantAddress: '0xMerchantAddress',
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
        'code',
        'usdtAmountRaw',
        'utlAmountRaw',
        'merchantAddress',
        'redeemedAt',
        'redemptionTxHash',
        'createdAt',
      ]);
      expect(result).toEqual([
        {
          id: 'c2',
          usdtAmountRaw: '2000000',
          utlAmountRaw: '100000000000000000',
          merchantAddress: '0xMerchantAddress',
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

    it('maps a legacy coupon created before merchantAddress existed to merchantAddress: null', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as UserDocument);
      const query = createChainableFind([
        {
          _id: 'c2',
          usdtAmountRaw: '2000000',
          utlAmountRaw: '100000000000000000',
          redeemedAt: new Date('2024-01-02T00:00:00.000Z'),
          redemptionTxHash: '0xdeadbeef',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
        },
      ]);
      couponModel.find.mockReturnValue(query);

      const result = await service.findRedeemedByUser('cognito-sub');

      expect(result[0]?.merchantAddress).toBeNull();
    });

    it('is a pure read — never runs the orphan-linking sweep (linking happens at write time: coupon issuance and PUT /wallets/address)', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as UserDocument);
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
          merchantAddress: '0xMerchantAddress',
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
        'merchantAddress',
        'redeemedAt',
        'redemptionTxHash',
        'createdAt',
      ]);
      expect(result).toEqual([
        {
          id: 'c1',
          code: 'aabbcc1234567890aabbcc1234567890',
          usdtAmountRaw: '1000000',
          utlAmountRaw: '50000000000000000',
          merchantAddress: '0xMerchantAddress',
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

    it('maps a legacy coupon created before merchantAddress existed to merchantAddress: null', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as UserDocument);
      const query = createChainableFind([
        {
          _id: 'c1',
          code: 'aabbcc1234567890aabbcc1234567890',
          usdtAmountRaw: '1000000',
          utlAmountRaw: '50000000000000000',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
        },
      ]);
      couponModel.find.mockReturnValue(query);

      const result = await service.findUnredeemedByUser('cognito-sub');

      expect(result[0]?.merchantAddress).toBeNull();
    });

    it('is a pure read — never runs the orphan-linking sweep (linking happens at write time: coupon issuance and PUT /wallets/address)', async () => {
      (usersService.findByCognitoSub as jest.Mock).mockResolvedValue(mockUser as UserDocument);
      const query = createChainableFind([]);
      couponModel.find.mockReturnValue(query);

      await service.findUnredeemedByUser('cognito-sub');

      expect(couponModel.updateMany).not.toHaveBeenCalled();
    });
  });
});
