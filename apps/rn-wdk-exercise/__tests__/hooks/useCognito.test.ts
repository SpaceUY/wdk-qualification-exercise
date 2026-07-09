import { renderHook, act } from '@testing-library/react-native';
import { useCognito, signOutFromCognito } from '@/hooks/useCognito';
import { useAuthStore } from '@/stores/authStore';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn().mockResolvedValue({ type: 'dismiss' }),
}));

jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'space-utl://'),
  useAuthRequest: jest.fn(() => [
    { codeVerifier: 'pkce-verifier-123' },
    null,
    jest.fn().mockResolvedValue({ type: 'success' }),
  ]),
  exchangeCodeAsync: jest.fn(),
  revokeAsync: jest.fn().mockResolvedValue(true),
  ResponseType: { Code: 'code' },
}));

beforeEach(() => {
  useAuthStore.getState().clear();
  jest.clearAllMocks();
});

describe('useCognito', () => {
  it('returns ready=true when request exists', async () => {
    const { result } = await renderHook(() => useCognito());
    expect(result.current.ready).toBe(true);
  });

  it('returns ready=false when request is null', async () => {
    (AuthSession.useAuthRequest as jest.Mock).mockReturnValueOnce([null, null, jest.fn()]);
    const { result } = await renderHook(() => useCognito());
    expect(result.current.ready).toBe(false);
  });

  it('stores email and idToken after successful code exchange', async () => {
    const fakeIdToken = [
      Buffer.from('{}').toString('base64'),
      Buffer.from(JSON.stringify({ email: 'alice@example.com', sub: 'cognito-sub-1' })).toString('base64url'),
      'sig',
    ].join('.');

    (AuthSession.useAuthRequest as jest.Mock).mockReturnValue([
      { codeVerifier: 'pkce-verifier-123' },
      { type: 'success', params: { code: 'auth-code-xyz' } },
      jest.fn(),
    ]);
    (AuthSession.exchangeCodeAsync as jest.Mock).mockResolvedValue({ idToken: fakeIdToken });

    renderHook(() => useCognito());

    // Wait for the useEffect to run the exchange
    await act(async () => {
      await Promise.resolve();
    });

    expect(AuthSession.exchangeCodeAsync).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'auth-code-xyz', extraParams: { code_verifier: 'pkce-verifier-123' } }),
      expect.any(Object),
    );
    expect(useAuthStore.getState().userId).toBe('alice@example.com');
    expect(useAuthStore.getState().accessToken).toBe(fakeIdToken);
  });

  it('does nothing if response type is not success', async () => {
    (AuthSession.useAuthRequest as jest.Mock).mockReturnValue([
      { codeVerifier: 'pkce-verifier-123' },
      { type: 'cancel' },
      jest.fn(),
    ]);

    renderHook(() => useCognito());
    await act(async () => { await Promise.resolve(); });

    expect(AuthSession.exchangeCodeAsync).not.toHaveBeenCalled();
    expect(useAuthStore.getState().userId).toBeNull();
  });
});

describe('signOutFromCognito', () => {
  it('revokes the refresh token and opens the Hosted UI logout endpoint', async () => {
    useAuthStore.getState().setRefreshToken('refresh-token-123');

    await signOutFromCognito();

    expect(AuthSession.revokeAsync).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'refresh-token-123' }),
      expect.any(Object),
    );
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
      expect.stringContaining('/logout?client_id='),
      'space-utl://',
    );
  });

  it('skips revocation but still opens the Hosted UI logout endpoint when there is no refresh token', async () => {
    useAuthStore.getState().setRefreshToken(null);

    await signOutFromCognito();

    expect(AuthSession.revokeAsync).not.toHaveBeenCalled();
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalled();
  });

  it('does not throw when revocation fails', async () => {
    useAuthStore.getState().setRefreshToken('refresh-token-123');
    (AuthSession.revokeAsync as jest.Mock).mockRejectedValueOnce(new Error('revoke failed'));

    await expect(signOutFromCognito()).resolves.toBeUndefined();
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalled();
  });

  it('does not throw when the Hosted UI logout fails to open', async () => {
    useAuthStore.getState().setRefreshToken('refresh-token-123');
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockRejectedValueOnce(new Error('browser failed'));

    await expect(signOutFromCognito()).resolves.toBeUndefined();
  });
});
