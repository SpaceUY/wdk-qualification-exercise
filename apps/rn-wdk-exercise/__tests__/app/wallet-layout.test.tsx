import { render } from '@testing-library/react-native';
import { Tabs } from 'expo-router';
import WalletLayout from '../../app/(wallet)/_layout';

describe('WalletLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Tabs with headers hidden and a custom glass tab bar', async () => {
    await render(<WalletLayout />);

    const props = (Tabs as unknown as jest.Mock).mock.calls[0][0];
    expect(props.screenOptions).toEqual({ headerShown: false });
    expect(typeof props.tabBar).toBe('function');
  });

  it('registers pushed flows with href null so only Home and History are tabs', async () => {
    await render(<WalletLayout />);

    const screenCalls = (Tabs.Screen as unknown as jest.Mock).mock.calls.map((c) => c[0]);
    expect(screenCalls).toEqual([
      { name: 'index' },
      { name: 'history' },
      { name: 'send', options: { href: null } },
      { name: 'receive', options: { href: null } },
      { name: 'wallet-setup', options: { href: null } },
      { name: 'cashback', options: { href: null } },
    ]);
  });
});
