// Parses the raw Redis stream message shape published by @tetherto/wdk-indexer-wrk-base's
// WrkIndexerProc._publishTransfers (workers/proc.indexer.wrk.js): each XADD carries only
// `type` (always 'grouped_transaction') and `raw` — a newline-joined, comma-positional
// string per transfer within the transaction. See the reference consumer's
// _parseRawTransfer in wdk-indexer-processor-wrk/workers/indexer.processor.wrk.js.
export const GROUPED_TRANSACTION_MSG_TYPE = 'grouped_transaction';

const RAW_FIELD_COUNT = 12;

export interface RawGroupedTransfer {
  txHash: string;
  transferIndex: number;
  blockNumber: number;
  from: string;
  to: string;
  amount: string;
  timestamp: number;
  blockchain: string;
  token: string;
  transactionIndex: number;
  logIndex: number;
  label: string;
  metadata: string | null;
}

export function parseGroupedTransactionRaw(raw: string): RawGroupedTransfer[] {
  return raw
    .split('\n')
    .filter((line) => line.length > 0)
    .map(parseLine)
    .filter((transfer): transfer is RawGroupedTransfer => transfer !== null);
}

function parseLine(line: string): RawGroupedTransfer | null {
  const parts = line.split(',');
  if (parts.length < RAW_FIELD_COUNT) return null;

  return {
    txHash: parts[0] ?? '',
    transferIndex: Number(parts[1]),
    blockNumber: Number(parts[2]),
    from: parts[3] ?? '',
    to: parts[4] ?? '',
    amount: parts[5] ?? '',
    timestamp: Number(parts[6]),
    blockchain: parts[7] ?? '',
    token: parts[8] ?? '',
    transactionIndex: Number(parts[9]),
    logIndex: Number(parts[10]),
    label: parts[11] ?? '',
    metadata: parts.length > RAW_FIELD_COUNT ? parts.slice(RAW_FIELD_COUNT).join(',') : null,
  };
}

// The indexer publishes `amount` via ethers' formatUnits (human decimal, e.g. "5.0"), but
// downstream (TransferProcessor) treats TransferEventDto.amount as a raw base-unit integer
// string (`BigInt(amount)`) — matching the 6-decimal USDT assumption already hardcoded in
// TransferProcessor's DECIMAL_ADJUSTMENT constant. Converts here rather than propagating a
// decimal string that would throw at the BigInt() call site.
export function decimalToRawUnits(decimal: string, decimals: number): string | null {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(decimal);
  if (!match) return null;

  const [, sign, whole, fraction = ''] = match;
  const paddedFraction = (fraction + '0'.repeat(decimals)).slice(0, decimals);
  const raw = BigInt(whole + paddedFraction);
  return sign ? (-raw).toString() : raw.toString();
}
