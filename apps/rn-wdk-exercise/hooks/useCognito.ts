import { useEffect } from 'react';
import { Alert } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '@/stores/authStore';
import { COGNITO_CLIENT_ID, COGNITO_DOMAIN, cognitoDiscovery } from '@/config/cognito';

WebBrowser.maybeCompleteAuthSession();

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function useCognito(): { promptAsync: () => Promise<void>, ready: boolean } {
  const setUserId = useAuthStore((s) => s.setUserId);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setRefreshToken = useAuthStore((s) => s.setRefreshToken);

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'space-utl' });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: COGNITO_CLIENT_ID,
      redirectUri,
      scopes: ['openid', 'email', 'profile'],
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    cognitoDiscovery,
  );

  useEffect(() => {
    if (response?.type !== 'success' || !request?.codeVerifier) return;

    AuthSession.exchangeCodeAsync(
      {
        clientId: COGNITO_CLIENT_ID,
        redirectUri,
        code: response.params.code,
        extraParams: { code_verifier: request.codeVerifier },
      },
      cognitoDiscovery,
    )
      .then((tokenResult) => {
        const idToken = tokenResult.idToken;
        if (!idToken) return;
        const payload = decodeJwtPayload(idToken);
        const email = payload.email;
        if (typeof email !== 'string' || !email) {
          Alert.alert('Sign-in Error', 'Your account does not have a verified email address.');
          return;
        }
        setUserId(email);
        setAccessToken(idToken);
        setRefreshToken(tokenResult.refreshToken ?? null);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Sign-in failed. Please try again.';
        Alert.alert('Sign-in Error', message);
      });
  }, [response]);

  return { promptAsync: async () => { await promptAsync(); }, ready: !!request };
}

// Logging out locally only clears this app's own tokens - Cognito's Hosted UI keeps its own
// browser session cookie alive, and the refresh token stays valid server-side until revoked.
// Without this, a later login can silently resume the old session instead of prompting again.
export async function signOutFromCognito(): Promise<void> {
  const { refreshToken } = useAuthStore.getState();
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'space-utl' });

  if (refreshToken) {
    try {
      await AuthSession.revokeAsync({ clientId: COGNITO_CLIENT_ID, token: refreshToken }, cognitoDiscovery);
    } catch {
      // Refresh token may already be expired/revoked - nothing more to do server-side.
    }
  }

  try {
    const logoutUrl = `${COGNITO_DOMAIN}/logout?client_id=${COGNITO_CLIENT_ID}&logout_uri=${encodeURIComponent(redirectUri)}`;
    await WebBrowser.openAuthSessionAsync(logoutUrl, redirectUri);
  } catch {
    // Hosted UI logout is best-effort - local state is cleared by the caller regardless.
  }
}
