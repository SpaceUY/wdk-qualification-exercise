import { blockchainConfig } from './blockchain.config';

describe('blockchainConfig', () => {
  const originalEnv = process.env['CASHBACK_BPS'];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env['CASHBACK_BPS'];
    } else {
      process.env['CASHBACK_BPS'] = originalEnv;
    }
  });

  describe('cashbackBps', () => {
    it('defaults to 500n when CASHBACK_BPS is unset', () => {
      delete process.env['CASHBACK_BPS'];

      expect(blockchainConfig().cashbackBps).toBe(500n);
    });

    it('defaults to 500n when CASHBACK_BPS is blank (empty template value), NOT 0n', () => {
      process.env['CASHBACK_BPS'] = '';

      expect(blockchainConfig().cashbackBps).toBe(500n);
    });

    it('parses a valid integer value', () => {
      process.env['CASHBACK_BPS'] = '250';

      expect(blockchainConfig().cashbackBps).toBe(250n);
    });

    it('rejects a negative value with an error naming the variable', () => {
      process.env['CASHBACK_BPS'] = '-500';

      expect(() => blockchainConfig()).toThrow(/CASHBACK_BPS/);
    });

    it('rejects a non-numeric value with an error naming the variable', () => {
      process.env['CASHBACK_BPS'] = '5%';

      expect(() => blockchainConfig()).toThrow(/CASHBACK_BPS/);
    });

    it('rejects a decimal value with an error naming the variable', () => {
      process.env['CASHBACK_BPS'] = '2.5';

      expect(() => blockchainConfig()).toThrow(/CASHBACK_BPS/);
    });
  });
});
