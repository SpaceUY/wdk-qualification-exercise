import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import type { ExecutionContext } from '@nestjs/common';
import { CurrentUser } from './current-user.decorator';
import type { AuthenticatedUser } from '../jwt.strategy';

// Param decorators built with createParamDecorator can't be invoked directly —
// this pulls the underlying factory function back out via route metadata,
// the standard way to unit-test them without a full HTTP request.
function getParamDecoratorFactory(
  decorator: (...args: unknown[]) => ParameterDecorator,
) {
  class TestController {
    public test(@decorator() _value: unknown) {}
  }

  const args = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    TestController,
    'test',
  );
  return args[Object.keys(args)[0]].factory;
}

describe('CurrentUser decorator', () => {
  it('extracts the authenticated user from the request', () => {
    const factory = getParamDecoratorFactory(CurrentUser);
    const user: AuthenticatedUser = { sub: 'user-123', email: 'user@example.com' };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;

    expect(factory(undefined, ctx)).toEqual(user);
  });
});
