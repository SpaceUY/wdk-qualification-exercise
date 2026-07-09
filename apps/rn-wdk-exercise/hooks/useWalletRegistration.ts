import { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { putWalletAddress } from '@/utils/api';

// Registers the wallet's ethereum address with the backend once it resolves, at most once
// per mount. Transient network failures are retried with React Query's exponential backoff
// instead of piggybacking on pull-to-refresh.
export function useWalletRegistration(ethAddress: string | undefined): void {
  const { mutate, isIdle } = useMutation({
    // Wrapped (not passed by reference) so React Query's extra context argument
    // never reaches putWalletAddress.
    mutationFn: (address: string) => putWalletAddress(address),
    retry: 3,
  });

  useEffect(() => {
    if (ethAddress && isIdle) mutate(ethAddress);
  }, [ethAddress, isIdle, mutate]);
}
