import type { MMKV } from 'react-native-mmkv';
import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type WalletOnboardingStore = {
  walletOnboardingCompleted: boolean;
  shouldShowOnboarding: boolean;
  shouldPromptMnemonic: boolean;
  setWalletOnboardingCompleted: (v: boolean) => void;
  setShouldShowOnboarding: (v: boolean) => void;
  setShouldPromptMnemonic: (v: boolean) => void;
  resetStore: () => void;
};

// Lazy init so createMMKV() is never called at module import time.
// Expo Router eagerly imports all route modules before native modules are ready.
let _instance: MMKV | null = null;
function getInstance(): MMKV {
  if (!_instance) {
    _instance = createMMKV({ id: 'wallet-onboarding' });
  }
  return _instance;
}

const storage = {
  getItem: (name: string) => getInstance().getString(name) ?? null,
  setItem: (name: string, value: string) => getInstance().set(name, value),
  removeItem: (name: string) => getInstance().remove(name),
};

export const useWalletOnboardingStore = create<WalletOnboardingStore>()(
  persist(
    (set) => ({
      walletOnboardingCompleted: false,
      shouldShowOnboarding: false,
      shouldPromptMnemonic: false,
      setWalletOnboardingCompleted: (v) => set({ walletOnboardingCompleted: v }),
      setShouldShowOnboarding: (v) => set({ shouldShowOnboarding: v }),
      setShouldPromptMnemonic: (v) => set({ shouldPromptMnemonic: v }),
      resetStore: () =>
        set({
          walletOnboardingCompleted: false,
          shouldShowOnboarding: false,
          shouldPromptMnemonic: false,
        }),
    }),
    {
      name: 'wallet-onboarding',
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({
        walletOnboardingCompleted: state.walletOnboardingCompleted,
      }),
    },
  ),
);
