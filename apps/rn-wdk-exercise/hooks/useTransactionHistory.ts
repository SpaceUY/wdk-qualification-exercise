import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getUserTokenTransfers, type TokenTransfer } from '@/utils/appNodeApi';
import { RETRY_DELAYS_MS } from '@/hooks/useAppNodeWalletSync';

export function useTransactionHistory(
  userId: string | null,
  enabled: boolean,
): UseQueryResult<TokenTransfer[]> {
  return useQuery<TokenTransfer[]>({
    queryKey: ['wdk-app-node', 'token-transfers', userId],
    queryFn: () => getUserTokenTransfers(),
    enabled: Boolean(userId) && enabled,
    staleTime: 0,
    // Backstop for the rare case the backend's own retry + 24h Redis cache (see
    // apps/backend's token-transfers.service.ts) both miss — that proxy is now what
    // absorbs the ork/DHT lookup-miss bursts, not this client-side retry.
    retry: RETRY_DELAYS_MS.length,
    retryDelay: (attemptIndex) => RETRY_DELAYS_MS[attemptIndex] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1],
  });
}
