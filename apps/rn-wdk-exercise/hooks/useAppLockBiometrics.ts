import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useBiometrics } from './useBiometrics';
import { useAuthStore } from '@/stores/authStore';

export function useAppLockBiometrics(): {
  locked: boolean;
  unlock: () => Promise<void>;
  verifying: boolean;
} {
  const userId = useAuthStore((s) => s.userId);
  const { isAvailable, authenticate } = useBiometrics();
  const [locked, setLocked] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!userId) return;

    isAvailable().then((available) => {
      if (available) setLocked(true);
    });

    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      const comingToForeground =
        (previousState === 'inactive' || previousState === 'background') &&
        nextState === 'active';

      if (comingToForeground && userId) {
        isAvailable().then((available) => {
          if (available) setLocked(true);
        });
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
