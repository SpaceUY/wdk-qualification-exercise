import { useCallback } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuth(): { signIn: () => Promise<string | null> } {
  const [, , promptAsync] = Google.useAuthRequest({
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    scopes: ['https://www.googleapis.com/auth/drive.appdata'],
  });

  const signIn = useCallback(async (): Promise<string | null> => {
    const result = await promptAsync();
    if (result?.type === 'success') {
      return result.authentication?.accessToken ?? null;
    }
    return null;
  }, [promptAsync]);

  return { signIn };
}
