import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

export interface CognitoJwtPayload {
  sub: string;
  email: string;
  'cognito:username': string;
  token_use: 'id' | 'access';
  iss: string;
  aud: string;
  exp: number;
  iat: number;
}

export interface AuthenticatedUser {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const jwksUri = configService.getOrThrow<string>('cognito.jwksUri');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Hardcode RS256 — never allow 'none' or HS256 which could enable token forgery
      algorithms: ['RS256'] as const,
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri,
      }),
    });
  }

  validate(payload: CognitoJwtPayload): AuthenticatedUser {
    // Reject Cognito access tokens — they lack the email claim we need
    if (payload.token_use !== 'id') {
      throw new Error('Only Cognito id tokens are accepted');
    }
    return { sub: payload.sub, email: payload.email };
  }
}
