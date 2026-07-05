import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import RestoreCloudScreen from '../../app/(wallet)/wallet-setup/restore-cloud';

const mockRestoreWallet = jest.fn();
jest.mock('../../hooks/useWalletData', () => ({
  useWalletData: () => ({ restoreWallet: mockRestoreWallet }),
}));

const mockSignIn = jest.fn();
jest.mock('../../hooks/useGoogleAuth', () => ({
  useGoogleAuth: () => ({ signIn: mockSignIn }),
}));

const mockRestoreFromCloudBackup = jest.fn();
jest.mock('../../utils/cloudBackup', () => ({
  restoreFromCloudBackup: (...args: unknown[]) => mockRestoreFromCloudBackup(...args),
}));

const mockDecryptMnemonic = jest.fn();
jest.mock('../../utils/seedEncryption', () => ({
  ...jest.requireActual('../../utils/seedEncryption'),
  decryptMnemonic: (...args: unknown[]) => mockDecryptMnemonic(...args),
}));

const PASSPHRASE = 'a-valid-passphrase';

async function enterPassphraseAndSubmit() {
  await fireEvent.changeText(screen.getByTestId('passphrase-input'), PASSPHRASE);
  await fireEvent.press(screen.getByText('Decrypt & Restore'));
}

describe('RestoreCloudScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    useAuthStore.setState({ userId: 'user@test.com', accessToken: null });
    mockSignIn.mockResolvedValue('google-access-token');
    mockRestoreFromCloudBackup.mockResolvedValue('cloud-ciphertext');
    mockDecryptMnemonic.mockResolvedValue('abandon abandon abandon');
    mockRestoreWallet.mockResolvedValue(undefined);
  });

  it('does nothing when there is no signed-in user', async () => {
    Platform.OS = 'android';
    useAuthStore.setState({ userId: null, accessToken: null });

    await render(<RestoreCloudScreen />);
    await fireEvent.press(screen.getByText('Sign in with Google'));

    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('stops when Google sign-in is cancelled on Android', async () => {
    Platform.OS = 'android';
    mockSignIn.mockResolvedValue(null);

    await render(<RestoreCloudScreen />);
    await fireEvent.press(screen.getByText('Sign in with Google'));

    await waitFor(() => expect(mockSignIn).toHaveBeenCalled());
    expect(mockRestoreFromCloudBackup).not.toHaveBeenCalled();
  });

  it('restores on iOS without a Google sign-in', async () => {
    Platform.OS = 'ios';

    await render(<RestoreCloudScreen />);
    await fireEvent.press(screen.getByText('Restore from iCloud'));

    await waitFor(() =>
      expect(mockRestoreFromCloudBackup).toHaveBeenCalledWith('user@test.com', undefined),
    );
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('shows a "no backup found" alert when the cloud backup is empty', async () => {
    Platform.OS = 'android';
    mockRestoreFromCloudBackup.mockResolvedValue(null);

    await render(<RestoreCloudScreen />);
    await fireEvent.press(screen.getByText('Sign in with Google'));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'No Backup Found',
        'No cloud backup was found for this account.',
      ),
    );
    expect(mockRestoreWallet).not.toHaveBeenCalled();
  });

  it('shows the passphrase prompt after a backup is found, then decrypts and restores', async () => {
    Platform.OS = 'android';

    await render(<RestoreCloudScreen />);
    await fireEvent.press(screen.getByText('Sign in with Google'));

    await waitFor(() => expect(screen.getByTestId('passphrase-input')).toBeTruthy());
    await enterPassphraseAndSubmit();

    expect(mockDecryptMnemonic).toHaveBeenCalledWith('cloud-ciphertext', PASSPHRASE);
    await waitFor(() =>
      expect(mockRestoreWallet).toHaveBeenCalledWith('abandon abandon abandon', 'user@test.com'),
    );
    expect(Alert.alert).toHaveBeenCalledWith(
      'Wallet Restored',
      'Your wallet has been restored from your cloud backup.',
      expect.arrayContaining([expect.objectContaining({ text: 'OK' })]),
    );

    const [, , buttons] = (Alert.alert as jest.Mock).mock.calls[0];
    buttons[0].onPress();
    expect(router.replace).toHaveBeenCalledWith('/(wallet)');
  });

  it('restores successfully with an old-rules passphrase that would fail the strength check', async () => {
    Platform.OS = 'android';
    const OLD_RULES_PASSPHRASE = 'aaaaaaaa';

    await render(<RestoreCloudScreen />);
    await fireEvent.press(screen.getByText('Sign in with Google'));

    await waitFor(() => expect(screen.getByTestId('passphrase-input')).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId('passphrase-input'), OLD_RULES_PASSPHRASE);
    await fireEvent.press(screen.getByText('Decrypt & Restore'));

    expect(mockDecryptMnemonic).toHaveBeenCalledWith('cloud-ciphertext', OLD_RULES_PASSPHRASE);
    await waitFor(() =>
      expect(mockRestoreWallet).toHaveBeenCalledWith('abandon abandon abandon', 'user@test.com'),
    );
    expect(Alert.alert).toHaveBeenCalledWith(
      'Wallet Restored',
      'Your wallet has been restored from your cloud backup.',
      expect.arrayContaining([expect.objectContaining({ text: 'OK' })]),
    );
  });

  it('shows a failure alert when decryption throws (wrong passphrase)', async () => {
    Platform.OS = 'android';
    mockDecryptMnemonic.mockRejectedValue(new Error('Incorrect passphrase or corrupted backup'));

    await render(<RestoreCloudScreen />);
    await fireEvent.press(screen.getByText('Sign in with Google'));
    await waitFor(() => expect(screen.getByTestId('passphrase-input')).toBeTruthy());
    await enterPassphraseAndSubmit();

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Restore Failed',
        'Incorrect passphrase or corrupted backup',
      ),
    );
    expect(mockRestoreWallet).not.toHaveBeenCalled();
  });

  it('shows a failure alert when restoreWallet throws', async () => {
    Platform.OS = 'android';
    mockRestoreWallet.mockRejectedValue(new Error('Corrupt backup'));

    await render(<RestoreCloudScreen />);
    await fireEvent.press(screen.getByText('Sign in with Google'));
    await waitFor(() => expect(screen.getByTestId('passphrase-input')).toBeTruthy());
    await enterPassphraseAndSubmit();

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Restore Failed', 'Corrupt backup'));
  });
});
