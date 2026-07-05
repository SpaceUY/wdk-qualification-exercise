import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import RestoreWalletScreen from '../../app/(wallet)/wallet-setup/restore';

const mockValidateMnemonic = jest.fn();
jest.mock('@tetherto/wdk-react-native-core', () => ({
  validateMnemonic: (...args: unknown[]) => mockValidateMnemonic(...args),
}));

const mockRestoreWallet = jest.fn();
jest.mock('../../hooks/useWalletData', () => ({
  useWalletData: () => ({ restoreWallet: mockRestoreWallet }),
}));

const VALID_PHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

async function fillAndSubmit(phrase: string) {
  await fireEvent.changeText(screen.getByPlaceholderText('word1 word2 word3 …'), phrase);
  // "Restore Wallet" appears both as the screen title and the button label.
  await fireEvent.press(screen.getAllByText('Restore Wallet')[1]);
}

describe('RestoreWalletScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    useAuthStore.setState({ userId: 'user@test.com', accessToken: null });
    mockValidateMnemonic.mockReturnValue(true);
  });

  it('rejects a phrase that is not 12 or 24 words', async () => {
    await render(<RestoreWalletScreen />);

    await fillAndSubmit('abandon abandon abandon');

    expect(screen.getByText('Seed phrase must be 12 or 24 words')).toBeTruthy();
    expect(mockRestoreWallet).not.toHaveBeenCalled();
  });

  it('rejects a 12-word phrase that fails mnemonic validation', async () => {
    mockValidateMnemonic.mockReturnValue(false);

    await render(<RestoreWalletScreen />);

    await fillAndSubmit(VALID_PHRASE);

    expect(screen.getByText('Invalid seed phrase — check the words and order')).toBeTruthy();
    expect(mockRestoreWallet).not.toHaveBeenCalled();
  });

  it('normalizes case and whitespace before validating', async () => {
    await render(<RestoreWalletScreen />);

    await fillAndSubmit('  ABANDON  abandon ABANDON abandon abandon abandon abandon abandon abandon abandon abandon ABOUT  ');

    expect(mockValidateMnemonic).toHaveBeenCalledWith(VALID_PHRASE);
  });

  it('restores the wallet and prompts to navigate home on success', async () => {
    mockRestoreWallet.mockResolvedValue(undefined);

    await render(<RestoreWalletScreen />);

    await fillAndSubmit(VALID_PHRASE);

    await waitFor(() =>
      expect(mockRestoreWallet).toHaveBeenCalledWith(VALID_PHRASE, 'user@test.com'),
    );
    expect(Alert.alert).toHaveBeenCalledWith(
      'Wallet Restored',
      'Your wallet has been restored successfully.',
      expect.arrayContaining([expect.objectContaining({ text: 'OK' })]),
    );

    const [, , buttons] = (Alert.alert as jest.Mock).mock.calls[0];
    buttons[0].onPress();

    expect(router.replace).toHaveBeenCalledWith('/(wallet)');
  });

  it('shows the error message when restoreWallet throws an Error', async () => {
    mockRestoreWallet.mockRejectedValue(new Error('Corrupt backup'));

    await render(<RestoreWalletScreen />);

    await fillAndSubmit(VALID_PHRASE);

    await waitFor(() => expect(screen.getByText('Corrupt backup')).toBeTruthy());
  });

  it('shows a generic error message when restoreWallet throws a non-Error value', async () => {
    mockRestoreWallet.mockRejectedValue('boom');

    await render(<RestoreWalletScreen />);

    await fillAndSubmit(VALID_PHRASE);

    await waitFor(() => expect(screen.getByText('Restore failed')).toBeTruthy());
  });
});
