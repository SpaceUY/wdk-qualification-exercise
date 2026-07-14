import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createMMKVStorage } from '@/stores/mmkvStorage';

type SettingsStore = {
  // Privacy mode: masks every amount in the app (hero, rows, history), not just
  // the dashboard total. Read it wherever an AmountText renders.
  isBalanceHidden: boolean;
  toggleBalanceHidden: () => void;
  // One-time onboarding gate — app/index.tsx redirects to (onboarding) until set.
  hasSeenOnboarding: boolean;
  setOnboardingSeen: () => void;
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      isBalanceHidden: false,
      toggleBalanceHidden: () => set((state) => ({ isBalanceHidden: !state.isBalanceHidden })),
      hasSeenOnboarding: false,
      setOnboardingSeen: () => set({ hasSeenOnboarding: true }),
    }),
    {
      name: 'settings-store',
      storage: createJSONStorage(() => createMMKVStorage('settings-store')),
      partialize: (state) => ({
        isBalanceHidden: state.isBalanceHidden,
        hasSeenOnboarding: state.hasSeenOnboarding,
      }),
    },
  ),
);
