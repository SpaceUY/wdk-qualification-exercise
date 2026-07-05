import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useAuthStore } from '../../stores/authStore';
import BackupScreen from '../../app/(wallet)/wallet-setup/backup';

const mockGetMnemonic = jest.fn();
jest.mock('../../hooks/useWalletData', () => ({
  useWalletData: () => ({ getMnemonic: mockGetMnemonic }),
}));

const mockAuthenticate = jest.fn();
jest.mock('../../hooks/useBiometrics', () => ({
  useBiometrics: () => ({ authenticate: mockAuthenticate }),
}));

const mockSignIn = jest.fn();
jest.mock('../../hooks/useGoogleAuth', () => ({
  useGoogleAuth: () => ({ signIn: mockSignIn }),
}));

const mockCreateCloudBackup = jest.fn();
const mockRestoreFromCloudBackup = jest.fn();
jest.mock('../../utils/cloudBackup', () => ({
  createCloudBackup: (...args: unknown[]) => mockCreateCloudBackup(...args),
  restoreFromCloudBackup: (...args: unknown[]) => mockRestoreFromCloudBackup(...args),
}));

const mockPostWalletBackup = jest.fn();
jest.mock('../../utils/api', () => ({
  postWalletBackup: (...args: unknown[]) => mockPostWalletBackup(...args),
}));

const mockEncryptMnemonic = jest.fn();
jest.mock('../../utils/seedEncryption', () => ({
  ...jest.requireActual('../../utils/seedEncryption'),
  encryptMnemonic: (...args: unknown[]) => mockEncryptMnemonic(...args),
}));

const MNEMONIC = 'alpha bravo charlie';
const PASSPHRASE = 'a-valid-passphrase';

async function reveal() {
  await fireEvent.press(screen.getByText('Reveal Seed Phrase'));
}

async function uploadAndEnterPassphrase(uploadButtonText: string) {
  await fireEvent.press(screen.getByText(uploadButtonText));
  await fireEvent.changeText(screen.getByTestId('passphrase-input'), PASSPHRASE);
  await fireEvent.changeText(screen.getByTestId('passphrase-confirm-input'), PASSPHRASE);
  await fireEvent.press(screen.getByText('Encrypt & Upload'));
}

describe('BackupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    useAuthStore.setState({ userId: 'user@test.com', accessToken: null });
    mockAuthenticate.mockResolvedValue(true);
    mockGetMnemonic.mockResolvedValue(MNEMONIC);
    mockCreateCloudBackup.mockResolvedValue(undefined);
    mockRestoreFromCloudBackup.mockResolvedValue('cloud-ciphertext');
    mockPostWalletBackup.mockResolvedValue(undefined);
    mockSignIn.mockResolvedValue('google-access-token');
    mockEncryptMnemonic.mockResolvedValue('encrypted-blob');
  });

  it('does nothing when there is no signed-in user', async () => {
    useAuthStore.setState({ userId: null, accessToken: null });

    await render(<BackupScreen />);
    await reveal();

    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('stays hidden when biometric authentication is denied', async () => {
    mockAuthenticate.mockResolvedValue(false);

    await render(<BackupScreen />);
    await reveal();

    expect(mockGetMnemonic).not.toHaveBeenCalled();
    expect(screen.getByText('Reveal Seed Phrase')).toBeTruthy();
  });

  it('reveals the word grid after successful authentication', async () => {
    await render(<BackupScreen />);
    await reveal();

    await waitFor(() => expect(screen.getByText('alpha')).toBeTruthy());
    expect(screen.getByText('bravo')).toBeTruthy();
    expect(screen.getByText('charlie')).toBeTruthy();
    expect(screen.queryByText('Reveal Seed Phrase')).toBeNull();
  });

  it('shows an error alert when retrieving the mnemonic fails', async () => {
    mockGetMnemonic.mockRejectedValue(new Error('keystore locked'));

    await render(<BackupScreen />);
    await reveal();

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Could not retrieve seed phrase'),
    );
    expect(screen.getByText('Reveal Seed Phrase')).toBeTruthy();
  });

  it('copies the revealed mnemonic to the clipboard', async () => {
    await render(<BackupScreen />);
    await reveal();
    await waitFor(() => expect(screen.getByText('alpha')).toBeTruthy());

    await fireEvent.press(screen.getByText('Copy to Clipboard'));

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(MNEMONIC);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Copied',
      'Seed phrase copied. Store it securely and never share it.',
    );
  });

  it('does not show the passphrase prompt when cloud-backup authorization is denied', async () => {
    Platform.OS = 'ios';
    mockAuthenticate.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await render(<BackupScreen />);
    await reveal();
    await waitFor(() => expect(screen.getByText('alpha')).toBeTruthy());

    await fireEvent.press(screen.getByText('Upload to iCloud'));

    expect(screen.queryByTestId('passphrase-input')).toBeNull();
  });

  it('encrypts and backs up to iCloud on iOS without a Google sign-in', async () => {
    Platform.OS = 'ios';

    await render(<BackupScreen />);
    await reveal();
    await waitFor(() => expect(screen.getByText('alpha')).toBeTruthy());

    await uploadAndEnterPassphrase('Upload to iCloud');

    expect(mockEncryptMnemonic).toHaveBeenCalledWith(MNEMONIC, PASSPHRASE);
    await waitFor(() =>
      expect(mockCreateCloudBackup).toHaveBeenCalledWith('encrypted-blob', 'user@test.com'),
    );
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(mockRestoreFromCloudBackup).toHaveBeenCalledWith('user@test.com', undefined);
    expect(mockPostWalletBackup).toHaveBeenCalledWith('cloud-ciphertext');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Backed Up',
      'Seed phrase backed up to iCloud and our servers.',
    );
  });

  it('encrypts and backs up to Google Drive on Android via Google sign-in', async () => {
    Platform.OS = 'android';

    await render(<BackupScreen />);
    await reveal();
    await waitFor(() => expect(screen.getByText('alpha')).toBeTruthy());

    await uploadAndEnterPassphrase('Upload to Google Drive');

    expect(mockEncryptMnemonic).toHaveBeenCalledWith(MNEMONIC, PASSPHRASE);
    await waitFor(() =>
      expect(mockCreateCloudBackup).toHaveBeenCalledWith(
        'encrypted-blob',
        'user@test.com',
        'google-access-token',
      ),
    );
    expect(mockRestoreFromCloudBackup).toHaveBeenCalledWith(
      'user@test.com',
      'google-access-token',
    );
    expect(mockPostWalletBackup).toHaveBeenCalledWith('cloud-ciphertext');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Backed Up',
      'Seed phrase backed up to Google Drive and our servers.',
    );
  });

  it('stops the Android upload when Google sign-in is cancelled', async () => {
    Platform.OS = 'android';
    mockSignIn.mockResolvedValue(null);

    await render(<BackupScreen />);
    await reveal();
    await waitFor(() => expect(screen.getByText('alpha')).toBeTruthy());

    await uploadAndEnterPassphrase('Upload to Google Drive');

    await waitFor(() => expect(mockSignIn).toHaveBeenCalled());
    expect(mockCreateCloudBackup).not.toHaveBeenCalled();
  });

  it('shows a backup-failed alert when no cloud ciphertext can be read back', async () => {
    Platform.OS = 'ios';
    mockRestoreFromCloudBackup.mockResolvedValue(null);

    await render(<BackupScreen />);
    await reveal();
    await waitFor(() => expect(screen.getByText('alpha')).toBeTruthy());

    await uploadAndEnterPassphrase('Upload to iCloud');

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Backup Failed',
        'Could not read backup ciphertext from cloud storage',
      ),
    );
  });
});
