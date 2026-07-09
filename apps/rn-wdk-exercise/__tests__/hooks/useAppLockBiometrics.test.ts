import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useAppLockBiometrics, RELOCK_GRACE_MS } from '@/hooks/useAppLockBiometrics';
import { useAuthStore } from '@/stores/authStore';
import { useAppLockStore } from '@/stores/appLockStore';

const mockIsAvailable = jest.fn();
const mockAuthenticate = jest.fn();
const mockHasLocalWallet = jest.fn();

jest.mock('@/hooks/useBiometrics', () => ({
  useBiometrics: () => ({
    isAvailable: mockIsAvailable,
    authenticate: mockAuthenticate,
  }),
}));

jest.mock('@/hooks/useWalletData', () => ({
  useWalletData: () => ({
    hasLocalWallet: mockHasLocalWallet,
  }),
}));

let appStateListener: ((state: string) => void) | null = null;
let now = 1_000_000_000;
let dateNowSpy: jest.SpyInstance<number, []>;
let addEventListenerSpy: jest.SpyInstance;

beforeEach(() => {
  useAuthStore.getState().clear();
  useAppLockStore.setState({ locked: false, checked: false });
  mockIsAvailable.mockReset();
  mockAuthenticate.mockReset();
  mockHasLocalWallet.mockReset();
  // Default: returning user with a wallet already on this device.
  mockHasLocalWallet.mockResolvedValue(true);

  appStateListener = null;
  addEventListenerSpy = jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation(((_event: string, handler: (state: string) => void) => {
      appStateListener = handler;
      return { remove: jest.fn() };
    }) as unknown as typeof AppState.addEventListener);

  now = 1_000_000_000;
  dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
});

afterEach(() => {
  dateNowSpy.mockRestore();
  addEventListenerSpy.mockRestore();
});

// Simulates the app going to the background and coming back `elapsedMs` later.
async function backgroundForegroundCycle(elapsedMs: number) {
  await act(async () => {
    appStateListener?.('background');
    await Promise.resolve();
  });
  now += elapsedMs;
  await act(async () => {
    appStateListener?.('active');
    await Promise.resolve();
  });
}

describe('useAppLockBiometrics', () => {
  it('starts unlocked when no userId (not logged in)', async () => {
    mockIsAvailable.mockResolvedValue(true);
    const { result } = await renderHook(() => useAppLockBiometrics());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.locked).toBe(false);
  });

  it('locks on mount when user is logged in and biometrics available', async () => {
    useAuthStore.getState().setUserId('alice@example.com');
    mockIsAvailable.mockResolvedValue(true);

    const { result } = await renderHook(() => useAppLockBiometrics());
    await waitFor(() => expect(result.current.locked).toBe(true));
  });

  it('does not lock on first-time signup, before any local wallet exists', async () => {
    useAuthStore.getState().setUserId('newuser@example.com');
    mockIsAvailable.mockResolvedValue(true);
    mockHasLocalWallet.mockResolvedValue(false);

    const { result } = await renderHook(() => useAppLockBiometrics());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.locked).toBe(false);
    await waitFor(() => expect(useAppLockStore.getState().checked).toBe(true));
  });

  it('does not lock when biometrics unavailable', async () => {
    useAuthStore.getState().setUserId('alice@example.com');
    mockIsAvailable.mockResolvedValue(false);

    const { result } = await renderHook(() => useAppLockBiometrics());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.locked).toBe(false);
  });

  it('locks on mount when isAvailable() rejects (fail closed)', async () => {
    useAuthStore.getState().setUserId('alice@example.com');
    mockIsAvailable.mockRejectedValue(new Error('native module error'));

    const { result } = await renderHook(() => useAppLockBiometrics());
    await waitFor(() => expect(result.current.locked).toBe(true));
  });

  it('unlock() calls authenticate and sets locked=false on success', async () => {
    useAuthStore.getState().setUserId('alice@example.com');
    mockIsAvailable.mockResolvedValue(true);
    mockAuthenticate.mockResolvedValue(true);

    const { result } = await renderHook(() => useAppLockBiometrics());
    await waitFor(() => expect(result.current.locked).toBe(true));

    await act(async () => { await result.current.unlock(); });

    expect(mockAuthenticate).toHaveBeenCalledWith('Authenticate to open Wallet');
    expect(result.current.locked).toBe(false);
  });

  it('unlock() keeps locked=true when authenticate returns false', async () => {
    useAuthStore.getState().setUserId('alice@example.com');
    mockIsAvailable.mockResolvedValue(true);
    mockAuthenticate.mockResolvedValue(false);

    const { result } = await renderHook(() => useAppLockBiometrics());
    await waitFor(() => expect(result.current.locked).toBe(true));

    await act(async () => { await result.current.unlock(); });

    expect(result.current.locked).toBe(true);
  });

  it('stays unlocked when returning to the foreground within the grace period', async () => {
    useAuthStore.getState().setUserId('alice@example.com');
    mockIsAvailable.mockResolvedValue(true);
    mockAuthenticate.mockResolvedValue(true);

    const { result } = await renderHook(() => useAppLockBiometrics());
    await waitFor(() => expect(result.current.locked).toBe(true));

    await act(async () => { await result.current.unlock(); });
    expect(result.current.locked).toBe(false);

    // Briefly switching apps (e.g. to copy something) must not re-prompt.
    await backgroundForegroundCycle(60_000);

    expect(result.current.locked).toBe(false);
  });

  it('re-locks when returning to the foreground after the grace period expires', async () => {
    useAuthStore.getState().setUserId('alice@example.com');
    mockIsAvailable.mockResolvedValue(true);
    mockAuthenticate.mockResolvedValue(true);

    const { result } = await renderHook(() => useAppLockBiometrics());
    await waitFor(() => expect(result.current.locked).toBe(true));

    await act(async () => { await result.current.unlock(); });
    expect(result.current.locked).toBe(false);

    await backgroundForegroundCycle(RELOCK_GRACE_MS + 1);

    await waitFor(() => expect(result.current.locked).toBe(true));
  });

  it('does not re-lock when a system dialog (e.g. Face ID) briefly makes the app inactive without backgrounding it', async () => {
    // Regression test: on iOS, native biometric prompts (including the WDK SDK's own
    // wallet-unlock Face ID prompt) transition AppState active -> inactive -> active
    // WITHOUT ever passing through 'background'. That must not arm the re-lock timer,
    // no matter how long the dialog stays up - otherwise the app re-locks itself
    // mid-unlock in an infinite loop.
    useAuthStore.getState().setUserId('alice@example.com');
    mockIsAvailable.mockResolvedValue(true);
    mockAuthenticate.mockResolvedValue(true);

    const { result } = await renderHook(() => useAppLockBiometrics());
    await waitFor(() => expect(result.current.locked).toBe(true));

    await act(async () => { await result.current.unlock(); });
    expect(result.current.locked).toBe(false);

    await act(async () => {
      appStateListener?.('inactive');
      await Promise.resolve();
    });
    now += RELOCK_GRACE_MS + 1;
    await act(async () => {
      appStateListener?.('active');
      await Promise.resolve();
    });

    expect(result.current.locked).toBe(false);
  });

  it('re-locks on foreground after the grace period even when isAvailable() rejects (fail closed)', async () => {
    useAuthStore.getState().setUserId('alice@example.com');
    mockIsAvailable.mockResolvedValue(true);
    mockAuthenticate.mockResolvedValue(true);

    const { result } = await renderHook(() => useAppLockBiometrics());
    await waitFor(() => expect(result.current.locked).toBe(true));

    await act(async () => { await result.current.unlock(); });
    expect(result.current.locked).toBe(false);

    mockIsAvailable.mockRejectedValue(new Error('native module error'));

    await backgroundForegroundCycle(RELOCK_GRACE_MS + 1);

    await waitFor(() => expect(result.current.locked).toBe(true));
  });

  it('marks the app-lock check unresolved (checked=false) while isAvailable() is still pending', async () => {
    // Regression test: WDK's own wallet-unlock only re-prompts for biometrics when its
    // internal cache is cold, so it can silently skip the OS prompt on a later call within
    // the same process. useWalletBootstrap must wait for this hook's own check to resolve
    // (checked=true) before triggering WDK's unlock, instead of racing it - otherwise the
    // app's lock screen can be skipped entirely whenever WDK happens to unlock instantly.
    useAuthStore.getState().setUserId('alice@example.com');
    let resolveIsAvailable: (value: boolean) => void = () => {};
    mockIsAvailable.mockReturnValue(new Promise((resolve) => { resolveIsAvailable = resolve; }));

    await renderHook(() => useAppLockBiometrics());
    expect(useAppLockStore.getState().checked).toBe(false);

    await act(async () => { resolveIsAvailable(true); await Promise.resolve(); });
    await waitFor(() => expect(useAppLockStore.getState().checked).toBe(true));
    expect(useAppLockStore.getState().locked).toBe(true);
  });
});
