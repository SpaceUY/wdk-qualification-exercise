import { render } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import SendLayout from '../../app/(wallet)/send/_layout';

describe('SendLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hides headers and presents scan as a full screen modal', async () => {
    await render(<SendLayout />);

    expect((Stack as unknown as jest.Mock).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        screenOptions: expect.objectContaining({
          headerShown: false,
          // Guards against white flashes during push/pop transitions.
          contentStyle: { backgroundColor: '#0C1117' },
        }),
      }),
    );

    const screenCalls = (Stack.Screen as unknown as jest.Mock).mock.calls.map(([props]) => props);

    expect(screenCalls).toEqual([{ name: 'scan', options: { presentation: 'fullScreenModal' } }]);
  });
});
