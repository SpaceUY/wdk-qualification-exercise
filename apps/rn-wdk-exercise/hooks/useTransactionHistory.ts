import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getUserTokenTransfers, type TokenTransfer } from '@/utils/appNodeApi';
import { RETRY_DELAYS_MS } from '@/hooks/useAppNodeWalletSync';

export function useTransactionHistory(
  userId: string | null,
  enabled: boolean,
): UseQueryResult<TokenTransfer[]> {
  return useQuery<TokenTransfer[]>({
    queryKey: ['wdk-app-node', 'token-transfers', userId],
    queryFn: () => getUserTokenTransfers(userId as string),
    enabled: Boolean(userId) && enabled,
    staleTime: 0,
    // Same ork/DHT lookup-miss 404 burst useAppNodeWalletSync retries around — this
    // fetch hits the same app-node endpoint and was previously left uncovered.
    retry: RETRY_DELAYS_MS.length,
    retryDelay: (attemptIndex) => RETRY_DELAYS_MS[attemptIndex] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1],
  });
}
