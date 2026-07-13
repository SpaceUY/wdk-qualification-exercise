import type { MerchantsResponse } from '@/utils/api';
import {
  DEFAULT_MERCHANT_NAME,
  getContactInitials,
  getContactNetworkLabel,
  truncateAddress,
} from '@/utils/addressBook';
import type { ContactRowData } from './buildContactRows';

// Cooks the backend merchant list into the same row shape ContactRow renders,
// so the Merchants tab reuses the contact row component untouched. Merchants
// are EVM-only today (no per-chain field on the backend), hence the fixed
// null-network label.
export function buildMerchantRows(merchants: MerchantsResponse): ContactRowData[] {
  return merchants.addresses.map((address) => {
    const name = merchants.names[address] ?? DEFAULT_MERCHANT_NAME;
    return {
      id: address,
      name,
      initials: getContactInitials(name),
      truncatedAddress: truncateAddress(address),
      networkLabel: getContactNetworkLabel(null),
      address,
    };
  });
}
