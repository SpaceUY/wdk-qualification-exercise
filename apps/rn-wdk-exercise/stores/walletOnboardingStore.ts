import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createMMKVStorage } from '@/stores/mmkvStorage';

export type WalletOnboardingStore = {
  walletOnboardingCompleted: boolean;
  shouldShowOnboarding: boolean;
  shouldPromptMnemonic: boolean;
  setWalletOnboardingCompleted: (v: boolean) => void;
  setShouldShowOnboarding: (v: boolean) => void;
  setShouldPromptMnemonic: (v: boolean) => void;
  resetStore: () => void;
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
      storage: createJSONStorage(() => createMMKVStorage('wallet-onboarding')),
      partialize: (state) => ({
        walletOnboardingCompleted: state.walletOnboardingCompleted,
      }),
    },
  ),
);
