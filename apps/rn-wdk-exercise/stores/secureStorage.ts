import * as SecureStore from 'expo-secure-store';

// Async StateStorage adapter for zustand persist, backed by the OS Keychain
// (iOS) / Keystore (Android). Used for at-rest protection of the auth session --
// unlike the MMKV adapter (stores/mmkvStorage.ts), values here never touch a
// plaintext file on disk. One logical entry per store `name`.
//
// Chunking: expo-secure-store warns (and on Android can fail) for values over
// ~2 KB. A persisted auth blob (userId + Cognito idToken + refreshToken) can
// exceed that, so values larger than MAX_CHUNK are split across `${name}.<i>`
// entries with a small header under `name`. Small values are stored directly, so
// existing single-key data keeps reading. This is transparent to callers.
const MAX_CHUNK = 1800;
// Sentinel header marking a chunked value; persisted zustand state is a JSON
// object starting with '{', so this prefix can never collide with a real value.
const CHUNK_HEADER = '__CHUNKED__:';

export function createSecureStorage() {
  return {
    getItem: async (name: string): Promise<string | null> => {
      const head = await SecureStore.getItemAsync(name);
      if (head === null || !head.startsWith(CHUNK_HEADER)) return head;
      const count = Number(head.slice(CHUNK_HEADER.length));
      const parts: string[] = [];
      for (let i = 0; i < count; i++) {
        const part = await SecureStore.getItemAsync(`${name}.${i}`);
        // A missing chunk means partially-written/corrupt state; treat as absent.
        if (part === null) return null;
        parts.push(part);
      }
      return parts.join('');
    },
    setItem: async (name: string, value: string): Promise<void> => {
      if (value.length <= MAX_CHUNK) {
        await SecureStore.setItemAsync(name, value);
        return;
      }
      const chunks: string[] = [];
      for (let i = 0; i < value.length; i += MAX_CHUNK) {
        chunks.push(value.slice(i, i + MAX_CHUNK));
      }
      await Promise.all(chunks.map((c, i) => SecureStore.setItemAsync(`${name}.${i}`, c)));
      // Write the header last so a reader never sees a header pointing at
      // not-yet-written chunks.
      await SecureStore.setItemAsync(name, `${CHUNK_HEADER}${chunks.length}`);
    },
    removeItem: async (name: string): Promise<void> => {
      const head = await SecureStore.getItemAsync(name);
      await SecureStore.deleteItemAsync(name);
      if (head !== null && head.startsWith(CHUNK_HEADER)) {
        const count = Number(head.slice(CHUNK_HEADER.length));
        await Promise.all(
          Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${name}.${i}`)),
        );
      }
    },
  };
}
