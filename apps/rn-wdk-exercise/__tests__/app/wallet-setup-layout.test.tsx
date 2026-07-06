import { render } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import WalletSetupLayout from '../../app/(wallet)/wallet-setup/_layout';

describe('WalletSetupLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a Stack with headers hidden', async () => {
    await render(<WalletSetupLayout />);

    expect((Stack as unknown as jest.Mock).mock.calls[0][0]).toEqual(
      expect.objectContaining({ screenOptions: { headerShown: false } }),
    );
  });
});
