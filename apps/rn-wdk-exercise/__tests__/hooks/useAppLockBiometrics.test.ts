import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useAppLockBiometrics } from '@/hooks/useAppLockBiometrics';
import { useAuthStore } from '@/stores/authStore';

const mockIsAvailable = jest.fn();
const mockAuthenticate = jest.fn();

jest.mock('@/hooks/useBiometrics', () => ({
  useBiometrics: () => ({
    isAvailable: mockIsAvailable,
    authenticate: mockAuthenticate,
  }),
}));

let appStateListener: ((state: string) => void) | null = null;

beforeEach(() => {
  useAuthStore.getState().clear();
  mockIsAvailable.mockReset();
  mockAuthenticate.mockReset();
  appStateListener = null;

  // Reset currentState and capture listeners via the already-mocked AppState
  (AppState as unknown as { currentState: string }).currentState = 'active';
  (AppState.addEventListener as jest.Mock).mockReset();
  (AppState.addEventListener as jest.Mock).mockImplementation((_event: string, handler: (state: string) => void) => {
    appStateListener = handler;
    return { remove: jest.fn() };
  });
});

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

  it('re-locks when app returns to foreground', async () => {
    useAuthStore.getState().setUserId('alice@example.com');
    mockIsAvailable.mockResolvedValue(true);
    mockAuthenticate.mockResolvedValue(true);

    const { result } = await renderHook(() => useAppLockBiometrics());
    await waitFor(() => expect(result.current.locked).toBe(true));

    // Unlock
    await act(async () => { await result.current.unlock(); });
    expect(result.current.locked).toBe(false);

    // Simulate background → foreground via two listener events
    await act(async () => {
      appStateListener?.('background');
      await Promise.resolve();
    });
    await act(async () => {
      appStateListener?.('active');
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.locked).toBe(true));
  });

  it('re-locks on foreground when isAvailable() rejects (fail closed)', async () => {
    useAuthStore.getState().setUserId('alice@example.com');
    mockIsAvailable.mockResolvedValue(true);
    mockAuthenticate.mockResolvedValue(true);

    const { result } = await renderHook(() => useAppLockBiometrics());
    await waitFor(() => expect(result.current.locked).toBe(true));

    await act(async () => { await result.current.unlock(); });
    expect(result.current.locked).toBe(false);

    mockIsAvailable.mockRejectedValue(new Error('native module error'));

    await act(async () => {
      appStateListener?.('background');
      await Promise.resolve();
    });
    await act(async () => {
      appStateListener?.('active');
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.locked).toBe(true));
  });
});
