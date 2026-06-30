import { useEffect } from 'react';
import { Alert } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '@/stores/authStore';

WebBrowser.maybeCompleteAuthSession();

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const DOMAIN = process.env.EXPO_PUBLIC_COGNITO_DOMAIN ?? '';
const CLIENT_ID = process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID ?? '';

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: `${DOMAIN}/oauth2/authorize`,
  tokenEndpoint: `${DOMAIN}/oauth2/token`,
  revocationEndpoint: `${DOMAIN}/oauth2/revoke`,
};

export function useCognito(): { promptAsync: () => Promise<void>, ready: boolean } {
  const setUserId = useAuthStore((s) => s.setUserId);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'rn-wdk-exercise' });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID,
      redirectUri,
      scopes: ['openid', 'email', 'profile'],
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    discovery,
  );

  useEffect(() => {
    if (response?.type !== 'success' || !request?.codeVerifier) return;

    AuthSession.exchangeCodeAsync(
      {
        clientId: CLIENT_ID,
        redirectUri,
        code: response.params.code,
        extraParams: { code_verifier: request.codeVerifier },
      },
      discovery,
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
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Sign-in failed. Please try again.';
        Alert.alert('Sign-in Error', message);
      });
  }, [response]);

  return { promptAsync: async () => { await promptAsync(); }, ready: !!request };
}
