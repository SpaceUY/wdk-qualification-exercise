import { useQuery } from '@tanstack/react-query';
import { getMerchants } from '@/utils/api';

// Live, read-only merchant list for the Merchants tabs. Same queryKey as the
// inline query on send/confirm.tsx, so the tabs and the cashback badge share
// one cache entry instead of refetching per screen.
export function useMerchants() {
  return useQuery({ queryKey: ['merchants'], queryFn: getMerchants });
}
