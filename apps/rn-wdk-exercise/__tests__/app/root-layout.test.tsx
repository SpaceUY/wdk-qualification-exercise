import { render } from '@testing-library/react-native';
import { useAuthStore } from '../../stores/authStore';

const mockWdkAppProvider = jest.fn();
jest.mock('@tetherto/wdk-react-native-core', () => ({
  WdkAppProvider: (props: { children?: unknown }) => {
    mockWdkAppProvider(props);
    return props.children;
  },
}));

jest.mock('../../components/AppLockOverlay', () => ({ AppLockOverlay: () => null }));
jest.mock('sonner-native', () => ({ Toaster: () => null }));

// A real generated worklet bundle exists on disk (via the `postinstall` script), but it's a
// multi-MB gitignored artifact — tests shouldn't depend on it having been generated.
jest.mock('../../.wdk-bundle/wdk-worklet.bundle.js', () => 'mock-bundle', { virtual: true });

import RootLayout from '../../app/_layout';

describe('RootLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes the WDK provider without a user before sign-in', async () => {
    useAuthStore.setState({ userId: null, accessToken: null });

    await render(<RootLayout />);

    expect(mockWdkAppProvider).toHaveBeenCalledWith(
      expect.objectContaining({ currentUserId: null, enableAutoInitialization: false }),
    );
  });

  it('passes the signed-in user id to the WDK provider', async () => {
    useAuthStore.setState({ userId: 'user@test.com', accessToken: null });

    await render(<RootLayout />);

    expect(mockWdkAppProvider).toHaveBeenCalledWith(
      expect.objectContaining({ currentUserId: 'user@test.com' }),
    );
  });
});
