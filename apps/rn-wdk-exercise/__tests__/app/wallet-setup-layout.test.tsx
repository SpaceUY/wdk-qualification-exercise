import { render } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import WalletSetupLayout from '../../app/(wallet)/wallet-setup/_layout';

describe('WalletSetupLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('configures index, backup, restore, and restore-cloud screens', async () => {
    await render(<WalletSetupLayout />);

    const screenCalls = (Stack.Screen as unknown as jest.Mock).mock.calls.map(([props]) => props);

    expect(screenCalls).toEqual([
      { name: 'index', options: { title: 'Wallet Options' } },
      { name: 'backup', options: { title: 'Seed Phrase' } },
      { name: 'restore', options: { title: 'Restore Wallet' } },
      { name: 'restore-cloud', options: { title: 'Restore from Google Drive' } },
    ]);
  });
});
