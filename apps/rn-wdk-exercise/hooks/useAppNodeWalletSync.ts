import { useEffect, useRef, useState } from 'react';
import {
  connectAppNode,
  createAppNodeWallet,
  getAppNodeUserWallet,
  updateAppNodeWalletAddresses,
  type AppNodeWalletAddresses,
} from '@/utils/appNodeApi';

type SyncStatus = 'idle' | 'syncing' | 'done' | 'error';

// The self-hosted stack's ork resolves the data-shard's RPC key over the public hyperswarm
// DHT, and that lookup intermittently misses — the app-node then answers 404
// (ERR_DATA_SHARD_NOT_FOUND) for a few seconds until the shard re-announces. Retrying the
// whole sync run (connect is idempotent, and re-reading the wallet keeps create/update
// consistent after a partial failure) with a short backoff absorbs those bursts.
export const RETRY_DELAYS_MS = [800, 2000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithRetries(run: () => Promise<void>): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (err) {
      if (attempt >= RETRY_DELAYS_MS.length) throw err;
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}

// Registers the wallet's ethereum/bitcoin addresses with the self-hosted WDK stack's app-node,
// so its token-transfers endpoint has something to look up. Addresses load asynchronously and
// independently (see useWallet's autoLoadAccountIndices) — this re-syncs whenever a *new*
// address key appears, not just once on mount, since e.g. bitcoin can resolve after ethereum.
export function useAppNodeWalletSync(addresses: AppNodeWalletAddresses): {
  status: SyncStatus;
  error: string | null;
  retry: () => void;
} {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);
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

    runWithRetries(async () => {
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
    })
      .then(() => setStatus('done'))
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      })
      .finally(() => {
        inProgress.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- retryTrigger only forces a re-run
  }, [ethereum, bitcoin, retryTrigger]);

  // Failed keys are never added to syncedKeys, so bumping retryTrigger re-runs the
  // effect above against the same addresses instead of being skipped as already-synced.
  const retry = () => {
    if (inProgress.current) return;
    setRetryTrigger((n) => n + 1);
  };

  return { status, error, retry };
}
