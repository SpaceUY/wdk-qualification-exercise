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
