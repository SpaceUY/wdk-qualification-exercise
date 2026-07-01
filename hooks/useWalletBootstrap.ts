import { useCallback, useEffect, useRef, useState } from 'react';
import { useWdkApp } from '@tetherto/wdk-react-native-core';
import { useWalletData } from '@/hooks/useWalletData';
import { useWalletOnboardingStore } from '@/stores/walletOnboardingStore';
import { createCloudBackup, restoreFromCloudBackup } from '@/utils/cloudBackup';

type BootstrapStatus = 'idle' | 'loading' | 'ready' | 'error';

export function useWalletBootstrap(userId: string | null): {
  status: BootstrapStatus;
  error: string | null;
  retry: () => void;
} {
  const { workletState } = useWdkApp();
  const { unlock, hasLocalWallet, createWallet, setActiveWalletId, getMnemonic, restoreWallet } =
    useWalletData();
  const setWalletOnboardingCompleted = useWalletOnboardingStore(
    (s) => s.setWalletOnboardingCompleted,
  );

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
          // Slow path: try cloud restore first, then create new
          const cloudMnemonic = await restoreFromCloudBackup(walletId);

          if (cloudMnemonic) {
            await restoreWallet(cloudMnemonic, walletId);
            setActiveWalletId(walletId);
            await unlock(walletId);
          } else {
            await createWallet(walletId);
            // Fire-and-forget: back up new wallet to iCloud (iOS only — Android backup is user-initiated)
            getMnemonic(walletId)
              .then((m) => {
                if (m) return createCloudBackup(m, walletId);
              })
              .catch(() => {});
          }
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
    [
      hasLocalWallet,
      unlock,
      createWallet,
      setActiveWalletId,
      getMnemonic,
      restoreWallet,
      setWalletOnboardingCompleted,
    ],
  );

  useEffect(() => {
    if (!userId || bootstrapRan.current) return;
    if (!workletState.isReady) return;
    bootstrapRan.current = true;
    runBootstrap(userId);
  }, [userId, runBootstrap, workletState.isReady]);

  const retry = useCallback(() => {
    bootstrapRan.current = false;
    if (userId) {
      bootstrapRan.current = true;
      runBootstrap(userId);
    }
  }, [userId, runBootstrap]);

  return { status, error, retry };
}
