import { ConfigService } from '@nestjs/config';
import { CognitoJwtPayload, JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const configService = {
    getOrThrow: jest
      .fn()
      .mockReturnValue('https://cognito-idp.example.com/.well-known/jwks.json'),
  } as unknown as ConfigService;

  const buildPayload = (
    tokenUse: CognitoJwtPayload['token_use'],
  ): CognitoJwtPayload => ({
    sub: 'user-123',
    email: 'user@example.com',
    'cognito:username': 'user@example.com',
    token_use: tokenUse,
    iss: 'https://cognito-idp.example.com',
    aud: 'client-id',
    exp: 9999999999,
    iat: 0,
  });

  it('reads the JWKS URI from config', () => {
    new JwtStrategy(configService);

    expect(configService.getOrThrow).toHaveBeenCalledWith('cognito.jwksUri');
  });

  describe('validate', () => {
    const strategy = new JwtStrategy(configService);

    it('accepts id tokens and returns the sub and email', () => {
      const result = strategy.validate(buildPayload('id'));

      expect(result).toEqual({ sub: 'user-123', email: 'user@example.com' });
    });

    it('rejects access tokens', () => {
      expect(() => strategy.validate(buildPayload('access'))).toThrow(
        'Only Cognito id tokens are accepted',
      );
    });
  });
});
