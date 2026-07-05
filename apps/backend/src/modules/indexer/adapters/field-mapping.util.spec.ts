import { pickString, TRANSFER_FIELD_CANDIDATES } from './field-mapping.util';

describe('pickString', () => {
  it('returns the value of the first matching candidate key', () => {
    const item = { fromAddress: '0xsender' };
    expect(pickString(item, TRANSFER_FIELD_CANDIDATES.from)).toBe('0xsender');
  });

  it('prefers earlier candidates over later ones', () => {
    const item = { from: '0xprimary', sender: '0xfallback' };
    expect(pickString(item, TRANSFER_FIELD_CANDIDATES.from)).toBe('0xprimary');
  });

  it('returns undefined when no candidate key is present', () => {
    expect(pickString({}, TRANSFER_FIELD_CANDIDATES.from)).toBeUndefined();
  });

  it('ignores non-string and empty-string values', () => {
    const item = { from: '', fromAddress: 123, sender: '0xsender' };
    expect(pickString(item, TRANSFER_FIELD_CANDIDATES.from)).toBe('0xsender');
  });
});
