import {
  contactMatchesNetwork,
  getContactInitials,
  getContactNetworkLabel,
  isEvmNetwork,
  toContactNetworkValue,
  truncateAddress,
} from '../../utils/addressBook';

describe('addressBook utils', () => {
  describe('isEvmNetwork', () => {
    it.each(['ethereum', 'arbitrum', 'polygon'])('treats %s as EVM', (network) => {
      expect(isEvmNetwork(network)).toBe(true);
    });

    it.each(['bitcoin', 'spark', 'tron'])('treats %s as non-EVM', (network) => {
      expect(isEvmNetwork(network)).toBe(false);
    });
  });

  describe('contactMatchesNetwork', () => {
    it('offers a null-network (any EVM) contact on every EVM chain', () => {
      expect(contactMatchesNetwork(null, 'ethereum')).toBe(true);
      expect(contactMatchesNetwork(null, 'arbitrum')).toBe(true);
      expect(contactMatchesNetwork(null, 'polygon')).toBe(true);
    });

    it('never offers an EVM contact on a non-EVM chain', () => {
      expect(contactMatchesNetwork(null, 'bitcoin')).toBe(false);
      expect(contactMatchesNetwork(null, 'tron')).toBe(false);
    });

    it('matches a chain-specific contact only on its own chain', () => {
      expect(contactMatchesNetwork('bitcoin', 'bitcoin')).toBe(true);
      expect(contactMatchesNetwork('bitcoin', 'tron')).toBe(false);
      expect(contactMatchesNetwork('tron', 'ethereum')).toBe(false);
    });
  });

  describe('getContactNetworkLabel', () => {
    it('labels null as EVM and capitalizes chain names', () => {
      expect(getContactNetworkLabel(null)).toBe('EVM');
      expect(getContactNetworkLabel('bitcoin')).toBe('Bitcoin');
    });
  });

  describe('getContactInitials', () => {
    it('takes the first letter of up to two words, uppercased', () => {
      expect(getContactInitials('mom')).toBe('M');
      expect(getContactInitials('cold wallet')).toBe('CW');
      expect(getContactInitials('one two three')).toBe('OT');
    });

    it('falls back to ? for a blank name', () => {
      expect(getContactInitials('   ')).toBe('?');
    });
  });

  describe('toContactNetworkValue', () => {
    it('collapses EVM chains to null (the shared EVM option)', () => {
      expect(toContactNetworkValue('ethereum')).toBeNull();
      expect(toContactNetworkValue('arbitrum')).toBeNull();
      expect(toContactNetworkValue('polygon')).toBeNull();
    });

    it('maps known non-EVM chains to themselves', () => {
      expect(toContactNetworkValue('bitcoin')).toBe('bitcoin');
      expect(toContactNetworkValue('spark')).toBe('spark');
      expect(toContactNetworkValue('tron')).toBe('tron');
    });

    it('falls back to null for unknown or absent networks', () => {
      expect(toContactNetworkValue('solana')).toBeNull();
      expect(toContactNetworkValue(undefined)).toBeNull();
    });
  });

  describe('truncateAddress', () => {
    it('keeps head and tail of a long address', () => {
      expect(truncateAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe('0x1234...5678');
    });

    it('returns short addresses unchanged', () => {
      expect(truncateAddress('0x1234abcd')).toBe('0x1234abcd');
    });
  });
});
