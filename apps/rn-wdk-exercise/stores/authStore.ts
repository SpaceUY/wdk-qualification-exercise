import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createSecureStorage } from '@/stores/secureStorage';

type AuthStore = {
  userId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  // False until persisted state has been read back from SecureStore (async).
  // Readers that redirect on `userId` must wait for this to avoid a login flash.
  _hasHydrated: boolean;
  setUserId: (id: string) => void;
  setAccessToken: (token: string) => void;
  setRefreshToken: (token: string | null) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      userId: null,
      accessToken: null,
      refreshToken: null,
      _hasHydrated: false,
      setUserId: (id) => set({ userId: id }),
      setAccessToken: (token) => set({ accessToken: token }),
      setRefreshToken: (token) => set({ refreshToken: token }),
      clear: () => set({ userId: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => createSecureStorage()),
      partialize: (state) => ({
        userId: state.userId,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ _hasHydrated: true });
      },
    },
  ),
);
