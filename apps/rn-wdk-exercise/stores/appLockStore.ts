import { create } from 'zustand';

type AppLockStore = {
  locked: boolean;
  checked: boolean;
  setLocked: (locked: boolean) => void;
  setChecked: (checked: boolean) => void;
};

// Not persisted: every app process launch must re-run the biometric-availability check and
// re-lock from scratch, independent of whatever WDK's own secure storage happens to cache.
export const useAppLockStore = create<AppLockStore>((set) => ({
  locked: false,
  checked: false,
  setLocked: (locked) => set({ locked }),
  setChecked: (checked) => set({ checked }),
}));
