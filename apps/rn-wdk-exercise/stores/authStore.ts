import type { MMKV } from 'react-native-mmkv';
import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type AuthStore = {
  userId: string | null;
  accessToken: string | null;
  setUserId: (id: string) => void;
  setAccessToken: (token: string) => void;
  clear: () => void;
};

let _instance: MMKV | null = null;
function getInstance(): MMKV {
  if (!_instance) {
    _instance = createMMKV({ id: 'auth-store' });
  }
  return _instance;
}

const storage = {
  getItem: (name: string) => getInstance().getString(name) ?? null,
  setItem: (name: string, value: string) => getInstance().set(name, value),
  removeItem: (name: string) => getInstance().remove(name),
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      userId: null,
      accessToken: null,
      setUserId: (id) => set({ userId: id }),
      setAccessToken: (token) => set({ accessToken: token }),
      clear: () => set({ userId: null, accessToken: null }),
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({ userId: state.userId, accessToken: state.accessToken }),
    },
  ),
);
