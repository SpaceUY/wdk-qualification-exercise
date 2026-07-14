import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Platform } from 'react-native';
import { toast } from 'sonner-native';
import * as Clipboard from 'expo-clipboard';
import { usePreventScreenCapture } from 'expo-screen-capture';
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

  it('blocks screenshots and screen recording while the screen is mounted', async () => {
    await render(<BackupScreen />);

    expect(usePreventScreenCapture).toHaveBeenCalled();
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

  it('reveals the word grid after successful authentication, with each word masked', async () => {
    await render(<BackupScreen />);
    await reveal();

    await waitFor(() => expect(screen.getByTestId('seed-word-0')).toBeTruthy());
    expect(screen.queryByText('alpha')).toBeNull();
    expect(screen.queryByText('bravo')).toBeNull();
    expect(screen.queryByText('charlie')).toBeNull();
    expect(screen.getAllByText('••••••')).toHaveLength(3);
    expect(screen.queryByText('Reveal Seed Phrase')).toBeNull();
  });

  it('reveals an individual word only after it is tapped', async () => {
    await render(<BackupScreen />);
    await reveal();
    await waitFor(() => expect(screen.getByTestId('seed-word-0')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('seed-word-1'));

    expect(screen.getByText('bravo')).toBeTruthy();
    expect(screen.queryByText('alpha')).toBeNull();
    expect(screen.queryByText('charlie')).toBeNull();
  });

  it('hides a word again when tapped a second time', async () => {
    await render(<BackupScreen />);
    await reveal();
    await waitFor(() => expect(screen.getByTestId('seed-word-0')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('seed-word-1'));
    expect(screen.getByText('bravo')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('seed-word-1'));
    expect(screen.queryByText('bravo')).toBeNull();
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

  it('copies the revealed mnemonic to the clipboard and warns it will auto-clear', async () => {
    await render(<BackupScreen />);
    await reveal();
    await waitFor(() => expect(screen.getByTestId('seed-word-0')).toBeTruthy());

    await fireEvent.press(screen.getByText('Copy to Clipboard'));

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(MNEMONIC);
    expect(toast.warning).toHaveBeenCalledWith('Copied — clears in 60s', {
      description:
        'Other apps can read the clipboard. Paste it into your manager now; it will be cleared automatically.',
    });
  });

  it('clears the clipboard 60s after copying if it still holds the seed', async () => {
    // Uses a setTimeout spy (invoked manually) instead of jest.useFakeTimers(): this file
    // never mocks global timers elsewhere, and toggling fake/real timers mid-suite was
    // observed to corrupt unrelated renders in later tests in this same file (see the
    // equivalent note in dashboard.test.tsx).
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValue(MNEMONIC);

    await render(<BackupScreen />);
    await reveal();
    await waitFor(() => expect(screen.getByTestId('seed-word-0')).toBeTruthy());

    await fireEvent.press(screen.getByText('Copy to Clipboard'));

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(MNEMONIC);
    const scheduled = setTimeoutSpy.mock.calls.find(([, delay]) => delay === 60_000);
    expect(scheduled).toBeDefined();

    await act(async () => {
      (scheduled![0] as () => void)();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(Clipboard.getStringAsync).toHaveBeenCalled();
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('');
  });

  it('does not clear the clipboard if a different value was copied afterward', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValue('something-else');

    await render(<BackupScreen />);
    await reveal();
    await waitFor(() => expect(screen.getByTestId('seed-word-0')).toBeTruthy());

    await fireEvent.press(screen.getByText('Copy to Clipboard'));

    const scheduled = setTimeoutSpy.mock.calls.find(([, delay]) => delay === 60_000);
    expect(scheduled).toBeDefined();

    await act(async () => {
      (scheduled![0] as () => void)();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(Clipboard.getStringAsync).toHaveBeenCalled();
    expect(Clipboard.setStringAsync).not.toHaveBeenCalledWith('');
  });

  it('does not show the passphrase prompt when cloud-backup authorization is denied', async () => {
    Platform.OS = 'ios';
    mockAuthenticate.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await render(<BackupScreen />);
    await reveal();
    await waitFor(() => expect(screen.getByTestId('seed-word-0')).toBeTruthy());

    await fireEvent.press(screen.getByText('Upload to iCloud'));

    expect(screen.queryByTestId('passphrase-input')).toBeNull();
  });

  it('encrypts and backs up to iCloud on iOS without a Google sign-in', async () => {
    Platform.OS = 'ios';

    await render(<BackupScreen />);
    await reveal();
    await waitFor(() => expect(screen.getByTestId('seed-word-0')).toBeTruthy());

    await uploadAndEnterPassphrase('Upload to iCloud');

    expect(mockEncryptMnemonic).toHaveBeenCalledWith(MNEMONIC, PASSPHRASE);
    await waitFor(() =>
      expect(mockCreateCloudBackup).toHaveBeenCalledWith('encrypted-blob', 'user@test.com'),
    );
    expect(mockSignIn).not.toHaveBeenCalled();
    // iOS skips the read-back-from-iCloud verification (iCloud writes are eventually
    // consistent, so re-reading immediately after write is unreliable) — it posts the
    // ciphertext it already has in memory instead.
    expect(mockRestoreFromCloudBackup).not.toHaveBeenCalled();
    expect(mockPostWalletBackup).toHaveBeenCalledWith('encrypted-blob');
    expect(toast.success).toHaveBeenCalledWith('Backed Up', {
      description: 'Seed phrase backed up to iCloud and our servers.',
    });
  });

  it('encrypts and backs up to Google Drive on Android via Google sign-in', async () => {
    Platform.OS = 'android';

    await render(<BackupScreen />);
    await reveal();
    await waitFor(() => expect(screen.getByTestId('seed-word-0')).toBeTruthy());

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
    expect(toast.success).toHaveBeenCalledWith('Backed Up', {
      description: 'Seed phrase backed up to Google Drive and our servers.',
    });
  });

  it('stops the Android upload when Google sign-in is cancelled', async () => {
    Platform.OS = 'android';
    mockSignIn.mockResolvedValue(null);

    await render(<BackupScreen />);
    await reveal();
    await waitFor(() => expect(screen.getByTestId('seed-word-0')).toBeTruthy());

    await uploadAndEnterPassphrase('Upload to Google Drive');

    await waitFor(() => expect(mockSignIn).toHaveBeenCalled());
    expect(mockCreateCloudBackup).not.toHaveBeenCalled();
  });

  it('shows a backup-failed alert when no cloud ciphertext can be read back', async () => {
    // Only Android reads the ciphertext back from cloud storage before posting it — iOS
    // sends the in-memory ciphertext directly (see useSeedBackup.ts) since iCloud writes
    // are eventually consistent and an immediate read-back is unreliable.
    Platform.OS = 'android';
    mockRestoreFromCloudBackup.mockResolvedValue(null);

    await render(<BackupScreen />);
    await reveal();
    await waitFor(() => expect(screen.getByTestId('seed-word-0')).toBeTruthy());

    await uploadAndEnterPassphrase('Upload to Google Drive');

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Backup Failed',
        'Could not read backup ciphertext from cloud storage',
      ),
    );
  });
});
