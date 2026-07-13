import { useQuery } from '@tanstack/react-query';
import { getPriceHistory, type PriceHistoryRange, type PriceHistoryResponse } from '@/utils/api';

// USD price series for one asset's chart. Keyed by range so flipping the selector
// back to an already-fetched range renders instantly from cache. staleTime mirrors
// the backend's per-range cache: 1d moves fast, longer ranges barely change.
export function usePriceHistory(symbol: string | undefined, range: PriceHistoryRange) {
  return useQuery<PriceHistoryResponse>({
    queryKey: ['priceHistory', symbol, range],
    queryFn: () => getPriceHistory(symbol as string, range),
    enabled: !!symbol,
    staleTime: range === '1d' ? 60_000 : 5 * 60_000,
  });
}
