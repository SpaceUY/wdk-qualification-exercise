import { render } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import WalletLayout from '../../app/(wallet)/_layout';

describe('WalletLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a Stack with headers hidden and a dark content background', async () => {
    await render(<WalletLayout />);

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

  it('registers the tab group and every pushed flow as Stack screens so navigation animates as a push', async () => {
    await render(<WalletLayout />);

    const screenCalls = (Stack.Screen as unknown as jest.Mock).mock.calls.map((c) => c[0]);
    expect(screenCalls).toEqual([
      { name: '(tabs)' },
      { name: 'send' },
      { name: 'receive' },
      { name: 'wallet-setup' },
      { name: 'cashback' },
      { name: 'settings' },
    ]);
  });
});
