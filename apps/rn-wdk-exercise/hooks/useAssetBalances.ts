import { useCallback } from 'react';
import { useBalance, useBalancesForWallet } from '@tetherto/wdk-react-native-core';
import {
  BTC_ASSET,
  BTC_CONFIG,
  EVM_ASSETS,
  SPARK_ASSET,
  SPARK_CONFIG,
  USDT_TRON_ASSET,
  USDT_TRON_CONFIG,
} from '@/config/assets';

export type AssetBalanceResult = {
  assetId: string;
  success: boolean;
  balance: string | null;
};

// Container hook that owns every WDK balance query the dashboard needs — the four
// per-chain hooks aggregated into one lookup, one loading flag, and one refetch.
// Keeps the screen free of WDK wiring and gives pull-to-refresh a single target.
export function useAssetBalances() {
  const { data: evmBalances, isLoading: evmLoading, refetch: refetchEvm } = useBalancesForWallet(
    0,
    EVM_ASSETS,
    { staleTime: 0, refetchInterval: 30_000 },
  );

  const { data: btcBalance, isLoading: btcLoading, refetch: refetchBtc } = useBalance(BTC_CONFIG.network, 0, BTC_ASSET, {
    staleTime: 0,
    refetchInterval: 30_000,
  });

  const { data: sparkBalance, isLoading: sparkLoading, refetch: refetchSpark } = useBalance(SPARK_CONFIG.network, 0, SPARK_ASSET, {
    staleTime: 0,
    refetchInterval: 60_000,
  });

  const { data: tronBalance, isLoading: tronLoading, refetch: refetchTron } = useBalance(USDT_TRON_CONFIG.network, 0, USDT_TRON_ASSET, {
    staleTime: 0,
    refetchInterval: 60_000,
  });

  const allBalances: AssetBalanceResult[] = [
    ...(evmBalances ?? []),
    ...(btcBalance ? [btcBalance] : []),
    ...(sparkBalance ? [sparkBalance] : []),
    ...(tronBalance ? [tronBalance] : []),
  ];
  // Built once per render instead of calling allBalances.find() inside renderItem — an O(1)
  // lookup per row instead of an O(n) scan per row (O(n²) total across the asset list).
  const balanceByAssetId = new Map(allBalances.map((b) => [b.assetId, b]));

  const refetchAll = useCallback(async () => {
    await Promise.all([refetchEvm(), refetchBtc(), refetchSpark(), refetchTron()]);
  }, [refetchEvm, refetchBtc, refetchSpark, refetchTron]);

  return {
    balanceByAssetId,
    hasAnyBalance: allBalances.length > 0,
    isLoading: evmLoading || btcLoading || sparkLoading || tronLoading,
    refetchAll,
  };
}
