export function useGoogleAuth(): { signIn: () => Promise<string | null> } {
  return { signIn: async () => null };
}
