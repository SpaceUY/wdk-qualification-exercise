import { renderHook, act } from '@testing-library/react-native';

describe('useGoogleAuth (iOS stub)', () => {
  it('signIn always resolves to null', async () => {
    const { useGoogleAuth } = require('@/hooks/useGoogleAuth');
    const { signIn } = useGoogleAuth();
    await expect(signIn()).resolves.toBeNull();
  });
});

describe('useGoogleAuth (Android)', () => {
  const mockPromptAsync = jest.fn();
  const mockExchangeCodeAsync = jest.fn();
  const mockRequest = { redirectUri: 'com.space.utl:/oauthredirect', codeVerifier: 'pkce-verifier' };

  jest.mock('expo-web-browser', () => ({
    maybeCompleteAuthSession: jest.fn(),
  }));

  jest.mock('expo-auth-session/providers/google', () => ({
    useAuthRequest: jest.fn(() => [mockRequest, null, mockPromptAsync]),
    discovery: { tokenEndpoint: 'https://oauth2.googleapis.com/token' },
  }));

  jest.mock('expo-auth-session', () => ({
    exchangeCodeAsync: (...args: unknown[]) => mockExchangeCodeAsync(...args),
  }));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when the Google prompt is dismissed', async () => {
    mockPromptAsync.mockResolvedValueOnce({ type: 'dismiss' });

    const { useGoogleAuth } = require('@/hooks/useGoogleAuth.android');
    const { result } = await renderHook(() => useGoogleAuth());

    const token = await act(() => result.current.signIn());

    expect(token).toBeNull();
    expect(mockExchangeCodeAsync).not.toHaveBeenCalled();
  });

  it('exchanges the auth code for an access token (code flow redirect has no access_token)', async () => {
    mockPromptAsync.mockResolvedValueOnce({
      type: 'success',
      params: { code: 'auth-code-123' },
      authentication: null,
    });
    mockExchangeCodeAsync.mockResolvedValueOnce({ accessToken: 'google-access-token' });

    const { useGoogleAuth } = require('@/hooks/useGoogleAuth.android');
    const { result } = await renderHook(() => useGoogleAuth());

    const token = await act(() => result.current.signIn());

    expect(token).toBe('google-access-token');
    expect(mockExchangeCodeAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'auth-code-123',
        redirectUri: 'com.space.utl:/oauthredirect',
        extraParams: { code_verifier: 'pkce-verifier' },
      }),
      expect.anything(),
    );
  });

  it('rejects when the code exchange fails so callers treat it as an error, not a cancel', async () => {
    mockPromptAsync.mockResolvedValueOnce({
      type: 'success',
      params: { code: 'auth-code-123' },
      authentication: null,
    });
    mockExchangeCodeAsync.mockRejectedValueOnce(new Error('exchange failed'));

    const { useGoogleAuth } = require('@/hooks/useGoogleAuth.android');
    const { result } = await renderHook(() => useGoogleAuth());

    await expect(act(() => result.current.signIn())).rejects.toThrow('exchange failed');
  });
});
