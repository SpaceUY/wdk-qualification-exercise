import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MerchantsService } from './merchants.service';

jest.mock('../config/merchants.config', () => ({
  MERCHANT_NAMES: { '0xabc123': 'Café Central' },
}));

describe('MerchantsService', () => {
  let service: MerchantsService;
  let configService: { get: jest.Mock; getOrThrow: jest.Mock };

  beforeEach(async () => {
    configService = { get: jest.fn(), getOrThrow: jest.fn().mockReturnValue(500n) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [MerchantsService, { provide: ConfigService, useValue: configService }],
    }).compile();

    service = module.get(MerchantsService);
  });

  describe('getMerchants', () => {
    it('returns configured addresses with the cashback rate derived from cashbackBps', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'blockchain.merchantAddresses') return ['0xabc123', '0xdef456'];
        return undefined;
      });

      const result = service.getMerchants();

      expect(result).toEqual({
        addresses: ['0xabc123', '0xdef456'],
        names: { '0xabc123': 'Café Central' },
        cashbackRate: 0.05,
      });
    });

    it('omits addresses that have no entry in MERCHANT_NAMES from the names map', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'blockchain.merchantAddresses') return ['0xdef456'];
        return undefined;
      });

      const result = service.getMerchants();

      expect(result.names).toEqual({});
    });

    it('defaults to an empty addresses array when merchantAddresses is missing', () => {
      configService.get.mockReturnValue(undefined);

      const result = service.getMerchants();

      expect(result.addresses).toEqual([]);
    });

    it('throws when cashbackBps is not configured, instead of silently defaulting', () => {
      configService.get.mockReturnValue(undefined);
      configService.getOrThrow.mockImplementation(() => {
        throw new Error('Configuration key "blockchain.cashbackBps" does not exist');
      });

      expect(() => service.getMerchants()).toThrow();
    });
  });
});
