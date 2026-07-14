import { isValidAddressForNetwork } from '@/utils/address';

describe('isValidAddressForNetwork', () => {
  const EVM = '0x' + 'a'.repeat(40);

  it('accepts EVM addresses on EVM networks', () => {
    expect(isValidAddressForNetwork(EVM, 'ethereum')).toBe(true);
    expect(isValidAddressForNetwork(EVM, 'arbitrum')).toBe(true);
    expect(isValidAddressForNetwork(EVM, 'polygon')).toBe(true);
  });

  it('rejects malformed and wrong-network addresses', () => {
    expect(isValidAddressForNetwork('0x123', 'ethereum')).toBe(false);
    expect(isValidAddressForNetwork('', 'ethereum')).toBe(false);
    expect(isValidAddressForNetwork(EVM, 'bitcoin')).toBe(false);
  });

  it('validates tron and bitcoin formats', () => {
    expect(isValidAddressForNetwork('TJRabPrwbZy45sbavfcjinPJC18kjpRTv8', 'tron')).toBe(true);
    expect(isValidAddressForNetwork('not-a-tron-address', 'tron')).toBe(false);
    expect(isValidAddressForNetwork('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', 'bitcoin')).toBe(true);
    expect(isValidAddressForNetwork('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2', 'bitcoin')).toBe(true);
  });

  it('falls back to a non-EVM check for spark', () => {
    expect(isValidAddressForNetwork(EVM, 'spark')).toBe(false);
    expect(isValidAddressForNetwork('sp1qsomesparkaddress', 'spark')).toBe(true);
  });
});
