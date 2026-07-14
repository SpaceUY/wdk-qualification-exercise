import * as SecureStore from 'expo-secure-store';
import { createSecureStorage } from '../../stores/secureStorage';

// __resetSecureStore is a test-only helper on the Jest mock
// (__mocks__/expo-secure-store.ts). Import the module the same (ESM) way the
// production code does so both share one in-memory store instance.
const { __resetSecureStore } = SecureStore as unknown as { __resetSecureStore: () => void };

describe('createSecureStorage', () => {
  const storage = createSecureStorage();

  beforeEach(() => {
    __resetSecureStore();
  });

  it('returns null for a missing key', async () => {
    expect(await storage.getItem('auth-store')).toBeNull();
  });

  it('stores and reads a small value under a single key (no chunking)', async () => {
    await storage.setItem('auth-store', '{"userId":"a@b.com"}');
    expect(await storage.getItem('auth-store')).toBe('{"userId":"a@b.com"}');
    // Stored directly, no chunk header, no chunk keys.
    expect(await SecureStore.getItemAsync('auth-store')).toBe('{"userId":"a@b.com"}');
    expect(await SecureStore.getItemAsync('auth-store.0')).toBeNull();
  });

  it('chunks a large value and reads it back identically', async () => {
    const big = 'x'.repeat(5000); // > MAX_CHUNK (1800) → 3 chunks
    await storage.setItem('auth-store', big);
    // Base key holds the header; the payload lives in chunk keys.
    expect(await SecureStore.getItemAsync('auth-store')).toBe('__CHUNKED__:3');
    expect(await SecureStore.getItemAsync('auth-store.0')).toHaveLength(1800);
    expect(await SecureStore.getItemAsync('auth-store.2')).not.toBeNull();
    // Round-trips to the original value.
    expect(await storage.getItem('auth-store')).toBe(big);
  });

  it('returns null when a chunk is missing (corrupt/partial write)', async () => {
    const big = 'y'.repeat(5000);
    await storage.setItem('auth-store', big);
    await SecureStore.deleteItemAsync('auth-store.1'); // drop a middle chunk
    expect(await storage.getItem('auth-store')).toBeNull();
  });

  it('removes a small value', async () => {
    await storage.setItem('auth-store', 'small');
    await storage.removeItem('auth-store');
    expect(await storage.getItem('auth-store')).toBeNull();
  });

  it('removes all chunks of a chunked value', async () => {
    const big = 'z'.repeat(5000);
    await storage.setItem('auth-store', big);
    await storage.removeItem('auth-store');
    expect(await SecureStore.getItemAsync('auth-store')).toBeNull();
    expect(await SecureStore.getItemAsync('auth-store.0')).toBeNull();
    expect(await SecureStore.getItemAsync('auth-store.1')).toBeNull();
    expect(await SecureStore.getItemAsync('auth-store.2')).toBeNull();
  });
});
