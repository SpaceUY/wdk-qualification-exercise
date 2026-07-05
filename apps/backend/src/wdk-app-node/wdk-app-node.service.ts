import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sign } from 'jsonwebtoken';

@Injectable()
export class WdkAppNodeService {
  constructor(private readonly config: ConfigService) {}

  mintToken(userId: string): string {
    const secret = this.config.getOrThrow<string>('wdkAppNode.jwtSecret');
    const expiresIn = this.config.get<number>('wdkAppNode.tokenTtlSeconds') ?? 3600;
    return sign({ userId }, secret, { algorithm: 'HS256', expiresIn });
  }
}
