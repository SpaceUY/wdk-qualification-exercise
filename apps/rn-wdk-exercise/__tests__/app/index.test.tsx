import { render, screen } from '@testing-library/react-native';
import { useAuthStore } from '../../stores/authStore';
import RootIndex from '../../app/index';

describe('RootIndex', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ userId: null, accessToken: null });
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
