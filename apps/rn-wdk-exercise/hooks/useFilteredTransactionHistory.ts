import { useMemo } from 'react';
import { useWallet } from '@tetherto/wdk-react-native-core';
import { useAuthStore } from '@/stores/authStore';
import { useAppNodeWalletSync } from '@/hooks/useAppNodeWalletSync';
import { useTransactionHistory } from '@/hooks/useTransactionHistory';

// Everything the History screen needs to render: app-node sync + transfer fetch, optionally
// narrowed to one network/symbol (the dashboard's per-token drill-down). Memoized so the
// filtered array keeps its identity across re-renders when nothing changed — FlatList and
// anything else comparing by reference would otherwise see "new data" every render.
export function useFilteredTransactionHistory({
  network,
  symbol,
}: {
  network?: string;
  symbol?: string;
}) {
  const userId = useAuthStore((s) => s.userId);
  const { addresses } = useWallet({ autoLoadAccountIndices: [0] });
  const ethereum = addresses['ethereum']?.[0];
  const bitcoin = addresses['bitcoin']?.[0];

  const { status: syncStatus, error: syncError } = useAppNodeWalletSync({ ethereum, bitcoin });
  const {
    data: allTransfers,
    isLoading,
    isError,
  } = useTransactionHistory(userId, syncStatus === 'done');

  const transfers = useMemo(() => {
    if (!network) return allTransfers;
    return allTransfers?.filter(
      (t) =>
        t.blockchain === network && (!symbol || t.token?.toLowerCase() === symbol.toLowerCase()),
    );
  }, [allTransfers, network, symbol]);

  const myAddresses = useMemo(
    () => [ethereum, bitcoin].filter((a): a is string => Boolean(a)),
    [ethereum, bitcoin],
  );

  return { transfers, isLoading, isError, syncStatus, syncError, myAddresses };
}
