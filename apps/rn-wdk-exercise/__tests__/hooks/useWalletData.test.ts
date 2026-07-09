import { renderHook, act } from '@testing-library/react-native';

const mockCreateWallet = jest.fn<Promise<void>, [string]>();
const mockRestoreWallet = jest.fn<Promise<void>, [string, string]>();
const mockDeleteWallet = jest.fn<Promise<void>, [string]>();
const mockUnlock = jest.fn<Promise<void>, [string]>();
const mockLock = jest.fn<void, []>();
const mockGetMnemonic = jest.fn<Promise<string | null>, [string]>();
const mockGetEncryptedSeed = jest.fn<Promise<string | null>, [string]>();
const mockSetActiveWalletId = jest.fn<void, [string]>();

jest.mock('@tetherto/wdk-react-native-core', () => ({
  useWalletManager: () => ({
    createWallet: mockCreateWallet,
    restoreWallet: mockRestoreWallet,
    deleteWallet: mockDeleteWallet,
    unlock: mockUnlock,
    lock: mockLock,
    getMnemonic: mockGetMnemonic,
    getEncryptedSeed: mockGetEncryptedSeed,
    setActiveWalletId: mockSetActiveWalletId,
    activeWalletId: 'wallet-001',
    wallets: [],
  }),
  useWdkApp: jest.fn(),
}));

import { useWalletData } from '../../hooks/useWalletData';

describe('useWalletData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hasLocalWallet', () => {
    it('returns true when getEncryptedSeed resolves with a non-null value', async () => {
      mockGetEncryptedSeed.mockResolvedValue('encrypted-seed-data');

      const { result } = await renderHook(() => useWalletData());
      let has!: boolean;
      await act(async () => { has = await result.current.hasLocalWallet('wallet-001'); });

      expect(has).toBe(true);
      expect(mockGetEncryptedSeed).toHaveBeenCalledWith('wallet-001');
    });

    it('returns false when getEncryptedSeed resolves with null', async () => {
      mockGetEncryptedSeed.mockResolvedValue(null);

      const { result } = await renderHook(() => useWalletData());
      let has!: boolean;
      await act(async () => { has = await result.current.hasLocalWallet('wallet-001'); });

      expect(has).toBe(false);
    });

    it('returns false when getEncryptedSeed resolves with undefined', async () => {
      mockGetEncryptedSeed.mockResolvedValue(undefined as unknown as null);

      const { result } = await renderHook(() => useWalletData());
      let has!: boolean;
      await act(async () => { has = await result.current.hasLocalWallet('wallet-001'); });

      expect(has).toBe(false);
    });
  });

  describe('createWallet (safeCreateWallet)', () => {
    it('calls underlying createWallet on the happy path', async () => {
      mockCreateWallet.mockResolvedValue(undefined);

      const { result } = await renderHook(() => useWalletData());
      await act(async () => { await result.current.createWallet('wallet-001'); });

      expect(mockCreateWallet).toHaveBeenCalledWith('wallet-001');
      expect(mockSetActiveWalletId).not.toHaveBeenCalled();
      expect(mockUnlock).not.toHaveBeenCalled();
    });

    it('calls setActiveWalletId + unlock when createWallet throws "already exists"', async () => {
      mockCreateWallet.mockRejectedValue(new Error('Wallet already exists'));
      mockUnlock.mockResolvedValue(undefined);

      const { result } = await renderHook(() => useWalletData());
      await act(async () => { await result.current.createWallet('wallet-001'); });

      expect(mockSetActiveWalletId).toHaveBeenCalledWith('wallet-001');
      expect(mockUnlock).toHaveBeenCalledWith('wallet-001');
    });

    it('re-throws when createWallet throws a non-"already exists" error', async () => {
      mockCreateWallet.mockRejectedValue(new Error('Unknown error'));

      const { result } = await renderHook(() => useWalletData());
      await expect(
        act(async () => { await result.current.createWallet('wallet-001'); }),
      ).rejects.toThrow('Unknown error');

      expect(mockSetActiveWalletId).not.toHaveBeenCalled();
    });

    it('re-throws non-Error rejections', async () => {
      mockCreateWallet.mockRejectedValue('plain string error');

      const { result } = await renderHook(() => useWalletData());
      await expect(
        act(async () => { await result.current.createWallet('wallet-001'); }),
      ).rejects.toBe('plain string error');
    });

    it('passes the correct walletId to setActiveWalletId and unlock in already-exists branch', async () => {
      mockCreateWallet.mockRejectedValue(new Error('already exists'));
      mockUnlock.mockResolvedValue(undefined);

      const { result } = await renderHook(() => useWalletData());
      await act(async () => { await result.current.createWallet('specific-wallet'); });

      expect(mockSetActiveWalletId).toHaveBeenCalledWith('specific-wallet');
      expect(mockUnlock).toHaveBeenCalledWith('specific-wallet');
    });
  });

  describe('restoreWallet (safeRestoreWallet)', () => {
    it('normalizes mnemonic: lowercase + trim + single-space', async () => {
      mockRestoreWallet.mockResolvedValue(undefined);

      const { result } = await renderHook(() => useWalletData());
      await act(async () => {
        await result.current.restoreWallet('  WORD1  WORD2   WORD3  ', 'wallet-001');
      });

      expect(mockRestoreWallet).toHaveBeenCalledWith('word1 word2 word3', 'wallet-001');
    });

    it('converts mixed-case mnemonic to lowercase', async () => {
      mockRestoreWallet.mockResolvedValue(undefined);

      const { result } = await renderHook(() => useWalletData());
      await act(async () => {
        await result.current.restoreWallet('Word1 Word2 Word3', 'wallet-001');
      });

      expect(mockRestoreWallet).toHaveBeenCalledWith('word1 word2 word3', 'wallet-001');
    });

    it('collapses tabs and multiple spaces', async () => {
      mockRestoreWallet.mockResolvedValue(undefined);

      const { result } = await renderHook(() => useWalletData());
      await act(async () => {
        await result.current.restoreWallet('word1\t\tword2   word3', 'wallet-001');
      });

      expect(mockRestoreWallet).toHaveBeenCalledWith('word1 word2 word3', 'wallet-001');
    });

    it('passes walletId through unchanged', async () => {
      mockRestoreWallet.mockResolvedValue(undefined);

      const { result } = await renderHook(() => useWalletData());
      await act(async () => {
        await result.current.restoreWallet('word1 word2', 'my-specific-wallet');
      });

      expect(mockRestoreWallet).toHaveBeenCalledWith('word1 word2', 'my-specific-wallet');
    });

    it('propagates rejection from restoreWallet', async () => {
      mockRestoreWallet.mockRejectedValue(new Error('Invalid mnemonic'));

      const { result } = await renderHook(() => useWalletData());
      await expect(
        act(async () => { await result.current.restoreWallet('bad', 'wallet-001'); }),
      ).rejects.toThrow('Invalid mnemonic');
    });

    it('deletes the existing wallet and retries when restoreWallet throws "already exists"', async () => {
      mockRestoreWallet
        .mockRejectedValueOnce(new Error('A wallet with the ID "wallet-001" already exists.'))
        .mockResolvedValueOnce(undefined);
      mockDeleteWallet.mockResolvedValue(undefined);

      const { result } = await renderHook(() => useWalletData());
      await act(async () => {
        await result.current.restoreWallet('word1 word2 word3', 'wallet-001');
      });

      expect(mockDeleteWallet).toHaveBeenCalledWith('wallet-001');
      expect(mockRestoreWallet).toHaveBeenCalledTimes(2);
      expect(mockRestoreWallet).toHaveBeenNthCalledWith(2, 'word1 word2 word3', 'wallet-001');
    });

    it('re-throws when restoreWallet fails again after delete-and-retry', async () => {
      mockRestoreWallet.mockRejectedValue(new Error('already exists'));
      mockDeleteWallet.mockResolvedValue(undefined);

      const { result } = await renderHook(() => useWalletData());
      let caughtError: Error | undefined;
      await act(async () => {
        try {
          await result.current.restoreWallet('word1 word2', 'wallet-001');
        } catch (err) {
          caughtError = err as Error;
        }
      });

      expect(caughtError?.message).toBe('already exists');
      expect(mockDeleteWallet).toHaveBeenCalledWith('wallet-001');
      expect(mockRestoreWallet).toHaveBeenCalledTimes(2);
    });
  });

  describe('passthrough properties', () => {
    it('exposes deleteWallet from useWalletManager', async () => {
      const { result } = await renderHook(() => useWalletData());
      expect(result.current.deleteWallet).toBe(mockDeleteWallet);
    });

    it('exposes unlock from useWalletManager', async () => {
      const { result } = await renderHook(() => useWalletData());
      expect(result.current.unlock).toBe(mockUnlock);
    });

    it('exposes lock from useWalletManager', async () => {
      const { result } = await renderHook(() => useWalletData());
      expect(result.current.lock).toBe(mockLock);
    });

    it('exposes getMnemonic from useWalletManager', async () => {
      const { result } = await renderHook(() => useWalletData());
      expect(result.current.getMnemonic).toBe(mockGetMnemonic);
    });

    it('exposes activeWalletId from useWalletManager', async () => {
      const { result } = await renderHook(() => useWalletData());
      expect(result.current.activeWalletId).toBe('wallet-001');
    });
  });
});
