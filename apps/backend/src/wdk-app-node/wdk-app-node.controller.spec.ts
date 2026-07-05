import { Test } from '@nestjs/testing';
import { WdkAppNodeController } from './wdk-app-node.controller';
import { WdkAppNodeService } from './wdk-app-node.service';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

describe('WdkAppNodeController', () => {
  let controller: WdkAppNodeController;
  const service = { mintToken: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [WdkAppNodeController],
      providers: [{ provide: WdkAppNodeService, useValue: service }],
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
});
