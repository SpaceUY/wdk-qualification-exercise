import { render } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import CashbackLayout from '../../app/(wallet)/cashback/_layout';

describe('CashbackLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a Stack titled Cashback with headers shown', async () => {
    await render(<CashbackLayout />);

    expect((Stack as unknown as jest.Mock).mock.calls[0][0]).toEqual(
      expect.objectContaining({ screenOptions: { headerShown: true, title: 'Cashback' } }),
    );
  });
});
