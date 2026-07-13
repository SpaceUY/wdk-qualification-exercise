import { render, screen } from '@testing-library/react-native';
import { useAuthStore } from '../../stores/authStore';
import { useSettingsStore } from '../../stores/settingsStore';
import RootIndex from '../../app/index';

describe('RootIndex', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ userId: null, accessToken: null });
    // Onboarding already seen by default so the pre-existing auth-routing tests
    // exercise the auth branch; the first-run branch has its own test below.
    useSettingsStore.setState({ hasSeenOnboarding: true });
  });

  it('redirects to onboarding on first run, before any auth routing', async () => {
    useSettingsStore.setState({ hasSeenOnboarding: false });
    useAuthStore.setState({ userId: 'user@test.com' });

    await render(<RootIndex />);

    expect(screen.getByTestId('mock-redirect').props.children).toBe('/(onboarding)');
  });

  it('redirects to the wallet when a user is signed in', async () => {
    useAuthStore.setState({ userId: 'user@test.com' });

    await render(<RootIndex />);

    expect(screen.getByTestId('mock-redirect').props.children).toBe('/(wallet)');
  });

  it('redirects to auth when no user is signed in', async () => {
    await render(<RootIndex />);

    expect(screen.getByTestId('mock-redirect').props.children).toBe('/(auth)');
  });
});
