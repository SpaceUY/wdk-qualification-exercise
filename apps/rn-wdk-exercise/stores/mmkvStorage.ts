import type { MMKV } from 'react-native-mmkv';
import { createMMKV } from 'react-native-mmkv';

// Shared zustand persist adapter backed by MMKV, one instance per store `id`.
// Lazy init: createMMKV() is deferred to first access, since Expo Router eagerly
// imports every route module before native modules are guaranteed ready.
// (The auth session does NOT use this — it lives in secure storage; see
// stores/secureStorage.ts.)
export function createMMKVStorage(id: string) {
  let instance: MMKV | null = null;
  const getInstance = (): MMKV => (instance ??= createMMKV({ id }));
  return {
    getItem: (name: string) => getInstance().getString(name) ?? null,
    setItem: (name: string, value: string) => getInstance().set(name, value),
    removeItem: (name: string) => getInstance().remove(name),
  };
}
