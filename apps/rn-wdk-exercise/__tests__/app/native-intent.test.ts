import { redirectSystemPath } from '../../app/+native-intent';

describe('redirectSystemPath', () => {
  it('suppresses the OAuth redirect URL in the form iOS/Android deliver it (full scheme URL)', () => {
    const path =
      'space-utl://oauthredirect?state=abc123&iss=https://accounts.google.com&code=4/0AX&scope=email%20profile';
    expect(redirectSystemPath({ path, initial: false })).toBe('');
  });

  it('suppresses the alternate-scheme form used by expo-auth-session', () => {
    expect(
      redirectSystemPath({ path: 'com.space.utl:/oauthredirect?code=xyz', initial: false }),
    ).toBe('');
  });

  it('suppresses a bare parsed path form', () => {
    expect(redirectSystemPath({ path: '/oauthredirect', initial: false })).toBe('');
  });

  it('suppresses the OAuth redirect on cold start too (initial: true)', () => {
    expect(
      redirectSystemPath({ path: 'space-utl://oauthredirect?state=abc', initial: true }),
    ).toBe('');
  });

  it('passes every other deep link through untouched', () => {
    const paths = [
      '/',
      '/(wallet)/send/confirm',
      'space-utl://send?address=0xabc',
      '/wallet-setup/restore-cloud',
    ];
    for (const path of paths) {
      expect(redirectSystemPath({ path, initial: false })).toBe(path);
      expect(redirectSystemPath({ path, initial: true })).toBe(path);
    }
  });
});
