// Display-only metadata for merchant addresses. MERCHANT_ADDRESSES (blockchain.config.ts)
// remains the sole source of truth for which addresses are treated as merchants — an
// address missing from this map is still a valid merchant, just shown with a generic name.
export const MERCHANT_NAMES: Record<string, string> = {
  '0xcafdb270dcfddc9dede4d444c955618c0ff05cff': 'Test Merchant',
};
