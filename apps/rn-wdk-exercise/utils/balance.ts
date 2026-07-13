export function formatBalanceFromRaw(
  raw: string | null | undefined,
  decimals: number,
): string | null {
  if (raw == null || raw === '') return null;
  if (raw === '0') return '0';

  const balanceBigInt = BigInt(raw);
  const divisor = 10n ** BigInt(decimals);
  const wholePart = balanceBigInt / divisor;
  const fractionalPart = balanceBigInt % divisor;

  if (fractionalPart === 0n) return wholePart.toString();

  const fractionalStr = fractionalPart
    .toString()
    .padStart(decimals, '0')
    .replace(/0+$/, '');

  return `${wholePart}.${fractionalStr}`;
}

export function trimDisplayDecimals(value: string, maxFractionDigits: number): string {
  const [whole, frac = ''] = value.split('.');
  if (!frac) return whole;
  const cut = frac.slice(0, maxFractionDigits).replace(/0+$/, '');
  return cut ? `${whole}.${cut}` : whole;
}

export function humanAmountToRaw(human: string, decimals: number): string {
  const [whole = '0', frac = ''] = human.trim().replace(',', '.').split('.');
  const fracPadded = frac.slice(0, decimals).padEnd(decimals, '0');
  const combined = whole + fracPadded;
  return combined.replace(/^0+/, '') || '0';
}

// Fiat math is display-only, so Number precision is acceptable here — unlike the raw
// base-unit helpers around it, the input is an already-formatted decimal string whose
// magnitude a Number represents fine. Returns null (not 0) when the value is unknowable:
// a missing price must never render as $0.00.
export function computeFiatValue(
  humanAmount: string | null | undefined,
  price: number | null | undefined,
): number | null {
  if (humanAmount == null || price == null) return null;
  const amount = Number(humanAmount);
  if (!Number.isFinite(amount)) return null;
  return amount * price;
}

export function formatFiat(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Fixed-decimal display formatting (e.g. always 2 or 4 digits) done via BigInt, never
// `Number(raw) / 10 ** decimals` — that conversion silently loses precision past
// Number.MAX_SAFE_INTEGER (2^53-1), which raw base-unit amounts (18-decimal UTL, etc.)
// routinely exceed.
export function formatFixedFromRaw(raw: string, decimals: number, fractionDigits: number): string {
  const value = BigInt(raw);
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const remainder = value % divisor;

  if (fractionDigits === 0) return whole.toString();

  const fractionStr = remainder
    .toString()
    .padStart(decimals, '0')
    .slice(0, fractionDigits)
    .padEnd(fractionDigits, '0');
  return `${whole}.${fractionStr}`;
}
