type StorageValue = string | number | boolean | ArrayBuffer;

function createMockMMKVInstance(id: string) {
  const store = new Map<string, StorageValue>();
  return {
    id,
    get size() { return store.size; },
    isReadOnly: false,
    isEncrypted: false,
    clearAll: () => store.clear(),
    remove: (key: string) => { store.delete(key); },
    set: (key: string, value: StorageValue) => { store.set(key, value); },
    getString: (key: string): string | undefined => {
      const v = store.get(key);
      return typeof v === 'string' ? v : undefined;
    },
    getNumber: (key: string): number | undefined => {
      const v = store.get(key);
      return typeof v === 'number' ? v : undefined;
    },
    getBoolean: (key: string): boolean | undefined => {
      const v = store.get(key);
      return typeof v === 'boolean' ? v : undefined;
    },
    getBuffer: (key: string): ArrayBuffer | undefined => {
      const v = store.get(key);
      return v instanceof ArrayBuffer ? v : undefined;
    },
    getAllKeys: (): string[] => Array.from(store.keys()),
    contains: (key: string): boolean => store.has(key),
    addOnValueChangedListener: (_listener: (key: string) => void) => ({ remove: () => {} }),
    recrypt: () => {},
    trim: () => {},
    dispose: () => {},
  };
}

export const createMMKV = jest.fn((config?: { id?: string }) =>
  createMockMMKVInstance(config?.id ?? 'mmkv.default'),
);

export const existsMMKV = jest.fn((_id: string) => false);
export const deleteMMKV = jest.fn((_id: string) => {});
export const useMMKVString = jest.fn();
export const useMMKVNumber = jest.fn();
export const useMMKVBoolean = jest.fn();
export const useMMKVObject = jest.fn();
export const useMMKVListener = jest.fn();
export const useMMKVKeys = jest.fn();
