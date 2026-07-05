// Shared "try several candidate field names" pattern for undocumented upstream payload
// shapes (hosted API's per-item /token-transfers shape, and the raw Redis stream's field
// names) — both adapters map into the same TransferEventDto.
export const TRANSFER_FIELD_CANDIDATES = {
  from: ['from', 'fromAddress', 'sender'],
  to: ['to', 'toAddress', 'recipient'],
  amount: ['amount', 'value'],
  txHash: ['txHash', 'hash', 'transactionHash'],
  chain: ['chain', 'network'],
  token: ['token', 'symbol', 'asset'],
} as const;

export function pickString(item: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}
