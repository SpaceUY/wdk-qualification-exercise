import { renderHook, act, waitFor } from '@testing-library/react-native';

// ─── useWdkApp mock ──────────────────────────────────────────────────────────
const mockUseWdkApp = jest.fn();

jest.mock('@tetherto/wdk-react-native-core', () => ({
  useWdkApp: () => mockUseWdkApp(),
  useWalletManager: jest.fn(),
}));

// ─── useWalletData mock ───────────────────────────────────────────────────────
const mockHasLocalWallet = jest.fn<Promise<boolean>, [string]>();
const mockUnlock = jest.fn<Promise<void>, [string]>();
const mockCreateWallet = jest.fn<Promise<void>, [string]>();
const mockSetActiveWalletId = jest.fn<void, [string]>();
const mockGetMnemonic = jest.fn<Promise<string | null>, [string]>();
const mockRestoreWallet = jest.fn<Promise<void>, [string, string]>();

jest.mock('../../hooks/useWalletData', () => ({
  useWalletData: () => ({
    hasLocalWallet: mockHasLocalWallet,
    unlock: mockUnlock,
    createWallet: mockCreateWallet,
    setActiveWalletId: mockSetActiveWalletId,
    getMnemonic: mockGetMnemonic,
    restoreWallet: mockRestoreWallet,
    deleteWallet: jest.fn(),
    getEncryptedSeed: jest.fn(),
    activeWalletId: null,
    wallets: [],
  }),
}));

// ─── useWalletOnboardingStore mock (selector pattern) ─────────────────────────
// The hook calls: useWalletOnboardingStore((s) => s.setWalletOnboardingCompleted)
// The mock must accept and invoke the selector with a stub store state.
const mockSetWalletOnboardingCompleted = jest.fn<void, [boolean]>();
const mockUseWalletOnboardingStore = jest.fn();

jest.mock('../../stores/walletOnboardingStore', () => ({
  useWalletOnboardingStore: (selector: (s: { setWalletOnboardingCompleted: jest.Mock }) => unknown) =>
    mockUseWalletOnboardingStore(selector),
}));

// ─── cloudBackup mock ─────────────────────────────────────────────────────────
const mockRestoreFromCloudBackup = jest.fn<Promise<string | null>, [string]>();
const mockCreateCloudBackup = jest.fn<Promise<void>, [string, string]>();

jest.mock('../../utils/cloudBackup', () => ({
  restoreFromCloudBackup: (walletId: string) => mockRestoreFromCloudBackup(walletId),
  createCloudBackup: (mnemonic: string, walletId: string) =>
    mockCreateCloudBackup(mnemonic, walletId),
  hasCloudBackup: jest.fn(),
}));

// ─── SUT ─────────────────────────────────────────────────────────────────────
import { useWalletBootstrap } from '../../hooks/useWalletBootstrap';

// ─── Test setup helpers ───────────────────────────────────────────────────────
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
    mockRestoreFromCloudBackup.mockResolvedValue(null);
    mockCreateCloudBackup.mockResolvedValue(undefined);
  });

  // ── idle states ─────────────────────────────────────────────────────────────
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

  // ── loading state ───────────────────────────────────────────────────────────
  it('immediately sets status to loading when bootstrap starts', async () => {
    mockHasLocalWallet.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = await renderHook(() => useWalletBootstrap('user@test.com'));
    expect(result.current.status).toBe('loading');
  });

  // ── fast path: local wallet ─────────────────────────────────────────────────
  it('fast path: sets active and unlocks when local wallet exists', async () => {
    mockHasLocalWallet.mockResolvedValue(true);
    mockUnlock.mockResolvedValue(undefined);

    const { result } = await renderHook(() => useWalletBootstrap('user@test.com'));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(mockSetActiveWalletId).toHaveBeenCalledWith('user@test.com');
    expect(mockUnlock).toHaveBeenCalledWith('user@test.com');
    expect(mockRestoreFromCloudBackup).not.toHaveBeenCalled();
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

  // ── cloud restore path ──────────────────────────────────────────────────────
  it('cloud path: restores from cloud backup when no local wallet', async () => {
    mockHasLocalWallet.mockResolvedValue(false);
    mockRestoreFromCloudBackup.mockResolvedValue('abandon about above');
    mockRestoreWallet.mockResolvedValue(undefined);
    mockUnlock.mockResolvedValue(undefined);

    const { result } = await renderHook(() => useWalletBootstrap('user@test.com'));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(mockRestoreFromCloudBackup).toHaveBeenCalledWith('user@test.com');
    expect(mockRestoreWallet).toHaveBeenCalledWith('abandon about above', 'user@test.com');
    expect(mockSetActiveWalletId).toHaveBeenCalledWith('user@test.com');
    expect(mockUnlock).toHaveBeenCalledWith('user@test.com');
    expect(mockSetWalletOnboardingCompleted).toHaveBeenCalledWith(false);
    expect(mockCreateWallet).not.toHaveBeenCalled();
  });

  // ── new wallet path ─────────────────────────────────────────────────────────
  it('new wallet path: creates wallet when no local and no cloud backup', async () => {
    mockHasLocalWallet.mockResolvedValue(false);
    mockRestoreFromCloudBackup.mockResolvedValue(null);
    mockCreateWallet.mockResolvedValue(undefined);
    mockGetMnemonic.mockResolvedValue('test mnemonic phrase');

    const { result } = await renderHook(() => useWalletBootstrap('user@test.com'));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    await waitFor(() =>
      expect(mockCreateCloudBackup).toHaveBeenCalledWith('test mnemonic phrase', 'user@test.com'),
    );

    expect(mockCreateWallet).toHaveBeenCalledWith('user@test.com');
    expect(mockSetWalletOnboardingCompleted).toHaveBeenCalledWith(false);
    expect(mockUnlock).not.toHaveBeenCalled();
    expect(mockSetActiveWalletId).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('fire-and-forget backup failure does not block status:ready', async () => {
    mockHasLocalWallet.mockResolvedValue(false);
    mockRestoreFromCloudBackup.mockResolvedValue(null);
    mockCreateWallet.mockResolvedValue(undefined);
    mockGetMnemonic.mockResolvedValue('mnemonic');
    mockCreateCloudBackup.mockRejectedValue(new Error('iCloud unavailable'));

    const { result } = await renderHook(() => useWalletBootstrap('user@test.com'));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.status).toBe('ready');
    expect(result.current.error).toBeNull();
  });

  it('does not attempt cloud backup when getMnemonic returns null', async () => {
    mockHasLocalWallet.mockResolvedValue(false);
    mockRestoreFromCloudBackup.mockResolvedValue(null);
    mockCreateWallet.mockResolvedValue(undefined);
    mockGetMnemonic.mockResolvedValue(null);

    const { result } = await renderHook(() => useWalletBootstrap('user@test.com'));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(mockCreateCloudBackup).not.toHaveBeenCalled();
  });

  // ── error paths ─────────────────────────────────────────────────────────────
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
    mockRestoreFromCloudBackup.mockResolvedValue(null);
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

  // ── retry behavior ──────────────────────────────────────────────────────────
  it('retry re-runs bootstrap after error', async () => {
    mockHasLocalWallet.mockRejectedValueOnce(new Error('First failure'));

    const { result } = await renderHook(() => useWalletBootstrap('user@test.com'));

    await waitFor(() => expect(result.current.status).toBe('error'));

    mockHasLocalWallet.mockResolvedValue(true);
    mockUnlock.mockResolvedValue(undefined);

    await act(async () => { result.current.retry(); });

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(mockHasLocalWallet).toHaveBeenCalledTimes(2);
  });

  it('retry does nothing when userId is null', async () => {
    const { result } = await renderHook(() => useWalletBootstrap(null));

    await act(async () => { result.current.retry(); });

    expect(mockHasLocalWallet).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  // ── single-run guard ────────────────────────────────────────────────────────
  it('does not re-run bootstrap on re-render with same userId', async () => {
    mockHasLocalWallet.mockResolvedValue(true);
    mockUnlock.mockResolvedValue(undefined);

    const { result, rerender } = await renderHook<
      ReturnType<typeof useWalletBootstrap>,
      { userId: string | null }
    >(
      ({ userId }) => useWalletBootstrap(userId),
      { initialProps: { userId: 'user@test.com' } },
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));

    rerender({ userId: 'user@test.com' });

    expect(mockHasLocalWallet).toHaveBeenCalledTimes(1);
  });
});
