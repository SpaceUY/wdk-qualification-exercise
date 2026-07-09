import { useCallback } from 'react';
import { exchangeCodeAsync } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';

export function useGoogleAuth(): { signIn: () => Promise<string | null> } {
  const [request, , promptAsync] = Google.useAuthRequest({
    androidClientId: CLIENT_ID,
    scopes: ['https://www.googleapis.com/auth/drive.appdata'],
  });

  const signIn = useCallback(async (): Promise<string | null> => {
    const result = await promptAsync();
    if (result?.type !== 'success') return null;
    if (result.authentication?.accessToken) return result.authentication.accessToken;

    // Android uses the authorization-code flow, so the redirect only carries a code —
    // the token exchange never happens inside promptAsync and must be done here.
    const code = result.params?.code;
    if (!code || !request) return null;
    const tokens = await exchangeCodeAsync(
      {
        clientId: CLIENT_ID,
        redirectUri: request.redirectUri,
        code,
        extraParams: { code_verifier: request.codeVerifier ?? '' },
      },
      Google.discovery,
    );
    return tokens.accessToken ?? null;
  }, [promptAsync, request]);

  return { signIn };
}
