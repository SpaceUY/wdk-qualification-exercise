import { render } from '@testing-library/react-native';
import { Tabs } from 'expo-router';
import TabsLayout from '../../app/(wallet)/(tabs)/_layout';
import { GlassTabBar } from '../../components/navigation/GlassTabBar';

jest.mock('../../components/navigation/GlassTabBar', () => ({
  GlassTabBar: jest.fn(() => null),
}));

describe('WalletTabsLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Tabs with headers hidden and the glass tab bar wired as the custom tabBar', async () => {
    await render(<TabsLayout />);

    const props = (Tabs as unknown as jest.Mock).mock.calls[0][0];
    expect(props.screenOptions).toEqual({ headerShown: false });

    const navProps = {
      state: { index: 0, routes: [{ key: 'index-key', name: 'index' }] },
      navigation: { navigate: jest.fn(), emit: jest.fn() },
    };
    await render(props.tabBar(navProps));
    expect(GlassTabBar).toHaveBeenCalledWith(expect.objectContaining(navProps), undefined);
  });

  it('registers only Home and History as tabs', async () => {
    await render(<TabsLayout />);

    const screenCalls = (Tabs.Screen as unknown as jest.Mock).mock.calls.map((c) => c[0]);
    expect(screenCalls).toEqual([{ name: 'index' }, { name: 'history' }]);
  });
});
