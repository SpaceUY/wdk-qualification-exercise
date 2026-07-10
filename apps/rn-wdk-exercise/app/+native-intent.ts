// Google's Android OAuth redirect (hooks/useGoogleAuth.android.ts) lands on
// `space-utl://oauthredirect?state=...`. expo-web-browser's openAuthSessionAsync()
// already resolves the pending sign-in promise from that same incoming URL — the router
// must not ALSO treat it as a route (it has no screen and would show "Unmatched Route").
// Returning a falsy path suppresses navigation entirely: expo-router guards both the
// warm-link listener and the cold-start initial URL with `if (href)` before navigating,
// so the app stays where it was (warm) or opens at its normal initial route (cold).
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (path.includes('oauthredirect')) return '';
  return path;
}
