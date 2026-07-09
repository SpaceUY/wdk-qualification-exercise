import { parseMerchantQR } from '@/utils/merchantQR';

describe('parseMerchantQR', () => {
  describe('JSON merchant format', () => {
    it('extracts address and amount from {"to","amount"} payload', () => {
      const qr = JSON.stringify({ to: '0xAbc123', amount: '25.00' });
      expect(parseMerchantQR(qr)).toEqual({ address: '0xAbc123', amount: '25.00' });
    });

    it('returns null amount when amount is absent', () => {
      const qr = JSON.stringify({ to: '0xAbc123' });
      expect(parseMerchantQR(qr)).toEqual({ address: '0xAbc123', amount: null });
    });
  });

  describe('ethereum: URI format', () => {
    it('extracts address from bare ethereum: URI', () => {
      expect(parseMerchantQR('ethereum:0xDef456')).toEqual({
        address: '0xDef456',
        amount: null,
      });
    });

    it('extracts address and amount when ?amount query param present', () => {
      expect(parseMerchantQR('ethereum:0xDef456?amount=10.5')).toEqual({
        address: '0xDef456',
        amount: '10.5',
      });
    });

    it('reads recipient from "address" query param on EIP-681 token-transfer URIs', () => {
      // Path segment (0xDef456) is the ERC-20 contract, not the recipient — must not be used as "address".
      expect(parseMerchantQR('ethereum:0xDef456/transfer?address=0xOther&uint256=1000')).toEqual({
        address: '0xOther',
        amount: null,
      });
    });
  });

  describe('tron: URI format', () => {
    it('extracts Tron address', () => {
      expect(parseMerchantQR('tron:TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t?amount=5')).toEqual({
        address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        amount: '5',
      });
    });
  });

  describe('plain address fallback', () => {
    it('returns plain address with null amount', () => {
      expect(parseMerchantQR('0xPlainAddress')).toEqual({
        address: '0xPlainAddress',
        amount: null,
      });
    });
  });
});
