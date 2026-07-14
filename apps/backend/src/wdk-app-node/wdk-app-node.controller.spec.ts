import { Test } from '@nestjs/testing';
import { WdkAppNodeController } from './wdk-app-node.controller';
import { WdkAppNodeService } from './wdk-app-node.service';
import { TokenTransfersService } from './token-transfers.service';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

describe('WdkAppNodeController', () => {
  let controller: WdkAppNodeController;
  const service = { mintToken: jest.fn() };
  const tokenTransfersService = { getTokenTransfers: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [WdkAppNodeController],
      providers: [
        { provide: WdkAppNodeService, useValue: service },
        { provide: TokenTransfersService, useValue: tokenTransfersService },
      ],
    }).compile();

    controller = moduleRef.get(WdkAppNodeController);
  });

  it('mints a token scoped to the authenticated user email, not the Cognito sub', () => {
    service.mintToken.mockReturnValue('signed.jwt.token');
    const authUser: AuthenticatedUser = { sub: 'cognito-sub-123', email: 'user@example.com' };

    const result = controller.getToken(authUser);

    expect(service.mintToken).toHaveBeenCalledWith('user@example.com');
    expect(result).toEqual({ token: 'signed.jwt.token' });
  });

  it('proxies token-transfers for the authenticated user email, wrapped in a transfers envelope', async () => {
    const transfers = [{ transactionHash: '0xabc' }];
    tokenTransfersService.getTokenTransfers.mockResolvedValue(transfers);
    const authUser: AuthenticatedUser = { sub: 'cognito-sub-123', email: 'user@example.com' };

    const result = await controller.getTokenTransfers(authUser, { limit: 10, skip: 5 });

    expect(tokenTransfersService.getTokenTransfers).toHaveBeenCalledWith('user@example.com', {
      limit: 10,
      skip: 5,
    });
    expect(result).toEqual({ transfers });
  });
});
