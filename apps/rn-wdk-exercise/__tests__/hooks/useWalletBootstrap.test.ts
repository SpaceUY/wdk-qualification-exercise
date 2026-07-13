import { renderHook, act, waitFor } from '@testing-library/react-native';

const mockUseWdkApp = jest.fn();
jest.mock('@tetherto/wdk-react-native-core', () => ({
  useWdkApp: () => mockUseWdkApp(),
  useWalletManager: jest.fn(),
}));

const mockHasLocalWallet = jest.fn<Promise<boolean>, [string]>();
const mockUnlock = jest.fn<Promise<void>, [string]>();
const mockCreateWallet = jest.fn<Promise<void>, [string]>();
const mockSetActiveWalletId = jest.fn<void, [string]>();

jest.mock('../../hooks/useWalletData', () => ({
  useWalletData: () => ({
    hasLocalWallet: mockHasLocalWallet,
    unlock: mockUnlock,
    createWallet: mockCreateWallet,
    setActiveWalletId: mockSetActiveWalletId,
    getMnemonic: jest.fn(),
    restoreWallet: jest.fn(),
    deleteWallet: jest.fn(),
    getEncryptedSeed: jest.fn(),
    activeWalletId: null,
    wallets: [],
  }),
}));

const mockGetWalletBackupExists = jest.fn<Promise<boolean>, []>();
jest.mock('../../utils/api', () => ({
  getWalletBackupExists: () => mockGetWalletBackupExists(),
}));

const mockSetWalletOnboardingCompleted = jest.fn<void, [boolean]>();
const mockUseWalletOnboardingStore = jest.fn();

jest.mock('../../stores/walletOnboardingStore', () => ({
  useWalletOnboardingStore: (selector: (s: { setWalletOnboardingCompleted: jest.Mock }) => unknown) =>
    mockUseWalletOnboardingStore(selector),
}));

import { useWalletBootstrap } from '../../hooks/useWalletBootstrap';
import { useAppLockStore } from '../../stores/appLockStore';

function setupWdkReady(isReady: boolean) {
  mockUseWdkApp.mockReturnValue({ workletState: { isReady } });
}

function setupStoreMock() {
  mockUseWalletOnboardingStore.mockImplementation(
    (selector: (s: { setWalletOnboardingCompleted: jest.Mock }) => unknown) =>
      selector({ setWalletOnboardingCompleted: mockSetWalletOnboardingCompleted }),
  );
}

describe('useWalletBootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupWdkReady(true);
    setupStoreMock();
    // Default: backend has no backup for this user, so the slow path auto-creates.
    mockGetWalletBackupExists.mockResolvedValue(false);
    // Default: the app's own biometric gate already checked out and isn't locked, so
    // existing tests exercise bootstrap without needing to care about the lock screen.
    useAppLockStore.setState({ checked: true, locked: false });
  });

  it('stays idle when userId is null', async () => {
    const { result } = await renderHook(() => useWalletBootstrap(null));
    expect(result.current.status).toBe('idle');
    expect(mockHasLocalWallet).not.toHaveBeenCalled();
  });

  it('stays idle when workletState.isReady is false', async () => {
    setupWdkReady(false);
    const { result } = await renderHook(() => useWalletBootstrap('user@test.com'));
    expect(result.current.status).toBe('idle');
    expect(mockHasLocalWallet).not.toHaveBeenCalled();
  });

  it('stays idle while the app-level biometric check has not resolved yet', async () => {
    useAppLockStore.setState({ checked: false, locked: false });
    const { result } = await renderHook(() => useWalletBootstrap('user@test.com'));
    expect(result.current.status).toBe('idle');
    expect(mockHasLocalWallet).not.toHaveBeenCalled();
  });

  it('stays idle while the app lock screen is locked, even once the check has resolved', async () => {
    useAppLockStore.setState({ checked: true, locked: true });
    const { result } = await renderHook(() => useWalletBootstrap('user@test.com'));
    expect(result.current.status).toBe('idle');
    expect(mockHasLocalWallet).not.toHaveBeenCalled();
  });

  it('starts bootstrapping once the app lock screen clears', async () => {
    useAppLockStore.setState({ checked: true, locked: true });
    mockHasLocalWallet.mockResolvedValue(true);
    mockUnlock.mockResolvedValue(undefined);

    const { result } = await renderHook(() => useWalletBootstrap('user@test.com'));
    expect(result.current.status).toBe('idle');

    await act(async () => { useAppLockStore.setState({ locked: false }); });

    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it('immediately sets status to loading when bootstrap starts', async () => {
    mockHasLocalWallet.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = await renderHook(() => useWalletBootstrap('user@test.com'));
    expect(result.current.status).toBe('loading');
  });

  it('fast path: sets active and unlocks when local wallet exists', async () => {
    mockHasLocalWallet.mockResolvedValue(true);
    mockUnlock.mockResolvedValue(undefined);

    const { result } = await renderHook(() => useWalletBootstrap('user@test.com'));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(mockSetActiveWalletId).toHaveBeenCalledWith('user@test.com');
    expect(mockUnlock).toHaveBeenCalledWith('user@test.com');
    expect(mockCreateWallet).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('fast path: does not call setWalletOnboardingCompleted', async () => {
    mockHasLocalWallet.mockResolvedValue(true);
    mockUnlock.mockResolvedValue(undefined);

    const { result } = await renderHook(() => useWalletBootstrap('user@test.com'));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(mockSetWalletOnboardingCompleted).not.toHaveBeenCalled();
  });

  it('slow path: creates a fresh wallet when none exists locally and the backend has no backup', async () => {
    mockHasLocalWallet.mockResolvedValue(false);
    mockGetWalletBackupExists.mockResolvedValue(false);
    mockCreateWallet.mockResolvedValue(undefined);

    const { result } = await renderHook(() => useWalletBootstrap('user@test.com'));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(mockCreateWallet).toHaveBeenCalledWith('user@test.com');
    expect(mockSetWalletOnboardingCompleted).toHaveBeenCalledWith(false);
    expect(mockUnlock).not.toHaveBeenCalled();
    expect(mockSetActiveWalletId).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('slow path: hands off to cloud restore instead of creating when the backend has a backup', async () => {
    mockHasLocalWallet.mockResolvedValue(false);
    mockGetWalletBackupExists.mockResolvedValue(true);

    const { result } = await renderHook(() => useWalletBootstrap('user@test.com'));

    await waitFor(() => expect(result.current.status).toBe('needs-cloud-restore'));

    expect(mockCreateWallet).not.toHaveBeenCalled();
    expect(mockSetWalletOnboardingCompleted).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('transitions to error when the backup existence check fails, without creating a wallet', async () => {
    mockHasLocalWallet.mockResolvedValue(false);
    mockGetWalletBackupExists.mockRejectedValue(new Error('Network request failed'));

    const { result } = await renderHook(() => useWalletBootstrap('user@test.com'));

    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.error).toBe('Network request failed');
    expect(mockCreateWallet).not.toHaveBeenCalled();
  });

  it('transitions to error when hasLocalWallet throws', async () => {
    mockHasLocalWallet.mockRejectedValue(new Error('Storage read failed'));

    const { result } = await renderHook(() => useWalletBootstrap('user@test.com'));

    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.error).toBe('Storage read failed');
  });

  it('transitions to error when unlock throws', async () => {
    mockHasLocalWallet.mockResolvedValue(true);
    mockUnlock.mockRejectedValue(new Error('Unlock failed'));

    const { result } = await renderHook(() => useWalletBootstrap('user@test.com'));

    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.error).toBe('Unlock failed');
  });

  it('transitions to error when createWallet throws', async () => {
    mockHasLocalWallet.mockResolvedValue(false);
    mockCreateWallet.mockRejectedValue(new Error('Create failed'));

    const { result } = await renderHook(() => useWalletBootstrap('user@test.com'));

    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.error).toBe('Create failed');
  });

  it('serializes non-Error thrown values as string', async () => {
    mockHasLocalWallet.mockRejectedValue('plain string error');

    const { result } = await renderHook(() => useWalletBootstrap('user@test.com'));

    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.error).toBe('plain string error');
  });

  it('retry re-runs bootstrap after error', async () => {
    mockHasLocalWallet.mockRejectedValueOnce(new Error('First failure'));

    const { result } = await renderHook(() => useWalletBootstrap('user@test.com'));

    await waitFor(() => expect(result.current.status).toBe('error'));

    mockHasLocalWallet.mockResolvedValue(true);
    mockUnlock.mockResolvedValue(undefined);

    await act(async () => {
      result.current.retry();
    });

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(mockHasLocalWallet).toHaveBeenCalledTimes(2);
  });

  it('retry does nothing when userId is null', async () => {
    const { result } = await renderHook(() => useWalletBootstrap(null));

    await act(async () => {
      result.current.retry();
    });

    expect(mockHasLocalWallet).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('does not re-run bootstrap on re-render with same userId', async () => {
    mockHasLocalWallet.mockResolvedValue(true);
    mockUnlock.mockResolvedValue(undefined);

    const { result, rerender } = await renderHook<
      ReturnType<typeof useWalletBootstrap>,
      { userId: string | null }
    >(({ userId }) => useWalletBootstrap(userId), { initialProps: { userId: 'user@test.com' } });

    await waitFor(() => expect(result.current.status).toBe('ready'));

    rerender({ userId: 'user@test.com' });

    expect(mockHasLocalWallet).toHaveBeenCalledTimes(1);
  });
});
