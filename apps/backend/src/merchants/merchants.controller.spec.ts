import { Test, TestingModule } from '@nestjs/testing';
import { MerchantsController } from './merchants.controller';
import { MerchantsService } from './merchants.service';

describe('MerchantsController', () => {
  let controller: MerchantsController;
  let merchantsService: jest.Mocked<MerchantsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MerchantsController],
      providers: [{ provide: MerchantsService, useValue: { getMerchants: jest.fn() } }],
    }).compile();

    controller = module.get(MerchantsController);
    merchantsService = module.get(MerchantsService);
  });

  describe('list', () => {
    it('delegates to MerchantsService.getMerchants', () => {
      const expected = { addresses: ['0xabc123'], names: {}, cashbackRate: 0.05 };
      (merchantsService.getMerchants as jest.Mock).mockReturnValue(expected);

      const result = controller.list();

      expect(merchantsService.getMerchants).toHaveBeenCalledWith();
      expect(result).toEqual(expected);
    });
  });
});
