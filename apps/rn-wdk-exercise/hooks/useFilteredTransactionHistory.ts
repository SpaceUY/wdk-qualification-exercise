import { useCallback, useMemo } from 'react';
import { useWallet } from '@tetherto/wdk-react-native-core';
import { useAuthStore } from '@/stores/authStore';
import { useAppNodeWalletSync } from '@/hooks/useAppNodeWalletSync';
import { useTransactionHistory } from '@/hooks/useTransactionHistory';

// The indexer tags transfers by on-chain token label, which isn't always the wallet's
// display symbol — Spark's indexer records BTC-denominated transfers as 'btc' (see
// infra/wdk-stack processor-spark's TOKEN=btc), not 'sbtc'.
const SYMBOL_TO_INDEXER_TOKEN: Record<string, string> = { sbtc: 'btc' };

// Everything the History screen needs to render: app-node sync + transfer fetch, optionally
// narrowed to one network/symbol (the dashboard's per-token drill-down). Memoized so the
// filtered array keeps its identity across re-renders when nothing changed — FlatList and
// anything else comparing by reference would otherwise see "new data" every render.
export function useFilteredTransactionHistory({
  network,
  symbol,
  enabled = true,
}: {
  network?: string;
  symbol?: string;
  /** Skips the app-node sync and transfers request entirely — for assets whose
      history isn't tracked yet, where the result would always be empty. */
  enabled?: boolean;
}) {
  const userId = useAuthStore((s) => s.userId);
  const { addresses } = useWallet({ autoLoadAccountIndices: [0] });
  const ethereum = addresses['ethereum']?.[0];
  const bitcoin = addresses['bitcoin']?.[0];

  const { status: syncStatus, error: syncError, retry: retrySync } = useAppNodeWalletSync(
    enabled ? { ethereum, bitcoin } : {},
  );
  const {
    data: allTransfers,
    isLoading,
    isError,
    refetch: refetchTransfers,
  } = useTransactionHistory(userId, enabled && syncStatus === 'done');

  // Wallet sync failing and the transfers fetch failing are two different failure points
  // upstream of "the screen shows an error" — retry whichever one actually broke.
  const retry = useCallback(() => {
    if (syncStatus === 'error') {
      retrySync();
    } else {
      refetchTransfers();
    }
  }, [syncStatus, retrySync, refetchTransfers]);

  const transfers = useMemo(() => {
    if (!network) return allTransfers;
    const expectedToken = symbol && (SYMBOL_TO_INDEXER_TOKEN[symbol.toLowerCase()] ?? symbol.toLowerCase());
    return allTransfers?.filter(
      (t) => t.blockchain === network && (!expectedToken || t.token?.toLowerCase() === expectedToken),
    );
  }, [allTransfers, network, symbol]);

  const myAddresses = useMemo(
    () => [ethereum, bitcoin].filter((a): a is string => Boolean(a)),
    [ethereum, bitcoin],
  );

  return { transfers, isLoading, isError, syncStatus, syncError, myAddresses, retry, refetch: refetchTransfers };
}
