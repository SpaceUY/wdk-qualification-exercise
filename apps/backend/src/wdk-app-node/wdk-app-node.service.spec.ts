import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { verify } from 'jsonwebtoken';
import { WdkAppNodeService } from './wdk-app-node.service';

describe('WdkAppNodeService', () => {
  let service: WdkAppNodeService;
  const config = {
    getOrThrow: jest.fn(),
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [WdkAppNodeService, { provide: ConfigService, useValue: config }],
    }).compile();

    service = moduleRef.get(WdkAppNodeService);
  });

  it('signs a token with the userId payload using the configured secret', () => {
    config.getOrThrow.mockReturnValue('shared-secret');
    config.get.mockReturnValue(3600);

    const token = service.mintToken('user@example.com');
    const decoded = verify(token, 'shared-secret') as { userId: string };

    expect(decoded.userId).toBe('user@example.com');
    expect(config.getOrThrow).toHaveBeenCalledWith('wdkAppNode.jwtSecret');
  });

  it('rejects verification against the wrong secret', () => {
    config.getOrThrow.mockReturnValue('shared-secret');
    config.get.mockReturnValue(3600);

    const token = service.mintToken('user@example.com');

    expect(() => verify(token, 'wrong-secret')).toThrow();
  });

  it('defaults the TTL to 3600s when not configured', () => {
    config.getOrThrow.mockReturnValue('shared-secret');
    config.get.mockReturnValue(undefined);

    const token = service.mintToken('user@example.com');
    const decoded = verify(token, 'shared-secret') as { iat: number; exp: number };

    expect(decoded.exp - decoded.iat).toBe(3600);
  });

  it('honors a configured TTL', () => {
    config.getOrThrow.mockReturnValue('shared-secret');
    config.get.mockReturnValue(60);

    const token = service.mintToken('user@example.com');
    const decoded = verify(token, 'shared-secret') as { iat: number; exp: number };

    expect(decoded.exp - decoded.iat).toBe(60);
  });
});
