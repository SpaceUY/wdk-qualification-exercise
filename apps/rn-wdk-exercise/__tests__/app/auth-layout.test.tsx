import { render, screen } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import AuthLayout from '../../app/(auth)/_layout';

describe('AuthLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ userId: null, accessToken: null });
  });

  it('redirects to the wallet when already signed in', async () => {
    useAuthStore.setState({ userId: 'user@test.com' });

    await render(<AuthLayout />);

    expect(screen.getByTestId('mock-redirect').props.children).toBe('/(wallet)');
    expect(Stack).not.toHaveBeenCalled();
  });

  it('renders the auth stack when signed out', async () => {
    await render(<AuthLayout />);

    expect(screen.queryByTestId('mock-redirect')).toBeNull();
    expect(Stack).toHaveBeenCalled();
    expect((Stack as unknown as jest.Mock).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        screenOptions: expect.objectContaining({
          headerShown: false,
          // Guards against white flashes during push/pop transitions.
          contentStyle: { backgroundColor: '#0C1117' },
        }),
      }),
    );
  });
});
