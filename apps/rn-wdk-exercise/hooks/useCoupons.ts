import { useQuery } from '@tanstack/react-query';
import { getClaimedCoupons, getCoupons } from '@/utils/api';

export type CouponTab = 'available' | 'claimed';

// Lazy per-tab coupon queries — each runs only while its tab is active, preserving
// the screen's existing behavior. One owner for the fetch wiring (was inline).
export function useCoupons(tab: CouponTab) {
  const available = useQuery({
    queryKey: ['coupons'],
    queryFn: getCoupons,
    enabled: tab === 'available',
  });
  const claimed = useQuery({
    queryKey: ['coupons', 'claimed'],
    queryFn: getClaimedCoupons,
    enabled: tab === 'claimed',
  });
  return { available, claimed };
}
