import { getNetworkDisplayName } from '@/config/networkMeta';

// Fallback display name for backend merchants that have no entry in the
// GET /merchants `names` map. Shared by the confirm-screen cashback badge and
// the Merchants tab so both render the same label for the same address.
export const DEFAULT_MERCHANT_NAME = 'Affiliated merchant';

// The EVM chains the wallet supports share one address format (0x + 40 hex on the
// same curve), so a contact saved with network: null is offered on all of them.
const EVM_NETWORKS = new Set(['ethereum', 'arbitrum', 'polygon']);

export function isEvmNetwork(network: string): boolean {
  return EVM_NETWORKS.has(network);
}

// Gate for the send-flow picker: a Bitcoin contact must never be offered when
// sending on Tron. null (= any EVM) matches only EVM networks.
export function contactMatchesNetwork(contactNetwork: string | null, sendNetwork: string): boolean {
  if (contactNetwork === null) return isEvmNetwork(sendNetwork);
  return contactNetwork === sendNetwork;
}

export function getContactNetworkLabel(network: string | null): string {
  return network === null ? 'EVM' : getNetworkDisplayName(network);
}

export function getContactInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return words
    .slice(0, 2)
    .map((word) => word[0]!)
    .join('')
    .toUpperCase();
}

export function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Network choices for the add-contact form. value maps straight to
// AddressBookContact.network (null = any EVM chain).
export const CONTACT_NETWORK_OPTIONS: { label: string; value: string | null }[] = [
  { label: 'EVM', value: null },
  { label: 'Bitcoin', value: 'bitcoin' },
  { label: 'Spark', value: 'spark' },
  { label: 'Tron', value: 'tron' },
];

// Which option to preselect when the add-contact form is opened from the send flow:
// EVM chains collapse to null ("any EVM"), other known chains map to themselves. A
// contact saved on the preselected chain is guaranteed to appear back in the picker,
// which filters by the same network. Unknown/absent networks fall back to EVM.
export function toContactNetworkValue(network: string | undefined): string | null {
  if (!network || isEvmNetwork(network)) return null;
  return CONTACT_NETWORK_OPTIONS.some((option) => option.value === network) ? network : null;
}
