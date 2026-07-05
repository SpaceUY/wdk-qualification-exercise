import { render } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import SendLayout from '../../app/(wallet)/send/_layout';

describe('SendLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('configures index, scan, and confirm screens', async () => {
    await render(<SendLayout />);

    const screenCalls = (Stack.Screen as unknown as jest.Mock).mock.calls.map(([props]) => props);

    expect(screenCalls).toEqual([
      { name: 'index', options: { title: 'Send' } },
      { name: 'scan', options: { title: 'Scan QR Code', presentation: 'fullScreenModal' } },
      { name: 'confirm', options: { title: 'Confirm' } },
    ]);
  });
});
