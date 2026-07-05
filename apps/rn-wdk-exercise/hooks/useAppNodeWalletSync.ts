import { useEffect, useRef, useState } from 'react';
import {
  connectAppNode,
  createAppNodeWallet,
  getAppNodeUserWallet,
  updateAppNodeWalletAddresses,
  type AppNodeWalletAddresses,
} from '@/utils/appNodeApi';

type SyncStatus = 'idle' | 'syncing' | 'done' | 'error';

// Registers the wallet's ethereum/bitcoin addresses with the self-hosted WDK stack's app-node,
// so its token-transfers endpoint has something to look up. Addresses load asynchronously and
// independently (see useWallet's autoLoadAccountIndices) — this re-syncs whenever a *new*
// address key appears, not just once on mount, since e.g. bitcoin can resolve after ethereum.
export function useAppNodeWalletSync(addresses: AppNodeWalletAddresses): {
  status: SyncStatus;
  error: string | null;
} {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const inProgress = useRef(false);
  const syncedKeys = useRef(new Set<string>());

  const { ethereum, bitcoin } = addresses;

  useEffect(() => {
    const known: AppNodeWalletAddresses = {};
    if (ethereum) known.ethereum = ethereum;
    if (bitcoin) known.bitcoin = bitcoin;

    const knownKeys = Object.keys(known) as (keyof AppNodeWalletAddresses)[];
    if (knownKeys.length === 0) return;
    if (inProgress.current) return;
    if (knownKeys.every((key) => syncedKeys.current.has(key))) return;

    inProgress.current = true;
    setStatus('syncing');
    setError(null);

    (async () => {
      await connectAppNode();
      const existing = await getAppNodeUserWallet();

      if (!existing) {
        await createAppNodeWallet(known);
      } else {
        const missing = knownKeys.some((key) => !existing.addresses[key]);
        if (missing) {
          await updateAppNodeWalletAddresses(existing.id, { ...existing.addresses, ...known });
        }
      }
      knownKeys.forEach((key) => syncedKeys.current.add(key));
    })()
      .then(() => setStatus('done'))
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      })
      .finally(() => {
        inProgress.current = false;
      });
  }, [ethereum, bitcoin]);

  return { status, error };
}
