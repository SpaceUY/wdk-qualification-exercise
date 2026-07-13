import { useQuery } from '@tanstack/react-query';
import { getPrices, type PricesResponse } from '@/utils/api';

// USD spot prices from our backend (which caches upstream for a minute). Balance
// UIs must never block crypto amounts on this query — fiat is progressive
// enhancement: while loading or failed, render the crypto amount alone.
export function usePrices() {
  return useQuery<PricesResponse>({
    queryKey: ['prices'],
    queryFn: getPrices,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
