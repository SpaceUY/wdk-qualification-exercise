import * as SecureStore from 'expo-secure-store';

// Async StateStorage adapter for zustand persist, backed by the OS Keychain
// (iOS) / Keystore (Android). Used for at-rest protection of the auth session —
// unlike the MMKV adapter (stores/mmkvStorage.ts), values here never touch a
// plaintext file on disk. One SecureStore entry per store `name`.
export function createSecureStorage() {
  return {
    getItem: (name: string): Promise<string | null> => SecureStore.getItemAsync(name),
    setItem: (name: string, value: string): Promise<void> => SecureStore.setItemAsync(name, value),
    removeItem: (name: string): Promise<void> => SecureStore.deleteItemAsync(name),
  };
}
