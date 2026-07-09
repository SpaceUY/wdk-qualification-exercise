import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useBiometrics } from './useBiometrics';
import { useWalletData } from './useWalletData';
import { useAuthStore } from '@/stores/authStore';
import { useAppLockStore } from '@/stores/appLockStore';

// How long the app may sit in the background before returning to the foreground
// requires re-authentication. Short absences (copying a code, sharing, using the
// camera) must not force another biometric prompt; a wallet left in the background
// for longer must not stay open indefinitely.
export const RELOCK_GRACE_MS = 10 * 60 * 1000;

export function useAppLockBiometrics(): {
  locked: boolean;
  unlock: () => Promise<void>;
  verifying: boolean;
} {
  const userId = useAuthStore((s) => s.userId);
  const { isAvailable, authenticate } = useBiometrics();
  const { hasLocalWallet } = useWalletData();
  const locked = useAppLockStore((s) => s.locked);
  const setLocked = useAppLockStore((s) => s.setLocked);
  const setChecked = useAppLockStore((s) => s.setChecked);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!userId) {
      setChecked(true);
      setLocked(false);
      return;
    }

    // The one place the lock decision is made — at process launch and again when
    // returning to the foreground past the grace period. Only first-time signups
    // (no local wallet yet) skip the lock: WDK's own creation-time biometric prompt
    // already gates them, so an app-level lock screen would just be a second,
    // redundant prompt in front of it. Fails closed: if availability can't be
    // determined, lock.
    const applyLockDecision = () => {
      Promise.all([isAvailable(), hasLocalWallet(userId)])
        .then(([available, hasWallet]) => {
          setLocked(available && hasWallet);
          setChecked(true);
        })
        .catch(() => {
          setLocked(true);
          setChecked(true);
        });
    };

    setChecked(false);
    applyLockDecision();

    // Only 'background' arms the re-lock timer. Native system dialogs (Face ID /
    // Touch ID sheets, including the WDK SDK's own wallet-unlock prompt) drive
    // AppState through active -> inactive -> active without ever reaching
    // 'background', and must not re-trigger the lock screen.
    let backgroundedAt: number | null = null;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        backgroundedAt = Date.now();
        return;
      }
      if (nextState === 'active' && backgroundedAt != null) {
        const elapsed = Date.now() - backgroundedAt;
        backgroundedAt = null;
        if (elapsed >= RELOCK_GRACE_MS) applyLockDecision();
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
