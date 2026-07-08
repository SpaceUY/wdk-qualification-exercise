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

  jest.mock('expo-web-browser', () => ({
    maybeCompleteAuthSession: jest.fn(),
  }));

  jest.mock('expo-auth-session/providers/google', () => ({
    useAuthRequest: jest.fn(() => [{}, null, mockPromptAsync]),
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
  });

  it('returns the access token when the Google prompt succeeds', async () => {
    mockPromptAsync.mockResolvedValueOnce({
      type: 'success',
      authentication: { accessToken: 'google-access-token' },
    });

    const { useGoogleAuth } = require('@/hooks/useGoogleAuth.android');
    const { result } = await renderHook(() => useGoogleAuth());

    const token = await act(() => result.current.signIn());

    expect(token).toBe('google-access-token');
  });
});
