// In-memory mock of expo-secure-store for Jest — mirrors __mocks__/react-native-mmkv.ts.
// Async APIs resolve immediately so zustand persist hydration completes within a tick.
const store = new Map<string, string>();

export async function getItemAsync(key: string): Promise<string | null> {
  return store.has(key) ? (store.get(key) as string) : null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  store.set(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  store.delete(key);
}

// Test helper — not part of the real module surface; lets tests reset between cases.
export function __resetSecureStore(): void {
  store.clear();
}
