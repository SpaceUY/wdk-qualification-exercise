import { decimalToRawUnits, parseGroupedTransactionRaw } from './grouped-transaction.util';

describe('parseGroupedTransactionRaw', () => {
  it('parses a single transfer line', () => {
    const raw = '0xtx1,0,100,0xfrom,0xto,1.5,1700000000000,ethereum,usdt,0,0,transfer';
    const [transfer] = parseGroupedTransactionRaw(raw);

    expect(transfer).toMatchObject({
      txHash: '0xtx1',
      transferIndex: 0,
      blockNumber: 100,
      from: '0xfrom',
      to: '0xto',
      amount: '1.5',
      blockchain: 'ethereum',
      token: 'usdt',
      metadata: null,
    });
  });

  it('parses multiple newline-joined transfers', () => {
    const raw = [
      '0xtx1,0,100,0xfrom,0xto1,1.0,1700000000000,ethereum,usdt,0,0,transfer',
      '0xtx1,1,100,0xfrom,0xto2,2.0,1700000000000,ethereum,usdt,0,1,transfer',
    ].join('\n');

    expect(parseGroupedTransactionRaw(raw)).toHaveLength(2);
  });

  it('rejoins a metadata tail that itself contains commas', () => {
    const raw = '0xtx1,0,100,0xfrom,0xto,1.5,1700000000000,ethereum,usdt,0,0,transfer,{"a":1,"b":2}';
    const [transfer] = parseGroupedTransactionRaw(raw);

    expect(transfer?.metadata).toBe('{"a":1,"b":2}');
  });

  it('drops lines with fewer than the required 12 fields', () => {
    expect(parseGroupedTransactionRaw('too,few,fields')).toEqual([]);
  });

  it('ignores blank lines', () => {
    const raw = '\n0xtx1,0,100,0xfrom,0xto,1.5,1700000000000,ethereum,usdt,0,0,transfer\n';
    expect(parseGroupedTransactionRaw(raw)).toHaveLength(1);
  });
});

describe('decimalToRawUnits', () => {
  it('converts a whole-number decimal string to raw base units', () => {
    expect(decimalToRawUnits('5', 6)).toBe('5000000');
  });

  it('converts a fractional decimal string', () => {
    expect(decimalToRawUnits('1.5', 6)).toBe('1500000');
  });

  it('handles the ethers.formatUnits trailing-".0" shape', () => {
    expect(decimalToRawUnits('5.0', 6)).toBe('5000000');
  });

  it('truncates fractional digits beyond the token precision', () => {
    expect(decimalToRawUnits('1.1234567', 6)).toBe('1123456');
  });

  it('preserves the sign for negative amounts', () => {
    expect(decimalToRawUnits('-2.5', 6)).toBe('-2500000');
  });

  it('returns null for unparsable input', () => {
    expect(decimalToRawUnits('not-a-number', 6)).toBeNull();
  });
});
