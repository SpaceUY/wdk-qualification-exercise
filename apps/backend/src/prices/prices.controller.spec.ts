import { Test, TestingModule } from '@nestjs/testing';
import { PricesController } from './prices.controller';
import { PricesService } from './prices.service';

describe('PricesController', () => {
  let controller: PricesController;
  let pricesService: { getPrices: jest.Mock };

  beforeEach(async () => {
    pricesService = { getPrices: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PricesController],
      providers: [{ provide: PricesService, useValue: pricesService }],
    }).compile();

    controller = module.get(PricesController);
  });

  describe('list', () => {
    it('delegates to PricesService.getPrices', async () => {
      const expected = { prices: { BTC: 98000 }, fetchedAt: '2026-07-10T00:00:00.000Z' };
      pricesService.getPrices.mockResolvedValue(expected);

      const result = await controller.list();

      expect(pricesService.getPrices).toHaveBeenCalledWith();
      expect(result).toEqual(expected);
    });
  });
});
