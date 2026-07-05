import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import WalletSetupScreen from '../../app/(wallet)/wallet-setup/index';

describe('WalletSetupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the cloud restore option', async () => {
    await render(<WalletSetupScreen />);
    expect(screen.getByText('Restore from Cloud Backup')).toBeTruthy();
  });

  it('navigates to the backup screen', async () => {
    await render(<WalletSetupScreen />);

    await fireEvent.press(screen.getByText('View Seed Phrase'));

    expect(router.push).toHaveBeenCalledWith('/(wallet)/wallet-setup/backup');
  });

  it('navigates to the cloud restore screen', async () => {
    await render(<WalletSetupScreen />);
    await fireEvent.press(screen.getByText('Restore from Cloud Backup'));

    expect(router.push).toHaveBeenCalledWith('/(wallet)/wallet-setup/restore-cloud');
  });

  it('navigates to the manual restore screen', async () => {
    await render(<WalletSetupScreen />);

    await fireEvent.press(screen.getByText('Restore Wallet'));

    expect(router.push).toHaveBeenCalledWith('/(wallet)/wallet-setup/restore');
  });
});
