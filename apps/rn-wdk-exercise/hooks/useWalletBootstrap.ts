import { useCallback, useEffect, useRef, useState } from 'react';
import { useWdkApp } from '@tetherto/wdk-react-native-core';
import { useWalletData } from '@/hooks/useWalletData';
import { useWalletOnboardingStore } from '@/stores/walletOnboardingStore';
import { useAppLockStore } from '@/stores/appLockStore';

type BootstrapStatus = 'idle' | 'loading' | 'ready' | 'error';

export function useWalletBootstrap(userId: string | null): {
  status: BootstrapStatus;
  error: string | null;
  retry: () => void;
} {
  const { workletState } = useWdkApp();
  const { unlock, hasLocalWallet, createWallet, setActiveWalletId } = useWalletData();
  const setWalletOnboardingCompleted = useWalletOnboardingStore(
    (s) => s.setWalletOnboardingCompleted,
  );
  // WDK's own secure-storage unlock only re-prompts for biometrics when its internal cache
  // is cold - it can silently skip the OS prompt on a later call within the same process.
  // Waiting for the app's own biometric gate here means our lock screen is always the single
  // source of truth for "did the user just prove presence", instead of racing WDK's prompt
  // (or riding along on whatever it happens to have cached).
  const appLockChecked = useAppLockStore((s) => s.checked);
  const appLocked = useAppLockStore((s) => s.locked);

  const [status, setStatus] = useState<BootstrapStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const bootstrapRan = useRef(false);
  const opInProgress = useRef(false);

  const runBootstrap = useCallback(
    async (walletId: string) => {
      if (opInProgress.current) return;
      opInProgress.current = true;
      setStatus('loading');
      setError(null);

      try {
        const hasWallet = await hasLocalWallet(walletId);

        if (hasWallet) {
          // Fast path: wallet exists on-device
          setActiveWalletId(walletId);
          await unlock(walletId);
        } else {
          // No local wallet: always create a fresh one. Restoring from an existing cloud
          // backup now requires a user-supplied passphrase (see utils/seedEncryption.ts),
          // which isn't available inside this background bootstrap effect — restoring
          // from a cloud backup is something the user does explicitly, via the
          // "Restore from Cloud Backup" screen.
          await createWallet(walletId);
          setWalletOnboardingCompleted(false);
        }

        setStatus('ready');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setStatus('error');
      } finally {
        opInProgress.current = false;
      }
    },
    [hasLocalWallet, unlock, createWallet, setActiveWalletId, setWalletOnboardingCompleted],
  );

  useEffect(() => {
    if (!userId || bootstrapRan.current) return;
    if (!workletState.isReady) return;
    if (!appLockChecked || appLocked) return;
    bootstrapRan.current = true;
    runBootstrap(userId);
  }, [userId, runBootstrap, workletState.isReady, appLockChecked, appLocked]);

  const retry = useCallback(() => {
    bootstrapRan.current = false;
    if (userId) {
      bootstrapRan.current = true;
      runBootstrap(userId);
    }
  }, [userId, runBootstrap]);

  return { status, error, retry };
}
