import { useCallback, useEffect, useRef, useState } from 'react';
import { useWdkApp } from '@tetherto/wdk-react-native-core';
import { useWalletData } from '@/hooks/useWalletData';
import { useWalletOnboardingStore } from '@/stores/walletOnboardingStore';
import { useAppLockStore } from '@/stores/appLockStore';
import { getWalletBackupExists } from '@/utils/api';

type BootstrapStatus = 'idle' | 'loading' | 'ready' | 'needs-cloud-restore' | 'error';

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
          // No local wallet. If the backend already holds an encrypted backup for this
          // user, silently creating a fresh seed here would orphan their registered
          // address forever (the server refuses address updates once set) — so hand off
          // to the explicit "Restore from Cloud Backup" flow instead, which asks for the
          // backup passphrase this background effect can't supply. Only when the backend
          // confirms there is no backup do we auto-create a fresh wallet.
          const backupExists = await getWalletBackupExists();
          if (backupExists) {
            setStatus('needs-cloud-restore');
            return;
          }
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
