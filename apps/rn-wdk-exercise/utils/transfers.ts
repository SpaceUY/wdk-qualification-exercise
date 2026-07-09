import type { TokenTransfer } from '@/utils/appNodeApi';

export function truncateHash(hash: string): string {
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

export function formatTransferDate(tsSeconds: number): string {
  const ms = tsSeconds > 1e12 ? tsSeconds : tsSeconds * 1000;
  return new Date(ms).toLocaleString();
}

export function isReceived(transfer: TokenTransfer, myAddresses: string[]): boolean {
  if (transfer.type === 'received') return true;
  if (transfer.type === 'sent') return false;
  return myAddresses.some((addr) => addr.toLowerCase() === transfer.to?.toLowerCase());
}
