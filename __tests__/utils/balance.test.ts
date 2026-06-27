import {
  formatBalanceFromRaw,
  trimDisplayDecimals,
  humanAmountToRaw,
} from '../../utils/balance';

describe('formatBalanceFromRaw', () => {
  it('returns null for null input', () => {
    expect(formatBalanceFromRaw(null, 6)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(formatBalanceFromRaw(undefined, 6)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(formatBalanceFromRaw('', 6)).toBeNull();
  });

  it('returns "0" for raw "0"', () => {
    expect(formatBalanceFromRaw('0', 6)).toBe('0');
  });

  it('formats 1_000_000 with 6 decimals as "1"', () => {
    expect(formatBalanceFromRaw('1000000', 6)).toBe('1');
  });

  it('formats 10_000_000 with 6 decimals as "10"', () => {
    expect(formatBalanceFromRaw('10000000', 6)).toBe('10');
  });

  it('handles 0-decimal token', () => {
    expect(formatBalanceFromRaw('42', 0)).toBe('42');
  });

  it('formats 1_500_000 with 6 decimals as "1.5" (trims trailing zeros)', () => {
    expect(formatBalanceFromRaw('1500000', 6)).toBe('1.5');
  });

  it('formats 1_050_000 with 6 decimals as "1.05"', () => {
    expect(formatBalanceFromRaw('1050000', 6)).toBe('1.05');
  });

  it('formats 1_000_001 with 6 decimals as "1.000001"', () => {
    expect(formatBalanceFromRaw('1000001', 6)).toBe('1.000001');
  });

  it('formats 123_456 with 6 decimals as "0.123456"', () => {
    expect(formatBalanceFromRaw('123456', 6)).toBe('0.123456');
  });

  it('formats 100_000 with 6 decimals as "0.1"', () => {
    expect(formatBalanceFromRaw('100000', 6)).toBe('0.1');
  });

  it('handles 18-decimal ETH: 1e18 → "1"', () => {
    expect(formatBalanceFromRaw('1000000000000000000', 18)).toBe('1');
  });

  it('handles 18-decimal ETH: 0.5 ETH', () => {
    expect(formatBalanceFromRaw('500000000000000000', 18)).toBe('0.5');
  });

  it('handles 1 wei (smallest 18-decimal unit)', () => {
    expect(formatBalanceFromRaw('1', 18)).toBe('0.000000000000000001');
  });

  it('handles 8-decimal BTC: 1 BTC = 1e8 sats', () => {
    expect(formatBalanceFromRaw('100000000', 8)).toBe('1');
  });

  it('handles 1 satoshi', () => {
    expect(formatBalanceFromRaw('1', 8)).toBe('0.00000001');
  });

  it('handles 2-decimal token: "150" → "1.5"', () => {
    expect(formatBalanceFromRaw('150', 2)).toBe('1.5');
  });
});

describe('trimDisplayDecimals', () => {
  it('returns whole number when input has no decimal', () => {
    expect(trimDisplayDecimals('42', 2)).toBe('42');
  });

  it('trims to maxFractionDigits when fractional part is longer', () => {
    expect(trimDisplayDecimals('1.123456', 2)).toBe('1.12');
  });

  it('does not add trailing zeros', () => {
    expect(trimDisplayDecimals('1.5', 4)).toBe('1.5');
  });

  it('strips trailing zeros after trim', () => {
    expect(trimDisplayDecimals('1.1000', 4)).toBe('1.1');
  });

  it('returns whole number when all trimmed fractional digits are zero', () => {
    expect(trimDisplayDecimals('1.0000', 2)).toBe('1');
  });

  it('handles maxFractionDigits of 0', () => {
    expect(trimDisplayDecimals('1.9999', 0)).toBe('1');
  });

  it('preserves significant digits shorter than max', () => {
    expect(trimDisplayDecimals('1.5', 6)).toBe('1.5');
  });

  it('handles "0.000001" with max 6 → "0.000001"', () => {
    expect(trimDisplayDecimals('0.000001', 6)).toBe('0.000001');
  });

  it('trims "0.000001" to max 4 → "0" (all digits are zeros after trim)', () => {
    expect(trimDisplayDecimals('0.000001', 4)).toBe('0');
  });
});

describe('humanAmountToRaw', () => {
  it('converts "1" with 6 decimals → "1000000"', () => {
    expect(humanAmountToRaw('1', 6)).toBe('1000000');
  });

  it('converts "1.5" with 6 decimals → "1500000"', () => {
    expect(humanAmountToRaw('1.5', 6)).toBe('1500000');
  });

  it('converts "1.000001" with 6 decimals → "1000001"', () => {
    expect(humanAmountToRaw('1.000001', 6)).toBe('1000001');
  });

  it('converts "0.1" with 6 decimals → "100000"', () => {
    expect(humanAmountToRaw('0.1', 6)).toBe('100000');
  });

  it('converts "0" → "0"', () => {
    expect(humanAmountToRaw('0', 6)).toBe('0');
  });

  it('converts "0.0" → "0"', () => {
    expect(humanAmountToRaw('0.0', 6)).toBe('0');
  });

  it('converts "0.000000" → "0"', () => {
    expect(humanAmountToRaw('0.000000', 6)).toBe('0');
  });

  it('handles comma as decimal separator: "1,5" → "1500000"', () => {
    expect(humanAmountToRaw('1,5', 6)).toBe('1500000');
  });

  it('trims whitespace: "  1.5  " → "1500000"', () => {
    expect(humanAmountToRaw('  1.5  ', 6)).toBe('1500000');
  });

  it('truncates fractional part exceeding decimals', () => {
    // "1.1234567" with 6 decimals → frac "123456" → "1123456"
    expect(humanAmountToRaw('1.1234567', 6)).toBe('1123456');
  });

  it('handles 0 decimals (integer token)', () => {
    expect(humanAmountToRaw('42', 0)).toBe('42');
  });

  it('handles 0 decimals with fractional input (truncates all frac)', () => {
    expect(humanAmountToRaw('42.9', 0)).toBe('42');
  });

  it('converts "1" with 18 decimals → "1" + 18 zeros', () => {
    expect(humanAmountToRaw('1', 18)).toBe('1' + '0'.repeat(18));
  });

  it('strips leading zeros: "0.5" with 6 decimals → "500000"', () => {
    expect(humanAmountToRaw('0.5', 6)).toBe('500000');
  });

  it('handles integer without decimal point: "10" with 6 → "10000000"', () => {
    expect(humanAmountToRaw('10', 6)).toBe('10000000');
  });
});
