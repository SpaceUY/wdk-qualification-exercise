import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useBiometrics } from './useBiometrics';
import { useAuthStore } from '@/stores/authStore';
import { useAppLockStore } from '@/stores/appLockStore';

export function useAppLockBiometrics(): {
  locked: boolean;
  unlock: () => Promise<void>;
  verifying: boolean;
} {
  const userId = useAuthStore((s) => s.userId);
  const { isAvailable, authenticate } = useBiometrics();
  const locked = useAppLockStore((s) => s.locked);
  const setLocked = useAppLockStore((s) => s.setLocked);
  const setChecked = useAppLockStore((s) => s.setChecked);
  const [verifying, setVerifying] = useState(false);
  const wentToBackgroundRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      setChecked(true);
      setLocked(false);
      return;
    }

    setChecked(false);
    isAvailable()
      .then((available) => {
        setLocked(available);
        setChecked(true);
      })
      .catch(() => {
        setLocked(true);
        setChecked(true);
      });

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        wentToBackgroundRef.current = true;
      }

      // Only treat this as "returning from background" if the app actually
      // backgrounded. Native system dialogs (e.g. Face ID/Touch ID prompts -
      // including the WDK SDK's own biometric prompt for wallet unlock) also
      // drive AppState through active -> inactive -> active without ever
      // reaching 'background', and must not re-trigger the lock screen.
      const comingToForeground = wentToBackgroundRef.current && nextState === 'active';

      if (comingToForeground && userId) {
        wentToBackgroundRef.current = false;
        isAvailable()
          .then((available) => {
            if (available) setLocked(true);
          })
          .catch(() => setLocked(true));
      }
    });

    return () => subscription.remove();
  }, [userId]);

  async function unlock(): Promise<void> {
    if (verifying) return;
    setVerifying(true);
    try {
      const granted = await authenticate('Authenticate to open Wallet');
      if (granted) setLocked(false);
    } finally {
      setVerifying(false);
    }
  }

  return { locked, unlock, verifying };
}
