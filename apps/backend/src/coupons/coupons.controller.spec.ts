import { Test, TestingModule } from '@nestjs/testing';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

describe('CouponsController', () => {
  let controller: CouponsController;
  let couponsService: jest.Mocked<CouponsService>;

  const authUser: AuthenticatedUser = { sub: 'cognito-sub', email: 'test@example.com' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CouponsController],
      providers: [
        {
          provide: CouponsService,
          useValue: {
            claimCoupon: jest.fn(),
            findUnredeemedByUser: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(CouponsController);
    couponsService = module.get(CouponsService);
  });

  describe('claim', () => {
    it('delegates to CouponsService with correct arguments', async () => {
      const expected = { redemptionTxHash: '0xabc' };
      (couponsService.claimCoupon as jest.Mock).mockResolvedValue(expected);

      const result = await controller.claim(authUser, { code: 'abcdef1234567890abcdef1234567890' });

      expect(couponsService.claimCoupon).toHaveBeenCalledWith(
        'abcdef1234567890abcdef1234567890',
        'cognito-sub',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('list', () => {
    it('returns unredeemed coupons for the authenticated user', async () => {
      const expected = [
        {
          id: 'c1',
          code: 'aabbcc1234567890aabbcc1234567890',
          utlAmountRaw: '50000000000000000',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
        },
      ];
      (couponsService.findUnredeemedByUser as jest.Mock).mockResolvedValue(expected);

      const result = await controller.list(authUser);

      expect(couponsService.findUnredeemedByUser).toHaveBeenCalledWith('cognito-sub');
      expect(result).toEqual(expected);
    });
  });
});
