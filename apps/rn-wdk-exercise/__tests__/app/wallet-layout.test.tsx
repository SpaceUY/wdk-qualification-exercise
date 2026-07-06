import { render } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import WalletLayout from '../../app/(wallet)/_layout';

describe('WalletLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a Stack with headers hidden', async () => {
    await render(<WalletLayout />);

    expect((Stack as unknown as jest.Mock).mock.calls[0][0]).toEqual(
      expect.objectContaining({ screenOptions: { headerShown: false } }),
    );
  });
});
