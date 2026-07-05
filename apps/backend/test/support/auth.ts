import { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../src/auth/jwt.strategy';

export const TEST_USER: AuthenticatedUser = {
  sub: 'test-cognito-sub-1',
  email: 'test-user-1@example.com',
};

export function createMockJwtAuthGuard(user: AuthenticatedUser): {
  canActivate: (context: ExecutionContext) => boolean;
} {
  return {
    canActivate(context: ExecutionContext): boolean {
      const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
      request.user = user;
      return true;
    },
  };
}
