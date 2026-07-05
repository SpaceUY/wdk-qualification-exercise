import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getUserTokenTransfers, type TokenTransfer } from '@/utils/appNodeApi';

export function useTransactionHistory(
  userId: string | null,
  enabled: boolean,
): UseQueryResult<TokenTransfer[]> {
  return useQuery<TokenTransfer[]>({
    queryKey: ['wdk-app-node', 'token-transfers', userId],
    queryFn: () => getUserTokenTransfers(userId as string),
    enabled: Boolean(userId) && enabled,
    staleTime: 0,
  });
}
