import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';

const mockSignOutFromCognito = jest.fn().mockResolvedValue(undefined);
jest.mock('../../hooks/useCognito', () => ({
  signOutFromCognito: () => mockSignOutFromCognito(),
}));

const mockLock = jest.fn();
jest.mock('../../hooks/useWalletData', () => ({
  useWalletData: () => ({ lock: mockLock }),
}));

import SettingsScreen from '../../app/(wallet)/settings';

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ userId: 'user@test.com', accessToken: null });
  });

  it('navigates to the seed phrase screen', async () => {
    await render(<SettingsScreen />);

    await fireEvent.press(screen.getByTestId('settings-seed'));

    expect(router.push).toHaveBeenCalledWith('/(wallet)/wallet-setup');
  });

  it('logs out and returns to the auth screen', async () => {
    await render(<SettingsScreen />);

    await fireEvent.press(screen.getByTestId('settings-logout'));

    await waitFor(() => expect(mockSignOutFromCognito).toHaveBeenCalled());
    expect(mockLock).toHaveBeenCalled();
    expect(useAuthStore.getState().userId).toBeNull();
    expect(router.replace).toHaveBeenCalledWith('/(auth)');
  });

  it('shows the app version', async () => {
    await render(<SettingsScreen />);

    expect(screen.getByText(/^Version /)).toBeTruthy();
  });
});
