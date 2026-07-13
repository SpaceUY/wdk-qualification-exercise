import type { MMKV } from 'react-native-mmkv';
import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type SettingsStore = {
  // Privacy mode: masks every amount in the app (hero, rows, history), not just
  // the dashboard total. Read it wherever an AmountText renders.
  isBalanceHidden: boolean;
  toggleBalanceHidden: () => void;
  // One-time onboarding gate — app/index.tsx redirects to (onboarding) until set.
  hasSeenOnboarding: boolean;
  setOnboardingSeen: () => void;
};

let _instance: MMKV | null = null;
function getInstance(): MMKV {
  if (!_instance) {
    _instance = createMMKV({ id: 'settings-store' });
  }
  return _instance;
}

const storage = {
  getItem: (name: string) => getInstance().getString(name) ?? null,
  setItem: (name: string, value: string) => getInstance().set(name, value),
  removeItem: (name: string) => getInstance().remove(name),
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
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({
        isBalanceHidden: state.isBalanceHidden,
        hasSeenOnboarding: state.hasSeenOnboarding,
      }),
    },
  ),
);
